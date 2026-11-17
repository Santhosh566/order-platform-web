import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Grid,
  Group,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShoppingCartPlus, IconZoomIn } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { useCart } from '../../cart/CartContext'
import { MAX_QUANTITY } from '../../cart/cart'
import { PhotoViewer } from '../../components/PhotoViewer'
import { ProductImage } from '../../components/ProductImage'
import { QueryState } from '../../components/QueryState'
import { formatMoney, formatRate } from '../../lib/format'
import { paragraphs } from '../../lib/images'
import { useProductDetail, type ProductDetail } from '../../shop/catalogue'
import { ProductCardView, StockBadge } from '../../shop/ProductCardView'
import { DeliveryCheck } from '../../shop/DeliveryCheck'
import { RecentlyViewed } from '../../shop/RecentlyViewed'
import { rememberViewed } from '../../shop/recentlyViewed'
import { ShareButton } from '../../shop/ShareButton'
import { Stars } from '../../shop/Stars'
import { ProductReviews } from '../../reviews/ProductReviews'
import { ProductOffers } from '../../promotions/ProductOffers'
import { BackInStockButton } from '../../wishlist/BackInStockButton'
import { WishlistButton } from '../../wishlist/WishlistButton'

/** One product: photos, brand, rating, price with GST, specifications, related products, add to cart. */
export function ProductDetailPage() {
  const { sku = '' } = useParams()
  const product = useProductDetail(sku)
  return (
    <Stack gap="md" maw={1200}>
      <QueryState query={product}>
        {(data) =>
          data ? (
            <ProductView key={data.sku} product={data} />
          ) : (
            <Stack>
              <Title order={3}>This product is not available</Title>
              <Anchor component={Link} to="/shop">
                Back to the shop
              </Anchor>
            </Stack>
          )
        }
      </QueryState>
    </Stack>
  )
}

