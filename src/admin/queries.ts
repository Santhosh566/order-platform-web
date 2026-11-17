import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminOrderRow,
  ProductSpec,
  ProductPhoto,
  AvailablePickup,
  PickupInProgress,
  DeadLetter,
  RouteAction,
  RouteInfo,
  DeliveryAttempt,
  DeliveryInProgress,
  Driver,
  GoodwillRefund,
  ItemCondition,
  NewProduct,
  Page,
  PlatformMetrics,
  PriceChange,
  PriceView,
  ProductDetail,
  ProductEdit,
  ProductView,
  StatusCounts,
  StockChange,
  StockMovement,
  WaitingDelivery,
} from '../api/adminTypes'
import { api } from '../api/client'
import type { CategoryNode, CreditNote, OrderStatus, ReturnRequest, ReturnStatus } from '../api/types'

/** Everything under ['admin'] is refreshed when a live order change arrives. */
export const adminKeys = {
  all: ['admin'] as const,
  metrics: ['admin', 'metrics'] as const,
  statusCounts: ['admin', 'status-counts'] as const,
  orders: (params: OrderSearch) => ['admin', 'orders', params] as const,
  catalog: (params: CatalogSearch) => ['admin', 'catalog', params] as const,
  product: (sku: string) => ['admin', 'product', sku] as const,
  movements: (sku: string, page: number) => ['admin', 'movements', sku, page] as const,
  returns: (status: ReturnStatus | 'ALL') => ['admin', 'returns', status] as const,
  waiting: ['admin', 'delivery', 'waiting'] as const,
  inProgress: ['admin', 'delivery', 'in-progress'] as const,
  drivers: ['admin', 'delivery', 'drivers'] as const,
  attempts: (orderId: string) => ['admin', 'delivery', 'attempts', orderId] as const,
}

const enc = encodeURIComponent

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function useMetrics() {
  return useQuery({
    queryKey: adminKeys.metrics,
    queryFn: ({ signal }) => api<PlatformMetrics>('/api/admin/metrics', { signal }),
  })
}

export function useStatusCounts() {
  return useQuery({
    queryKey: adminKeys.statusCounts,
    queryFn: ({ signal }) => api<StatusCounts>('/api/admin/orders/status-counts', { signal }),
  })
}

// ── Orders ───────────────────────────────────────────────────────────────────

export interface OrderSearch {
  q: string
  status: OrderStatus[]
  page: number
  size: number
}

export function useAdminOrders(params: OrderSearch) {
  return useQuery({
    queryKey: adminKeys.orders(params),
    queryFn: ({ signal }) =>
      api<Page<AdminOrderRow>>(
        '/api/admin/orders' +
          query({ q: params.q.trim(), status: params.status.join(','), page: params.page, size: params.size }),
        { signal },
      ),
    // The table keeps the last page while the next loads, instead of flashing empty
    placeholderData: keepPreviousData,
  })
}

/** Refreshes the order, the lists it appears in, and the dashboard after a staff action. */
function useRefreshOrder() {
  const client = useQueryClient()
  return (orderId: string) => {
    void client.invalidateQueries({ queryKey: ['orders', orderId] })
    void client.invalidateQueries({ queryKey: ['credit-notes', orderId] })
    void client.invalidateQueries({ queryKey: adminKeys.all })
  }
}

// The order actions below send the version the admin was shown (If-Match). When the order changed
// since, nothing is done and it is reloaded, so they see what it is now before trying again.

export function useGoodwillRefund(orderId: string, version?: number) {
  const refresh = useRefreshOrder()
  return useMutation({
    mutationFn: (refund: GoodwillRefund) =>
      api<CreditNote>(`/api/admin/orders/${enc(orderId)}/refunds`, { method: 'POST', body: refund, ifMatch: version }),
    onSettled: () => refresh(orderId),
  })
}

export function useReturnToStock(orderId: string, version?: number) {
  const refresh = useRefreshOrder()
  return useMutation({
    mutationFn: () =>
      api<{ status: OrderStatus; orderId: string }>(`/api/admin/orders/${enc(orderId)}/return`, {
        method: 'POST',
        ifMatch: version,
      }),
    onSettled: () => refresh(orderId),
  })
}

