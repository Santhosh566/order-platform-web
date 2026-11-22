import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { StockMovement } from '../api/adminTypes'

/** A warehouse: its own GST registration, position and invoice series. */
export interface Warehouse {
  id: number
  code: string
  name: string
  address: string
  pin: string
  /** GST state code, the first two digits of the GSTIN */
  stateCode: string
  gstin: string
  latitude: number
  longitude: number
  /** "14:00:00": orders packed by then leave the same day */
  cutoffTime: string
  active: boolean
  /** Where stock goes when nobody says which */
  isDefault: boolean
  invoicePrefix: string
  creditNotePrefix: string
}

/** GET /api/admin/warehouses */
export interface WarehouseSummary {
  warehouse: Warehouse
  /** Products it holds any of */
  products: number
  available: number
  reserved: number
}

/** GET /api/admin/catalog/{sku}/warehouses */
export interface WarehouseStock {
  warehouseId: number
  code: string
  name: string
  active: boolean
  available: number
  reserved: number
  reorderLevel: number
}

/** GET /api/public/warehouses: what the shop shows customers */
export interface PublicWarehouse {
  id: number
  code: string
  name: string
}

export interface WarehouseRequest {
  code?: string
  name?: string
  address?: string
  pin?: string
  gstin?: string
  invoicePrefix?: string
  creditNotePrefix?: string
  /** "16:30" */
  cutoffTime?: string
  latitude?: number | null
  longitude?: number | null
  active?: boolean
}

export interface Transfer {
  sku: string
  fromWarehouseId: number
  toWarehouseId: number
  quantity: number
  reason?: string
}

const keys = {
  all: ['admin', 'warehouses'] as const,
  stockOf: (sku: string) => ['admin', 'catalog', sku, 'warehouses'] as const,
  public: ['warehouses', 'public'] as const,
}

export function useWarehouses() {
  return useQuery({
    queryKey: keys.all,
    queryFn: ({ signal }) => api<WarehouseSummary[]>('/api/admin/warehouses', { signal }),
  })
}

export function useStockByWarehouse(sku: string) {
  return useQuery({
    queryKey: keys.stockOf(sku),
    queryFn: ({ signal }) => api<WarehouseStock[]>(`/api/admin/catalog/${encodeURIComponent(sku)}/warehouses`, { signal }),
  })
}

/** Id → warehouse, for "Ships from"; rarely changes */
export function usePublicWarehouses() {
  return useQuery({
    queryKey: keys.public,
    queryFn: ({ signal }) => api<PublicWarehouse[]>('/api/public/warehouses', { signal, anonymous: true }),
    staleTime: 10 * 60_000,
  })
}

export function useSaveWarehouse(id?: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: WarehouseRequest) =>
      id === undefined
        ? api<Warehouse>('/api/admin/warehouses', { method: 'POST', body: request })
        : api<Warehouse>(`/api/admin/warehouses/${id}`, { method: 'PATCH', body: request }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.all })
      void client.invalidateQueries({ queryKey: keys.public })
    },
  })
}

export function useTransfer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (transfer: Transfer) =>
      api<{ out: StockMovement; in: StockMovement }>('/api/admin/warehouses/transfers', { method: 'POST', body: transfer }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin'] }),
  })
}

/** An admin moves a driver to another warehouse. */
export function useMoveDriver(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (warehouseId: number) =>
      api<Warehouse>(`/api/admin/users/${encodeURIComponent(userId)}/warehouse`, { method: 'PUT', body: { warehouseId } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['admin'] }),
  })
}

/** "14:00:00" → "2:00 PM" */
export function formatCutoff(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, h, m)
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}
