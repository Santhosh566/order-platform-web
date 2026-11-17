import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { accessToken } from '../api/client'
import type { Order } from '../api/types'
import { keys } from './queries'

export type LiveState = 'connecting' | 'live' | 'offline'

/**
 * Listens to /api/stream/orders and puts each changed order straight into the query cache, so
 * the pages update without polling. The backend sends a customer only their own orders, and an
 * admin every order.
 *
 * An EventSource cannot send headers, so the token goes in the URL. The browser would retry with
 * the same, possibly expired, token; instead every failure closes the stream and a new one opens
 * with a fresh token, waiting longer after each failure.
 */
export function useLiveOrders(): LiveState {
  const client = useQueryClient()
  const [state, setState] = useState<LiveState>(() =>
    typeof EventSource === 'undefined' ? 'offline' : 'connecting',
  )

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false

    const connect = async () => {
      const token = await accessToken()
      if (stopped) return
      if (!token) {
        setState('offline')
        return
      }
      source = new EventSource('/api/stream/orders?access_token=' + encodeURIComponent(token))
      source.addEventListener('INIT', () => {
        failures = 0
        setState('live')
        // Anything that changed while the stream was down
        void client.invalidateQueries({ queryKey: keys.orders })
        void client.invalidateQueries({ queryKey: ['admin'] })
      })
      source.addEventListener('ORDER_UPDATED', (event) => {
        const order = parse((event as MessageEvent<string>).data)
        if (!order) return
        client.setQueryData(keys.order(order.orderId), order)
        void client.invalidateQueries({ queryKey: keys.orders, exact: true })
        // Admin screens: lists, counts and the delivery board (only those on screen refetch)
        void client.invalidateQueries({ queryKey: ['admin'] })
      })
      // Admins also hear about dead letters and routes; the operations screen refetches
      for (const name of ['DLQ_UPDATED', 'DLQ_REPLAYED', 'ROUTE_UPDATED']) {
        source.addEventListener(name, () => void client.invalidateQueries({ queryKey: ['admin'] }))
      }
      source.onerror = () => {
        source?.close()
        source = null
        if (stopped) return
        setState('offline')
        failures += 1
        retry = setTimeout(() => void connect(), Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5)))
      }
    }

    void connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      source?.close()
    }
  }, [client])

  return state
}

function parse(data: string): Order | null {
  try {
    const value: unknown = JSON.parse(data)
    return value && typeof value === 'object' && 'orderId' in value ? (value as Order) : null
  } catch {
    return null
  }
}
