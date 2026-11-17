import { Anchor, Button, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBell, IconBellCheck } from '@tabler/icons-react'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { useSaveToWishlist, useWishlistEntry } from './queries'

/**
 * For a sold-out product: "Email me when it's back". Asking also saves it to the wishlist.
 * The email is sent once; after that the shopper can ask again.
 */
export function BackInStockButton({ sku, name }: { sku: string; name: string }) {
  const entry = useWishlistEntry(sku)
  const save = useSaveToWishlist()
  const waiting = entry?.notifyWhenAvailable === true && entry.notifiedAt === null

  const ask = (notifyWhenAvailable: boolean) =>
    save.mutate(
      { sku, notifyWhenAvailable },
      {
        onSuccess: () =>
          notifications.show(
            notifyWhenAvailable
              ? { color: 'green', title: 'We will email you', message: `As soon as ${name} is back in stock.` }
              : { color: 'gray', title: 'No email', message: 'It stays in your wishlist.' },
          ),
        onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
      },
    )

  if (waiting) {
    return (
      <Group gap="xs">
        <IconBellCheck size={18} color="var(--mantine-color-green-7)" />
        <Text size="sm">We will email you when it is back.</Text>
        <Anchor component="button" type="button" size="sm" onClick={() => ask(false)} disabled={save.isPending}>
          Cancel
        </Anchor>
      </Group>
    )
  }
  return (
    <Stack gap={6} align="flex-start">
      {entry?.notifiedAt && (
        <Text size="xs" c="dimmed">
          We emailed you on {formatDate(entry.notifiedAt)} that it was back; it has sold out again.
        </Text>
      )}
      <Button variant="light" leftSection={<IconBell size={18} />} onClick={() => ask(true)} loading={save.isPending}>
        Email me when it is back
      </Button>
    </Stack>
  )
}

