import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AvailableDelivery, AvailablePickup, MyDelivery, MyPickup } from '../api/adminTypes'
import { api } from '../api/client'

export const driverKeys = {
  available: ['delivery', 'available'] as const,
  mine: ['delivery', 'mine'] as const,
}

/**
 * Drivers get no live stream (it carries customers' orders), so the lists refresh every
 * 30 seconds and whenever the phone comes back to the app.
 */
const REFRESH_MS = 30_000

/** GET /api/delivery/warehouse: where the driver collects parcels and brings returns */
export interface DriverWarehouse {
  id: number
  code: string
  name: string
  address: string
}

export function useMyWarehouse() {
  return useQuery({
    queryKey: ['delivery', 'warehouse'],
    queryFn: ({ signal }) => api<DriverWarehouse>('/api/delivery/warehouse', { signal }),
    staleTime: 5 * 60_000,
  })
}

export function useAvailable() {
  return useQuery({
    queryKey: driverKeys.available,
    queryFn: ({ signal }) => api<AvailableDelivery[]>('/api/delivery/available', { signal }),
    refetchInterval: REFRESH_MS,
  })
}

export function useMine() {
  return useQuery({
    queryKey: driverKeys.mine,
    queryFn: ({ signal }) => api<MyDelivery[]>('/api/delivery/mine', { signal }),
    refetchInterval: REFRESH_MS,
  })
}

export type DriverAction = 'take' | 'pickup' | 'out-for-delivery' | 'deliver' | 'fail'

/** Every step on the road is one POST; the reply is the delivery as it is now. */
export function useDriverAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, action, body }: { orderId: string; action: DriverAction; body?: Record<string, unknown> }) =>
      api<MyDelivery>(`/api/delivery/orders/${encodeURIComponent(orderId)}/${action}`, {
        method: 'POST',
        body: body ?? {},
      }),
    onSuccess: (delivery) => {
      // Show the new state at once; finished deliveries drop off the list
      client.setQueryData<MyDelivery[]>(driverKeys.mine, (current) => {
        const others = (current ?? []).filter((d) => d.orderId !== delivery.orderId)
        const live = delivery.deliveryStatus === 'ASSIGNED' || delivery.deliveryStatus === 'PICKED_UP'
        return live ? [...others, delivery] : others
      })
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: driverKeys.mine })
      void client.invalidateQueries({ queryKey: driverKeys.available })
    },
  })
}

/** Where the driver is in a delivery, which decides the one main button to show. */
export type Stage = 'collect' | 'start' | 'handover'

export function stageOf(delivery: Pick<MyDelivery, 'deliveryStatus' | 'status'>): Stage {
  if (delivery.deliveryStatus === 'ASSIGNED') return 'collect'
  return delivery.status === 'OUT_FOR_DELIVERY' ? 'handover' : 'start'
}

/** A maps search for the address, which opens the maps app on a phone. */
export function mapsLink(address: MyDelivery['address']): string | null {
  if (!address) return null
  const text = [address.line1, address.line2, address.city, address.state, address.postalCode, 'India']
    .filter(Boolean)
    .join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`
}

/** tel: needs digits and a leading +, without the spaces and dashes people type. */
export function telLink(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

// ── Return pickups ───────────────────────────────────────────────────────────

export const pickupKeys = {
  available: ['delivery', 'pickups', 'available'] as const,
  mine: ['delivery', 'pickups', 'mine'] as const,
}

export function useAvailablePickups() {
  return useQuery({
    queryKey: pickupKeys.available,
    queryFn: ({ signal }) => api<AvailablePickup[]>('/api/delivery/pickups/available', { signal }),
    refetchInterval: REFRESH_MS,
  })
}

export function useMyPickups() {
  return useQuery({
    queryKey: pickupKeys.mine,
    queryFn: ({ signal }) => api<MyPickup[]>('/api/delivery/pickups/mine', { signal }),
    refetchInterval: REFRESH_MS,
  })
}

export type PickupAction = 'take' | 'start' | 'collect' | 'fail'

export function usePickupAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ returnId, action, body }: { returnId: string; action: PickupAction; body?: Record<string, string> }) =>
      api<MyPickup>(`/api/delivery/pickups/${encodeURIComponent(returnId)}/${action}`, {
        method: 'POST',
        body: body ?? {},
      }),
    onSuccess: (pickup) => {
      client.setQueryData<MyPickup[]>(pickupKeys.mine, (current) => {
        const others = (current ?? []).filter((p) => p.returnId !== pickup.returnId)
        const live = pickup.pickupStatus === 'ASSIGNED' || pickup.pickupStatus === 'ON_THE_WAY'
        return live ? [...others, pickup] : others
      })
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: pickupKeys.mine })
      void client.invalidateQueries({ queryKey: pickupKeys.available })
    },
  })
}
