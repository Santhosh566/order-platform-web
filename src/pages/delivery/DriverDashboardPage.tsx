import { Anchor, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { QueryState } from '../../components/QueryState'
import { DriverFigures } from '../../delivery/DriverFigures'
import { formatRate, useMyStats } from '../../delivery/stats'
import { formatMoney } from '../../lib/format'

/** The driver's own day at a glance, then their week, month or year. */
export function DriverDashboardPage() {
  const stats = useMyStats()

  return (
    <Stack gap="lg">
      <Title order={2}>My dashboard</Title>
      <QueryState query={stats}>
        {(s) => {
          const today = s.periods.DAY.figures
          const open = s.openNow.deliveries + s.openNow.pickups
          return (
            <>
              <Paper withBorder radius="md" p="md">
                <Title order={4} mb="sm">
                  Today
                </Title>
                <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
                  <Today label="To do now" value={open}>
                    <Anchor component={Link} to="/delivery/mine" size="xs">
                      {s.openNow.deliveries} deliveries · {s.openNow.pickups} pickups
                    </Anchor>
                  </Today>
                  <Today label="Delivered today" value={today.delivered} />
                  <Today label="Pickups collected today" value={today.pickupsCollected} />
                  <Today label="Failed today" value={today.failed}>
                    <Text size="xs" c="dimmed">
                      Success rate {formatRate(today.successRate)}
                    </Text>
                  </Today>
                  <Today label="Earned today" value={formatMoney(today.earnings)} />
                  <Today label="Cash collected today" value={formatMoney(today.cashCollected)}>
                    <Text size="xs" c="dimmed">
                      Hand it in at the hub
                    </Text>
                  </Today>
                </SimpleGrid>
              </Paper>
              <DriverFigures summary={s} driverId={null} />
            </>
          )
        }}
      </QueryState>
    </Stack>
  )
}

function Today({ label, value, children }: { label: string; value: number | string; children?: ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Group gap={4}>
        <Text fw={700} fz={26} aria-label={label}>
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </Text>
      </Group>
      {children}
    </Stack>
  )
}
