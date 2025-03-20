import './RetentionTable.scss'

import { IconChevronDown } from '@posthog/icons'
import clsx from 'clsx'
import { mean, sum } from 'd3'
import { useActions, useValues } from 'kea'
import { IconChevronRight } from 'lib/lemon-ui/icons'
import { Tooltip } from 'lib/lemon-ui/Tooltip'
import { gradateColor, range } from 'lib/utils'
import React from 'react'
import { insightLogic } from 'scenes/insights/insightLogic'

import { themeLogic } from '~/layout/navigation-3000/themeLogic'

import { retentionModalLogic } from './retentionModalLogic'
import { retentionTableLogic } from './retentionTableLogic'
import { NO_BREAKDOWN_VALUE } from './types'

export function RetentionTable({ inSharedMode = false }: { inSharedMode?: boolean }): JSX.Element | null {
    const { insightProps } = useValues(insightLogic)
    const {
        tableRowsSplitByBreakdownValue,
        hideSizeColumn,
        retentionVizOptions,
        theme,
        retentionFilter,
        expandedBreakdowns,
    } = useValues(retentionTableLogic(insightProps))
    const { toggleBreakdown } = useActions(retentionTableLogic(insightProps))
    const { openModal } = useActions(retentionModalLogic(insightProps))
    const backgroundColor = theme?.['preset-1'] || '#000000' // Default to black if no color found
    const backgroundColorMean = theme?.['preset-2'] || '#000000' // Default to black if no color found
    const meanRetentionCalculation = retentionFilter?.meanRetentionCalculation ?? 'weighted'
    const { isDarkModeOn } = useValues(themeLogic)

    const totalIntervals = retentionFilter?.totalIntervals ?? 8

    return (
        <table
            className={clsx('RetentionTable', { 'RetentionTable--small-layout': retentionVizOptions?.useSmallLayout })}
            data-attr="retention-table"
            // eslint-disable-next-line react/forbid-dom-props
            style={
                {
                    '--retention-table-color': backgroundColor,
                } as React.CSSProperties
            }
        >
            <tbody>
                <tr>
                    <th className="bg">Cohort</th>
                    {!hideSizeColumn && <th className="bg">Size</th>}
                    {range(0, totalIntervals).map((interval) => (
                        <th key={interval}>{`${retentionFilter?.period} ${interval}`}</th>
                    ))}
                </tr>

                {Object.entries(tableRowsSplitByBreakdownValue).map(
                    ([breakdownValue, breakdownRows], breakdownIndex) => (
                        <React.Fragment key={breakdownIndex}>
                            <tr
                                onClick={() => toggleBreakdown(breakdownValue)}
                                className={clsx('cursor-pointer', {
                                    'bg-slate-100': !isDarkModeOn && expandedBreakdowns[breakdownValue],
                                })}
                            >
                                <td>
                                    {expandedBreakdowns[breakdownValue] ? <IconChevronDown /> : <IconChevronRight />}
                                    <span className="pl-2">
                                        {breakdownValue === NO_BREAKDOWN_VALUE
                                            ? 'Weighted Mean'
                                            : breakdownValue === null || breakdownValue === ''
                                            ? '(empty)'
                                            : breakdownValue}{' '}
                                    </span>
                                </td>

                                {!hideSizeColumn && <td>{sum(breakdownRows.map((row) => row.cohortSize))}</td>}

                                {range(0, totalIntervals).map((interval) => (
                                    <td key={interval}>
                                        <CohortDay
                                            percentage={
                                                (() => {
                                                    // rows with value for the (completed) interval
                                                    // Also don't include the count if the cohort size (count) is 0 or less
                                                    const validRows = breakdownRows.filter((row) => {
                                                        return !(
                                                            row.values?.[interval]?.isCurrentPeriod ||
                                                            !row.values?.[interval] ||
                                                            row.values?.[interval]?.count <= 0
                                                        )
                                                    })

                                                    if (meanRetentionCalculation === 'weighted') {
                                                        if (validRows.length === 0) {
                                                            return 0
                                                        }

                                                        const weightedSum = sum(
                                                            validRows.map(
                                                                (row) =>
                                                                    (row.values?.[interval]?.percentage || 0) *
                                                                    row.cohortSize
                                                            )
                                                        )
                                                        const totalWeight = sum(validRows.map((row) => row.cohortSize))

                                                        return totalWeight > 0 ? weightedSum / totalWeight : 0
                                                    }
                                                    // default to simple mean

                                                    return (
                                                        mean(
                                                            validRows.map((row) => row.values[interval]?.percentage)
                                                        ) || 0
                                                    )
                                                })() || 0
                                            }
                                            clickable={false}
                                            backgroundColor={backgroundColorMean}
                                        />
                                    </td>
                                ))}
                            </tr>

                            {expandedBreakdowns[breakdownValue] &&
                                breakdownRows.map((row, rowIndex) => (
                                    <tr
                                        key={rowIndex}
                                        onClick={() => {
                                            if (!inSharedMode) {
                                                openModal(rowIndex)
                                            }
                                        }}
                                        className={clsx({ 'bg-slate-100': !isDarkModeOn })}
                                    >
                                        <td className="pl-6">{row.label}</td>
                                        {!hideSizeColumn && (
                                            <td>
                                                <span className="RetentionTable__TextTab">{row.cohortSize}</span>
                                            </td>
                                        )}
                                        {row.values.map((column, columnIndex) => (
                                            <td key={columnIndex}>
                                                <CohortDay
                                                    percentage={column.percentage}
                                                    clickable={true}
                                                    isCurrentPeriod={column.isCurrentPeriod}
                                                    backgroundColor={backgroundColor}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                        </React.Fragment>
                    )
                )}
            </tbody>
        </table>
    )
}

function CohortDay({
    percentage,
    clickable,
    backgroundColor,
    isCurrentPeriod,
}: {
    percentage: number
    clickable: boolean
    backgroundColor: string
    isCurrentPeriod?: boolean
}): JSX.Element {
    const backgroundColorSaturation = percentage / 100
    const saturatedBackgroundColor = gradateColor(backgroundColor, backgroundColorSaturation, 0.1)
    const textColor = backgroundColorSaturation > 0.4 ? '#fff' : 'var(--text-3000)' // Ensure text contrast

    const numberCell = (
        <div
            className={clsx('RetentionTable__Tab', {
                'RetentionTable__Tab--clickable': clickable,
                'RetentionTable__Tab--period': isCurrentPeriod,
            })}
            // eslint-disable-next-line react/forbid-dom-props
            style={!isCurrentPeriod ? { backgroundColor: saturatedBackgroundColor, color: textColor } : undefined}
        >
            {percentage.toFixed(1)}%
        </div>
    )
    return isCurrentPeriod ? <Tooltip title="Period in progress">{numberCell}</Tooltip> : numberCell
}
