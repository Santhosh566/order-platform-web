import { Button, Group, NumberInput, Select, Stack, Table, Text, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import type { Order } from '../../api/types'
import { errorMessage } from '../../lib/errors'
import { useRequestReturn } from '../../customer/queries'
import { ItemLine } from '../../components/ItemLines'
import { useThumbnails } from '../../components/thumbnails'

const REASONS = [
  'Damaged or defective',
  'Wrong item sent',
  'Not as described',
  'No longer needed',
  'Other',
] as const

/** Choose units and a reason; the backend checks the window and the units left again. */
export function ReturnDialog({
  order,
  returnable,
  onDone,
}: {
  order: Order
  returnable: Map<string, number>
  onDone: () => void
}) {
  const request = useRequestReturn()
  const skus = [...returnable.entries()].filter(([, left]) => left > 0)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [touched, setTouched] = useState(false)

  const chosen = skus
    .map(([sku]) => ({ sku, quantity: quantities[sku] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const needsDetails = reason === 'Other'
  const reasonText = reason ? (details.trim() ? `${reason}: ${details.trim()}` : reason) : ''
  const valid = chosen.length > 0 && !!reason && (!needsDetails || details.trim().length > 0)

  const nameOf = (sku: string) => order.items.find((i) => i.sku === sku)?.productName ?? sku
  const thumbnails = useThumbnails(order.items.map((i) => i.sku))

  const submit = async () => {
    setTouched(true)
    if (!valid) return
    try {
      await request.mutateAsync({ orderId: order.orderId, reason: reasonText, items: chosen })
      notifications.show({
        color: 'green',
        title: 'Return requested',
        message: 'We will review it shortly and email you the next steps.',
      })
      onDone()
    } catch (error) {
      notifications.show({ color: 'red', title: 'Return not requested', message: errorMessage(error) })
    }
  }

  return (
    <Stack gap="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th w={110}>Return</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {skus.map(([sku, left]) => (
            <Table.Tr key={sku}>
              <Table.Td>
                <ItemLine sku={sku} name={nameOf(sku)} thumbnail={thumbnails.get(sku)} detail={`Up to ${left}`} size={44} />
              </Table.Td>
              <Table.Td>
                <NumberInput
                  aria-label={`Units of ${nameOf(sku)} to return`}
                  value={quantities[sku] ?? 0}
                  onChange={(value) =>
                    setQuantities((current) => ({ ...current, [sku]: typeof value === 'number' ? value : 0 }))
                  }
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
          Choose at least one item to return.
        </Text>
      )}
      <Select
        label="Why are you returning it?"
        data={[...REASONS]}
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
        error={touched && needsDetails && !details.trim() ? 'Tell us what went wrong' : undefined}
      />
      <Text size="xs" c="dimmed">
        Once we approve the return, our courier collects the items. The refund goes back the way you paid (to the
        card first, then to your wallet for what it paid), with a GST credit note, after the items reach our warehouse.
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone} disabled={request.isPending}>
          Close
        </Button>
        <Button onClick={() => void submit()} loading={request.isPending}>
          Request return
        </Button>
      </Group>
    </Stack>
  )
}
