import { Alert, Anchor, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { IconDiscount, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { formatMoney } from '../lib/format'
import { useOffers, type Quote } from './queries'

/**
 * A coupon field, the offers the customer can use, and what the applied coupon saves. Whether a coupon
 * applies is the server's answer (the quote); the field only says which code to try.
 */
export function CouponBox({
  applied,
  quote,
  onApply,
  onRemove,
  disabled,
}: {
  applied: string | null
  quote: Quote | undefined
  onApply: (code: string) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const [code, setCode] = useState('')
  const offers = useOffers()
  const accepted = applied && quote?.couponCode === applied ? quote : null
  const refused = applied && quote?.couponError && quote.couponCode === null ? quote.couponError : null

  const apply = (value: string) => {
    const clean = value.trim().toUpperCase()
    if (clean) onApply(clean)
  }

  return (
    <Stack gap="xs">
      {accepted ? (
        <Alert color="green" p="xs" icon={<IconDiscount size={18} />}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              <b>{accepted.couponCode}</b> applied: you save {formatMoney(accepted.discount, accepted.currency)}
            </Text>
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconX size={12} />} onClick={onRemove}>
              Remove
            </Button>
          </Group>
        </Alert>
      ) : (
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <TextInput
            aria-label="Coupon code"
            placeholder="Coupon code"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply(code)
            }}
            error={refused}
            flex={1}
            disabled={disabled}
            style={{ textTransform: 'uppercase' }}
          />
          <Button variant="default" onClick={() => apply(code)} disabled={disabled || !code.trim()}>
            Apply
          </Button>
        </Group>
      )}
      {!accepted && (offers.data?.length ?? 0) > 0 && (
        <Stack gap={4} role="list" aria-label="Offers for you">
          {offers.data!.map((o) => (
            <Group key={o.code} gap="xs" wrap="nowrap" role="listitem" aria-label={o.code} justify="space-between">
              <Text size="xs">
                <b>{o.code}</b> · {o.description}
                {(o.appliesTo?.length ?? 0) > 0 && (
                  <Text span size="xs" c="dimmed">
                    {' '}
                    · on {o.appliesTo.join(', ')}
                  </Text>
                )}
              </Text>
              <Anchor
                component="button"
                type="button"
                size="xs"
                onClick={() => {
                  setCode(o.code)
                  onApply(o.code)
                }}
                aria-label={`Apply ${o.code}`}
              >
                Apply
              </Anchor>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
