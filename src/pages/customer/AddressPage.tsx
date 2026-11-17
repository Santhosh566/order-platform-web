import { Alert, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle } from '@tabler/icons-react'
import type { ShippingAddress } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { AddressForm } from '../../components/AddressForm'
import { errorMessage } from '../../lib/errors'
import { useSaveAddress } from '../../customer/queries'

/** The default delivery address. Orders already placed keep the address they were placed with. */
export function AddressPage() {
  const auth = useAuth()
  const save = useSaveAddress()
  const current = auth.me?.defaultAddress ?? null

  const submit = (address: ShippingAddress) =>
    save.mutate(address, {
      onSuccess: async () => {
        await auth.refreshMe()
        notifications.show({ color: 'green', title: 'Address saved', message: 'New orders will be delivered here.' })
      },
      onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
    })

  return (
    <Stack gap="md" maw={720}>
      <div>
        <Title order={2}>Delivery address</Title>
        <Text c="dimmed" size="sm">
          We deliver anywhere in India. Your state decides whether GST is charged as CGST + SGST or as IGST.
        </Text>
      </div>
      {!current && (
        <Alert icon={<IconInfoCircle size={18} />}>
          You have no saved address yet. Save one to check out faster.
        </Alert>
      )}
      <Paper withBorder radius="md" p="lg">
        {/* Remounted after a save so the form shows what the server stored */}
        <AddressForm
          key={JSON.stringify(current)}
          initial={current}
          submitLabel="Save address"
          busy={save.isPending}
          onSubmit={submit}
        />
      </Paper>
      <Text size="xs" c="dimmed">
        Changing this does not move orders already placed.
      </Text>
    </Stack>
  )
}
