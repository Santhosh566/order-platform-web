import { SimpleGrid, Stack, Title } from '@mantine/core'
import { useAuth } from '../auth/AuthContext'
import { ProductCardView } from './ProductCardView'
import { readRecent } from './recentlyViewed'

/** The shopper's last opened products, newest first; nothing until they have opened one. */
export function RecentlyViewed({ exclude, max = 4 }: { exclude?: string; max?: number }) {
  const { me } = useAuth()
  const recent = me ? readRecent(me.userId).filter((p) => p.sku !== exclude).slice(0, max) : []
  if (recent.length === 0) return null
  return (
    <Stack gap="sm">
      <Title order={4}>Recently viewed</Title>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="sm">
        {recent.map((p) => (
          <ProductCardView key={p.sku} product={p} compact />
        ))}
      </SimpleGrid>
    </Stack>
  )
}
