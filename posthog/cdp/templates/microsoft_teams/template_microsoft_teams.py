from posthog.cdp.templates.hog_function_template import HogFunctionTemplate, HogFunctionSubTemplate, SUB_TEMPLATE_COMMON


template: HogFunctionTemplate = HogFunctionTemplate(
    status="stable",
    free=True,
    type="destination",
    id="template-microsoft-teams",
    name="Microsoft Teams",
    description="Sends a message to a Microsoft Teams channel",
    icon_url="/static/services/microsoft-teams.png",
    category=["Customer Success"],
    hog="""
if (not match(inputs.webhookUrl, '^https://[^/]+.logic.azure.com:443/workflows/[^/]+/triggers/manual/paths/invoke?.*')) {
    throw Error('Invalid URL. The URL should match the format: https://<region>.logic.azure.com:443/workflows/<workflowId>/triggers/manual/paths/invoke?...')
}

let res := fetch(inputs.webhookUrl, {
    'body': {
        'type': 'message',
        'attachments': [
            {
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'contentUrl': null,
                'content': {
                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                    'type': 'AdaptiveCard',
                    'version': '1.2',
                    'body': [
                        {
                            'type': 'TextBlock',
                            'text': inputs.text,
                            'wrap': true
                        }
                    ]
                }
            }
        ]
    },
    'method': 'POST',
    'headers': {
        'Content-Type': 'application/json'
    }
});

if (res.status >= 400) {
    throw Error(f'Failed to post message to Microsoft Teams: {res.status}: {res.body}');
}
""".strip(),
    inputs_schema=[
        {
            "key": "webhookUrl",
            "type": "string",
            "label": "Webhook URL",
            "description": "See this page on how to generate a Webhook URL: https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498",
            "secret": False,
            "required": True,
        },
        {
            "key": "text",
            "type": "string",
            "label": "Text",
            "description": "(see https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook?tabs=newteams%2Cdotnet#example)",
            "default": "**{person.name}** triggered event: '{event.event}'",
            "secret": False,
            "required": True,
        },
    ],
    sub_templates=[
        HogFunctionSubTemplate(
            id="early-access-feature-enrollment",
            name="Post to Microsoft Teams on feature enrollment",
            description="Posts a message to Microsoft Teams when a user enrolls or un-enrolls in an early access feature",
            filters=SUB_TEMPLATE_COMMON["early-access-feature-enrollment"].filters,
            input_schema_overrides={
                "text": {
                    "default": "**{person.name}** {event.properties.$feature_enrollment ? 'enrolled in' : 'un-enrolled from'} the early access feature for '{event.properties.$feature_flag}'",
                }
            },
        ),
        HogFunctionSubTemplate(
            id="survey-response",
            name="Post to Microsoft Teams on survey response",
            description="Posts a message to Microsoft Teams when a user responds to a survey",
            filters=SUB_TEMPLATE_COMMON["survey-response"].filters,
            input_schema_overrides={
                "text": {
                    "default": "**{person.name}** responded to survey **{event.properties.$survey_name}**",
                }
            },
        ),
        HogFunctionSubTemplate(
            id="activity-log",
            type="internal_destination",
            name="Post to Microsoft Teams on team activity",
            filters=SUB_TEMPLATE_COMMON["activity-log"].filters,
            input_schema_overrides={
                "text": {
                    "default": "**{person.name}** {event.properties.activity} {event.properties.scope} {event.properties.item_id}",
                }
            },
        ),
        HogFunctionSubTemplate(
            name="Post to Teams on issue created",
            description="Post to a Microsoft Teams channel when an issue is created",
            id=SUB_TEMPLATE_COMMON["error-tracking-issue-created"].id,
            type=SUB_TEMPLATE_COMMON["error-tracking-issue-created"].type,
            filters=SUB_TEMPLATE_COMMON["error-tracking-issue-created"].filters,
            input_schema_overrides={
                "text": {
                    "default": "**🔴 {event.properties.name} created:** {event.properties.description} (View in [Posthog]({project.url}/error_tracking/{event.distinct_id}))",
                    "hidden": True,
                }
            },
        ),
        HogFunctionSubTemplate(
            name="Post to Teams on issue reopened",
            description="Post to a Microsoft Teams channel when an issue is reopened",
            id=SUB_TEMPLATE_COMMON["error-tracking-issue-reopened"].id,
            type=SUB_TEMPLATE_COMMON["error-tracking-issue-reopened"].type,
            filters=SUB_TEMPLATE_COMMON["error-tracking-issue-reopened"].filters,
            input_schema_overrides={
                "text": {
                    "default": "**🔄 {event.properties.name} reopened:** {event.properties.description}",
                    "hidden": True,
                }
            },
        ),
    ],
)
