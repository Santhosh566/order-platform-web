import type { Order, OrderStatus } from '../api/types'

/**
 * How order statuses read to a customer. The rules mirror OrderStatus.java; the backend still
 * decides every action, these only choose which buttons to show.
 */

interface StatusInfo {
  label: string
  color: string
}

const INFO: Record<OrderStatus, StatusInfo> = {
  PENDING: { label: 'Placed', color: 'gray' },
  INVENTORY_RESERVED: { label: 'Processing payment', color: 'blue' },
  CONFIRMED: { label: 'Confirmed', color: 'blue' },
  SHIPPED: { label: 'Packing', color: 'indigo' },
  READY_FOR_DISPATCH: { label: 'Ready to ship', color: 'indigo' },
  IN_TRANSIT: { label: 'On the way', color: 'violet' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', color: 'orange' },
  DELIVERED: { label: 'Delivered', color: 'green' },
  DELIVERY_FAILED: { label: 'Delivery attempt failed', color: 'yellow' },
  RETURNED: { label: 'Returned to us', color: 'gray' },
  OUT_OF_STOCK: { label: 'Out of stock', color: 'red' },
  PAYMENT_FAILED: { label: 'Payment failed', color: 'red' },
  FULFILLMENT_FAILED: { label: 'Could not be fulfilled', color: 'red' },
  FRAUD_REJECTED: { label: 'Declined', color: 'red' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
}

export function statusLabel(status: OrderStatus): string {
  return INFO[status]?.label ?? status
}

export function statusColor(status: OrderStatus): string {
  return INFO[status]?.color ?? 'gray'
}

/** Nothing has left the warehouse yet (OrderStatus.isCancellable). */
const CANCELLABLE: ReadonlySet<OrderStatus> = new Set([
  'PENDING',
  'INVENTORY_RESERVED',
  'CONFIRMED',
  'SHIPPED',
  'READY_FOR_DISPATCH',
])

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE.has(status)
}

/** Paid and still in the warehouse (PartialCancelService.CANCELLABLE_IN_PART); earlier statuses are mid-payment. */
const CANCELLABLE_IN_PART: ReadonlySet<OrderStatus> = new Set(['CONFIRMED', 'SHIPPED', 'READY_FOR_DISPATCH'])

/** Units still coming on each SKU, after cancellations. */
export function activeUnits(order: Pick<Order, 'items'>): Map<string, number> {
  const left = new Map<string, number>()
  for (const item of order.items) {
    left.set(item.sku, (left.get(item.sku) ?? 0) + (item.activeQuantity ?? item.quantity))
  }
  return left
}

/** Some units can be cancelled while others still ship: needs at least two units left. */
export function canCancelItems(order: Pick<Order, 'status' | 'items'>): boolean {
  if (!CANCELLABLE_IN_PART.has(order.status)) return false
  return [...activeUnits(order).values()].reduce((a, b) => a + b, 0) > 1
}

/** The order ended without reaching the customer. */
const ENDED_UNFULFILLED: ReadonlySet<OrderStatus> = new Set([
  'RETURNED',
  'OUT_OF_STOCK',
  'PAYMENT_FAILED',
  'FULFILLMENT_FAILED',
  'FRAUD_REJECTED',
  'CANCELLED',
])

export function endedUnfulfilled(status: OrderStatus): boolean {
  return ENDED_UNFULFILLED.has(status)
}

/** Steps of the progress bar, and which statuses count as reaching each. */
export const PROGRESS_STEPS = ['Placed', 'Confirmed', 'Packed', 'On the way', 'Out for delivery', 'Delivered'] as const

const STEP_OF: Partial<Record<OrderStatus, number>> = {
  PENDING: 0,
  INVENTORY_RESERVED: 0,
  CONFIRMED: 1,
  SHIPPED: 1,
  READY_FOR_DISPATCH: 2,
  IN_TRANSIT: 3,
  DELIVERY_FAILED: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
}

/** The step reached, or null for an order that ended without delivery. */
export function progressStep(status: OrderStatus): number | null {
  return STEP_OF[status] ?? null
}

/** Days after delivery during which items can be returned (orders.returns.window-days). */
export const RETURN_WINDOW_DAYS = 7

/** When returns close, or null when the order has not been delivered. */
export function returnWindowCloses(order: Pick<Order, 'status' | 'deliveredAt'>): Date | null {
  if (order.status !== 'DELIVERED' || !order.deliveredAt) return null
  const delivered = new Date(order.deliveredAt)
  if (Number.isNaN(delivered.getTime())) return null
  return new Date(delivered.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

export function canRequestReturn(order: Pick<Order, 'status' | 'deliveredAt'>, now = new Date()): boolean {
  const closes = returnWindowCloses(order)
  return closes !== null && now < closes
}

/** Order ids are long UUIDs; customers recognise them by the first block. */
export function shortOrderId(orderId: string): string {
  const match = /^ORD-([0-9a-f]{8})/i.exec(orderId)
  return match ? `ORD-${match[1].toUpperCase()}` : orderId
}

/** Counted as a sale (OrderStatus.isRevenue). */
const REVENUE: ReadonlySet<OrderStatus> = new Set([
  'CONFIRMED',
  'SHIPPED',
  'READY_FOR_DISPATCH',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'DELIVERED',
])

/** The backend issues an invoice for any order that was paid (InvoiceService.issueInvoice). */
export function hasInvoice(order: Pick<Order, 'status' | 'paymentTransactionId'>): boolean {
  return order.paymentTransactionId !== null || REVENUE.has(order.status)
}

/** Units of each SKU that can still be returned: ordered, less those in returns not rejected. */
export function returnableUnits(
  order: Pick<Order, 'items'>,
  returns: ReadonlyArray<{ status: string; items: ReadonlyArray<{ sku: string; quantity: number }> }>,
): Map<string, number> {
  const left = activeUnits(order)
  for (const request of returns) {
    if (request.status === 'REJECTED') continue
    for (const item of request.items) {
      left.set(item.sku, Math.max(0, (left.get(item.sku) ?? 0) - item.quantity))
    }
  }
  return left
}

/** Every status, in life-cycle order. */
export const ALL_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'INVENTORY_RESERVED',
  'CONFIRMED',
  'SHIPPED',
  'READY_FOR_DISPATCH',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
  'OUT_OF_STOCK',
  'PAYMENT_FAILED',
  'FULFILLMENT_FAILED',
  'FRAUD_REJECTED',
]
