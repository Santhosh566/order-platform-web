import { Alert, Anchor, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'
import type { Order, ShippingAddress } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { DeliveryChoice, type ChosenSlot } from '../../checkout/DeliveryChoice'
import { formatSlot } from '../../checkout/labels'
import { findState, stateName } from '../../lib/indianStates'
import { notifyFailure } from '../../lib/notifyFailure'
import { useChangeAddress } from '../../orders/changes'
import { AddressBlock } from '../AddressBlock'
import { AddressForm } from '../AddressForm'

function sameAddress(a: ShippingAddress | null | undefined, b: ShippingAddress | null | undefined): boolean {
  if (!a || !b) return false
  const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return (['recipientName', 'recipientPhone', 'line1', 'line2', 'city', 'state', 'postalCode'] as const).every(
    (k) => norm(a[k]) === norm(b[k]),
  )
}

/**
 * Sends the order somewhere else, until a driver takes it. The customer uses it on their order and an admin on
 * any order; the server decides what is allowed (same warehouse region, and the same state once packed).
 */
export function ChangeAddressDialog({ order, staff = false, onDone }: { order: Order; staff?: boolean; onDone: () => void }) {
  const auth = useAuth()
  const change = useChangeAddress(order.orderId, order.version)
  const [next, setNext] = useState<ShippingAddress | null>(null)
  const booked: ChosenSlot | null =
    order.deliveryDate && order.deliveryWindow ? { date: order.deliveryDate, window: order.deliveryWindow } : null
  const [slot, setSlot] = useState<ChosenSlot | null>(booked)

  const saved = staff ? null : (auth.me?.defaultAddress ?? null)
  const offerSaved = saved && !sameAddress(saved, order.shippingAddress)
  const packed = !!order.invoiceNumber
  const fromState = stateName(order.placeOfSupply)
  const toState = next ? (findState(next.state)?.name ?? next.state) : null
  const stateMoves = !!next && !!order.placeOfSupply && findState(next.state)?.code !== order.placeOfSupply

  const submit = async () => {
    if (!next) return
    try {
      const reply = await change.mutateAsync({
        address: next,
        // An order on standard delivery stays on it; a booked one sends what was chosen for the new PIN
        ...(booked ? { deliverySlot: slot ?? { date: null, window: null } } : {}),
      })
      const moved = reply.changes.find((c) => c.kind === 'DELIVERY_SLOT')
      notifications.show({
        color: 'green',
        title: 'Delivery address changed',
        message: `Order will be delivered to ${next.city}.${moved ? ` Delivery: ${moved.after}.` : ''}`,
      })
      onDone()
    } catch (error) {
      notifyFailure('Address not changed', error)
    }
  }

  if (!next) {
    return (
      <Stack gap="md">
        {order.shippingAddress && (
          <div>
            <Text size="xs" c="dimmed" mb={4}>
              Now delivering to
            </Text>
            <AddressBlock address={order.shippingAddress} />
          </div>
        )}
        {offerSaved && (
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              Deliver to {staff ? 'the' : 'my'} saved address: {saved.line1}, {saved.city}
            </Text>
            <Button variant="light" size="xs" onClick={() => setNext(saved)}>
              Use it
            </Button>
          </Group>
        )}
        <Text size="xs" c="dimmed">
          The order is already at the warehouse for this part of India, so the new address must be one it delivers to.
          {packed
            ? ` It is packed and its tax invoice names ${fromState}, so the new address must be in ${fromState}.`
            : ''}
        </Text>
        <AddressForm
          initial={order.shippingAddress}
          submitLabel="Continue"
          onSubmit={(address) => setNext(address)}
          extraActions={
            <Button variant="default" onClick={onDone}>
              Close
            </Button>
          }
        />
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <div>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            New delivery address
          </Text>
          <Anchor component="button" type="button" size="xs" onClick={() => setNext(null)}>
            Edit
          </Anchor>
        </Group>
        <AddressBlock address={next} />
      </div>
      {sameAddress(next, order.shippingAddress) && (
        <Alert color="yellow" icon={<IconInfoCircle size={18} />} p="xs">
          This is the address the order already goes to.
        </Alert>
      )}
      {stateMoves && (
        <Alert color={packed ? 'red' : 'blue'} icon={<IconInfoCircle size={18} />} p="xs">
          {packed
            ? `The tax invoice was issued for ${fromState}, so the order cannot go to ${toState}. Cancel it and place a new order instead.`
            : `GST is worked out again for ${toState}. The total stays the same.`}
        </Alert>
      )}
      {booked && (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Delivery
          </Text>
          <Text size="xs" c="dimmed">
            Booked: {formatSlot(booked.date, booked.window)}. Keep it, or choose another day for the new address.
          </Text>
          <DeliveryChoice pin={next.postalCode} value={slot} onChange={setSlot} disabled={change.isPending} />
        </Stack>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone} disabled={change.isPending}>
          Close
        </Button>
        <Button onClick={() => void submit()} loading={change.isPending} disabled={sameAddress(next, order.shippingAddress)}>
          Deliver here
        </Button>
      </Group>
    </Stack>
  )
}
