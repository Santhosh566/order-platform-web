import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { ProductCard } from '../shop/catalogue'

/** A saved product. product is null once it is no longer sold; name still says which it was. */
export interface WishlistEntry {
  sku: string
  name: string
  product: ProductCard | null
  addedAt: string
  /** Asked for the back-in-stock email */
  notifyWhenAvailable: boolean
  /** When that email was sent; null while still waiting */
  notifiedAt: string | null
}

export const wishlistKey = ['wishlist'] as const

/** The customer's wishlist; empty (and not fetched) for staff, who have none. */
export function useWishlist() {
  const { hasRole } = useAuth()
  const customer = hasRole('CUSTOMER')
  return useQuery({
    queryKey: wishlistKey,
    queryFn: ({ signal }) => api<WishlistEntry[]>('/api/wishlist', { signal }),
    enabled: customer,
    staleTime: 60_000,
  })
}

/** The saved entry for a product, if any. */
export function useWishlistEntry(sku: string): WishlistEntry | undefined {
  return useWishlist().data?.find((e) => e.sku === sku)
}

/**
 * Saves a product; notifyWhenAvailable true also asks for the email (again), false cancels it.
 * The list is updated from the reply, so every heart on the page changes at once.
 */
export function useSaveToWishlist() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ sku, notifyWhenAvailable }: { sku: string; notifyWhenAvailable?: boolean }) =>
      api<WishlistEntry>(`/api/wishlist/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        body: notifyWhenAvailable === undefined ? {} : { notifyWhenAvailable },
      }),
    onSuccess: (saved) =>
      client.setQueryData<WishlistEntry[]>(wishlistKey, (list = []) => [
        saved,
        ...list.filter((e) => e.sku !== saved.sku),
      ]),
  })
}

export function useRemoveFromWishlist() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sku: string) => api<void>(`/api/wishlist/${encodeURIComponent(sku)}`, { method: 'DELETE' }),
    onSuccess: (_, sku) =>
      client.setQueryData<WishlistEntry[]>(wishlistKey, (list = []) => list.filter((e) => e.sku !== sku)),
  })
}
