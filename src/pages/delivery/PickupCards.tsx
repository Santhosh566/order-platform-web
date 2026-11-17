import { Anchor, Badge, Button, Card, Checkbox, Divider, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconArrowBackUp, IconMap2, IconMapPin, IconPackage, IconPhone } from '@tabler/icons-react'
import { useState } from 'react'
import type { AvailablePickup, MyPickup } from '../../api/adminTypes'
import { ApiError } from '../../api/client'
import { AddressBlock } from '../../components/AddressBlock'
import { mapsLink, telLink, usePickupAction } from '../../delivery/queries'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'
import { CodeEntry } from './CodeEntry'
import { ItemLines } from '../../components/ItemLines'

/** A return waiting to be collected, by area only. */
export function AvailablePickupCard({ pickup, onTaken }: { pickup: AvailablePickup; onTaken: () => void }) {
  const action = usePickupAction()
  const take = () =>
    action.mutate(
      { returnId: pickup.returnId, action: 'take' },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', title: 'Pickup is yours', message: 'Start it when you set out.' })
          onTaken()
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
              {pickup.city}, {pickup.postalCode}
            </Text>
          </Group>
          <Group gap={6}>
            {pickup.attempts > 0 && (
              <Badge color="yellow" variant="light">
                Try {pickup.attempts + 1}
              </Badge>
            )}
            <Badge color="grape" variant="light" leftSection={<IconArrowBackUp size={12} />}>
              Return pickup
            </Badge>
          </Group>
        </Group>
        <Text size="sm" c="dimmed">
          {pickup.state} · {shortOrderId(pickup.orderId)}
        </Text>
        <Group gap={6}>
          <IconPackage size={16} />
          <Text size="sm">
            {pickup.itemCount} {pickup.itemCount === 1 ? 'item' : 'items'} to collect · approved{' '}
            {formatDateTime(pickup.approvedAt)}
          </Text>
        </Group>
        <Button size="md" fullWidth variant="light" onClick={take} loading={action.isPending}>
          Take this pickup
        </Button>
      </Stack>
    </Card>
  )
}

/** A pickup in hand: start it (the customer gets a code), then collect with the code at the door. */
export function MyPickupCard({ pickup: p, onFail }: { pickup: MyPickup; onFail: () => void }) {
  const action = usePickupAction()
  const [checked, setChecked] = useState(false)
  const tel = telLink(p.recipientPhone)
  const maps = mapsLink(p.address)
  const onTheWay = p.pickupStatus === 'ON_THE_WAY'

  const start = () =>
    modals.openConfirmModal({
      title: 'Start this pickup?',
      children: (
        <Text size="sm">The customer is emailed a one-time code now. Start when you are on your way to them.</Text>
      ),
      labels: { confirm: 'Start pickup', cancel: 'Not yet' },
      onConfirm: () =>
        action.mutate(
          { returnId: p.returnId, action: 'start' },
          {
            onSuccess: () => notifications.show({ color: 'green', title: 'Code sent to the customer', message: p.returnId }),
            onError: (error) => notifications.show({ color: 'red', title: 'Not started', message: errorMessage(error) }),
          },
        ),
    })

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>Return of {shortOrderId(p.orderId)}</Text>
          <Group gap={6}>
            {p.attempt > 1 && (
              <Badge color="yellow" variant="light">
                Try {p.attempt}
              </Badge>
            )}
            <Badge color="grape" variant="light">
              {onTheWay ? 'Pickup – on the way' : 'Pickup – not started'}
            </Badge>
          </Group>
        </Group>

        {p.address && <AddressBlock address={p.address} />}
        <Group grow gap="xs">
          {tel && (
            <Button component="a" href={tel} variant="default" leftSection={<IconPhone size={18} />}>
              Call
            </Button>
          )}
          {maps && (
            <Button component="a" href={maps} target="_blank" rel="noreferrer" variant="default" leftSection={<IconMap2 size={18} />}>
              Map
            </Button>
          )}
        </Group>

        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            To collect
          </Text>
          <ItemLines items={p.items} label="To collect" />
          <Text size="xs" c="dimmed">
            Customer’s reason: {p.reason}
          </Text>
        </div>

        <Divider />
        {!onTheWay && (
          <Button size="lg" fullWidth loading={action.isPending} onClick={start}>
            Start pickup
          </Button>
        )}
        {onTheWay && (
          <CodeEntry
            attemptsLeft={p.codeAttemptsLeft}
            instruction="Check the items, take them, then ask the customer for the 6-digit code from their email."
            lockedText="This pickup can no longer be confirmed with a code. Mark it as not collected and leave the items with the customer."
            confirmLabel="Confirm pickup"
            busy={action.isPending}
            ready={checked}
            onConfirm={(code, onError) =>
              action.mutate(
                { returnId: p.returnId, action: 'collect', body: { code } },
                {
                  onSuccess: () =>
                    notifications.show({
                      color: 'green',
                      title: 'Collected',
                      message: 'Take the items to the hub. The customer is refunded once they are checked.',
                    }),
                  onError: (e) => onError(errorMessage(e)),
                },
              )
            }
          >
            <Checkbox
              label="I have the items listed above, and nothing is obviously missing"
              checked={checked}
              onChange={(e) => setChecked(e.currentTarget.checked)}
            />
          </CodeEntry>
        )}
        <Anchor component="button" type="button" size="sm" c="red" onClick={onFail} ta="center">
          {onTheWay ? 'Could not collect' : 'I can’t take this one'}
        </Anchor>
      </Stack>
    </Card>
  )
}
