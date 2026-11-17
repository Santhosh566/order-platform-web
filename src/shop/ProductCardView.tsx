import { Anchor, Badge, Button, Card, Group, NumberInput, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShoppingCartPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useCart } from '../cart/CartContext'
import { MAX_QUANTITY } from '../cart/cart'
import { ProductImage } from '../components/ProductImage'
import { formatMoney } from '../lib/format'
import { cardOffer, offerHeadline } from '../promotions/offerText'
import type { ProductCard, StockStatus } from './catalogue'
import { Stars } from './Stars'
import { WishlistButton } from '../wishlist/WishlistButton'

/** A product in a list: photo, brand, name, rating, price, stock and add to cart. */
export function ProductCardView({ product, compact }: { product: ProductCard; compact?: boolean }) {
  const cart = useCart()
  const [quantity, setQuantity] = useState<number>(1)
  const soldOut = product.stockStatus === 'OUT_OF_STOCK'
  const limit = Math.min(MAX_QUANTITY, product.maxPerOrder ?? MAX_QUANTITY)
  const href = `/shop/${encodeURIComponent(product.sku)}`
  const offer = cardOffer(product.offers)

  const add = () => {
    cart.add({ sku: product.sku, name: product.name, unitPrice: product.price }, quantity)
    notifications.show({ color: 'green', title: 'Added to cart', message: `${quantity} × ${product.name}` })
    setQuantity(1)
  }

  return (
    <Card withBorder padding="md" radius="md" h="100%">
      <Card.Section mb="sm" pos="relative">
        <Link to={href} aria-label={`${product.name}: details`}>
          <ProductImage imageKey={product.imageKey} alt={product.imageAlt ?? product.name} ratio={1} radius="0" />
        </Link>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <WishlistButton sku={product.sku} name={product.name} />
        </div>
        {offer && (
          <Badge
            pos="absolute"
            top={10}
            left={10}
            color="green"
            variant="filled"
            tt="none"
            title={`${offer.description} (code ${offer.code})`}
            style={{ pointerEvents: 'none' }}
          >
            Extra {offerHeadline(offer)}
          </Badge>
        )}
      </Card.Section>
      <Stack gap={6} h="100%">
        {product.brand && (
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            {product.brand}
          </Text>
        )}
        <Anchor component={Link} to={href} fw={600} c="inherit" lineClamp={2} size="sm">
          {product.name}
        </Anchor>
        <Stars average={product.rating.average} count={product.rating.count} />
        <Group justify="space-between" align="center" mt="auto" wrap="nowrap">
          <Text fw={700} size="lg">
            {formatMoney(product.price, product.currency)}
          </Text>
          <StockBadge status={product.stockStatus} />
        </Group>
        {!compact && (
          <Group gap="xs" wrap="nowrap">
            <NumberInput
              aria-label={`Quantity of ${product.name}`}
              value={quantity}
              onChange={(v) => setQuantity(typeof v === 'number' ? v : 1)}
              min={1}
              max={limit}
              clampBehavior="strict"
              allowDecimal={false}
              w={70}
              size="xs"
              disabled={soldOut}
            />
            <Button flex={1} size="xs" leftSection={<IconShoppingCartPlus size={16} />} onClick={add} disabled={soldOut}>
              {soldOut ? 'Sold out' : 'Add to cart'}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

export function StockBadge({ status }: { status: StockStatus }) {
  const [label, color] =
    status === 'OUT_OF_STOCK' ? ['Out of stock', 'red'] : status === 'FEW_LEFT' ? ['Only a few left', 'orange'] : ['In stock', 'green']
  return (
    <Badge color={color} variant="light" size="sm" style={{ flexShrink: 0 }}>
      {label}
    </Badge>
  )
}
