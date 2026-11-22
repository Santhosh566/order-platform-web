import { Alert, Button, Group, Paper, Stack, Text, TextInput } from '@mantine/core'
import { IconMapPin, IconTruckDelivery } from '@tabler/icons-react'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../lib/format'
import { useDeliveryEstimate, type DeliveryEstimate } from './catalogue'

const LAST_PIN = 'order-platform:last-pin'

function rememberedPin(): string | null {
  try {
    return window.localStorage.getItem(LAST_PIN)
  } catch {
    return null
  }
}

/** "Deliver to 560038: by Thu, 13 Nov". The PIN starts from the saved address or the last one tried. */
export function DeliveryCheck({ sku }: { sku: string }) {
  const { me } = useAuth()
  const initial = rememberedPin() ?? me?.defaultAddress?.postalCode ?? ''
  const [input, setInput] = useState(initial)
  const [pin, setPin] = useState<string | null>(/^[1-9][0-9]{5}$/.test(initial) ? initial : null)
  const estimate = useDeliveryEstimate(sku, pin)
  const valid = /^[1-9][0-9]{5}$/.test(input.trim())

  const check = () => {
    const value = input.trim()
    if (!/^[1-9][0-9]{5}$/.test(value)) return
    setPin(value)
    try {
      window.localStorage.setItem(LAST_PIN, value)
    } catch {
      // Not remembered; it still works now
    }
  }

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            label="Deliver to"
            placeholder="PIN code"
            leftSection={<IconMapPin size={16} />}
            inputMode="numeric"
            maxLength={6}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            error={input.length === 6 && !valid ? 'Not a PIN code' : undefined}
            w={160}
          />
          <Button variant="light" onClick={check} disabled={!valid} loading={estimate.isFetching}>
            Check
          </Button>
        </Group>
        {estimate.data && <EstimateText estimate={estimate.data} />}
      </Stack>
    </Paper>
  )
}

function EstimateText({ estimate: e }: { estimate: DeliveryEstimate }) {
  if (e.outcome === 'INVALID_PIN') return <Text size="sm" c="red">Enter a 6-digit PIN code.</Text>
  if (e.outcome === 'UNKNOWN_PIN')
    return (
      <Text size="sm" c="red">
        We could not find PIN {e.pin}. Check it, or try a nearby one.
      </Text>
    )
  if (e.outcome === 'OUT_OF_STOCK')
    return <Text size="sm" c="dimmed">Out of stock right now, so there is no delivery date yet.</Text>

  const place = e.district && e.state ? `${e.district}, ${e.state}` : null
  const by =
    e.earliest === e.latest || !e.latest
      ? `by ${formatDate(e.earliest)}`
      : `between ${formatDate(e.earliest)} and ${formatDate(e.latest)}`
  return (
    <Stack gap={4}>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <IconTruckDelivery size={18} />
        <Text size="sm">
          <b>Delivered {by}</b>
          {place && <> to {place}</>}
        </Text>
      </Group>
      {e.minutesToCutOff !== null && e.minutesToCutOff > 0 && (
        <Text size="xs" c="green.8">
          Order within {e.minutesToCutOff >= 60 ? `${Math.floor(e.minutesToCutOff / 60)} h ` : ''}
          {e.minutesToCutOff % 60} min and it leaves today.
        </Text>
      )}
      {e.shipsFrom && (
        <Text size="xs" c="dimmed">
          Ships from our {e.shipsFrom}.
        </Text>
      )}
      {e.holidays.length > 0 && (
        <Text size="xs" c="dimmed">
          No deliveries on {e.holidays.map((h) => `${h.name} (${formatDate(h.date)})`).join(', ')}.
        </Text>
      )}
      {e.approximate && (
        <Alert color="gray" p={6} variant="light">
          <Text size="xs">An approximate date: we cannot look up this PIN yet, so it allows for the farthest areas.</Text>
        </Alert>
      )}
    </Stack>
  )
}
