import { Alert, Avatar, Badge, Box, Divider, Grid, Group, Loader, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconClock, IconHome, IconMapPin, IconRoute, IconScooter } from '@tabler/icons-react'
import { lazy, Suspense, type ReactNode } from 'react'
import type { OrderStatus } from '../api/types'
import { ago, useTracking, type Tracking } from './queries'
import type { MapPoint } from './TrackingMap'

const TrackingMap = lazy(() => import('./TrackingMap'))

/**
 * The customer's view while their parcel is out for delivery: when it should arrive, who is bringing it, and a map.
 * Full width at the top of the order page; nothing before the order is out or after it is delivered.
 */
export function LiveTrackingCard({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const tracking = useTracking(orderId, status)
  if (status !== 'OUT_FOR_DELIVERY' || !tracking.data?.live) return null
  return <TrackingView tracking={tracking.data} />
}

export function TrackingView({ tracking }: { tracking: Tracking }) {
  const { driver, destination } = tracking
  const name = tracking.driverName ?? 'Your driver'
  const points: MapPoint[] = []
  if (driver) points.push({ ...driver, kind: 'driver', label: name, stale: driver.stale })
  if (destination) {
    points.push({
      ...destination,
      kind: 'destination',
      label: destination.approximate ? 'Your area' : 'You',
      areaRadiusM: destination.approximate ? destination.areaRadiusM : undefined,
    })
  }
  const arrivesAt = tracking.etaAt
    ? new Date(tracking.etaAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <Paper withBorder radius="md" p={0} aria-label="Live tracking" style={{ overflow: 'hidden' }}>
      <Grid gap={0}>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md" p="lg" h="100%">
            <Group justify="space-between" wrap="nowrap">
              <Group gap={6}>
                <IconMapPin size={18} />
                <Title order={5}>Live tracking</Title>
              </Group>
              {driver ? (
                <Badge variant="dot" color={driver.stale ? 'gray' : 'green'}>
                  {driver.stale ? `Last seen ${ago(driver.recordedAt)}` : `Updated ${ago(driver.recordedAt)}`}
                </Badge>
              ) : (
                <Badge variant="dot" color="gray">
                  Waiting for location
                </Badge>
              )}
            </Group>

            {tracking.etaMinutes != null ? (
              <div>
                <Text size="sm" c="dimmed">
                  Arriving in about
                </Text>
                <Text fz={36} fw={800} lh={1.1}>
                  {tracking.etaMinutes} min
                </Text>
                {arrivesAt && (
                  <Text size="sm" c="dimmed">
                    around {arrivesAt}
                  </Text>
                )}
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                {tracking.message}
              </Text>
            )}

            {tracking.inYourArea && (
              <Alert color="green" variant="light" p="xs" title={`${name} is in your area`}>
                Keep your phone nearby and the delivery code ready.
              </Alert>
            )}
            {tracking.etaMinutes != null && tracking.message && (
              <Text size="sm" c="dimmed">
                {tracking.message}
              </Text>
            )}

            <Divider />
            <Group gap="sm" wrap="nowrap">
              <Avatar color="blue" radius="xl">
                <IconScooter size={20} />
              </Avatar>
              <div>
                <Text size="sm" fw={600}>
                  {name}
                </Text>
                <Text size="xs" c="dimmed">
                  is bringing your order
                </Text>
              </div>
            </Group>
            {tracking.distanceKm != null && (
              <Fact icon={<IconRoute size={16} />}>About {tracking.distanceKm} km away by road</Fact>
            )}
            {destination && <Fact icon={<IconHome size={16} />}>{destination.label}</Fact>}
            <Fact icon={<IconClock size={16} />}>
              The time is an estimate. {name} may have other deliveries on the way.
            </Fact>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Box p={{ base: 'sm', md: 'sm' }} pl={{ md: 0 }}>
            {points.length > 0 ? (
              <Suspense fallback={<MapPlaceholder />}>
                <TrackingMap points={points} line />
              </Suspense>
            ) : (
              <MapPlaceholder />
            )}
            <Group gap="lg" mt={6} px={4}>
              <Legend color="#1c7ed6" label={name} />
              {destination?.approximate && <Legend color="#e8590c" label="Your area (the middle of your PIN code, not your door)" />}
            </Group>
          </Box>
        </Grid.Col>
      </Grid>
    </Paper>
  )
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <ThemeIcon variant="light" color="gray" size="sm" radius="xl">
        {icon}
      </ThemeIcon>
      <Text size="sm">{children}</Text>
    </Group>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={10} h={10} style={{ borderRadius: '50%', background: color }} />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  )
}

function MapPlaceholder() {
  return (
    <Box h={360} style={{ display: 'grid', placeItems: 'center', borderRadius: 'var(--mantine-radius-md)' }} bg="gray.1">
      <Loader size="sm" />
    </Box>
  )
}
