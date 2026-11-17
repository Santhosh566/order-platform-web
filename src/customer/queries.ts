import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type {
  CancelItemsReply,
  CancelItemsRequest,
  CreditNote,
  NewOrder,
  NewReturn,
  Order,
  OrderAccepted,
  OrderSummary,
  PublicProduct,
  PublicProductDetail,
  CategoryNode,
  ReturnRequest,
  ShippingAddress,
} from '../api/types'

/** Query keys in one place, so a change can refresh everything that shows it. */
export const keys = {
  catalog: ['catalog'] as const,
  catalogIn: (category: string | null) => ['catalog', 'list', category ?? 'all'] as const,
  product: (sku: string) => ['catalog', 'product', sku] as const,
  categories: ['categories'] as const,
  orders: ['orders'] as const,
  order: (orderId: string) => ['orders', orderId] as const,
  returns: ['returns'] as const,
  creditNotes: (orderId: string) => ['credit-notes', orderId] as const,
}

/** Every product on sale, or one category's (a main category includes its sub-categories). */
export function useCatalog(category: string | null = null) {
  return useQuery({
    queryKey: keys.catalogIn(category),
    queryFn: ({ signal }) =>
      api<PublicProduct[]>(
        '/api/public/catalog' + (category ? `?category=${encodeURIComponent(category)}` : ''),
        { anonymous: true, signal },
      ),
  })
}

export function useProduct(sku: string) {
  return useQuery({
    queryKey: keys.product(sku),
    queryFn: ({ signal }) =>
      api<PublicProductDetail>(`/api/public/catalog/${encodeURIComponent(sku)}`, { anonymous: true, signal }),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: ({ signal }) => api<CategoryNode[]>('/api/public/categories', { anonymous: true, signal }),
    staleTime: 5 * 60_000,
  })
}

export function useOrders() {
  return useQuery({
    queryKey: keys.orders,
    queryFn: ({ signal }) => api<OrderSummary[]>('/api/orders', { signal }),
  })
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: keys.order(orderId),
    queryFn: ({ signal }) => api<Order>(`/api/orders/${encodeURIComponent(orderId)}`, { signal }),
  })
}

export function useReturns() {
  return useQuery({
    queryKey: keys.returns,
    queryFn: ({ signal }) => api<ReturnRequest[]>('/api/returns', { signal }),
  })
}

export function useCreditNotes(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.creditNotes(orderId),
    queryFn: ({ signal }) =>
      api<CreditNote[]>(`/api/returns/orders/${encodeURIComponent(orderId)}/credit-notes`, { signal }),
    enabled,
  })
}

export function usePlaceOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (order: NewOrder) => api<OrderAccepted>('/api/orders', { method: 'POST', body: order }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.orders })
      // Stock labels change once the order reserves its units
      void client.invalidateQueries({ queryKey: keys.catalog })
    },
  })
}

/**
 * Cancels the order the customer is looking at. version is the one they were shown: if the order
 * changed since, nothing happens and it is reloaded (isOrderChanged).
 */
export function useCancelOrder(orderId: string, version?: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api<{ status: string; orderId: string; message: string }>(
        `/api/orders/${encodeURIComponent(orderId)}/cancel`,
        { method: 'POST', ifMatch: version },
      ),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.orders }),
  })
}

/** Cancels some units before dispatch (the customer's own order, or any order for an admin). */
export function useCancelItems(orderId: string, version?: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: CancelItemsRequest) =>
      api<CancelItemsReply>(`/api/orders/${encodeURIComponent(orderId)}/cancel-items`, {
        method: 'POST',
        body: request,
        ifMatch: version,
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.orders })
      void client.invalidateQueries({ queryKey: keys.creditNotes(orderId) })
      // The units are back on sale
      void client.invalidateQueries({ queryKey: keys.catalog })
    },
  })
}

export function useRequestReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: NewReturn) => api<ReturnRequest>('/api/returns', { method: 'POST', body: request }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: keys.returns })
      void client.invalidateQueries({ queryKey: keys.order(created.orderId) })
    },
  })
}

export function useSaveAddress() {
  return useMutation({
    mutationFn: (address: ShippingAddress) =>
      api<ShippingAddress>('/api/me/address', { method: 'PUT', body: address }),
  })
}
