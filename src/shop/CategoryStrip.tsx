import { Box, Chip, Group, ScrollArea, Skeleton, Text, UnstyledButton } from '@mantine/core'
import { IconLayoutGrid } from '@tabler/icons-react'
import { ProductImage } from '../components/ProductImage'
import type { CategoryTile } from './catalogue'

const TILE = 76

/**
 * The row of round category pictures across the top of the shop, as in the big Indian shopping
 * apps: tap one to see only it; it scrolls sideways on a phone.
 */
export function CategoryStrip({
  tree,
  selected,
  onSelect,
}: {
  tree: CategoryTile[] | undefined
  /** The main category on show, or null for all */
  selected: string | null
  onSelect: (slug: string | null) => void
}) {
  return (
    <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars>
      <Group gap="md" wrap="nowrap" role="list" aria-label="Categories" pb={4}>
        <Tile label="All" active={selected === null} onClick={() => onSelect(null)}>
          <Box
            w={TILE}
            h={TILE}
            style={{
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--mantine-color-default-hover)',
            }}
          >
            <IconLayoutGrid size={30} stroke={1.5} />
          </Box>
        </Tile>
        {tree
          ? tree
              .filter((c) => (c.productCount ?? 0) > 0)
              .map((c) => (
                <Tile key={c.slug} label={c.name} active={selected === c.slug} onClick={() => onSelect(c.slug)}>
                  <Box w={TILE} h={TILE} style={{ borderRadius: '50%', overflow: 'hidden' }}>
                    <ProductImage imageKey={c.imageKey} alt="" ratio={1} radius="0" />
                  </Box>
                </Tile>
              ))
          : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} circle height={TILE} />)}
      </Group>
    </ScrollArea>
  )
}

function Tile({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <UnstyledButton
      role="listitem"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      w={TILE + 16}
      style={{ flexShrink: 0, textAlign: 'center' }}
    >
      <Box
        mx="auto"
        w={TILE + 6}
        p={2}
        style={{
          borderRadius: '50%',
          outline: active ? '3px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
          outlineOffset: active ? 1 : 0,
          transition: 'outline-color 120ms',
        }}
      >
        {children}
      </Box>
      <Text size="xs" mt={6} fw={active ? 700 : 500} lineClamp={2} lh={1.25}>
        {label}
      </Text>
    </UnstyledButton>
  )
}

/** The sub-categories of the main category on show, as pills: "All Electronics", "Laptops", … */
export function SubCategoryPills({
  main,
  selected,
  onSelect,
}: {
  main: CategoryTile
  selected: string
  onSelect: (slug: string) => void
}) {
  const subs = main.children.filter((c) => (c.productCount ?? 0) > 0)
  if (subs.length === 0) return null
  return (
    <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars>
      <Chip.Group multiple={false} value={selected} onChange={(v) => onSelect(v as string)}>
        <Group gap={6} wrap="nowrap" aria-label={`${main.name} sub-categories`} role="radiogroup">
          <Chip value={main.slug} size="sm" variant="outline">
            All {main.name}
          </Chip>
          {subs.map((s) => (
            <Chip key={s.slug} value={s.slug} size="sm" variant="outline">
              {s.name} ({s.productCount})
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </ScrollArea>
  )
}
