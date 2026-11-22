import { Anchor, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { QueryState } from '../components/QueryState'
import { shortOrderId } from '../lib/orderStatus'
import { ago, useDriversOnRoad } from './queries'
import type { MapPoint } from './TrackingMap'

const TrackingMap = lazy(() => import('./TrackingMap'))

/** The admin's view of every driver out for delivery and where each was last seen. */
export function DriversOnRoadMap() {
  const drivers = useDriversOnRoad()
  return (
    <Paper withBorder radius="md" p="md" aria-label="Drivers on the road">
      <Title order={4} mb="sm">
        Drivers on the road
      </Title>
      <QueryState query={drivers}>
        {(rows) => {
          if (rows.length === 0) {
            return (
              <Text c="dimmed" size="sm">
                No driver is out for delivery right now.
              </Text>
            )
          }
          const points: MapPoint[] = rows.flatMap((d) =>
            d.position ? [{ ...d.position, kind: 'driver' as const, label: d.name, stale: d.position.stale }] : [],
          )
          return (
            <Stack gap="sm">
              {points.length > 0 && (
                <Suspense fallback={<Loader size="sm" />}>
                  <TrackingMap points={points} height={320} />
                </Suspense>
              )}
              {rows.map((d) => (
                <Group key={d.driverId} justify="space-between" wrap="wrap" gap="xs">
                  <Text size="sm" fw={500}>
                    {d.name}
                  </Text>
                  <Text size="sm" c={d.position?.stale || !d.position ? 'dimmed' : undefined}>
                    {d.position ? `Seen ${ago(d.position.recordedAt)}` : 'No location yet'} ·{' '}
                    {d.orderIds.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(id)}`} size="sm">
                          {shortOrderId(id)}
                        </Anchor>
                      </span>
                    ))}
                  </Text>
                </Group>
              ))}
            </Stack>
          )
        }}
      </QueryState>
    </Paper>
  )
}
