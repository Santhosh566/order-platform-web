import { createContext, useContext } from 'react'
import type { Me, Role } from '../api/types'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error'

export interface AuthState {
  status: AuthStatus
  /** The signed-in user as the backend sees them; roles come from here, not from the browser. */
  me: Me | null
  error: string | null
  signIn: (returnTo?: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: Role) => boolean
  /** Reloads /api/me, e.g. after the address changed. */
  refreshMe: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return auth
}
