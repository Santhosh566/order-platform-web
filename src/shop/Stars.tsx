import { Group, Rating, Text } from '@mantine/core'

/** "★★★★☆ 4.2 (31)", or nothing for a product nobody has rated yet. */
export function Stars({ average, count, size = 'xs' }: { average: number; count: number; size?: 'xs' | 'sm' | 'md' }) {
  if (count === 0) return null
  return (
    <Group gap={4} wrap="nowrap" aria-label={`Rated ${average.toFixed(1)} out of 5 by ${count} ${count === 1 ? 'customer' : 'customers'}`}>
      <Rating value={average} fractions={2} readOnly size={size} />
      <Text size={size} c="dimmed" aria-hidden>
        {average.toFixed(1)} ({count})
      </Text>
    </Group>
  )
}
