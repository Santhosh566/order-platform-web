import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export type CartStatus = 'ACTIVE' | 'ORDERED' | 'RECOVERED' | 'EMPTIED' | 'EXPIRED'

export const CART_STATUS_LABELS: Record<CartStatus, string> = {
  ACTIVE: 'Open',
  ORDERED: 'Ordered',
  RECOVERED: 'Recovered',
  EMPTIED: 'Emptied',
  EXPIRED: 'Expired',
}

export const CART_STATUS_COLORS: Record<CartStatus, string> = {
  ACTIVE: 'blue',
  ORDERED: 'green',
  RECOVERED: 'teal',
  EMPTIED: 'gray',
  EXPIRED: 'orange',
}

/** GET /api/admin/carts/stats: carts started in the period and how they ended so far. */
export interface CartStats {
  from: string
  to: string
  started: number
  ordered: number
  reminded: number
  recovered: number
  /** recovered ÷ reminded, 0 to 1; null when none was reminded */
  recoveryRate: number | null
  recoveredRevenue: number
  emptied: number
  expired: number
  couponsSent: number
  couponsUsed: number
  /** Open now, whenever they started */
  open: number
  openValue: number
}

export interface CartRow {
  cartId: number
  customerId: string
  customerName: string
  customerEmail: string | null
  status: CartStatus
  itemCount: number
  value: number
  createdAt: string
  updatedAt: string
  remindersSent: number
  lastRemindedAt: string | null
  reminderCoupon: string | null
  orderId: string | null
  items: Array<{ sku: string; name: string; quantity: number }>
}

export interface CartPage {
  items: CartRow[]
  totalItems: number
  page: number
  size: number
}

export const CART_PAGE_SIZE = 25

export function useCartStats(days: number) {
  return useQuery({
    queryKey: ['admin', 'carts', 'stats', days],
    queryFn: ({ signal }) => {
      const to = new Date()
      const from = new Date(to.getTime() - (days - 1) * 86_400_000)
      return api<CartStats>(`/api/admin/carts/stats?from=${isoDate(from)}&to=${isoDate(to)}`, { signal })
    },
  })
}

export function useCarts(status: CartStatus | null, page: number) {
  return useQuery({
    queryKey: ['admin', 'carts', 'list', status, page],
    queryFn: ({ signal }) =>
      api<CartPage>(`/api/admin/carts?page=${page}&size=${CART_PAGE_SIZE}${status ? `&status=${status}` : ''}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

/** The local calendar date, as the backend's India-time dates are */
function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
