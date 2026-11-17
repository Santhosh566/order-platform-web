import { Alert, Button, PinInput, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

/**
 * The 6-digit code pad used at the customer's door, for deliveries and return pickups alike.
 * The server counts wrong codes; after 5 the code can no longer be used.
 */
export function CodeEntry({
  attemptsLeft,
  instruction,
  lockedText,
  confirmLabel,
  busy,
  ready = true,
  children,
  onConfirm,
}: {
  attemptsLeft: number
  instruction: string
  lockedText: string
  confirmLabel: string
  busy: boolean
  /** Something else must be done first, such as checking the items. */
  ready?: boolean
  children?: ReactNode
  onConfirm: (code: string, onError: (message: string) => void) => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (attemptsLeft <= 0) {
    return (
      <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Too many wrong codes">
        {lockedText}
      </Alert>
    )
  }

  return (
    <Stack gap="xs" align="center">
      <Text size="sm" ta="center">
        {instruction}
      </Text>
      {children}
      <PinInput
        length={6}
        type="number"
        oneTimeCode
        size="lg"
        value={code}
        onChange={(value) => {
          setCode(value)
          setError(null)
        }}
        aria-label="Customer's code"
        error={!!error}
      />
      {error && (
        <Text size="sm" c="red" ta="center">
          {error}
        </Text>
      )}
      {/* The server's count: the list reloads after every try */}
      {attemptsLeft < 5 && (
        <Text size="sm" c="dimmed" ta="center">
          {attemptsLeft} {attemptsLeft === 1 ? 'try' : 'tries'} left
        </Text>
      )}
      <Button
        size="lg"
        fullWidth
        disabled={code.length !== 6 || !ready}
        loading={busy}
        onClick={() =>
          onConfirm(code, (message) => {
            setCode('')
            setError(message)
          })
        }
      >
        {confirmLabel}
      </Button>
    </Stack>
  )
}
