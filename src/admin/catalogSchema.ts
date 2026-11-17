import { z } from 'zod'

/**
 * The catalogue rules of CatalogAdminService, checked before sending so mistakes show by the field.
 * The backend checks them all again.
 */

/** The GST slabs the backend accepts. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40] as const

export const GST_OPTIONS = GST_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }))

const price = z
  .number({ error: 'Enter a price' })
  .positive('The price must be more than 0')
  .max(9_999_999_999.99, 'That price is too high')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most 2 decimals')

const gstRate = z
  .string()
  .refine((v) => (GST_RATES as readonly number[]).includes(Number(v)), 'Choose a GST rate')

const hsn = z
  .string()
  .trim()
  .regex(/^\d{4}(\d{2}){0,2}$/, 'HSN codes are 4, 6 or 8 digits')

export const newProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,63}$/, '2–64 capital letters, digits or dashes'),
  name: z.string().trim().min(1, 'Enter a name').max(255),
  hsnCode: hsn,
  unitPrice: price,
  gstRate,
  openingStock: z.number({ error: 'Enter a number' }).int().min(0, 'Cannot be negative'),
  reorderLevel: z.number({ error: 'Enter a number' }).int().min(0, 'Cannot be negative'),
  // Optional: a product can be created first and sorted into a category later
  categoryId: z.string().default(''),
  description: z.string().max(5000, 'At most 5000 characters').default(''),
})

export type NewProductValues = z.input<typeof newProductSchema>

/** Plain text shown on the product page; blank lines separate paragraphs. */
export const DESCRIPTION_MAX = 5000

export const editProductSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(255),
  hsnCode: hsn,
  reorderLevel: z.number({ error: 'Enter a number' }).int().min(0, 'Cannot be negative'),
  active: z.boolean(),
  /** "" for none, else the category id */
  categoryId: z.string(),
  brand: z.string().trim().max(80, 'At most 80 characters'),
  /** Empty for no limit */
  maxPerOrder: z.number().int().min(1, 'At least 1').max(1000).optional(),
  description: z.string().max(DESCRIPTION_MAX, `At most ${DESCRIPTION_MAX} characters`),
})

export type EditProductValues = z.infer<typeof editProductSchema>

export const priceChangeSchema = z
  .object({
    unitPrice: price,
    gstRate,
    when: z.enum(['now', 'later']),
    /** datetime-local value, e.g. 2026-12-01T00:00 */
    effectiveFrom: z.string(),
    reason: z.string().trim().max(255),
  })
  .refine((v) => v.when === 'now' || isFuture(v.effectiveFrom), {
    path: ['effectiveFrom'],
    message: 'Choose a time in the future',
  })

export type PriceChangeValues = z.infer<typeof priceChangeSchema>

export const stockChangeSchema = z
  .object({
    type: z.enum(['RECEIPT', 'ADJUSTMENT', 'WRITE_OFF']),
    quantity: z.number({ error: 'Enter a quantity' }).int('Whole units only'),
    reason: z.string().trim().max(500),
  })
  .refine((v) => (v.type === 'ADJUSTMENT' ? v.quantity !== 0 : v.quantity > 0), {
    path: ['quantity'],
    message: 'Enter how many units',
  })
  .refine((v) => v.type === 'RECEIPT' || v.reason.length > 0, {
    path: ['reason'],
    message: 'Say why: stock is changing without an order or a delivery',
  })

export type StockChangeValues = z.infer<typeof stockChangeSchema>

function isFuture(value: string): boolean {
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

/**
 * datetime-local gives "2026-12-01T09:30" in the browser's time; the server reads it as its own
 * local time (IST). Staff work in India, so the two are the same.
 */
export function toServerDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}
