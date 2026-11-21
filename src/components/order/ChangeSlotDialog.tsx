import { Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import type { Order } from '../../api/types'
import { DeliveryChoice, type ChosenSlot } from '../../checkout/DeliveryChoice'
import { formatSlot } from '../../checkout/labels'
import { notifyFailure } from '../../lib/notifyFailure'
import { useChangeSlot } from '../../orders/changes'

/** Another delivery day and time, or standard delivery, by checkout's rules, until a driver takes the parcel. */
export function ChangeSlotDialog({ order, onDone }: { order: Order; onDone: () => void }) {
  const change = useChangeSlot(order.orderId, order.version)
  const booked: ChosenSlot | null =
    order.deliveryDate && order.deliveryWindow ? { date: order.deliveryDate, window: order.deliveryWindow } : null
  const [slot, setSlot] = useState<ChosenSlot | null>(booked)
  const unchanged = slot?.date === booked?.date && slot?.window === booked?.window
  const pin = order.shippingAddress?.postalCode ?? null

  const submit = async () => {
    try {
      await change.mutateAsync(slot ?? { date: null, window: null })
      notifications.show({
        color: 'green',
        title: 'Delivery changed',
        message: slot ? `Booked for ${formatSlot(slot.date, slot.window)}.` : 'Standard delivery.',
      })
      onDone()
    } catch (error) {
      notifyFailure('Delivery not changed', error)
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm">
        Now: <b>{formatSlot(order.deliveryDate, order.deliveryWindow) ?? 'Standard delivery'}</b>
      </Text>
      {order.status === 'DELIVERY_FAILED' && (
        <Text size="sm" c="dimmed">
          We missed you last time. Choose a day and time when someone will be in.
        </Text>
      )}
      {pin ? (
        <DeliveryChoice pin={pin} value={slot} onChange={setSlot} disabled={change.isPending} />
      ) : (
        <Text c="dimmed" size="sm">
          This order has no delivery address.
        </Text>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone} disabled={change.isPending}>
          Close
        </Button>
        <Button onClick={() => void submit()} loading={change.isPending} disabled={unchanged || !pin}>
          Save
        </Button>
      </Group>
    </Stack>
  )
}
