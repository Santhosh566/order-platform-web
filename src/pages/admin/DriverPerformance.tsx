import { Anchor, Group, Modal, Paper, SegmentedControl, Table, Text, Title, UnstyledButton } from '@mantine/core'
import { IconArrowsSort, IconSortDescending } from '@tabler/icons-react'
import { useState } from 'react'
import { QueryState } from '../../components/QueryState'
import { DriverFigures } from '../../delivery/DriverFigures'
import {
  PERIODS,
  PERIOD_LABELS,
  formatRate,
  useDriverStats,
  useLeaderboard,
  type DriverFigures as Figures,
  type LeaderboardRow,
  type StatsPeriod,
} from '../../delivery/stats'
import { formatMoney } from '../../lib/format'

type SortKey = 'completed' | 'failed' | 'successRate' | 'cashCollected' | 'tasks' | 'rating' | 'earnings'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'failed', label: 'Failed' },
  { key: 'successRate', label: 'Success rate' },
  { key: 'rating', label: 'Rating' },
  { key: 'cashCollected', label: 'Cash collected' },
  { key: 'earnings', label: 'Earnings' },
]

/** Every driver's work in a period, sortable; a name opens that driver's figures and chart. */
export function DriverPerformance() {
  const [period, setPeriod] = useState<StatsPeriod>('MONTH')
  const [sort, setSort] = useState<SortKey>('completed')
  const [open, setOpen] = useState<LeaderboardRow | null>(null)
  const board = useLeaderboard(period)

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Driver performance</Title>
        <SegmentedControl
          aria-label="Period"
          size="xs"
          value={period}
          onChange={(v) => setPeriod(v as StatsPeriod)}
          data={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
        />
      </Group>
      <QueryState query={board}>
        {(b) =>
          b.drivers.length === 0 ? (
            <Text c="dimmed" size="sm">
              No active delivery users.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={760}>
              <Table striped highlightOnHover aria-label="Driver performance">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Driver</Table.Th>
                    {COLUMNS.map((c) => (
                      <Table.Th key={c.key} ta="right" aria-sort={sort === c.key ? 'descending' : undefined}>
                        <UnstyledButton onClick={() => setSort(c.key)} fz="sm" fw={700}>
                          <Group gap={4} wrap="nowrap" justify="flex-end">
                            {c.label}
                            {sort === c.key ? <IconSortDescending size={14} /> : <IconArrowsSort size={14} opacity={0.4} />}
                          </Group>
                        </UnstyledButton>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sorted(b.drivers, sort).map((d) => (
                    <Table.Tr key={d.driverId}>
                      <Table.Td>
                        <Anchor component="button" type="button" size="sm" onClick={() => setOpen(d)}>
                          {d.driverName}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          {d.driverId}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">{d.figures.completed}</Table.Td>
                      <Table.Td ta="right">{d.figures.tasks}</Table.Td>
                      <Table.Td ta="right">{d.figures.failed}</Table.Td>
                      <Table.Td ta="right">{formatRate(d.figures.successRate)}</Table.Td>
                      <Table.Td ta="right">
                        {d.figures.rating === null ? '—' : `${d.figures.rating.toFixed(1)} ★ (${d.figures.ratingCount})`}
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(d.figures.cashCollected)}</Table.Td>
                      <Table.Td ta="right">{formatMoney(d.figures.earnings)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        }
      </QueryState>
      <Modal opened={open !== null} onClose={() => setOpen(null)} title={open?.driverName} size="xl">
        {open && <DriverDetail driverId={open.driverId} />}
      </Modal>
    </Paper>
  )
}

function DriverDetail({ driverId }: { driverId: string }) {
  const stats = useDriverStats(driverId)
  return <QueryState query={stats}>{(s) => <DriverFigures summary={s} driverId={driverId} />}</QueryState>
}

function sorted(rows: LeaderboardRow[], key: SortKey): LeaderboardRow[] {
  const value = (f: Figures) =>
    key === 'successRate' ? (f.successRate ?? -1) : key === 'rating' ? (f.rating ?? -1) : Number(f[key])
  return [...rows].sort((a, b) => value(b.figures) - value(a.figures) || a.driverName.localeCompare(b.driverName))
}
