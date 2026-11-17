import { Alert, Button, Group, NumberInput, Select, Stack, Table, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Order } from '../../api/types'
import { useCancelItems } from '../../customer/queries'
import { notifyFailure } from '../../lib/notifyFailure'
import { formatMoney } from '../../lib/format'
import { activeUnits } from '../../lib/orderStatus'
import { ItemLine } from '../ItemLines'
import { useThumbnails } from '../thumbnails'

const CUSTOMER_REASONS = ['Ordered too many', 'Ordered by mistake', 'Found it cheaper elsewhere', 'No longer needed', 'Other'] as const
const STAFF_REASONS = ['Customer asked by phone', 'Item damaged in the warehouse', 'Item could not be found', 'Other'] as const

/**
 * Value of the units of one SKU, at what each line charged per unit (its coupon share included).
 * An estimate for the screen: the credit note on the server splits paise exactly.
 */
function unitsValue(order: Order, sku: string, units: number): number {
  let left = units
  let value = 0
  for (const line of order.items) {
    if (left === 0 || line.sku !== sku) continue
    const now = Math.min(line.activeQuantity, left)
    value += (line.lineTotal / line.quantity) * now
    left -= now
  }
  return value
}

/**
 * Cancel some items of an order still in the warehouse. The customer uses it on their order and
 * an admin on any order; the server checks the status and the units left again.
 */
export function CancelItemsDialog({ order, staff = false, onDone }: { order: Order; staff?: boolean; onDone: () => void }) {
  const cancel = useCancelItems(order.orderId, order.version)
  const client = useQueryClient()
  const skus = [...activeUnits(order).entries()].filter(([, left]) => left > 0)
  const totalUnits = skus.reduce((sum, [, left]) => sum + left, 0)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [touched, setTouched] = useState(false)

  const chosen = skus
    .map(([sku]) => ({ sku, quantity: quantities[sku] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const chosenUnits = chosen.reduce((sum, line) => sum + line.quantity, 0)
  const everything = chosenUnits === totalUnits
  const value = chosen.reduce((sum, line) => sum + unitsValue(order, line.sku, line.quantity), 0)
  const unpaidCod = order.paymentMethod === 'COD' && order.paymentTransactionId === null

  const needsDetails = reason === 'Other'
  const reasonText = reason ? (details.trim() ? `${reason}: ${details.trim()}` : reason) : ''
  const valid = chosen.length > 0 && !!reason && (!needsDetails || details.trim().length > 0)

  const nameOf = (sku: string) => order.items.find((i) => i.sku === sku)?.productName ?? sku
  const thumbnails = useThumbnails(order.items.map((i) => i.sku))
  const reasons = staff ? STAFF_REASONS : CUSTOMER_REASONS

  const submit = async () => {
    setTouched(true)
    if (!valid) return
    try {
      const reply = await cancel.mutateAsync({ items: chosen, reason: reasonText })
      if (staff) void client.invalidateQueries({ queryKey: ['admin'] })
      notifications.show({
        color: 'green',
        title: reply.wholeOrderCancelled ? 'Order cancelled' : 'Items cancelled',
        message: reply.wholeOrderCancelled
          ? 'Nothing was left to send, so the whole order was cancelled.'
          : reply.refunded !== null
            ? `${formatMoney(reply.refunded, order.currency)} is being refunded. Credit note ${reply.creditNote?.number}.`
            : `The cash due at the door is now ${formatMoney(reply.order.amountDue, order.currency)}.`,
      })
      onDone()
    } catch (error) {
      notifyFailure('Items not cancelled', error)
    }
  }

  return (
    <Stack gap="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th w={110}>Cancel</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {skus.map(([sku, left]) => (
            <Table.Tr key={sku}>
              <Table.Td>
                <ItemLine sku={sku} name={nameOf(sku)} thumbnail={thumbnails.get(sku)} detail={`${left} coming`} size={44} />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  aria-label={`Units of ${nameOf(sku)} to cancel`}
                  value={quantities[sku] ?? 0}
                  onChange={(v) => setQuantities((current) => ({ ...current, [sku]: typeof v === 'number' ? v : 0 }))}
                  min={0}
                  max={left}
                  clampBehavior="strict"
                  allowDecimal={false}
                  size="xs"
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {touched && chosen.length === 0 && (
        <Text size="sm" c="red">
          Choose at least one item to cancel.
        </Text>
      )}
      {everything && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} p="xs">
          That is everything still coming, so the whole order will be cancelled.
        </Alert>
      )}
      <Select
        label="Why are you cancelling?"
        data={[...reasons]}
        value={reason}
        onChange={setReason}
        withAsterisk
        error={touched && !reason ? 'Choose a reason' : undefined}
        comboboxProps={{ withinPortal: false }}
      />
      <Textarea
        label="Details"
        description={needsDetails ? undefined : 'Optional'}
        withAsterisk={needsDetails}
        maxLength={200}
        autosize
        minRows={2}
        value={details}
        onChange={(e) => setDetails(e.currentTarget.value)}
        error={touched && needsDetails && !details.trim() ? 'Say why' : undefined}
      />
      {chosen.length > 0 && !everything && (
        <Text size="sm" data-testid="cancel-estimate">
          {unpaidCod
            ? `Cash due at the door goes down by about ${formatMoney(value, order.currency)}, to about ${formatMoney(order.amountDue - value, order.currency)}.`
            : `About ${formatMoney(value, order.currency)} goes back to the original payment method, with a GST credit note.`}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Each item is refunded at the price paid for it, including its share of any coupon. The rest of the order ships as
        planned.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone} disabled={cancel.isPending}>
          Close
        </Button>
        <Button color="red" onClick={() => void submit()} loading={cancel.isPending}>
          {everything ? 'Cancel order' : 'Cancel items'}
        </Button>
      </Group>
    </Stack>
  )
}
