import { Anchor, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconHeart, IconShoppingCartPlus, IconTrash } from '@tabler/icons-react'
import { Link } from 'react-router'
import { useCart } from '../../cart/CartContext'
import { MAX_QUANTITY } from '../../cart/cart'
import { ProductImage } from '../../components/ProductImage'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatMoney } from '../../lib/format'
import { StockBadge } from '../../shop/ProductCardView'
import { BackInStockButton } from '../../wishlist/BackInStockButton'
import { useRemoveFromWishlist, useWishlist, type WishlistEntry } from '../../wishlist/queries'

/** Products the customer saved for later, newest first, with today's price and stock. */
export function WishlistPage() {
  const wishlist = useWishlist()
  return (
    <Stack gap="md" maw={880}>
      <div>
        <Title order={2}>Wishlist</Title>
        <Text c="dimmed" size="sm">
          Products you saved, at today’s price. For one that is sold out, ask us to email you when it is back.
        </Text>
      </div>
      <QueryState query={wishlist}>{(rows) => <WishlistRows rows={rows} />}</QueryState>
    </Stack>
  )
}

function WishlistRows({ rows }: { rows: WishlistEntry[] }) {
  if (rows.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="sm">
          <IconHeart size={40} stroke={1.4} />
          <Text>Your wishlist is empty. Tap the heart on a product to save it here.</Text>
          <Button component={Link} to="/shop" variant="light">
            Browse the shop
          </Button>
        </Stack>
      </Paper>
    )
  }
  return (
    <Stack gap="sm" role="list" aria-label="Wishlist">
      {rows.map((entry) => (
        <WishlistRow key={entry.sku} entry={entry} />
      ))}
    </Stack>
  )
}

function WishlistRow({ entry }: { entry: WishlistEntry }) {
  const cart = useCart()
  const remove = useRemoveFromWishlist()
  const product = entry.product
  const href = `/shop/${encodeURIComponent(entry.sku)}`
  const inCart = cart.lines.find((l) => l.sku === entry.sku)?.quantity ?? 0
  const limit = Math.min(MAX_QUANTITY, product?.maxPerOrder ?? MAX_QUANTITY)

  const addToCart = () => {
    if (!product) return
    if (inCart + 1 > limit) {
      notifications.show({ color: 'orange', title: 'Limit per order', message: `At most ${limit} of this product per order.` })
      return
    }
    cart.add({ sku: product.sku, name: product.name, unitPrice: product.price }, 1)
    notifications.show({ color: 'green', title: 'Added to cart', message: product.name })
  }

  const onRemove = () =>
    remove.mutate(entry.sku, {
      onError: (error) => notifications.show({ color: 'red', title: 'Not removed', message: errorMessage(error) }),
    })

  return (
    <Paper withBorder radius="md" p="sm" role="listitem" aria-label={entry.name}>
      <Group wrap="nowrap" align="flex-start" gap="md">
        <div style={{ width: 88, flexShrink: 0 }}>
          {product ? (
            <Link to={href} aria-label={`${entry.name}: details`}>
              <ProductImage imageKey={product.imageKey} alt={product.imageAlt ?? entry.name} ratio={1} />
            </Link>
          ) : (
            <ProductImage imageKey={null} alt={entry.name} ratio={1} />
          )}
        </div>
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          {product ? (
            <Anchor component={Link} to={href} fw={600} c="inherit" lineClamp={2}>
              {entry.name}
            </Anchor>
          ) : (
            <Text fw={600} c="dimmed" lineClamp={2}>
              {entry.name}
            </Text>
          )}
          {product ? (
            <Group gap="sm">
              <Text fw={700}>{formatMoney(product.price, product.currency)}</Text>
              <StockBadge status={product.stockStatus} />
            </Group>
          ) : (
            <Badge color="gray" variant="light" w="fit-content">
              No longer sold
            </Badge>
          )}
          <Text size="xs" c="dimmed">
            Saved on {formatDate(entry.addedAt)}
          </Text>
          <Group gap="xs" mt={4}>
            {product && product.stockStatus !== 'OUT_OF_STOCK' && (
              <Button size="xs" leftSection={<IconShoppingCartPlus size={16} />} onClick={addToCart}>
                Add to cart
              </Button>
            )}
            {product && product.stockStatus === 'OUT_OF_STOCK' && <BackInStockButton sku={entry.sku} name={entry.name} />}
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={onRemove}
              loading={remove.isPending}
              aria-label={`Remove ${entry.name}`}
            >
              Remove
            </Button>
          </Group>
        </Stack>
      </Group>
    </Paper>
  )
}