function ProductView({ product }: { product: ProductDetail }) {
  const cart = useCart()
  const { me } = useAuth()
  // Remembered for "Recently viewed"; a write only, nothing to re-render
  useEffect(() => {
    if (me) rememberViewed(me.userId, product)
  }, [me, product])
  const images = product.images.map((i) => ({ ...i, id: Number(i.id) }))
  const [selected, setSelected] = useState(0)
  const [viewing, setViewing] = useState<number | null>(null)
  const limit = Math.min(MAX_QUANTITY, product.maxPerOrder ?? MAX_QUANTITY)
  const [quantity, setQuantity] = useState(1)
  const soldOut = product.stockStatus === 'OUT_OF_STOCK'
  const shown = images[Math.min(selected, Math.max(images.length - 1, 0))]
  const inCart = cart.lines.find((l) => l.sku === product.sku)?.quantity ?? 0

  const add = () => {
    if (inCart + quantity > limit) {
      notifications.show({
        color: 'orange',
        title: 'Limit per order',
        message: `At most ${limit} of this product per order; ${inCart} already in your cart.`,
      })
      return
    }
    cart.add({ sku: product.sku, name: product.name, unitPrice: product.price }, quantity)
    notifications.show({ color: 'green', title: 'Added to cart', message: `${quantity} × ${product.name}` })
  }

  return (
    <Stack gap="xl">
      <Breadcrumbs>
        <Anchor component={Link} to="/shop" size="sm">
          Shop
        </Anchor>
        {product.category?.parentSlug && (
          <Anchor component={Link} to={`/shop?category=${product.category.parentSlug}`} size="sm">
            {product.category.parentName}
          </Anchor>
        )}
        {product.category && (
          <Anchor component={Link} to={`/shop?category=${product.category.slug}`} size="sm">
            {product.category.name}
          </Anchor>
        )}
        <Text size="sm" c="dimmed" lineClamp={1}>
          {product.name}
        </Text>
      </Breadcrumbs>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="sm">
            <Paper withBorder radius="md" p="xs" pos="relative">
              {shown ? (
                <UnstyledButton
                  onClick={() => setViewing(selected)}
                  aria-label={`Enlarge photo${shown.altText ? `: ${shown.altText}` : ''}`}
                  style={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
                >
                  <ProductImage imageKey={shown.largeKey} alt={shown.altText ?? product.name} naturalWidth={shown.width} />
                </UnstyledButton>
              ) : (
                <ProductImage imageKey={null} alt={product.name} />
              )}
              {shown && (
                <Badge
                  variant="default"
                  pos="absolute"
                  bottom={14}
                  right={14}
                  leftSection={<IconZoomIn size={12} />}
                  style={{ pointerEvents: 'none' }}
                >
                  Click to enlarge
                </Badge>
              )}
            </Paper>
            {images.length > 1 && (
              <Group gap="xs" role="list" aria-label="Photos">
                {images.map((image, index) => (
                  <UnstyledButton
                    key={image.id}
                    role="listitem"
                    onClick={() => setSelected(index)}
                    aria-label={`Photo ${index + 1}${image.altText ? `: ${image.altText}` : ''}`}
                    aria-current={index === selected ? 'true' : undefined}
                    style={{
                      width: 72,
                      borderRadius: 'var(--mantine-radius-sm)',
                      outline: index === selected ? '2px solid var(--mantine-primary-color-filled)' : undefined,
                      outlineOffset: 2,
                    }}
                  >
                    <ProductImage imageKey={image.thumbKey} alt={image.altText ?? product.name} />
                  </UnstyledButton>
                ))}
              </Group>
            )}
            <PhotoViewer
              images={images}
              index={viewing}
              name={product.name}
              onChange={(i) => {
                setViewing(i)
                setSelected(i)
              }}
              onClose={() => setViewing(null)}
            />
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <div>
              {product.brand && (
                <Anchor component={Link} to={`/shop?brand=${encodeURIComponent(product.brand)}`} size="sm" fw={600} tt="uppercase">
                  {product.brand}
                </Anchor>
              )}
              <Title order={2}>{product.name}</Title>
              <Group gap="sm" justify="space-between">
                <Group gap="sm">
                  <Text size="sm" c="dimmed">
                    {product.sku}
                  </Text>
                  {product.rating.count > 0 && (
                    <Anchor href="#reviews" underline="never" aria-label="Go to ratings and reviews">
                      <Stars average={product.rating.average} count={product.rating.count} size="sm" />
                    </Anchor>
                  )}
                </Group>
                <Group gap="xs">
                  <WishlistButton sku={product.sku} name={product.name} variant="button" />
                  <ShareButton title={product.name} path={`/shop/${encodeURIComponent(product.sku)}`} />
                </Group>
              </Group>
            </div>
            <Group gap="sm">
              <Text fw={700} fz={28}>
                {formatMoney(product.price, product.currency)}
              </Text>
              <StockBadge status={product.stockStatus} />
            </Group>
            <Text size="sm" c="dimmed">
              Includes GST at {formatRate(product.gstRate)}. Free delivery anywhere in India. Returns within 7 days of
              delivery.
            </Text>
            <ProductOffers offers={product.offers} />

            <Group gap="xs" wrap="nowrap" maw={380}>
              <NumberInput
                aria-label={`Quantity of ${product.name}`}
                value={quantity}
                onChange={(v) => setQuantity(typeof v === 'number' ? v : 1)}
                min={1}
                max={limit}
                clampBehavior="strict"
                allowDecimal={false}
                w={90}
                disabled={soldOut}
              />
              <Button flex={1} leftSection={<IconShoppingCartPlus size={18} />} onClick={add} disabled={soldOut}>
                {soldOut ? 'Sold out' : 'Add to cart'}
              </Button>
            </Group>
            {soldOut && <BackInStockButton sku={product.sku} name={product.name} />}
            {product.maxPerOrder && (
              <Text size="xs" c="dimmed">
                At most {product.maxPerOrder} per order.
              </Text>
            )}
            <DeliveryCheck sku={product.sku} />

            {paragraphs(product.description).length > 0 && (
              <Stack gap="xs">
                <Title order={4}>About this product</Title>
                {paragraphs(product.description).map((p, i) => (
                  // Plain text only: line breaks kept, nothing interpreted as markup
                  <Text key={i} size="sm" style={{ whiteSpace: 'pre-line' }}>
                    {p}
                  </Text>
                ))}
              </Stack>
            )}

            {product.specs.length > 0 && (
              <Stack gap="xs">
                <Title order={4}>Specifications</Title>
                <Table withTableBorder striped verticalSpacing={6} fz="sm">
                  <Table.Tbody>
                    {product.specs.map((s) => (
                      <Table.Tr key={s.name}>
                        <Table.Th scope="row" w="40%" fw={500} c="dimmed">
                          {s.name}
                        </Table.Th>
                        <Table.Td>{s.value}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            )}
          </Stack>
        </Grid.Col>
      </Grid>

      <ProductReviews sku={product.sku} name={product.name} />

      {product.related.length > 0 && (
        <Stack gap="sm">
          <Title order={3}>More in {product.category?.name ?? 'this category'}</Title>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
            {product.related.slice(0, 4).map((p) => (
              <ProductCardView key={p.sku} product={p} compact />
            ))}
          </SimpleGrid>
        </Stack>
      )}
      <RecentlyViewed exclude={product.sku} />
    </Stack>
  )
}
