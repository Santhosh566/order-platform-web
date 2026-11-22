import { Alert, Text } from '@mantine/core'
import { IconMapPin, IconMapPinOff } from '@tabler/icons-react'
import { ago } from './queries'
import type { Sharing } from './useShareLocation'

/** Tells the driver, always, whether customers can see where they are. */
export function LocationSharingBanner({ sharing }: { sharing: Sharing }) {
  const { state, lastSentAt, problem } = sharing
  if (state === 'off') return null
  if (state === 'sharing' || state === 'starting') {
    return (
      <Alert color="green" variant="light" icon={<IconMapPin size={18} />} title="Sharing your location">
        <Text size="sm">
          Customers you are delivering to can see where you are until their parcel is delivered. Keep this page open.
          {lastSentAt ? ` Last sent ${ago(new Date(lastSentAt).toISOString())}.` : ' Finding your position…'}
        </Text>
      </Alert>
    )
  }
  return (
    <Alert color={state === 'denied' ? 'red' : 'yellow'} variant="light" icon={<IconMapPinOff size={18} />}
      title={state === 'denied' ? 'Location blocked' : 'Location not shared'}>
      <Text size="sm">{problem}</Text>
    </Alert>
  )
}
