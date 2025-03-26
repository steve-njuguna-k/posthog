from django.contrib import admin

from posthog.admin.admins import (
    OrganizationAdmin,
    UserAdmin,
    TeamAdmin,
    DashboardAdmin,
    DashboardTemplateAdmin,
    DataColorThemeAdmin,
    InsightAdmin,
    ExperimentAdmin,
    ExperimentSavedMetricAdmin,
    FeatureFlagAdmin,
    AsyncDeletionAdmin,
    InstanceSettingAdmin,
    PluginConfigAdmin,
    PluginAdmin,
    TextAdmin,
    CohortAdmin,
    PersonAdmin,
    PersonDistinctIdAdmin,
    SurveyAdmin,
    DataWarehouseTableAdmin,
    ProjectAdmin,
    HogFunctionAdmin,
    GroupTypeMappingAdmin,
)
from posthog.models import (
    Organization,
    User,
    Team,
    Dashboard,
    DashboardTemplate,
    Insight,
    Experiment,
    ExperimentSavedMetric,
    DataColorTheme,
    FeatureFlag,
    AsyncDeletion,
    InstanceSetting,
    PluginConfig,
    Plugin,
    Text,
    Project,
    Cohort,
    Person,
    PersonDistinctId,
    Survey,
    DataWarehouseTable,
    HogFunction,
    GroupTypeMapping,
)

admin.site.register(Organization, OrganizationAdmin)
admin.site.register(Project, ProjectAdmin)
admin.site.register(Team, TeamAdmin)
admin.site.register(User, UserAdmin)

admin.site.register(Dashboard, DashboardAdmin)
admin.site.register(DashboardTemplate, DashboardTemplateAdmin)
admin.site.register(Insight, InsightAdmin)
admin.site.register(GroupTypeMapping, GroupTypeMappingAdmin)
admin.site.register(DataColorTheme, DataColorThemeAdmin)

admin.site.register(Experiment, ExperimentAdmin)
admin.site.register(ExperimentSavedMetric, ExperimentSavedMetricAdmin)
admin.site.register(FeatureFlag, FeatureFlagAdmin)

admin.site.register(AsyncDeletion, AsyncDeletionAdmin)
admin.site.register(InstanceSetting, InstanceSettingAdmin)
admin.site.register(PluginConfig, PluginConfigAdmin)
admin.site.register(Plugin, PluginAdmin)
admin.site.register(Text, TextAdmin)

admin.site.register(Cohort, CohortAdmin)
admin.site.register(Person, PersonAdmin)
admin.site.register(PersonDistinctId, PersonDistinctIdAdmin)

admin.site.register(Survey, SurveyAdmin)

admin.site.register(DataWarehouseTable, DataWarehouseTableAdmin)
admin.site.register(HogFunction, HogFunctionAdmin)
