/**
 * Shapes of the admin API's JSON replies (/api/admin/**). Admins also read one order with
 * GET /api/orders/{id}, which gives them the staff-only fields as well.
 */
import type { OrderStatus, ReturnStatus, ShippingAddress } from './types'

export interface Page<T> {
  items: T[]
  page: number
  size?: number
  totalItems: number
  totalPages: number
}

/** GET /api/admin/orders */
export interface AdminOrderRow {
  orderId: string
  customerId: string
  recipientName: string | null
  city: string | null
  state: string | null
  status: OrderStatus
  orderType: string | null
  currency: string
  total: number
  refundedTotal: number
  itemCount: number
  fraudStatus: string | null
  returnStatus: 'NONE' | 'PARTIAL' | 'FULL'
  invoiceNumber: string | null
  externalReference: string | null
  createdAt: string | null
  statusChangedAt: string | null
}

export type StatusCounts = Record<OrderStatus, number>

/** GET /api/admin/metrics */
export interface PlatformMetrics {
  totalOrders: number
  /** Net of refunds, platform currency only. */
  totalRevenue: number
  currency: string
  dlqQuarantinedCount: number
  activeRoutesCount: number
  totalRoutesCount: number
  connectedUiClients: number
}

/** Staff-only order fields, on top of what a customer sees. */
export interface AdminOrderExtras {
  fraudScore: number | null
  fraudStatus: string | null
  shippingCost: number | null
  paymentGateway: string | null
}

// ── Catalogue ────────────────────────────────────────────────────────────────

export interface ProductView {
  sku: string
  name: string
  hsnCode: string | null
  unitPrice: number | null
  gstRate: number
  currency: string
  available: number
  reserved: number
  reorderLevel: number
  lowStock: boolean
  active: boolean
  /** Sent back as expectedVersion, so two admins cannot overwrite each other. */
  version: number
  updatedAt: string | null
  updatedBy: string | null
  description: string | null
  categoryId: number | null
  categoryName: string | null
  brand: string | null
  maxPerOrder: number | null
  ratingAvg: number
  ratingCount: number
  /** The category's GST rule (APPAREL_2500: the rate follows the price), or null */
  gstRule: string | null
}

/** A product photo as the admin manages it. */
export interface ProductPhoto {
  id: number
  sku: string
  largeKey: string
  thumbKey: string
  position: number
  altText: string | null
  width: number
  height: number
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
}

export type PriceState = 'SCHEDULED' | 'APPLIED' | 'CANCELLED'

export interface PriceView {
  id: number
  unitPrice: number
  gstRate: number
  effectiveFrom: string
  state: PriceState
  reason: string | null
  createdBy: string | null
  createdAt: string | null
}

export type MovementType = 'OPENING' | 'RECEIPT' | 'ADJUSTMENT' | 'WRITE_OFF' | 'RESERVE' | 'RELEASE' | 'SHIP' | 'RETURN'

export interface StockMovement {
  id: number
  sku: string
  type: MovementType
  availableChange: number
  reservedChange: number
  availableAfter: number
  reservedAfter: number
  orderId: string | null
  reason: string | null
  createdBy: string | null
  createdAt: string
}

/** GET /api/admin/catalog/{sku} */
export interface ProductDetail {
  product: ProductView
  prices: PriceView[]
  recentMovements: StockMovement[]
  images: ProductPhoto[]
  specs: ProductSpec[]
  /** Specification names the product's category suggests */
  suggestedSpecs: string[]
}

export interface ProductSpec {
  name: string
  value: string
}

export interface NewProduct {
  sku: string
  name: string
  hsnCode: string
  unitPrice: number
  gstRate: number
  openingStock: number
  reorderLevel: number
  description?: string
  categoryId?: number | null
}

export interface ProductEdit {
  expectedVersion: number
  name?: string
  hsnCode?: string
  reorderLevel?: number
  active?: boolean
  /** "" removes it */
  description?: string
  /** 0 takes the product out of its category */
  categoryId?: number
  brand?: string
  /** 0 removes the limit */
  maxPerOrder?: number
}

export interface PriceChange {
  expectedVersion: number
  unitPrice: number
  gstRate: number
  /** Server-local time (IST) without a zone; left out means now. */
  effectiveFrom?: string
  reason?: string
}

export type ManualStockType = 'RECEIPT' | 'ADJUSTMENT' | 'WRITE_OFF'

export interface StockChange {
  type: ManualStockType
  quantity: number
  reason?: string
}

// ── Returns ──────────────────────────────────────────────────────────────────

export type ItemCondition = 'SELLABLE' | 'DAMAGED'

export interface GoodwillRefund {
  amount: number
  reason: string
}

export type { ReturnStatus }

// ── Deliveries ───────────────────────────────────────────────────────────────

