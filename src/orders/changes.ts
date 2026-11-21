import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Order, OrderStatus, ShippingAddress } from '../api/types'
import type { DeliveryWindow } from '../checkout/labels'
import { keys } from '../customer/queries'

export type OrderChangeKind = 'ADDRESS' | 'DELIVERY_SLOT' | 'ITEMS_ADDED'

/** GET /api/orders/{id}/changes: one change made after the order was placed. */
export interface OrderChange {
  id: number
  kind: OrderChangeKind
  /** What it was, as a person reads it; null for added items */
  before: string | null
  after: string
  /** ITEMS_ADDED: what they cost, GST included */
  amount: number | null
  note: string | null
  /** Who made it; null when a customer reads a change support made */
  changedBy: string | null
  byStaff: boolean
  createdAt: string
}

/** Both null: standard delivery. */
export interface SlotChoice {
  date: string | null
  window: DeliveryWindow | null
}

export interface ChangeReply {
  order: Order
  changes: OrderChange[]
  /** For added items: how they were paid */
  payment: { byCard: number; fromWallet: number; cashOnDelivery: number } | null
}

export const CHANGE_LABELS: Record<OrderChangeKind, string> = {
  ADDRESS: 'Delivery address',
  DELIVERY_SLOT: 'Delivery day',
  ITEMS_ADDED: 'Items added',
}

/** In the warehouse or back at the hub (OrderChangeService.DELIVERY_CHANGEABLE); the server also checks for a driver. */
const DELIVERY_CHANGEABLE: ReadonlySet<OrderStatus> = new Set([
  'CONFIRMED',
  'SHIPPED',
  'READY_FOR_DISPATCH',
  'DELIVERY_FAILED',
])

export function canChangeDelivery(order: Pick<Order, 'status'>): boolean {
  return DELIVERY_CHANGEABLE.has(order.status)
}

/** Paid and not packed yet: packing issues the invoice, which is never rewritten. */
export function canAddItems(order: Pick<Order, 'status' | 'invoiceNumber'>): boolean {
  return (order.status === 'CONFIRMED' || order.status === 'SHIPPED') && !order.invoiceNumber
}

const changesKey = (orderId: string) => ['orders', orderId, 'changes'] as const

export function useOrderChanges(orderId: string) {
  return useQuery({
    queryKey: changesKey(orderId),
    queryFn: ({ signal }) => api<OrderChange[]>(`/api/orders/${encodeURIComponent(orderId)}/changes`, { signal }),
  })
}

function useOrderChange<T>(orderId: string, version: number | undefined, path: string, alsoRefresh: readonly string[][] = []) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: T) =>
      api<ChangeReply>(`/api/orders/${encodeURIComponent(orderId)}/${path}`, { method: 'POST', body, ifMatch: version }),
    onSettled: () => {
      // keys.orders also covers the order's own change history
      void client.invalidateQueries({ queryKey: keys.orders })
      alsoRefresh.forEach((queryKey) => void client.invalidateQueries({ queryKey }))
    },
  })
}

/** A new address; deliverySlot left out keeps the booked delivery. */
export function useChangeAddress(orderId: string, version?: number) {
  return useOrderChange<{ address: ShippingAddress; deliverySlot?: SlotChoice }>(orderId, version, 'address', [['admin']])
}

export function useChangeSlot(orderId: string, version?: number) {
  return useOrderChange<SlotChoice>(orderId, version, 'delivery-slot', [['admin']])
}

/** More items before packing; stock labels and the wallet change too. */
export function useAddItems(orderId: string, version?: number) {
  return useOrderChange<{ items: Array<{ sku: string; quantity: number }>; useWallet: boolean }>(
    orderId,
    version,
    'items',
    [[...keys.catalog], ['wallet'], ['admin']],
  )
}
