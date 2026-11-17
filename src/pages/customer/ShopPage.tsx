import { Badge, Button, CloseButton, Drawer, Group, Indicator, Pagination, Paper, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAdjustmentsHorizontal, IconMoodEmpty } from '@tabler/icons-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useCart } from '../../cart/CartContext'
import { QueryState } from '../../components/QueryState'
import { formatMoney } from '../../lib/format'
import { useCategoryTree, useProducts, type CategoryTile, type Facets, type ProductSort } from '../../shop/catalogue'
import { CategoryStrip, SubCategoryPills } from '../../shop/CategoryStrip'
import { FilterPanel } from '../../shop/FilterPanel'
import { ProductCardView } from '../../shop/ProductCardView'
import { RecentlyViewed } from '../../shop/RecentlyViewed'
import { SearchBox } from '../../shop/SearchBox'
import { activeFilterCount, readShopQuery, toFilter, writeShopQuery, type ShopQuery } from '../../shop/shopQuery'
import { PromoCarousel } from '../../promotions/PromoCarousel'
import { offerHeadline, offerTerms } from '../../promotions/offerText'
import type { Offer } from '../../promotions/queries'

const SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'RELEVANCE', label: 'Relevance' },
  { value: 'PRICE_LOW_HIGH', label: 'Price: low to high' },
  { value: 'PRICE_HIGH_LOW', label: 'Price: high to low' },
  { value: 'NEWEST', label: 'Newest first' },
  { value: 'TOP_RATED', label: 'Top rated' },
]

/**
 * The shop: a strip of category pictures across the top (sub-categories as pills under it), search,
 * sort and pages. The full filter panel (category, brand, price, rating, stock, with counts) opens
 * from the Filters button, so the products get the whole width. Everything is in the address bar.
 */
export function ShopPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const cart = useCart()
  const query = useMemo(() => readShopQuery(params), [params])
  const filter = useMemo(() => toFilter(query), [query])
  const products = useProducts(filter, query.sort, query.page - 1)
  const [drawer, { open, close }] = useDisclosure(false)

  // Any change of filter starts again at page 1
  const update = (changes: Partial<ShopQuery>) =>
    setParams(writeShopQuery({ ...query, page: 1, ...changes }))
  const clearAll = () => setParams(writeShopQuery({ ...readShopQuery(new URLSearchParams()), q: query.q, sort: query.sort }))
  const facets = products.data?.facets
  const filtersOn = activeFilterCount(query)
  const tree = useCategoryTree().data
  const { main, current } = placeOf(tree, query.categories)
  // A category tile starts a fresh look at that category: brands of another one would match nothing
  const pickCategory = (slug: string | null) => update({ categories: slug ? [slug] : [], brands: [] })
  const heading = query.q ? `Results for “${query.q}”` : query.offer ? `Offer ${query.offer}` : (current?.name ?? 'Shop')
  // The coupon's terms come with the products it is for
  const offer = query.offer ? products.data?.items.flatMap((p) => p.offers ?? []).find((o) => o.code === query.offer) : undefined
  const plain = !query.q && filtersOn === 0 && query.page === 1

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>{heading}</Title>
          <Text c="dimmed" size="sm">
            All prices include GST. Free delivery anywhere in India.
          </Text>
        </div>
        <Group gap="sm" wrap="wrap">
          <SearchBox
            key={query.q}
            initial={query.q}
            onSearch={(text) => update({ q: text })}
            onPick={(s) => {
              if (s.kind === 'PRODUCT' && s.sku) navigate(`/shop/${encodeURIComponent(s.sku)}`)
              else if (s.kind === 'CATEGORY' && s.slug) update({ q: '', categories: [s.slug] })
              else if (s.kind === 'BRAND') update({ q: '', brands: [s.label] })
            }}
          />
          {cart.count > 0 && (
            <Button component={Link} to="/cart" variant="light">
              Cart ({cart.count})
            </Button>
          )}
        </Group>
      </Group>

      {plain && <PromoCarousel />}
      {offer && <OfferBanner offer={offer} />}

      <CategoryStrip tree={tree} selected={main?.slug ?? null} onSelect={pickCategory} />
      {main && <SubCategoryPills main={main} selected={current?.slug ?? main.slug} onSelect={(slug) => pickCategory(slug)} />}

      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <Indicator label={filtersOn} size={18} disabled={filtersOn === 0} offset={4}>
              <Button variant="default" size="sm" leftSection={<IconAdjustmentsHorizontal size={18} />} onClick={open}>
                Filters
              </Button>
            </Indicator>
            <Text size="sm" c="dimmed" aria-live="polite">
              {products.data ? `${products.data.totalItems.toLocaleString('en-IN')} products` : ' '}
            </Text>
          </Group>
          <Select
            aria-label="Sort by"
            size="sm"
            w={200}
            data={SORTS}
            value={query.sort}
            onChange={(v) => update({ sort: (v as ProductSort) ?? 'RELEVANCE' })}
            allowDeselect={false}
          />
        </Group>

        <ActiveFilters query={query} facets={facets} onChange={update} onClear={clearAll} />

        <QueryState query={products}>
          {(page) =>
            page.items.length === 0 ? (
              <Paper withBorder radius="md" p="xl">
                <Stack align="center" gap="xs">
                  <IconMoodEmpty size={36} stroke={1.4} />
                  <Text>{query.offer && filtersOn === 1 ? `Offer ${query.offer} has ended or is not available.` : 'No products match.'}</Text>
                  {(filtersOn > 0 || query.q) && (
                    <Button variant="light" size="xs" onClick={() => setParams(new URLSearchParams())}>
                      Clear search and filters
                    </Button>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Stack gap="md" style={{ opacity: products.isPlaceholderData ? 0.6 : 1, transition: 'opacity 150ms' }}>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 4, xl: 5 }} spacing="sm">
                  {page.items.map((p) => (
                    <ProductCardView key={p.sku} product={p} />
                  ))}
                </SimpleGrid>
                {page.totalPages > 1 && (
                  <Group justify="center">
                    <Pagination
                      total={page.totalPages}
                      value={query.page}
                      onChange={(p) => {
                        setParams(writeShopQuery({ ...query, page: p }))
                        window.scrollTo({ top: 0 })
                      }}
                      size="sm"
                    />
                  </Group>
                )}
              </Stack>
            )
          }
        </QueryState>
      </Stack>

      {plain && <RecentlyViewed />}

      <Drawer opened={drawer} onClose={close} title="Filters" position="left" size="sm">
        {facets && (
          <Stack gap="md">
            <FilterPanel facets={facets} query={query} onChange={update} />
            <Button onClick={close}>Show {products.data?.totalItems ?? 0} products</Button>
          </Stack>
        )}
      </Drawer>
    </Stack>
  )
}