export function useAdminCancel(orderId: string, version?: number) {
  const refresh = useRefreshOrder()
  return useMutation({
    mutationFn: () =>
      api<{ status: string; orderId: string; message: string }>(`/api/orders/${enc(orderId)}/cancel`, {
        method: 'POST',
        ifMatch: version,
      }),
    onSettled: () => refresh(orderId),
  })
}

// ── Catalogue ────────────────────────────────────────────────────────────────

export interface CatalogSearch {
  q: string
  includeInactive: boolean
  page: number
  size: number
}

export function useAdminCatalog(params: CatalogSearch) {
  return useQuery({
    queryKey: adminKeys.catalog(params),
    queryFn: ({ signal }) =>
      api<Page<ProductView>>('/api/admin/catalog' + query({ ...params, q: params.q.trim() }), { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(sku: string) {
  return useQuery({
    queryKey: adminKeys.product(sku),
    queryFn: ({ signal }) => api<ProductDetail>(`/api/admin/catalog/${enc(sku)}`, { signal }),
  })
}

export function useMovements(sku: string, page: number) {
  return useQuery({
    queryKey: adminKeys.movements(sku, page),
    queryFn: ({ signal }) =>
      api<Page<StockMovement>>(`/api/admin/catalog/${enc(sku)}/movements` + query({ page, size: 25 }), { signal }),
    placeholderData: keepPreviousData,
  })
}

function useRefreshCatalog() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: adminKeys.all })
    // The shop shows the same prices and stock labels
    void client.invalidateQueries({ queryKey: ['catalog'] })
  }
}

export function useCreateProduct() {
  const refresh = useRefreshCatalog()
  return useMutation({
    mutationFn: (product: NewProduct) =>
      api<ProductView>('/api/admin/catalog', { method: 'POST', body: product }),
    onSuccess: refresh,
  })
}

export function useEditProduct(sku: string) {
  const refresh = useRefreshCatalog()
  return useMutation({
    mutationFn: (edit: ProductEdit) =>
      api<ProductView>(`/api/admin/catalog/${enc(sku)}`, { method: 'PATCH', body: edit }),
    onSettled: refresh,
  })
}

export function useChangePrice(sku: string) {
  const refresh = useRefreshCatalog()
  return useMutation({
    mutationFn: (change: PriceChange) =>
      api<{ product: ProductView; price: PriceView }>(`/api/admin/catalog/${enc(sku)}/prices`, {
        method: 'POST',
        body: change,
      }),
    onSettled: refresh,
  })
}

export function useCancelScheduledPrice(sku: string) {
  const refresh = useRefreshCatalog()
  return useMutation({
    mutationFn: (priceId: number) =>
      api<PriceView>(`/api/admin/catalog/${enc(sku)}/prices/${priceId}`, { method: 'DELETE' }),
    onSettled: refresh,
  })
}

export function useChangeStock(sku: string) {
  const refresh = useRefreshCatalog()
  return useMutation({
    mutationFn: (change: StockChange) =>
      api<StockMovement>(`/api/admin/catalog/${enc(sku)}/stock`, { method: 'POST', body: change }),
    onSuccess: refresh,
  })
}

// ── Returns ──────────────────────────────────────────────────────────────────

export function useAdminReturns(status: ReturnStatus | 'ALL') {
  return useQuery({
    queryKey: adminKeys.returns(status),
    queryFn: ({ signal }) =>
      api<ReturnRequest[]>('/api/admin/returns' + query({ status: status === 'ALL' ? undefined : status }), {
        signal,
      }),
  })
}

function useReturnAction<TBody, TResult>(action: 'approve' | 'reject' | 'receive') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId, body }: { returnId: string; body: TBody }) =>
      api<TResult>(`/api/admin/returns/${enc(returnId)}/${action}`, { method: 'POST', body }),
    onSettled: (_data, _error, { returnId }) => {
      void client.invalidateQueries({ queryKey: adminKeys.all })
      void client.invalidateQueries({ queryKey: ['returns'] })
      void client.invalidateQueries({ queryKey: ['orders'] })
      void client.invalidateQueries({ queryKey: ['credit-notes'] })
      return returnId
    },
  })
}

export const useApproveReturn = () => useReturnAction<{ note?: string }, ReturnRequest>('approve')
export const useRejectReturn = () => useReturnAction<{ note: string }, ReturnRequest>('reject')
export const useReceiveReturn = () =>
  useReturnAction<{ conditions: Record<string, ItemCondition> }, CreditNote>('receive')

