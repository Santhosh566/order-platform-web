import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import * as cart from './cart'
import { CartContext, type CartState } from './CartContext'

/**
 * The cart lives in this browser's localStorage, one per signed-in user, so it survives a reload
 * and a shared computer does not show one person's cart to another.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const key = me ? `order-platform:cart:${me.userId}` : null
  const [lines, setLines] = useState<cart.CartLine[]>(() => read(key))
  const [loadedKey, setLoadedKey] = useState(key)

  // Another user signed in: show their cart, not the last one
  if (loadedKey !== key) {
    setLoadedKey(key)
    setLines(read(key))
  }

  useEffect(() => {
    if (!key) return
    try {
      if (lines.length === 0) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, JSON.stringify(lines))
      }
    } catch {
      // Storage full or blocked: the cart still works for this visit
    }
  }, [key, lines])

  // A change in another tab of the same shop
  useEffect(() => {
    if (!key) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setLines(cart.parseCart(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const reprice = useCallback<CartState['reprice']>((prices) => {
    setLines((current) => {
      let changed = false
      const next = current.map((line) => {
        const latest = prices.get(line.sku)
        if (latest && (latest.unitPrice !== line.unitPrice || latest.name !== line.name)) {
          changed = true
          return { ...line, name: latest.name, unitPrice: latest.unitPrice }
        }
        return line
      })
      return changed ? next : current
    })
  }, [])

  const value = useMemo<CartState>(
    () => ({
      lines,
      count: cart.itemCount(lines),
      add: (item, quantity) => setLines((current) => cart.addLine(current, item, quantity)),
      setQuantity: (sku, quantity) => setLines((current) => cart.setQuantity(current, sku, quantity)),
      remove: (sku) => setLines((current) => cart.removeLine(current, sku)),
      reprice,
      clear: () => setLines([]),
    }),
    [lines, reprice],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

function read(key: string | null): cart.CartLine[] {
  if (!key) return []
  try {
    return cart.parseCart(window.localStorage.getItem(key))
  } catch {
    return []
  }
}
