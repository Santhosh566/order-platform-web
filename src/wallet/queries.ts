import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export type WalletKind = 'GIFT_CARD' | 'ORDER_PAYMENT' | 'ORDER_REFUND' | 'ADMIN_CREDIT' | 'ADMIN_DEBIT'

/** One change to a wallet: positive adds money, negative takes it. */
export interface WalletEntry {
  id: number
  kind: WalletKind
  amount: number
  balanceAfter: number
  /** e.g. WAL-3F2A9C1E */
  reference: string
  orderId: string | null
  giftCardLastFour: string | null
  note: string | null
  createdBy: string | null
  createdAt: string
}

export interface Wallet {
  customerId: string
  balance: number
  /** What a new order can use: the balance less what orders being paid will take */
  available: number
  currency: string
  /** Newest first */
  history: WalletEntry[]
}

export interface Redeemed {
  amount: number
  lastFour: string
  balance: number
  entry: WalletEntry
}

export const WALLET_KINDS: Record<WalletKind, string> = {
  GIFT_CARD: 'Gift card added',
  ORDER_PAYMENT: 'Paid for an order',
  ORDER_REFUND: 'Refund',
  ADMIN_CREDIT: 'Credit from us',
  ADMIN_DEBIT: 'Correction',
}

const walletKey = ['wallet'] as const

/** GET /api/wallet: the signed-in customer's balance and history. */
export function useWallet(enabled = true) {
  return useQuery({
    queryKey: walletKey,
    queryFn: () => api<Wallet>('/api/wallet'),
    enabled,
    staleTime: 10_000,
  })
}

export function useRedeemGiftCard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api<Redeemed>('/api/wallet/gift-cards', { method: 'POST', body: { code } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: walletKey }),
  })
}

// ── Admins ───────────────────────────────────────────────────────────────────

export type GiftCardStatus = 'ACTIVE' | 'REDEEMED' | 'VOID' | 'EXPIRED'

export interface GiftCard {
  id: number
  /** XXXX-XXXX-XXXX-ABCD: the full code is shown only when issued */
  maskedCode: string
  amount: number
  currency: string
  label: string | null
  expiresAt: string
  status: GiftCardStatus
  redeemedBy: string | null
  redeemedByName: string | null
  redeemedAt: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
  createdBy: string | null
}

export interface NewGiftCards {
  amount: number
  count: number
  /** ISO local date-time; a year from now when left out */
  expiresAt: string | null
  label: string | null
}

export interface IssuedBatch {
  label: string | null
  amount: number
  expiresAt: string
  cards: Array<{ id: number; code: string; amount: number; expiresAt: string }>
}

export interface WalletAdjustment {
  amount: number
  note: string
}

const giftCardsKey = ['admin', 'gift-cards'] as const

export function useGiftCards(status: GiftCardStatus | null) {
  return useQuery({
    queryKey: [...giftCardsKey, status],
    queryFn: () => api<GiftCard[]>(`/api/admin/gift-cards${status ? `?status=${status}` : ''}`),
  })
}

export function useIssueGiftCards() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (batch: NewGiftCards) => api<IssuedBatch>('/api/admin/gift-cards', { method: 'POST', body: batch }),
    onSuccess: () => void client.invalidateQueries({ queryKey: giftCardsKey }),
  })
}

export function useVoidGiftCard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api<GiftCard>(`/api/admin/gift-cards/${id}/void`, { method: 'POST', body: { reason } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: giftCardsKey }),
  })
}

const userWalletKey = (userId: string) => ['admin', 'users', userId, 'wallet'] as const

export function useUserWallet(userId: string, enabled = true) {
  return useQuery({
    queryKey: userWalletKey(userId),
    queryFn: () => api<Wallet>(`/api/admin/users/${encodeURIComponent(userId)}/wallet`),
    enabled,
  })
}

/** Gives (credit) or takes back (debit) store credit. */
export function useAdjustWallet(userId: string, direction: 'credits' | 'debits') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (adjustment: WalletAdjustment) =>
      api<WalletEntry>(`/api/admin/users/${encodeURIComponent(userId)}/wallet/${direction}`, {
        method: 'POST',
        body: adjustment,
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: userWalletKey(userId) }),
  })
}
