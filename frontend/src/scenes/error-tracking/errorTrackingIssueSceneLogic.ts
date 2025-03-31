import { actions, connect, defaults, kea, key, listeners, path, props, reducers, selectors } from 'kea'
import { loaders } from 'kea-loaders'
import { router } from 'kea-router'
import api from 'lib/api'
import { Dayjs, dayjs } from 'lib/dayjs'
import { posthog } from 'posthog-js'
import { Scene } from 'scenes/sceneTypes'
import { urls } from 'scenes/urls'

import { SIDE_PANEL_CONTEXT_KEY, SidePanelSceneContext } from '~/layout/navigation-3000/sidepanel/types'
import {
    DateRange,
    ErrorTrackingIssue,
    ErrorTrackingIssueAggregations,
    ErrorTrackingIssueAssignee,
    ErrorTrackingRelationalIssue,
} from '~/queries/schema/schema-general'
import { ActivityScope, Breadcrumb } from '~/types'

import type { errorTrackingIssueSceneLogicType } from './errorTrackingIssueSceneLogicType'
import { errorTrackingLogic } from './errorTrackingLogic'
import { errorTrackingIssueEventsQuery, errorTrackingIssueQuery } from './queries'
import { resolveDateRange } from './utils'

export interface ErrorTrackingIssueSceneLogicProps {
    id: ErrorTrackingIssue['id']
    fingerprint?: string
}

export type ErrorTrackingIssueStatus = ErrorTrackingIssue['status']

export const errorTrackingIssueSceneLogic = kea<errorTrackingIssueSceneLogicType>([
    path((key) => ['scenes', 'error-tracking', 'errorTrackingIssueSceneLogic', key]),
    props({} as ErrorTrackingIssueSceneLogicProps),
    key((props) => props.id),

    connect({
        values: [errorTrackingLogic, ['dateRange', 'filterTestAccounts', 'filterGroup']],
        actions: [errorTrackingLogic, ['setDateRange', 'setFilterTestAccounts', 'setFilterGroup']],
    }),

    actions({
        loadIssue: true,
        loadProperties: (dateRange: DateRange) => ({ dateRange }),
        loadSummary: (dateRange: DateRange) => ({ dateRange }),
        setIssue: (issue: ErrorTrackingRelationalIssue) => ({ issue }),
        updateStatus: (status: ErrorTrackingIssueStatus) => ({ status }),
        updateAssignee: (assignee: ErrorTrackingIssueAssignee | null) => ({ assignee }),
    }),

    defaults({
        issue: null as ErrorTrackingRelationalIssue | null,
        properties: {} as Record<string, string>,
        summary: null as ErrorTrackingIssueSummary | null,
    }),

    reducers({
        issue: {
            setIssue: (_, { issue }: { issue: ErrorTrackingRelationalIssue }) => issue,
            updateAssignee: (state, { assignee }) => {
                return state ? { ...state, assignee } : null
            },
            updateStatus: (state, { status }) => {
                return state ? { ...state, status } : null
            },
        },
        summary: {},
    }),

    selectors({
        breadcrumbs: [
            (s) => [s.issue],
            (issue: ErrorTrackingRelationalIssue | null): Breadcrumb[] => {
                const exceptionType: string = issue?.name || 'Issue'
                return [
                    {
                        key: Scene.ErrorTracking,
                        name: 'Error tracking',
                        path: urls.errorTracking(),
                    },
                    {
                        key: [Scene.ErrorTrackingIssue, exceptionType],
                        name: exceptionType,
                    },
                ]
            },
        ],

        [SIDE_PANEL_CONTEXT_KEY]: [
            (_, p) => [p.id],
            (issueId): SidePanelSceneContext => {
                return {
                    activity_scope: ActivityScope.ERROR_TRACKING_ISSUE,
                    activity_item_id: issueId,
                }
            },
        ],

        eventsQuery: [
            (s) => [(_, props) => props.id, s.filterTestAccounts, s.filterGroup, s.dateRange],
            (issueId, filterTestAccounts, filterGroup, dateRange) =>
                errorTrackingIssueEventsQuery({
                    issueId,
                    filterTestAccounts: filterTestAccounts,
                    filterGroup: filterGroup,
                    dateRange: resolveDateRange(dateRange).toDateRange(),
                }),
        ],

        issueDateRange: [(s) => [s.issue], (issue) => (issue ? getIssueDateRange(issue) : {})],

        firstSeen: [
            (s) => [s.issue],
            (issue: ErrorTrackingRelationalIssue | null) => (issue ? dayjs(issue.first_seen) : null),
        ],

        lastSeen: [(s) => [s.summary], (summary: ErrorTrackingIssueSummary | null) => summary?.lastSeen],
        aggregations: [(s) => [s.summary], (summary: ErrorTrackingIssueSummary | null) => summary?.aggregations],
    }),

    loaders(({ props }) => ({
        issue: {
            loadIssue: async () => await api.errorTracking.getIssue(props.id, props.fingerprint),
        },
        properties: {
            loadProperties: async ({ dateRange }) => {
                const response = await api.query(
                    errorTrackingIssueQuery({
                        issueId: props.id,
                        dateRange,
                        volumeResolution: 0,
                    }),
                    {},
                    undefined,
                    'blocking'
                )
                const issue = response.results[0]
                // Earliest field should be defined as we use the issueId parameter
                return JSON.parse(issue.earliest!)
            },
        },
        summary: {
            loadSummary: async ({ dateRange }) => {
                const response = await api.query(
                    errorTrackingIssueQuery({
                        issueId: props.id,
                        dateRange,
                        volumeResolution: 40,
                    }),
                    {},
                    undefined,
                    'blocking'
                )
                const summary = response.results[0]
                return {
                    lastSeen: dayjs(summary.last_seen),
                    aggregations: summary.aggregations,
                } as ErrorTrackingIssueSummary
            },
        },
    })),

    listeners(({ props, actions }) => {
        return {
            loadIssueSuccess: [
                ({ issue }) => actions.loadProperties(getPropertiesDateRange(issue)),
                ({ issue }) => actions.loadSummary(getIssueDateRange(issue)),
            ],
            loadIssueFailure: ({ errorObject: { status, data } }) => {
                if (status == 308 && 'issue_id' in data) {
                    router.actions.replace(urls.errorTrackingIssue(data.issue_id))
                }
            },
            updateStatus: async ({ status }) => {
                posthog.capture('error_tracking_issue_status_updated', { status, issue_id: props.id })
                await api.errorTracking.updateIssue(props.id, { status })
            },
            updateAssignee: async ({ assignee }) => {
                posthog.capture('error_tracking_issue_assigned', { issue_id: props.id })
                await api.errorTracking.assignIssue(props.id, assignee)
            },
        }
    }),
])

function getIssueDateRange(issue: ErrorTrackingRelationalIssue): DateRange {
    return {
        date_from: dayjs(issue.first_seen).startOf('day').toISOString(),
        date_to: dayjs().endOf('minute').toISOString(),
    }
}

function getPropertiesDateRange(issue: ErrorTrackingRelationalIssue): DateRange {
    const firstSeen = dayjs(issue.first_seen)
    return {
        date_from: firstSeen.startOf('minute').toISOString(),
        date_to: firstSeen.endOf('minute').toISOString(),
    }
}

export type ErrorTrackingIssueSummary = {
    lastSeen: Dayjs
    aggregations: ErrorTrackingIssueAggregations
}
