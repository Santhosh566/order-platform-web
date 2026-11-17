import { Chip, Group, Radio, Skeleton, Stack, Text } from '@mantine/core'
import { useEffect } from 'react'
import { formatDay, type DeliveryWindow } from './labels'
import { useSlots } from './queries'

export interface ChosenSlot {
  date: string
  window: DeliveryWindow
}

/**
 * Standard delivery, or a day and time from the days the server offers for the address's PIN. Full
 * windows cannot be chosen; a choice that is no longer offered is cleared.
 */
export function DeliveryChoice({
  pin,
  value,
  onChange,
  disabled,
}: {
  pin: string | null
  value: ChosenSlot | null
  onChange: (value: ChosenSlot | null) => void
  disabled?: boolean
}) {
  const slots = useSlots(pin)
  const data = slots.data
  const day = value ? data?.days.find((d) => d.date === value.date) : undefined
  const window = value && day ? day.windows.find((w) => w.window === value.window) : undefined
  const stillOffered = !value || (!!window && window.available)

  useEffect(() => {
    if (data && !stillOffered) onChange(null)
  }, [data, stillOffered, onChange])

  if (!pin) return null
  if (slots.isPending) return <Skeleton h={60} />
  if (!data) return null

  const scheduled = value !== null
  return (
    <Stack gap="xs">
      <Radio.Group
        value={scheduled ? 'slot' : 'standard'}
        aria-label="Delivery"
        onChange={(v) => {
          if (v === 'standard') onChange(null)
          else {
            const first = data.days.find((d) => d.windows.some((w) => w.available))
            const open = first?.windows.find((w) => w.available)
            if (first && open) onChange({ date: first.date, window: open.window })
          }
        }}
      >
        <Stack gap="xs">
          <Radio
            value="standard"
            label="Standard delivery"
            description={data.standardBy ? `Arrives by ${formatDay(data.standardBy)}` : undefined}
            disabled={disabled}
          />
          <Radio
            value="slot"
            label="Choose a day and time"
            description={data.bookable ? 'Free; we deliver in the window you pick' : data.reason}
            disabled={disabled || !data.bookable}
          />
        </Stack>
      </Radio.Group>

      {scheduled && data.bookable && (
        <Stack gap="xs" pl="xl">
          <Chip.Group
            value={value.date}
            onChange={(date) => {
              const d = data.days.find((x) => x.date === date)
              const keep = d?.windows.find((w) => w.window === value.window && w.available)
              const open = keep ?? d?.windows.find((w) => w.available)
              if (d && open) onChange({ date: d.date, window: open.window })
            }}
          >
            <Group gap={6} role="radiogroup" aria-label="Delivery day">
              {data.days.map((d) => (
                <Chip
                  key={d.date}
                  value={d.date}
                  size="xs"
                  disabled={disabled || !d.windows.some((w) => w.available)}
                >
                  {formatDay(d.date)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          {day && (
            <Chip.Group value={value.window} onChange={(w) => onChange({ date: value.date, window: w as DeliveryWindow })}>
              <Group gap={6} role="radiogroup" aria-label="Delivery time">
                {day.windows.map((w) => (
                  <Chip key={w.window} value={w.window} size="xs" disabled={disabled || !w.available}>
                    {w.label}
                    {!w.available ? ' (full)' : w.placesLeft <= 5 ? ` (${w.placesLeft} left)` : ''}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          )}
          <Text size="xs" c="dimmed">
            Someone needs to be at the address to take the parcel and give the delivery code.
          </Text>
        </Stack>
      )}
    </Stack>
  )
}
