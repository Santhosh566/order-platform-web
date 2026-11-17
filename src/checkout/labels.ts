export type PaymentMethod = 'PREPAID' | 'COD'
export type DeliveryWindow = 'MORNING' | 'AFTERNOON' | 'EVENING'

export const WINDOW_LABELS: Record<DeliveryWindow, string> = {
  MORNING: '9 AM – 1 PM',
  AFTERNOON: '1 PM – 5 PM',
  EVENING: '5 PM – 9 PM',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PREPAID: 'Paid online',
  COD: 'Cash on delivery',
}

const DAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "Fri, 13 Nov" for an ISO date, read as a calendar day (no time zone shift). */
export function formatDay(iso: string): string {
  return DAY.format(new Date(`${iso}T00:00:00Z`))
}

/** "Fri, 13 Nov, 9 AM – 1 PM", or null for standard delivery. */
export function formatSlot(date: string | null | undefined, window: DeliveryWindow | null | undefined): string | null {
  if (!date || !window) return null
  return `${formatDay(date)}, ${WINDOW_LABELS[window]}`
}