// ── Deliveries ───────────────────────────────────────────────────────────────

export function useWaitingDeliveries() {
  return useQuery({
    queryKey: adminKeys.waiting,
    queryFn: ({ signal }) => api<WaitingDelivery[]>('/api/admin/delivery/waiting', { signal }),
  })
}

export function useDeliveriesInProgress() {
  return useQuery({
    queryKey: adminKeys.inProgress,
    queryFn: ({ signal }) => api<DeliveryInProgress[]>('/api/admin/delivery/in-progress', { signal }),
  })
}

export function useDrivers() {
  return useQuery({
    queryKey: adminKeys.drivers,
    queryFn: ({ signal }) => api<Driver[]>('/api/admin/delivery/drivers', { signal }),
  })
}

export function useDeliveryAttempts(orderId: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.attempts(orderId),
    queryFn: ({ signal }) =>
      api<DeliveryAttempt[]>(`/api/admin/delivery/orders/${enc(orderId)}/attempts`, { signal }),
    enabled,
  })
}

export function useAssignDriver() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, deliveryUserId, version }: { orderId: string; deliveryUserId: string; version?: number }) =>
      api<unknown>(`/api/admin/delivery/orders/${enc(orderId)}/assign`, {
        method: 'POST',
        body: { deliveryUserId },
        ifMatch: version,
      }),
    onSettled: (_d, _e, { orderId }) => {
      void client.invalidateQueries({ queryKey: adminKeys.all })
      void client.invalidateQueries({ queryKey: ['orders', orderId] })
    },
  })
}

// ── Operations ───────────────────────────────────────────────────────────────

export const opsKeys = {
  deadLetters: ['admin', 'dlq'] as const,
  routes: ['admin', 'routes'] as const,
}

export function useDeadLetters() {
  return useQuery({
    queryKey: opsKeys.deadLetters,
    queryFn: ({ signal }) => api<DeadLetter[]>('/api/dlq', { signal }),
  })
}

function useRefreshOps() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: adminKeys.all })
}

export function useReplay() {
  const refresh = useRefreshOps()
  return useMutation({
    mutationFn: (id: number) => api<DeadLetter>(`/api/dlq/${id}/replay`, { method: 'POST' }),
    onSettled: refresh,
  })
}

export function useDismiss() {
  const refresh = useRefreshOps()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      api<DeadLetter>(`/api/dlq/${id}/dismiss`, { method: 'POST', body: { note } }),
    onSettled: refresh,
  })
}

export function useRoutes() {
  return useQuery({
    queryKey: opsKeys.routes,
    queryFn: ({ signal }) => api<RouteInfo[]>('/api/admin/routes', { signal }),
    // Uptime and in-flight counts move on their own
    refetchInterval: 15_000,
  })
}

export function useRouteAction() {
  const refresh = useRefreshOps()
  return useMutation({
    mutationFn: ({ routeId, action }: { routeId: string; action: RouteAction }) =>
      api<{ routeId: string; status: string; by: string }>(
        `/api/admin/routes/${encodeURIComponent(routeId)}/${action}`,
        { method: 'POST' },
      ),
    onSettled: refresh,
  })
}

// ── Return pickups ───────────────────────────────────────────────────────────

export const pickupAdminKeys = {
  waiting: ['admin', 'pickups', 'waiting'] as const,
  inProgress: ['admin', 'pickups', 'in-progress'] as const,
}

export function useWaitingPickups() {
  return useQuery({
    queryKey: pickupAdminKeys.waiting,
    queryFn: ({ signal }) => api<AvailablePickup[]>('/api/admin/pickups/waiting', { signal }),
  })
}

export function usePickupsInProgress() {
  return useQuery({
    queryKey: pickupAdminKeys.inProgress,
    queryFn: ({ signal }) => api<PickupInProgress[]>('/api/admin/pickups/in-progress', { signal }),
  })
}

export function useAssignPickup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId, deliveryUserId }: { returnId: string; deliveryUserId: string }) =>
      api<unknown>(`/api/admin/pickups/${encodeURIComponent(returnId)}/assign`, {
        method: 'POST',
        body: { deliveryUserId },
      }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.all })
      void client.invalidateQueries({ queryKey: ['returns'] })
    },
  })
}

// ── Categories and photos ────────────────────────────────────────────────────

