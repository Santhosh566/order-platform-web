import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconMapPin, IconPackage, IconTruckDelivery } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router'
import type { AvailableDelivery } from '../../api/adminTypes'
import { ApiError } from '../../api/client'
import { QueryState } from '../../components/QueryState'
import { useAvailable, useAvailablePickups, useDriverAction, useMine, useMyPickups } from '../../delivery/queries'
import { AvailablePickupCard } from './PickupCards'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { DeliveryTerms } from './DeliveryTerms'
import { shortOrderId } from '../../lib/orderStatus'

/**
 * Orders ready to go, oldest first, by area only. The street and phone appear once the driver
 * takes the order.
 */
export function AvailablePage() {
  const available = useAvailable()
  const pickups = useAvailablePickups()
  const mine = useMine()
  const myPickups = useMyPickups()
  const navigate = useNavigate()
  const inHand = (mine.data?.length ?? 0) + (myPickups.data?.length ?? 0)

  return (
    <Stack gap="md" maw={560}>
      <div>
        <Title order={2}>Available orders</Title>
        <Text size="sm" c="dimmed">
          Deliveries start at the hub; return pickups start at the customer. The lists refresh every 30 seconds.
        </Text>
      </div>
      {inHand > 0 && (
        <Button component={Link} to="/delivery/mine" variant="light" size="md" fullWidth>
          You have {inHand} {inHand === 1 ? 'job' : 'jobs'} in hand →
        </Button>
      )}
      <QueryState query={available}>
        {(rows) =>
          rows.length === 0 ? (
            <Card withBorder radius="md" p="xl">
              <Stack align="center" gap="xs">
                <IconTruckDelivery size={40} stroke={1.4} />
                <Text>No orders to deliver right now.</Text>
              </Stack>
            </Card>
          ) : (
            <Stack gap="sm">
              {rows.map((row) => (
                <AvailableCard key={row.orderId} delivery={row} />
              ))}
            </Stack>
          )
        }
      </QueryState>
      {(pickups.data?.length ?? 0) > 0 && (
        <Stack gap="sm">
          <Title order={4} mt="sm">
            Return pickups
          </Title>
          {pickups.data?.map((p) => (
            <AvailablePickupCard key={p.returnId} pickup={p} onTaken={() => navigate('/delivery/mine')} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function AvailableCard({ delivery }: { delivery: AvailableDelivery }) {
  const action = useDriverAction()
  const navigate = useNavigate()

  const take = () =>
    action.mutate(
      { orderId: delivery.orderId, action: 'take' },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', title: 'It’s yours', message: 'Collect it from the hub next.' })
          navigate('/delivery/mine')
        },
        onError: (error) =>
          notifications.show({
            color: 'red',
            title: error instanceof ApiError && error.status === 409 ? 'Someone else took it' : 'Not taken',
            message: errorMessage(error),
          }),
      },
    )

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap={6}>
            <IconMapPin size={18} />
            <Text fw={600}>
              {delivery.city}, {delivery.postalCode}
            </Text>
          </Group>
          {delivery.status === 'DELIVERY_FAILED' && (
            <Badge color="yellow" variant="light">
              Second try
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {delivery.state} · {shortOrderId(delivery.orderId)}
        </Text>
        <DeliveryTerms terms={delivery} />
        <Group gap={6}>
          <IconPackage size={16} />
          <Text size="sm">
            {delivery.itemCount} {delivery.itemCount === 1 ? 'item' : 'items'} · waiting since{' '}
            {formatDateTime(delivery.waitingSince)}
          </Text>
        </Group>
        <Button size="md" fullWidth onClick={take} loading={action.isPending}>
          Take this order
        </Button>
      </Stack>
    </Card>
  )
}
