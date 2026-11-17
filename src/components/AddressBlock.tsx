import { Text } from '@mantine/core'
import type { ShippingAddress } from '../api/types'

export function AddressBlock({ address }: { address: ShippingAddress }) {
  return (
    <div>
      <Text fw={600}>{address.recipientName}</Text>
      <Text size="sm">{address.line1}</Text>
      {address.line2 && <Text size="sm">{address.line2}</Text>}
      <Text size="sm">
        {address.city}, {address.state} {address.postalCode}
      </Text>
      <Text size="sm" c="dimmed">
        Phone {address.recipientPhone}
      </Text>
    </div>
  )
}
