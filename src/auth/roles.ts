import type { Role } from '../api/types'

/** Where each kind of user starts. A user with several roles starts at the first that applies. */
export function homeFor(roles: readonly Role[]): string {
  if (roles.includes('ADMIN')) return '/admin'
  if (roles.includes('DELIVERY')) return '/delivery'
  if (roles.includes('CUSTOMER')) return '/shop'
  return '/no-access'
}
