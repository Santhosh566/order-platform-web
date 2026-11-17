import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/** A product's name and main photo, also for products no longer sold. */
export interface Thumbnail {
  sku: string
  name: string | null
  imageKey: string | null
}

/**
 * Names and photos for the products on an order or a return, in one request (public, cached).
 * Missing entries (an unknown SKU, or still loading) show a placeholder and the SKU.
 */
export function useThumbnails(skus: string[]): Map<string, Thumbnail> {
  const wanted = [...new Set(skus)].sort()
  const query = useQuery({
    queryKey: ['thumbnails', wanted],
    queryFn: ({ signal }) =>
      api<Thumbnail[]>(`/api/public/thumbnails?${wanted.map((s) => `sku=${encodeURIComponent(s)}`).join('&')}`, {
        anonymous: true,
        signal,
      }),
    enabled: wanted.length > 0,
    staleTime: 5 * 60_000,
  })
  return new Map((query.data ?? []).map((t) => [t.sku, t]))
}
