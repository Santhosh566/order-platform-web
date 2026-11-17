import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Role } from '../api/types'
import type { Profile } from '../profile/types'

export interface UserRow {
  userId: string
  fullName: string
  email: string | null
  phone: string | null
  roles: Role[]
  active: boolean
  /** Set when the user has a photo */
  photoVersion: string | null
  createdAt: string
}

export interface UserPage {
  items: UserRow[]
  total: number
  page: number
  size: number
}

export interface CustomerActivity {
  orders: number
  delivered: number
  cancelled: number
  /** Net of refunds and cancelled items */
  spent: number
  returns: number
  lastOrderAt: string | null
}

export interface DriverActivity {
  deliveries: number
  pickups: number
  failed: number
  earnings: number
  rating: number | null
  ratingCount: number
  lastDeliveryAt: string | null
}

/** Who turned the user off, when and why; null while active */
export interface Deactivation {
  at: string
  by: string
  byName: string | null
  reason: string
}

export interface UserDetail {
  profile: Profile
  active: boolean
  tier: string
  /** Has signed in through Keycloak at least once */
  signInLinked: boolean
  deactivation: Deactivation | null
  customer: CustomerActivity | null
  driver: DriverActivity | null
}

export const PAGE_SIZE = 25

export type StatusFilter = 'active' | 'inactive' | null

export function useUsers(q: string, role: Role | null, page: number, status: StatusFilter = null) {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (q) params.set('q', q)
  if (role) params.set('role', role)
  if (status) params.set('active', String(status === 'active'))
  return useQuery({
    queryKey: ['admin', 'users', q, role, page, status],
    queryFn: ({ signal }) => api<UserPage>(`/api/admin/users?${params}`, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: ({ signal }) => api<UserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`, { signal }),
  })
}

export interface StatusChange {
  userId: string
  active: boolean
  deliveriesReleased: number
  pickupsReleased: number
}

/** Turns a customer or driver off (with a reason) or back on; refreshes every admin list. */
export function useSetActive(userId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (change: { active: true } | { active: false; reason: string }) =>
      change.active
        ? api<StatusChange>(`/api/admin/users/${encodeURIComponent(userId)}/activate`, { method: 'POST' })
        : api<StatusChange>(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, {
            method: 'POST',
            body: { reason: change.reason },
          }),
    onSettled: () => void client.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  DELIVERY: 'Driver',
  ADMIN: 'Admin',
  SERVICE: 'Service',
}

export const ROLE_COLORS: Record<Role, string> = {
  CUSTOMER: 'blue',
  DELIVERY: 'orange',
  ADMIN: 'grape',
  SERVICE: 'gray',
}
