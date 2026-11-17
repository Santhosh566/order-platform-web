/**
 * Money and dates the way Indian customers read them.
 * Rupees use lakh/crore grouping (₹1,23,456.00); the backend sends amounts as JSON numbers
 * with two decimals, so they are only formatted here, never added up in the browser.
 */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

export function formatMoney(amount: number | string | null | undefined, currency = 'INR'): string {
  if (amount === null || amount === undefined || amount === '') {
    return '—'
  }
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (Number.isNaN(value)) {
    return '—'
  }
  if (currency === 'INR') {
    return inr.format(value)
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value)
}

/** "18%" or "0.25%": GST rates as printed on invoices. */
export function formatRate(rate: number | string | null | undefined): string {
  if (rate === null || rate === undefined) {
    return '—'
  }
  return `${Number(rate)}%`
}

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' })

/** The backend sends local date-times without a zone (server time, IST); SQL rows may send epoch millis. */
export function formatDateTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateTime.format(date)
}

export function formatDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : dateOnly.format(date)
}
