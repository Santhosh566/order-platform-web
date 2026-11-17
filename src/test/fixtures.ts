import type { ProductCard, ProductDetail, ProductPage } from '../shop/catalogue'
import type { Order, PublicProduct, ShippingAddress } from '../api/types'

export const ALICE_ADDRESS: ShippingAddress = {
  recipientName: 'Alice Smith',
  recipientPhone: '+91-98450-00101',
  line1: '12, 4th Cross, Indiranagar',
  line2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560038',
  country: 'IN',
}

export const CATALOG: PublicProduct[] = [
  { sku: 'PEN-01', name: 'Gel pen', unitPrice: 59, gstRate: 18, currency: 'INR', stockStatus: 'IN_STOCK' },
  { sku: 'BOOK-01', name: 'Notebook', unitPrice: 120, gstRate: 12, currency: 'INR', stockStatus: 'FEW_LEFT' },
  { sku: 'LAMP-01', name: 'Desk lamp', unitPrice: 1499, gstRate: 18, currency: 'INR', stockStatus: 'OUT_OF_STOCK' },
]

export const ORDER_ID = 'ORD-3f2a9c1e-1111-2222-3333-444455556666'

export function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: ORDER_ID,
    version: 4,
    customerId: 'CUST-100',
    status: 'CONFIRMED',
    orderType: 'STANDARD',
    currency: 'INR',
    subtotal: 100,
    cgstTotal: 9,
    sgstTotal: 9,
    igstTotal: 0,
    taxTotal: 18,
    total: 118,
    placeOfSupply: '29',
    sellerGstin: '29AABCO1234F1Z5',
    createdAt: '2026-11-08T10:00:00',
    statusChangedAt: '2026-11-08T10:01:00',
    externalReference: 'WEB-1',
    carrier: null,
    trackingNumber: null,
    paymentTransactionId: 'TX-1',
    refundedAt: null,
    refundedTotal: 0,
    cancelledTotal: 0,
    amountDue: 118,
    walletAmount: 0,
    walletRefunded: 0,
    cardAmount: 118,
    deliveredAt: null,
    returnStatus: 'NONE',
    invoiceNumber: null,
    invoiceDate: null,
    shippingAddress: ALICE_ADDRESS,
    items: [
      {
        sku: 'PEN-01',
        quantity: 2,
        price: 59,
        productName: 'Gel pen',
        hsnCode: '9608',
        gstRate: 18,
        taxableValue: 100,
        cgstAmount: 9,
        sgstAmount: 9,
        igstAmount: 0,
        discount: 0,
        lineTotal: 118,
        cancelledQuantity: 0,
        activeQuantity: 2,
      },
    ],
    paymentMethod: 'PREPAID',
    couponCode: null,
    discountTotal: 0,
    deliveryDate: null,
    deliveryWindow: null,
    ...overrides,
  }
}

// ── GraphQL catalogue ────────────────────────────────────────────────────────

export function card(overrides: Partial<ProductCard> = {}): ProductCard {
  return {
    sku: 'PEN-01',
    name: 'Gel pen',
    brand: 'Linkr',
    price: 59,
    gstRate: 18,
    currency: 'INR',
    stockStatus: 'IN_STOCK',
    imageKey: 'products/PEN-01/a-400.jpg',
    imageAlt: 'Gel pen, side view',
    rating: { average: 0, count: 0 },
    maxPerOrder: null,
    offers: [],
    ...overrides,
  }
}

export function productPage(items: ProductCard[], overrides: Partial<ProductPage> = {}): ProductPage {
  return {
    items,
    totalItems: items.length,
    totalPages: 1,
    page: 0,
    size: 24,
    facets: {
      categories: [
        { slug: 'office', name: 'Office', parentSlug: null, count: items.length },
        { slug: 'pens', name: 'Pens', parentSlug: 'office', count: items.length },
      ],
      brands: [
        { brand: 'Linkr', count: 1 },
        { brand: 'Typro', count: 2 },
      ],
      price: { min: 10, max: 2000 },
    },
    ...overrides,
  }
}

export function detail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    ...card(),
    description: 'Smooth gel ink.\n\nPack of one.',
    category: { slug: 'pens', name: 'Pens', parentSlug: 'office', parentName: 'Office' },
    specs: [{ name: 'Ink', value: 'Gel, blue' }],
    images: [
      { id: '1', largeKey: 'products/PEN-01/a-1200.jpg', thumbKey: 'products/PEN-01/a-400.jpg', altText: 'Side view', width: 800, height: 800 },
      { id: '2', largeKey: 'products/PEN-01/b-1200.jpg', thumbKey: 'products/PEN-01/b-400.jpg', altText: 'Nib', width: 800, height: 800 },
    ],
    related: [card({ sku: 'PEN-02', name: 'Fine liner', imageKey: null, imageAlt: null })],
    ...overrides,
  }
}