/**
 * Where the shopper is in the category tree: the main category on show (its tile is highlighted) and
 * the category itself, when exactly one is chosen.
 */
function placeOf(tree: CategoryTile[] | undefined, chosen: string[]): { main?: CategoryTile; current?: CategoryTile } {
  if (!tree || chosen.length !== 1) return {}
  for (const main of tree) {
    if (main.slug === chosen[0]) return { main, current: main }
    const sub = main.children.find((c) => c.slug === chosen[0])
    if (sub) return { main, current: sub }
  }
  return {}
}

/** The filters that are on, each removable, and "Clear all". */
function ActiveFilters({
  query,
  facets,
  onChange,
  onClear,
}: {
  query: ShopQuery
  facets: Facets | undefined
  onChange: (changes: Partial<ShopQuery>) => void
  onClear: () => void
}) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = []
  for (const slug of query.categories) {
    const name = facets?.categories.find((c) => c.slug === slug)?.name ?? slug
    chips.push({ key: `c-${slug}`, label: name, remove: () => onChange({ categories: query.categories.filter((c) => c !== slug) }) })
  }
  for (const brand of query.brands) {
    chips.push({ key: `b-${brand}`, label: brand, remove: () => onChange({ brands: query.brands.filter((b) => b !== brand) }) })
  }
  if (query.min !== null || query.max !== null) {
    const label =
      query.min !== null && query.max !== null
        ? `${formatMoney(query.min)} – ${formatMoney(query.max)}`
        : query.min !== null
          ? `From ${formatMoney(query.min)}`
          : `Up to ${formatMoney(query.max)}`
    chips.push({ key: 'price', label, remove: () => onChange({ min: null, max: null }) })
  }
  if (query.inStock) chips.push({ key: 'stock', label: 'In stock', remove: () => onChange({ inStock: false }) })
  if (query.rating !== null) chips.push({ key: 'rating', label: `${query.rating}★ & up`, remove: () => onChange({ rating: null }) })
  if (query.offer) chips.push({ key: 'offer', label: `Offer ${query.offer}`, remove: () => onChange({ offer: '' }) })
  if (chips.length === 0) return null

  return (
    <Group gap={6} role="list" aria-label="Filters on">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          role="listitem"
          variant="light"
          size="lg"
          tt="none"
          rightSection={<CloseButton size="xs" aria-label={`Remove ${chip.label}`} onClick={chip.remove} />}
        >
          {chip.label}
        </Badge>
      ))}
      {chips.length > 1 && (
        <Button variant="subtle" size="compact-xs" onClick={onClear}>
          Clear all
        </Button>
      )}
    </Group>
  )
}

/** Above the products of /shop?offer=CODE: what the coupon gives, and its code to enter in the cart. */
function OfferBanner({ offer }: { offer: Offer }) {
  const terms = offerTerms(offer)
  return (
    <Paper withBorder radius="md" p="md" bg="var(--mantine-color-green-light)" aria-label="About this offer">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <div>
          <Text fw={700} size="lg">
            {offerHeadline(offer)} with code{' '}
            <Text span ff="monospace" fw={700}>
              {offer.code}
            </Text>
          </Text>
          <Text size="sm">{offer.description}</Text>
          {terms.length > 0 && (
            <Text size="xs" c="dimmed">
              {terms.join(' · ')}
            </Text>
          )}
        </div>
        <Text size="xs" c="dimmed" maw={260}>
          Add these products to your cart and enter {offer.code} there.
        </Text>
      </Group>
    </Paper>
  )
}
