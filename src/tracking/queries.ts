import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { OrderStatus } from '../api/types'

export interface Position {
  latitude: number
  longitude: number
  accuracyM: number | null
  headingDeg: number | null
  recordedAt: string
  /** No position for a few minutes: this is where the driver was last */
  stale: boolean
}

export interface Destination {
  latitude: number
  longitude: number
  /** The centre of the delivery PIN code, not the house */
  approximate: boolean
  label: string
  /** The "in your area" distance around it, in metres */
  areaRadiusM: number
}

/** GET /api/orders/{id}/tracking, and the DRIVER_LOCATION live event for the order's customer. */
export interface Tracking {
  orderId: string
  status: OrderStatus
  /** Out for delivery with one of our drivers; otherwise message says why there is no map */
  live: boolean
  message: string | null
  driverName: string | null
  driver: Position | null
  destination: Destination | null
  /** By road, estimated */
  distanceKm: number | null
  etaMinutes: number | null
  etaAt: string | null
  /** The driver is within about a kilometre of the middle of the delivery PIN code */
  inYourArea: boolean
}

/** GET /api/admin/delivery/locations */
export interface DriverOnRoad {
  driverId: string
  name: string
  position: Position | null
  orderIds: string[]
}

/** Under the order's key, so the live stream can put a new position straight in (useLiveOrders). */
export const trackingKey = (orderId: string) => ['orders', orderId, 'tracking'] as const
export const driversOnRoadKey = ['admin', 'delivery', 'locations'] as const

export function useTracking(orderId: string, status: OrderStatus) {
  return useQuery({
    queryKey: trackingKey(orderId),
    queryFn: ({ signal }) => api<Tracking>(`/api/orders/${encodeURIComponent(orderId)}/tracking`, { signal }),
    enabled: status === 'OUT_FOR_DELIVERY',
    // The live stream brings each position; this only covers a stream that dropped
    refetchInterval: 60_000,
  })
}

export function useDriversOnRoad() {
  return useQuery({
    queryKey: driversOnRoadKey,
    queryFn: ({ signal }) => api<DriverOnRoad[]>('/api/admin/delivery/locations', { signal }),
    refetchInterval: 30_000,
  })
}

/** "just now", "3 min ago", "1 h ago" */
export function ago(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} h ago`
}

/** Metres between two points on the map (haversine), for deciding whether the driver moved. */
export function metresBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}
