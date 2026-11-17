import { formatDate, formatMoney } from '../lib/format'
import type { Offer } from './queries'

/** "20% off" or "₹100.00 off". */
export function offerHeadline(offer: Pick<Offer, 'discountType' | 'discountValue'>): string {
  return offer.discountType === 'PERCENT' ? `${offer.discountValue}% off` : `${formatMoney(offer.discountValue)} off`
}

/** The small print, in the order a shopper needs it: cap, minimum, who, until when. */
export function offerTerms(offer: Offer): string[] {
  const terms: string[] = []
  if (offer.discountType === 'PERCENT' && offer.maxDiscount) terms.push(`up to ${formatMoney(offer.maxDiscount)}`)
  if (offer.minOrderValue > 0) {
    terms.push(
      offer.targeted
        ? `when you buy ${formatMoney(offer.minOrderValue)} or more of these products`
        : `on orders of ${formatMoney(offer.minOrderValue)} or more`,
    )
  }
  if (offer.firstOrderOnly) terms.push('first order only')
  if (offer.endsAt) terms.push(`ends ${formatDate(offer.endsAt)}`)
  return terms
}

/** The offer a product card shows: the first coupon for chosen products. Whole-order coupons are not shown on every card. */
export function cardOffer(offers: readonly Offer[] | undefined): Offer | null {
  return offers?.find((o) => o.targeted) ?? null
}
