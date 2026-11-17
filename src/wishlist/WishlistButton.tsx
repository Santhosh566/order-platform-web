import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { errorMessage } from '../lib/errors'
import { useRemoveFromWishlist, useSaveToWishlist, useWishlistEntry } from './queries'

/** The heart: saves the product to the wishlist, or takes it off. Customers only. */
export function WishlistButton({ sku, name, variant = 'icon' }: { sku: string; name: string; variant?: 'icon' | 'button' }) {
  const entry = useWishlistEntry(sku)
  const save = useSaveToWishlist()
  const remove = useRemoveFromWishlist()
  const saved = entry !== undefined
  const busy = save.isPending || remove.isPending
  const label = saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`

  const toggle = () => {
    const onError = (error: unknown) =>
      notifications.show({ color: 'red', title: 'Wishlist not changed', message: errorMessage(error) })
    if (saved) remove.mutate(sku, { onError })
    else
      save.mutate(
        { sku },
        { onSuccess: () => notifications.show({ color: 'green', title: 'Saved to wishlist', message: name }), onError },
      )
  }

  const icon = saved ? <IconHeartFilled size={18} /> : <IconHeart size={18} />
  if (variant === 'button') {
    return (
      <Button variant="default" size="xs" color="red" leftSection={icon} onClick={toggle} loading={busy} aria-pressed={saved}>
        {saved ? 'Saved' : 'Save'}
      </Button>
    )
  }
  return (
    <Tooltip label={saved ? 'Saved: click to remove' : 'Save to wishlist'} withArrow>
      <ActionIcon
        variant="white"
        color="red"
        radius="xl"
        size="lg"
        aria-label={label}
        aria-pressed={saved}
        onClick={toggle}
        loading={busy}
        style={{ boxShadow: 'var(--mantine-shadow-xs)' }}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  )
}
