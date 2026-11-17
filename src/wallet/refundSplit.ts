import type { Order } from '../api/types'

const paise = (n: number) => Math.round(n * 100) / 100

/**
 * Where a refund of `amount` goes, as the server decides it: to the card first, and to the wallet only
 * what the card did not pay (PaymentGatewayService.recordRefund).
 */
export function refundSplit(order: Order, amount: number): { toCard: number; toWallet: number } {
  const walletAmount = order.walletAmount ?? 0
  const walletRefunded = order.walletRefunded ?? 0
  const cardAmount = order.cardAmount ?? order.total - walletAmount
  const cardLeft = Math.max(0, paise(cardAmount - (order.refundedTotal - walletRefunded)))
  const toCard = Math.min(amount, cardLeft)
  return { toCard: paise(toCard), toWallet: paise(amount - toCard) }
}

/** "₹500 to your card and ₹200 to your wallet", or just one of them. */
export function describeRefund(order: Order, amount: number, format: (n: number) => string, whose = 'your'): string {
  const { toCard, toWallet } = refundSplit(order, amount)
  const card = toCard === 0 ? null : `${format(toCard)} to ${whose} original payment method`
  const wallet = toWallet > 0 ? `${format(toWallet)} to ${whose} wallet` : null
  return [card, wallet].filter(Boolean).join(' and ')
}
