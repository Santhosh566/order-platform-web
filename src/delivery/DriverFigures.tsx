import { Group, Paper, Rating, SegmentedControl, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { QueryState } from '../components/QueryState'
import { formatDate, formatMoney } from '../lib/format'
import { CompletedChart } from './CompletedChart'
import {
  PERIODS,
  PERIOD_LABELS,
  PERIOD_SHORT,
  PREVIOUS_LABELS,
  change,
  formatRate,
  useStatsHistory,
  type DriverSummary,
  type StatsPeriod,
} from './stats'

/**
 * A driver's figures for a chosen period, with the chart. Drivers see their own (driverId null);
 * admins pass the driver's id.
 */
export function DriverFigures({ summary, driverId }: { summary: DriverSummary; driverId: string | null }) {
  const [period, setPeriod] = useState<StatsPeriod>('WEEK')
  const current = summary.periods[period]
  const f = current.figures
  const history = useStatsHistory(driverId, period)
  const completedChange = change(f.completed, current.previous.completed)

  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label="Period"
        value={period}
        onChange={(v) => setPeriod(v as StatsPeriod)}
        data={PERIODS.map((p) => ({ value: p, label: PERIOD_SHORT[p] }))}
        fullWidth
        maw={420}
      />

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
        <Figure
          label="Completed"
          value={f.completed}
          hint={
            completedChange
              ? `${completedChange.text} vs ${PREVIOUS_LABELS[period]} (${current.previous.completed})`
              : `None ${PREVIOUS_LABELS[period]} either`
          }
          trend={completedChange?.up ?? null}
        />
        <Figure label="Tasks given" value={f.tasks} hint={`${f.delivered} delivered · ${f.pickupsCollected} pickups`} />
        <Figure label="Success rate" value={formatRate(f.successRate)} hint={`${f.failed} failed attempts`} />
        <Figure label="Cash collected" value={formatMoney(f.cashCollected)} hint="Cash on delivery" />
        <Figure label="Earnings" value={formatMoney(f.earnings)} hint="Pay for finished jobs" />
        <Figure
          label="Customer rating"
          value={f.rating === null ? '—' : `${f.rating.toFixed(1)} ★`}
          hint={f.ratingCount === 1 ? '1 rating' : `${f.ratingCount} ratings`}
        />
      </SimpleGrid>

      {summary.feedback.length > 0 && (
        <Paper withBorder radius="md" p="md">
          <Title order={5} mb="xs">
            What customers said
          </Title>
          <Stack gap="xs">
            {summary.feedback.map((c) => (
              <Group key={c.ratedAt + c.comment} gap="sm" wrap="nowrap" align="flex-start">
                <Rating value={c.rating} readOnly size="xs" aria-label={`${c.rating} out of 5`} />
                <Text size="sm">
                  “{c.comment}”{' '}
                  <Text span size="xs" c="dimmed">
                    {formatDate(c.ratedAt)}
                  </Text>
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper withBorder radius="md" p="md">
        <Title order={5} mb="sm">
          Completed {period === 'DAY' ? 'by hour' : period === 'YEAR' ? 'by month' : 'by day'} ·{' '}
          {PERIOD_LABELS[period].toLowerCase()}
        </Title>
        <QueryState query={history}>
          {(h) => <CompletedChart buckets={h.buckets} title={`Completed, ${PERIOD_LABELS[period].toLowerCase()}`} />}
        </QueryState>
      </Paper>
    </Stack>
  )
}

function Figure({
  label,
  value,
  hint,
  trend = null,
}: {
  label: string
  value: number | string
  hint: string
  trend?: boolean | null
}) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} fz="xl" aria-label={label}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </Text>
      <Group gap={4}>
        <Text size="xs" c={trend === null ? 'dimmed' : trend ? 'teal.7' : 'red.7'}>
          {hint}
        </Text>
      </Group>
    </Paper>
  )
}
