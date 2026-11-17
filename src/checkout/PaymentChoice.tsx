import { Radio, Stack, Text } from '@mantine/core'
import type { PaymentMethod } from './labels'
import type { Quote } from './queries'

/** Pay online now, or cash at the door when the server says the order may be paid that way. */
export function PaymentChoice({
  value,
  onChange,
  quote,
  disabled,
}: {
  value: PaymentMethod
  onChange: (value: PaymentMethod) => void
  quote: Quote | undefined
  disabled?: boolean
}) {
  const cod = quote?.cashOnDelivery
  return (
    <Stack gap={6}>
      <Radio.Group value={value} onChange={(v) => onChange(v as PaymentMethod)} aria-label="Payment">
        <Stack gap="xs">
          <Radio value="PREPAID" label="Pay online now (UPI, card, net banking)" disabled={disabled} />
          <Radio
            value="COD"
            label="Cash on delivery"
            description={cod?.available ? 'Pay the driver in cash when the parcel arrives' : undefined}
            disabled={disabled || (cod !== undefined && !cod.available && value !== 'COD')}
          />
        </Stack>
      </Radio.Group>
      {cod && !cod.available && (
        <Text size="xs" c={value === 'COD' ? 'red' : 'dimmed'}>
          {cod.reason}
        </Text>
      )}
    </Stack>
  )
}