export interface CategoryInput {
  name?: string
  slug?: string
  /** 0 makes it a main category */
  parentId?: number
  sortOrder?: number
  active?: boolean
  /** "APPAREL_2500", or "" to remove the rule */
  gstRule?: string
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'] as const,
    queryFn: ({ signal }) => api<CategoryNode[]>('/api/admin/categories', { signal }),
  })
}

function useRefreshCategories() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: adminKeys.all })
    void client.invalidateQueries({ queryKey: ['categories'] })
    void client.invalidateQueries({ queryKey: ['catalog'] })
  }
}

export function useCreateCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: (input: CategoryInput & { name: string }) =>
      api<CategoryNode>('/api/admin/categories', { method: 'POST', body: input }),
    onSuccess: refresh,
  })
}

export function useEditCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CategoryInput }) =>
      api<CategoryNode>(`/api/admin/categories/${id}`, { method: 'PATCH', body: input }),
    onSettled: refresh,
  })
}

export function useDeleteCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/admin/categories/${id}`, { method: 'DELETE' }),
    onSettled: refresh,
  })
}

function useRefreshPhotos(sku: string) {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: adminKeys.product(sku) })
    void client.invalidateQueries({ queryKey: ['catalog'] })
  }
}

export function useUploadPhoto(sku: string) {
  const refresh = useRefreshPhotos(sku)
  return useMutation({
    mutationFn: ({ file, altText }: { file: File; altText?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (altText) form.append('altText', altText)
      return api<ProductPhoto>(`/api/admin/catalog/${encodeURIComponent(sku)}/images`, { method: 'POST', body: form })
    },
    onSettled: refresh,
  })
}

export function useDeletePhoto(sku: string) {
  const refresh = useRefreshPhotos(sku)
  return useMutation({
    mutationFn: (imageId: number) =>
      api<void>(`/api/admin/catalog/${encodeURIComponent(sku)}/images/${imageId}`, { method: 'DELETE' }),
    onSettled: refresh,
  })
}

export function useReorderPhotos(sku: string) {
  const refresh = useRefreshPhotos(sku)
  return useMutation({
    mutationFn: (imageIds: number[]) =>
      api<ProductPhoto[]>(`/api/admin/catalog/${encodeURIComponent(sku)}/images/order`, {
        method: 'PUT',
        body: { imageIds },
      }),
    onSettled: refresh,
  })
}

export function useDescribePhoto(sku: string) {
  const refresh = useRefreshPhotos(sku)
  return useMutation({
    mutationFn: ({ imageId, altText }: { imageId: number; altText: string }) =>
      api<ProductPhoto>(`/api/admin/catalog/${encodeURIComponent(sku)}/images/${imageId}`, {
        method: 'PATCH',
        body: { altText },
      }),
    onSettled: refresh,
  })
}

export function useSaveSpecs(sku: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (specs: ProductSpec[]) =>
      api<ProductSpec[]>(`/api/admin/catalog/${encodeURIComponent(sku)}/specs`, { method: 'PUT', body: specs }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: adminKeys.product(sku) })
      void client.invalidateQueries({ queryKey: ['catalogue'] })
    },
  })
}

export function useCategorySpecKeys(categoryId: number | null) {
  return useQuery({
    queryKey: ['admin', 'categories', categoryId, 'spec-keys'] as const,
    queryFn: ({ signal }) => api<string[]>(`/api/admin/categories/${categoryId}/spec-keys`, { signal }),
    enabled: categoryId !== null,
  })
}

export function useSaveCategorySpecKeys() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, names }: { id: number; names: string[] }) =>
      api<string[]>(`/api/admin/categories/${id}/spec-keys`, { method: 'PUT', body: names }),
    onSettled: () => void client.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function usePinDirectory() {
  return useQuery({
    queryKey: ['admin', 'pin-codes'] as const,
    queryFn: ({ signal }) => api<{ pins: number }>('/api/admin/pin-codes', { signal }),
  })
}

export interface PinImportResult {
  pins: number
  rowsRead: number
  rowsSkipped: number
  unknownStates: string[]
}

export function useImportPins() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<PinImportResult>('/api/admin/pin-codes', { method: 'POST', body: form })
    },
    onSettled: () => void client.invalidateQueries({ queryKey: ['admin', 'pin-codes'] }),
  })
}