/** GET /api/admin/delivery/waiting: orders no driver holds. */
/** What a driver must know before setting out: the booked slot and any cash to collect. */
export interface DeliveryTerms {
  paymentMethod?: 'PREPAID' | 'COD'
  /** Cash to collect at the door; null when prepaid or already collected */
  amountToCollect?: number | null
  currency?: string
  deliveryDate?: string | null
  deliveryWindow?: 'MORNING' | 'AFTERNOON' | 'EVENING' | null
}

export interface WaitingDelivery extends DeliveryTerms {
  orderId: string
  status: OrderStatus
  city: string
  state: string
  postalCode: string
  itemCount: number
  waitingSince: string
}

export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'FAILED' | 'REASSIGNED' | 'CANCELLED'

/** GET /api/admin/delivery/in-progress */
export interface DeliveryInProgress {
  orderId: string
  status: OrderStatus
  deliveryStatus: DeliveryStatus
  attempt: number
  deliveryUserId: string
  deliveryUserName: string
  assignedAt: string
  pickedUpAt: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}

/** GET /api/admin/delivery/drivers */
export interface Driver {
  userId: string
  fullName: string
  phone: string | null
  activeDeliveries: number
}

/** GET /api/admin/delivery/orders/{id}/attempts */
export interface DeliveryAttempt {
  orderId: string
  deliveryUserId: string
  status: DeliveryStatus
  attemptNumber: number
  assignedAt: string
  pickedUpAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  failureReason: string | null
  codeAttempts: number
}

export type { ShippingAddress }

// ── Driver (/api/delivery/**) ────────────────────────────────────────────────

/** GET /api/delivery/available: the area only, never the street or phone, until the driver takes it. */
export type AvailableDelivery = WaitingDelivery

/** GET /api/delivery/mine, and the reply to every driver action. */
export interface MyDelivery extends DeliveryTerms {
  orderId: string
  status: OrderStatus
  deliveryStatus: DeliveryStatus
  attempt: number
  recipientName: string | null
  recipientPhone: string | null
  address: ShippingAddress | null
  items: Array<{ sku: string; name: string | null; quantity: number }>
  /** Wrong codes left before the delivery can only be marked failed. */
  codeAttemptsLeft: number
}

// ── Operations ───────────────────────────────────────────────────────────────

/** GET /api/dlq: a message the pipeline gave up on after its retries. */
export interface DeadLetter {
  id: number
  orderId: string | null
  topic: string
  /** The message as it was received (JSON text for orders). */
  payload: string
  errorMessage: string | null
  exceptionClass: string | null
  redeliveryAttempts: number
  failedAt: string
  replayed: boolean
  replayedAt: string | null
  replayedBy: string | null
  dismissedAt: string | null
  dismissedBy: string | null
  dismissNote: string | null
}

export type RouteKind = 'CONSUMER' | 'API' | 'INTERNAL'

/** GET /api/admin/routes */
export interface RouteInfo {
  routeId: string
  /** Camel's ServiceStatus: Started, Suspended, Stopped, … */
  status: string
  kind: RouteKind
  /** Only consumers can be paused or stopped. */
  controllable: boolean
  endpointUri: string
  description: string | null
  uptime: string
  inflight: number
  /** Consumers only: the work a pause holds back. */
  waiting: RouteBacklog | null
}

export interface RouteBacklog {
  count: number
  unit: string
  /** Comma-separated order statuses whose list shows the waiting orders, if they are orders. */
  orderStatus: string | null
  /** Why the count does not apply, e.g. delivery simulation is off. */
  note: string | null
}

export type RouteAction = 'start' | 'stop' | 'suspend' | 'resume'

// ── Return pickups (/api/delivery/pickups, /api/admin/pickups) ───────────────

/** An approved return nobody is collecting yet. Area only, until a driver takes it. */
export interface AvailablePickup {
  returnId: string
  orderId: string
  city: string
  state: string
  postalCode: string
  itemCount: number
  approvedAt: string | null
  /** Earlier attempts, e.g. 1 after a missed pickup. */
  attempts: number
}

export type PickupAttemptStatus = 'ASSIGNED' | 'ON_THE_WAY' | 'COLLECTED' | 'FAILED' | 'REASSIGNED' | 'CANCELLED'

/** GET /api/delivery/pickups/mine, and the reply to every pickup step. */
export interface MyPickup {
  returnId: string
  orderId: string
  returnStatus: ReturnStatus
  pickupStatus: PickupAttemptStatus
  attempt: number
  reason: string
  recipientName: string | null
  recipientPhone: string | null
  address: ShippingAddress | null
  items: Array<{ sku: string; name: string | null; quantity: number }>
  codeAttemptsLeft: number
}

/** GET /api/admin/pickups/in-progress */
export interface PickupInProgress {
  returnId: string
  orderId: string
  pickupStatus: PickupAttemptStatus
  attempt: number
  deliveryUserId: string
  deliveryUserName: string
  assignedAt: string
  startedAt: string | null
  city: string | null
  state: string | null
  postalCode: string | null
}
