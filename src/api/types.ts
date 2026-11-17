/**
 * Shapes of the backend's JSON replies. Amounts are numbers with two decimals (BigDecimal on the server).
 */

export type Role = 'ADMIN' | 'CUSTOMER' | 'DELIVERY' | 'SERVICE'

export interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  line1: string
  line2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

/** GET /api/me */
export interface Me {
  userId: string
  fullName: string
  email: string | null
  roles: Role[]
  defaultAddress: ShippingAddress | null
  /** +91-98450-00101, or null */
  phone?: string | null
  /** Set when the user has a photo; changes with every new one */
  photoUpdatedAt?: string | null
  /** false when an admin turned the account off; the app then shows "contact the administrator" */
  active?: boolean
}

/** GET /api/public/auth-config */
export interface AuthConfig {
  issuer: string
  clientId: string
}

export type StockStatus = 'IN_STOCK' | 'FEW_LEFT' | 'OUT_OF_STOCK'

/** GET /api/public/catalog: unitPrice includes GST. */
export interface PublicProduct {
  sku: string
  name: string
  unitPrice: number
  gstRate: number
  currency: string
  stockStatus: StockStatus
  description?: string | null
  categoryId?: number | null
  /** The main photo's thumbnail key, for imageUrl(); null when the product has no photo. */
  imageKey?: string | null
  imageAlt?: string | null
  brand?: string | null
  /** Most units one order may hold; null for no limit. */
  maxPerOrder?: number | null
}

export interface PublicImage {
  id: number
  largeKey: string
  thumbKey: string
  altText: string | null
  width: number
  height: number
}

/** GET /api/public/catalog/{sku} */
export interface PublicProductDetail {
  product: PublicProduct
  categoryName: string | null
  categorySlug: string | null
  images: PublicImage[]
}

/** GET /api/public/categories (admin: with productCount, and inactive ones too) */
export interface CategoryNode {
  id: number
  slug: string
  name: string
  parentId: number | null
  sortOrder: number
  active: boolean
  productCount: number | null
  /** Admin only: APPAREL_2500 when GST follows the price */
  gstRule?: string | null
  children: CategoryNode[]
}

export type OrderStatus =
  | 'PENDING'
  | 'INVENTORY_RESERVED'
  | 'CONFIRMED'
  | 'READY_FOR_DISPATCH'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RETURNED'
  | 'OUT_OF_STOCK'
  | 'PAYMENT_FAILED'
  | 'FULFILLMENT_FAILED'
  | 'FRAUD_REJECTED'
  | 'CANCELLED'

/** One order line: price and tax as charged when the order was placed. */
export interface OrderItem {
  sku: string
  quantity: number
  price: number
  productName: string | null
  hsnCode: string | null
  gstRate: number
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  /** This line's share of the coupon discount (GST included); 0 without one */
  discount: number
  lineTotal: number
  /** Units cancelled before dispatch; the invoice keeps quantity, a credit note takes these off */
  cancelledQuantity: number
  /** quantity − cancelledQuantity: the units still coming */
  activeQuantity: number
}

/** GET /api/orders/{id} */
export interface Order {
  orderId: string
  /** Raised by every change; sent back as If-Match with an action, so one on an older copy is refused */
  version: number
  customerId: string
  status: OrderStatus
  orderType: string | null
  currency: string
  subtotal: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  taxTotal: number
  total: number
  placeOfSupply: string | null
  sellerGstin: string | null
  createdAt: string | null
  statusChangedAt: string | null
  externalReference: string | null
  carrier: string | null
  trackingNumber: string | null
  paymentTransactionId: string | null
  refundedAt: string | null
  refundedTotal: number
  /** Value of units cancelled before dispatch, GST included */
  cancelledTotal: number
  /** total − cancelledTotal: what the customer pays for what they keep (the cash due on COD) */
  amountDue: number
  /** Paid from the customer's wallet (taken with the card when the order is paid) */
  walletAmount: number
  /** The part of refundedTotal that went back to the wallet; refunds go to the card first */
  walletRefunded: number
  /** total − walletAmount: what the card (or UPI) is charged */
  cardAmount: number
  deliveredAt: string | null
  returnStatus: 'NONE' | 'PARTIAL' | 'FULL'
  invoiceNumber: string | null
  invoiceDate: string | null
  shippingAddress: ShippingAddress | null
  items: OrderItem[]
  paymentMethod: 'PREPAID' | 'COD'
  couponCode: string | null
  /** Taken off by the coupon, GST included */
  discountTotal: number
  /** A booked delivery day and window; null for standard delivery */
  deliveryDate: string | null
  deliveryWindow: 'MORNING' | 'AFTERNOON' | 'EVENING' | null
}

/** GET /api/orders: one row per order, straight from SQL, so the keys are column names. */
export interface OrderSummary {
  order_id: string
  customer_id: string
  status: OrderStatus
  order_type: string | null
  currency: string
  total: number
  tax_total: number
  created_at: string | number | null
}

/** POST /api/orders */
export interface NewOrder {
  /** The customer's own reference; the same one twice is refused, so a retried checkout cannot order twice. */
  orderId: string
  items: Array<{ sku: string; quantity: number }>
  /** Left out: the default address is used. */
  shippingAddress?: ShippingAddress
  couponCode?: string | null
  paymentMethod?: 'PREPAID' | 'COD'
  deliverySlot?: { date: string; window: 'MORNING' | 'AFTERNOON' | 'EVENING' } | null
  /** Pay as much as the wallet holds, and the rest online (not with cash on delivery) */
  useWallet?: boolean
}

/** 202 reply to POST /api/orders */
export interface OrderAccepted {
  status: OrderStatus
  orderId: string
  orderReference: string | null
  currency: string
  subtotal: number
  taxTotal: number
  total: number
}

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'PICKED_UP' | 'REJECTED' | 'REFUNDED'

/** A driver holds the pickup: ASSIGNED (scheduled) or ON_THE_WAY. */
export type PickupStatus = 'ASSIGNED' | 'ON_THE_WAY'

export interface ReturnItem {
  orderItemId: number
  sku: string
  quantity: number
  condition: 'SELLABLE' | 'DAMAGED' | null
}

export interface ReturnRequest {
  returnId: string
  orderId: string
  customerId: string
  status: ReturnStatus
  reason: string
  requestedAt: string
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
  /** Collected from the customer by a delivery user, on its way to the hub. */
  pickedUpAt?: string | null
  pickedUpBy?: string | null
  /** The live pickup attempt, while a driver has it. */
  pickupStatus?: PickupStatus | null
  receivedAt: string | null
  receivedBy: string | null
  items: ReturnItem[]
}

/** POST /api/returns */
export interface NewReturn {
  orderId: string
  reason: string
  items: Array<{ sku: string; quantity: number }>
}

export interface CreditNote {
  number: string
  orderId: string
  returnId: string | null
  kind: 'RETURN' | 'GOODWILL' | 'CANCELLATION'
  currency: string
  taxableValue: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  total: number
  reason: string | null
  issuedAt: string
}

/** POST /api/orders/{id}/cancel-items */
export interface CancelItemsRequest {
  items: Array<{ sku: string; quantity: number }>
  reason: string | null
}

export interface CancelItemsReply {
  order: Order
  /** null when the last units were cancelled, which cancels the whole order */
  creditNote: CreditNote | null
  wholeOrderCancelled: boolean
  /** Refunded to the original payment method; null on cash on delivery not yet paid */
  refunded: number | null
}
