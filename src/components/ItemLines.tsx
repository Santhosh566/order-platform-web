import { Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { ProductImage } from './ProductImage'
import { useThumbnails, type Thumbnail } from './thumbnails'

/** The small square photo used beside a line on orders, returns and pickups. */
export function ItemPhoto({ thumbnail, name, size = 48 }: { thumbnail?: Thumbnail; name: string; size?: number }) {
  return (
    <div style={{ width: size, flexShrink: 0 }}>
      <ProductImage imageKey={thumbnail?.imageKey} alt={name} ratio={1} />
    </div>
  )
}

/** One line: photo, name, then "SKU · 2 units" (or whatever detail is given). */
export function ItemLine({
  sku,
  quantity,
  name,
  thumbnail,
  detail,
  size,
}: {
  sku: string
  quantity?: number
  /** The name recorded on the order, if any; otherwise the catalogue's */
  name?: string | null
  thumbnail?: Thumbnail
  detail?: ReactNode
  size?: number
}) {
  const label = name ?? thumbnail?.name ?? sku
  return (
    <Group gap="sm" wrap="nowrap" align="center" role="listitem" aria-label={label}>
      <ItemPhoto thumbnail={thumbnail} name={label} size={size} />
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} lineClamp={2}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {detail ?? (
            <>
              {sku}
              {quantity !== undefined && <> · {quantity === 1 ? '1 unit' : `${quantity} units`}</>}
            </>
          )}
        </Text>
      </div>
    </Group>
  )
}

/** The lines of a return or pickup, each with its photo. */
export function ItemLines({
  items,
  label = 'Items',
}: {
  items: Array<{ sku: string; quantity: number; name?: string | null }>
  label?: string
}) {
  const thumbnails = useThumbnails(items.map((i) => i.sku))
  return (
    <Stack gap={6} role="list" aria-label={label} my={4}>
      {items.map((i, index) => (
        <ItemLine key={`${i.sku}-${index}`} sku={i.sku} quantity={i.quantity} name={i.name} thumbnail={thumbnails.get(i.sku)} />
      ))}
    </Stack>
  )
}
