import xml.etree.ElementTree as ET
from functools import cached_property
from typing import Generic, Optional, TypeVar
from uuid import uuid4

from langchain_core.agents import AgentAction
from langchain_core.messages import (
    AIMessage as LangchainAssistantMessage,
    BaseMessage,
    merge_message_runs,
)
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from ee.hogai.schema_generator.parsers import (
    PydanticOutputParserException,
    parse_pydantic_structured_output,
)
from ee.hogai.schema_generator.prompts import (
    FAILOVER_OUTPUT_PROMPT,
    FAILOVER_PROMPT,
    GROUP_MAPPING_PROMPT,
    NEW_PLAN_PROMPT,
    PLAN_PROMPT,
    QUESTION_PROMPT,
)
from ee.hogai.schema_generator.utils import SchemaGeneratorOutput
from ee.hogai.utils.helpers import find_start_message
from ee.hogai.utils.nodes import AssistantNode
from ee.hogai.utils.types import AssistantState, PartialAssistantState
from posthog.models.group_type_mapping import GroupTypeMapping
from posthog.schema import (
    FailureMessage,
    VisualizationMessage,
)

Q = TypeVar("Q", bound=BaseModel)


class SchemaGeneratorNode(AssistantNode, Generic[Q]):
    INSIGHT_NAME: str
    """
    Name of the insight type used in the exception messages.
    """
    OUTPUT_MODEL: type[SchemaGeneratorOutput[Q]]
    """Pydantic model of the output to be generated by the LLM."""
    OUTPUT_SCHEMA: dict
    """JSON schema of OUTPUT_MODEL for LLM's use."""

    @property
    def _model(self):
        return ChatOpenAI(model="gpt-4o", temperature=0, disable_streaming=True).with_structured_output(
            self.OUTPUT_SCHEMA,
            method="function_calling",
            include_raw=False,
        )

    @classmethod
    def _parse_output(cls, output: dict) -> SchemaGeneratorOutput[Q]:
        return parse_pydantic_structured_output(cls.OUTPUT_MODEL)(output)

    def _run_with_prompt(
        self,
        state: AssistantState,
        prompt: ChatPromptTemplate,
        config: Optional[RunnableConfig] = None,
    ) -> PartialAssistantState:
        start_id = state.start_id
        generated_plan = state.plan or ""
        intermediate_steps = state.intermediate_steps or []
        validation_error_message = intermediate_steps[-1][1] if intermediate_steps else None

        generation_prompt = prompt + self._construct_messages(state, validation_error_message=validation_error_message)
        merger = merge_message_runs()

        chain = generation_prompt | merger | self._model | self._parse_output

        try:
            message: SchemaGeneratorOutput[Q] = chain.invoke(
                {
                    "project_datetime": self.project_now,
                    "project_timezone": self.project_timezone,
                    "project_name": self._team.name,
                },
                config,
            )
        except PydanticOutputParserException as e:
            # Generation step is expensive. After a second unsuccessful attempt, it's better to send a failure message.
            if len(intermediate_steps) >= 2:
                return PartialAssistantState(
                    messages=[
                        FailureMessage(
                            content=f"Oops! It looks like I’m having trouble generating this {self.INSIGHT_NAME} insight. Could you please try again?"
                        )
                    ],
                    intermediate_steps=[],
                    plan="",
                )

            return PartialAssistantState(
                intermediate_steps=[
                    *intermediate_steps,
                    (AgentAction("handle_incorrect_response", e.llm_output, e.validation_message), None),
                ],
            )

        final_message = VisualizationMessage(
            query=self._get_insight_plan(state),
            plan=generated_plan,
            answer=message.query,
            initiator=start_id,
            id=str(uuid4()),
        )

        return PartialAssistantState(
            messages=[final_message],
            intermediate_steps=[],
            plan="",
        )

    def router(self, state: AssistantState):
        if state.intermediate_steps:
            return "tools"
        return "next"

    @cached_property
    def _group_mapping_prompt(self) -> str:
        groups = GroupTypeMapping.objects.filter(project_id=self._team.project_id).order_by("group_type_index")
        if not groups:
            return "The user has not defined any groups."

        root = ET.Element("list of defined groups")
        root.text = (
            "\n" + "\n".join([f'name "{group.group_type}", index {group.group_type_index}' for group in groups]) + "\n"
        )
        return ET.tostring(root, encoding="unicode")

    def _construct_messages(
        self, state: AssistantState, validation_error_message: Optional[str] = None
    ) -> list[BaseMessage]:
        """
        Reconstruct the conversation for the generation. Take all previously generated questions, plans, and schemas, and return the history.
        """
        # Only process the last five visualization messages.
        messages = [message for message in state.messages if isinstance(message, VisualizationMessage)][-5:]
        generated_plan = state.plan

        # Add the group mapping prompt to the beginning of the conversation.
        conversation: list[BaseMessage] = [
            HumanMessagePromptTemplate.from_template(GROUP_MAPPING_PROMPT, template_format="mustache").format(
                group_mapping=self._group_mapping_prompt
            )
        ]

        for message in messages:
            # Plans go first.
            conversation.append(
                HumanMessagePromptTemplate.from_template(PLAN_PROMPT, template_format="mustache").format(
                    plan=message.plan or ""
                )
            )
            # Then questions.
            conversation.append(
                HumanMessagePromptTemplate.from_template(QUESTION_PROMPT, template_format="mustache").format(
                    question=message.query or ""
                )
            )
            # Then the answer.
            if message.answer:
                conversation.append(LangchainAssistantMessage(content=message.answer.model_dump_json()))

        # Add the initiator message and the generated plan to the end, so instructions are clear.
        if generated_plan:
            prompt = NEW_PLAN_PROMPT if messages else PLAN_PROMPT
            conversation.append(
                HumanMessagePromptTemplate.from_template(prompt, template_format="mustache").format(
                    plan=generated_plan or ""
                )
            )
        conversation.append(
            HumanMessagePromptTemplate.from_template(QUESTION_PROMPT, template_format="mustache").format(
                question=self._get_insight_plan(state)
            )
        )

        # Retries must be added to the end of the conversation.
        if validation_error_message:
            conversation.append(
                HumanMessagePromptTemplate.from_template(FAILOVER_PROMPT, template_format="mustache").format(
                    validation_error_message=validation_error_message
                )
            )

        return conversation

    def _get_insight_plan(self, state: AssistantState) -> str:
        if state.root_tool_insight_plan:
            return state.root_tool_insight_plan
        start_message = find_start_message(state.messages, state.start_id)
        if start_message:
            return start_message.content
        return ""


class SchemaGeneratorToolsNode(AssistantNode):
    """
    Used for failover from generation errors.
    """

    def run(self, state: AssistantState, config: RunnableConfig) -> PartialAssistantState:
        intermediate_steps = state.intermediate_steps or []
        if not intermediate_steps:
            return PartialAssistantState()

        action, _ = intermediate_steps[-1]
        prompt = (
            ChatPromptTemplate.from_template(FAILOVER_OUTPUT_PROMPT, template_format="mustache")
            .format_messages(output=action.tool_input, exception_message=action.log)[0]
            .content
        )

        return PartialAssistantState(
            intermediate_steps=[
                *intermediate_steps[:-1],
                (action, str(prompt)),
            ]
        )
