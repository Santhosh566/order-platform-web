import { Badge, Group } from '@mantine/core'
import { IconCalendarTime, IconCash } from '@tabler/icons-react'
import type { DeliveryTerms as Terms } from '../../api/adminTypes'
import { formatSlot } from '../../checkout/labels'
import { formatMoney } from '../../lib/format'

/** "Collect ₹640 cash" and "Fri, 14 Nov, 9 AM – 1 PM" on a driver's card, when they apply. */
export function DeliveryTerms({ terms }: { terms: Terms }) {
  const slot = formatSlot(terms.deliveryDate, terms.deliveryWindow)
  const cash = terms.amountToCollect
  if (!slot && !cash) return null
  return (
    <Group gap={6}>
      {cash ? (
        <Badge color="orange" variant="filled" leftSection={<IconCash size={14} />} size="lg">
          Collect {formatMoney(cash, terms.currency)} cash
        </Badge>
      ) : null}
      {slot && (
        <Badge color="grape" variant="light" leftSection={<IconCalendarTime size={14} />} size="lg">
          {slot}
        </Badge>
      )}
    </Group>
  )
}
