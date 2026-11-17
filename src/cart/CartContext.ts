import { createContext, useContext } from 'react'
import type { CartLine } from './cart'

export interface CartState {
  lines: CartLine[]
  count: number
  add: (item: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (sku: string, quantity: number) => void
  remove: (sku: string) => void
  /** Refreshes names and prices from the catalogue. */
  reprice: (prices: Map<string, { name: string; unitPrice: number }>) => void
  clear: () => void
}

export const CartContext = createContext<CartState | null>(null)

export function useCart(): CartState {
  const cart = useContext(CartContext)
  if (!cart) {
    throw new Error('useCart must be used inside <CartProvider>')
  }
  return cart
}
