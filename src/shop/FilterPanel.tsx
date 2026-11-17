import { Anchor, Button, Checkbox, Collapse, Divider, Group, NumberInput, RangeSlider, SegmentedControl, Stack, Switch, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { formatMoney } from '../lib/format'
import type { Facets } from './catalogue'
import { toggle, type ShopQuery } from './shopQuery'

/** Categories, price, brands, stock and rating, each with how many products it would show. */
export function FilterPanel({
  facets,
  query,
  onChange,
}: {
  facets: Facets
  query: ShopQuery
  onChange: (changes: Partial<ShopQuery>) => void
}) {
  return (
    <Stack gap="md">
      <Section title="Category">
        <CategoryTree facets={facets} selected={query.categories} onChange={(categories) => onChange({ categories })} />
      </Section>
      <Divider />
      {facets.price && (
        <>
          <Section title="Price">
            <PriceRange key={`${facets.price.min}-${facets.price.max}`} range={facets.price} query={query} onChange={onChange} />
          </Section>
          <Divider />
        </>
      )}
      {facets.brands.length > 0 && (
        <>
          <Section title="Brand">
            <Brands brands={facets.brands} selected={query.brands} onChange={(brands) => onChange({ brands })} />
          </Section>
          <Divider />
        </>
      )}
      <Switch
        label="In stock only"
        checked={query.inStock}
        onChange={(e) => onChange({ inStock: e.currentTarget.checked })}
      />
      <Section title="Customer rating">
        <SegmentedControl
          fullWidth
          size="xs"
          aria-label="Customer rating"
          value={String(query.rating ?? 0)}
          onChange={(v) => onChange({ rating: v === '0' ? null : Number(v) })}
          data={[
            { value: '0', label: 'Any' },
            { value: '3', label: '3★ & up' },
            { value: '4', label: '4★ & up' },
          ]}
        />
      </Section>
    </Stack>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

/** Main categories with counts; a chosen one opens its sub-categories. */
function CategoryTree({
  facets,
  selected,
  onChange,
}: {
  facets: Facets
  selected: string[]
  onChange: (categories: string[]) => void
}) {
  const mains = facets.categories.filter((c) => c.parentSlug === null)
  const [open, setOpen] = useState<string[]>(() =>
    mains.filter((m) => selected.includes(m.slug) || facets.categories.some((c) => c.parentSlug === m.slug && selected.includes(c.slug))).map((m) => m.slug),
  )
  if (mains.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No categories match.
      </Text>
    )
  }
  return (
    <Stack gap={2}>
      {selected.length > 0 && (
        <Anchor component="button" type="button" size="xs" onClick={() => onChange([])} ta="left">
          All categories
        </Anchor>
      )}
      {mains.map((main) => {
        const subs = facets.categories.filter((c) => c.parentSlug === main.slug)
        const expanded = open.includes(main.slug)
        return (
          <div key={main.slug}>
            <Group gap={4} wrap="nowrap">
              <UnstyledButton
                aria-label={`${expanded ? 'Hide' : 'Show'} ${main.name} sub-categories`}
                aria-expanded={expanded}
                onClick={() => setOpen(toggle(open, main.slug))}
                style={{ display: 'flex' }}
              >
                {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </UnstyledButton>
              <Checkbox
                size="xs"
                label={`${main.name} (${main.count})`}
                checked={selected.includes(main.slug)}
                onChange={() => onChange(toggle(selected, main.slug))}
              />
            </Group>
            <Collapse expanded={expanded}>
              <Stack gap={4} pl={34} py={4}>
                {subs.map((sub) => (
                  <Checkbox
                    key={sub.slug}
                    size="xs"
                    label={`${sub.name} (${sub.count})`}
                    checked={selected.includes(sub.slug) || selected.includes(main.slug)}
                    disabled={selected.includes(main.slug)}
                    onChange={() => onChange(toggle(selected, sub.slug))}
                  />
                ))}
              </Stack>
            </Collapse>
          </div>
        )
      })}
    </Stack>
  )
}

/** A slider and two boxes; the list changes when the slider is let go or a box is left. */
function PriceRange({
  range,
  query,
  onChange,
}: {
  range: { min: number; max: number }
  query: ShopQuery
  onChange: (changes: Partial<ShopQuery>) => void
}) {
  const low = Math.floor(range.min)
  const high = Math.ceil(range.max)
  const [value, setValue] = useState<[number, number]>([query.min ?? low, query.max ?? high])
  const apply = ([from, to]: [number, number]) =>
    onChange({ min: from <= low ? null : from, max: to >= high ? null : to })

  if (high - low < 1) {
    return <Text size="sm">{formatMoney(low)}</Text>
  }
  return (
    <Stack gap="xs">
      <RangeSlider
        aria-label="Price range"
        min={low}
        max={high}
        step={Math.max(1, Math.round((high - low) / 100))}
        minRange={1}
        value={value}
        onChange={setValue}
        onChangeEnd={apply}
        label={(v) => formatMoney(v)}
      />
      <Group gap="xs" grow wrap="nowrap">
        <NumberInput
          aria-label="Lowest price"
          size="xs"
          prefix="₹"
          thousandSeparator=","
          min={0}
          value={value[0]}
          onChange={(v) => typeof v === 'number' && setValue([v, value[1]])}
          onBlur={() => apply(value)}
        />
        <NumberInput
          aria-label="Highest price"
          size="xs"
          prefix="₹"
          thousandSeparator=","
          min={0}
          value={value[1]}
          onChange={(v) => typeof v === 'number' && setValue([value[0], v])}
          onBlur={() => apply(value)}
        />
      </Group>
    </Stack>
  )
}

function Brands({
  brands,
  selected,
  onChange,
}: {
  brands: Facets['brands']
  selected: string[]
  onChange: (brands: string[]) => void
}) {
  const [all, setAll] = useState(false)
  // Chosen brands always show, even beyond the first eight
  const shown = all ? brands : brands.filter((b, i) => i < 8 || selected.includes(b.brand))
  return (
    <Stack gap={4}>
      {shown.map((b) => (
        <Checkbox
          key={b.brand}
          size="xs"
          label={`${b.brand} (${b.count})`}
          checked={selected.includes(b.brand)}
          onChange={() => onChange(toggle(selected, b.brand))}
        />
      ))}
      {brands.length > 8 && (
        <Button variant="subtle" size="compact-xs" w="fit-content" onClick={() => setAll(!all)}>
          {all ? 'Fewer brands' : `All ${brands.length} brands`}
        </Button>
      )}
    </Stack>
  )
}
