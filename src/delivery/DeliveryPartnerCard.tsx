import { Avatar, Badge, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconShieldCheck, IconStarFilled } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { OrderStatus } from '../api/types'
import { formatDateTime } from '../lib/format'
import { usePrivateImage } from '../profile/queries'
import { VEHICLE_LABELS, type VehicleType } from '../profile/types'

export interface DeliveryPartner {
  /** First name and initial, e.g. "Ravi S." */
  name: string
  stage: 'ON_THE_WAY' | 'DELIVERED'
  hasPhoto: boolean
  photoVersion: string | null
  vehicleType: VehicleType | null
  vehicleNumber: string | null
  rating: number | null
  ratingCount: number
  deliveries: number
  pickedUpAt: string | null
  deliveredAt: string | null
}

/** From pickup to delivery, and while the delivery can still be rated. */
const SHOWN_WHILE: ReadonlySet<OrderStatus> = new Set(['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'])

function useDeliveryPartner(orderId: string, status: OrderStatus) {
  return useQuery({
    // Under the order's key, so a live update of the order refreshes it too
    queryKey: ['orders', orderId, 'delivery-partner', status],
    queryFn: ({ signal }) =>
      api<{ orderId: string; partner: DeliveryPartner | null }>(
        `/api/orders/${encodeURIComponent(orderId)}/delivery-partner`,
        { signal },
      ),
    enabled: SHOWN_WHILE.has(status),
  })
}

/** Who is bringing the order: name, photo, vehicle and rating, as delivery apps show it. */
export function DeliveryPartnerCard({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const query = useDeliveryPartner(orderId, status)
  const partner = query.data?.partner ?? null
  const photo = usePrivateImage(
    partner?.hasPhoto ? `/api/orders/${encodeURIComponent(orderId)}/delivery-partner/photo` : null,
    partner?.photoVersion,
  )
  if (!partner) return null
  const delivered = partner.stage === 'DELIVERED'

  return (
    <Paper component="section" withBorder radius="md" p="md" aria-label="Delivery partner">
      <Title order={4} mb="sm">
        {delivered ? 'Delivered by' : 'Your delivery partner'}
      </Title>
      <Group gap="md" wrap="nowrap" align="flex-start">
        <Avatar src={photo} alt={photo ? `Photo of ${partner.name}` : undefined} size={64} radius="xl" color="orange">
          {partner.name.slice(0, 1)}
        </Avatar>
        <Stack gap={4}>
          <Text fw={600} size="lg">
            {partner.name}
          </Text>
          <Group gap={6}>
            {partner.rating !== null ? (
              <Badge variant="light" color="yellow" leftSection={<IconStarFilled size={12} />}>
                {partner.rating.toFixed(1)} ({partner.ratingCount})
              </Badge>
            ) : (
              <Badge variant="light" color="gray">
                New partner
              </Badge>
            )}
            <Text size="sm" c="dimmed">
              {partner.deliveries.toLocaleString('en-IN')} {partner.deliveries === 1 ? 'delivery' : 'deliveries'}
            </Text>
          </Group>
          {partner.vehicleType && (
            <Text size="sm">
              {VEHICLE_LABELS[partner.vehicleType]}
              {partner.vehicleNumber && (
                <>
                  {' · '}
                  <Text span ff="monospace" fw={600}>
                    {partner.vehicleNumber}
                  </Text>
                </>
              )}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            {delivered && partner.deliveredAt
              ? `Handed over ${formatDateTime(partner.deliveredAt)}`
              : partner.pickedUpAt
                ? `Picked up ${formatDateTime(partner.pickedUpAt)}`
                : null}
          </Text>
        </Stack>
      </Group>
      {!delivered && (
        <Group gap={6} mt="sm" wrap="nowrap" align="flex-start">
          <IconShieldCheck size={16} color="var(--mantine-color-green-7)" style={{ flexShrink: 0, marginTop: 2 }} />
          <Text size="xs" c="dimmed">
            Check the name and vehicle number when they arrive, and share your delivery code only once you have the parcel.
          </Text>
        </Group>
      )}
    </Paper>
  )
}
