import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import * as cart from './cart'
import { CartContext, type CartState } from './CartContext'
import { fromServer, toServer, type ServerCart } from './serverCart'

/** Changes are sent this long after the last one, so a few clicks on + make one request. */
export const SAVE_DELAY_MS = 500

/**
 * A customer's cart is kept on the server (/api/cart), so it is the same on every device and the shop can
 * remind them about a cart they left. Changes show at once and are saved shortly after. A cart this browser
 * kept in localStorage before (older versions, or before signing in) is merged into the server's once.
 *
 * Other users (staff looking at the shop) keep the cart in this browser's localStorage, as before.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  const onServer = !!me && me.roles.includes('CUSTOMER')
  const key = me ? `order-platform:cart:${me.userId}` : null
  const [lines, setLines] = useState<cart.CartLine[]>(() => (onServer ? [] : read(key)))
  const [loadedKey, setLoadedKey] = useState(key)
  // Bumped by every change the customer makes; a save sends what it holds then
  const [edits, setEdits] = useState(0)
  // What the timers and server replies compare against; kept current before any other effect runs
  const latest = useRef({ lines, edits })
  useLayoutEffect(() => {
    latest.current = { lines, edits }
  })
  // The change count a server reply may overwrite: a reply to an older state must not undo newer clicks
  const saved = useRef(0)

  // Another user signed in: show their cart, not the last one
  if (loadedKey !== key) {
    setLoadedKey(key)
    setLines(onServer ? [] : read(key))
  }

  const adopt = useCallback((server: ServerCart, upTo: number) => {
    if (latest.current.edits === upTo) {
      setLines(fromServer(server))
    }
  }, [])

  // Load the server's cart, merging in one this browser kept on its own
  useEffect(() => {
    if (!onServer || !key) return
    let cancelled = false
    const local = read(key)
    const at = latest.current.edits
    const load =
      local.length > 0
        ? api<ServerCart>('/api/cart/merge', { method: 'POST', body: toServer(local) })
        : api<ServerCart>('/api/cart')
    load
      .then((server) => {
        if (local.length > 0) forget(key)
        if (!cancelled) adopt(server, at)
      })
      .catch(() => {
        // Offline or the server is down: show what this browser has; it is merged next time
        if (!cancelled && local.length > 0 && latest.current.edits === at) setLines(local)
      })
    return () => {
      cancelled = true
    }
  }, [onServer, key, adopt])

  // Save each change shortly after the last one
  useEffect(() => {
    if (!onServer || edits === 0 || edits === saved.current) return
    const timer = window.setTimeout(() => {
      const { lines: sending, edits: at } = latest.current
      saved.current = at
      api<ServerCart>('/api/cart', { method: 'PUT', body: toServer(sending) })
        .then((server) => adopt(server, at))
        .catch(() => {
          // Kept here; the next change sends the whole cart again
          saved.current = 0
        })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [onServer, edits, adopt])

  // Back to this tab: the cart may have changed on another device or tab
  useEffect(() => {
    if (!onServer) return
    const onFocus = () => {
      const at = latest.current.edits
      if (at !== saved.current && at !== 0) return
      api<ServerCart>('/api/cart')
        .then((server) => adopt(server, at))
        .catch(() => undefined)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [onServer, adopt])

  // Staff: this browser's storage, shared between its tabs
  useEffect(() => {
    if (onServer || !key) return
    try {
      if (lines.length === 0) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, JSON.stringify(lines))
      }
    } catch {
      // Storage full or blocked: the cart still works for this visit
    }
  }, [onServer, key, lines])

  useEffect(() => {
    if (onServer || !key) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setLines(cart.parseCart(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [onServer, key])

  const change = useCallback((update: (current: cart.CartLine[]) => cart.CartLine[]) => {
    setLines(update)
    setEdits((n) => n + 1)
  }, [])

  // The customer accepted today's prices: saved, so the cart stops telling them about it
  const reprice = useCallback<CartState['reprice']>((prices) => {
    change((current) => {
      let changed = false
      const next = current.map((line) => {
        const found = prices.get(line.sku)
        if (found && (found.unitPrice !== line.unitPrice || found.name !== line.name)) {
          changed = true
          return { ...line, name: found.name, unitPrice: found.unitPrice }
        }
        return line
      })
      return changed ? next : current
    })
  }, [change])

  const value = useMemo<CartState>(
    () => ({
      lines,
      count: cart.itemCount(lines),
      add: (item, quantity) => change((current) => cart.addLine(current, item, quantity)),
      setQuantity: (sku, quantity) => change((current) => cart.setQuantity(current, sku, quantity)),
      remove: (sku) => change((current) => cart.removeLine(current, sku)),
      reprice,
      clear: () => change(() => []),
    }),
    [lines, change, reprice],
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

function forget(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Blocked storage: it is merged again next time, which changes nothing
  }
}
