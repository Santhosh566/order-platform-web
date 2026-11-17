import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, configureApi } from '../api/client'
import type { AuthConfig, Me, Role } from '../api/types'
import { AuthContext, type AuthState, type AuthStatus } from './AuthContext'

/**
 * Sign-in with Keycloak: authorization code flow with PKCE, handled by oidc-client-ts.
 * Tokens live in sessionStorage (gone when the tab closes) and are renewed in the background
 * with the refresh token. Keycloak's settings come from the backend, so there is one place to change them.
 */

const CALLBACK_PATH = '/auth/callback'

interface ReturnState {
  returnTo?: string
}

// React may run effects twice in development; the code from Keycloak can be exchanged only once
let startup: Promise<{ manager: UserManager; returnTo: string | null }> | null = null

function start(): Promise<{ manager: UserManager; returnTo: string | null }> {
  startup ??= (async () => {
    const config = await api<AuthConfig>('/api/public/auth-config', { anonymous: true })
    const origin = window.location.origin
    const manager = new UserManager({
      authority: config.issuer,
      client_id: config.clientId,
      redirect_uri: origin + CALLBACK_PATH,
      post_logout_redirect_uri: origin + '/',
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })

    let returnTo: string | null = null
    if (window.location.pathname === CALLBACK_PATH) {
      try {
        const user = await manager.signinRedirectCallback()
        returnTo = (user.state as ReturnState | undefined)?.returnTo ?? '/'
      } catch {
        returnTo = '/'
      }
      window.history.replaceState(null, '', returnTo)
    }
    return { manager, returnTo }
  })()
  return startup
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const managerRef = useRef<UserManager | null>(null)

  const loadMe = useCallback(async () => {
    const profile = await api<Me>('/api/me')
    setMe(profile)
    setStatus('signedIn')
  }, [])

  useEffect(() => {
    let cancelled = false
    start()
      .then(async ({ manager }) => {
        if (cancelled) return
        managerRef.current = manager
        configureApi({
          getToken: async () => {
            const user = await manager.getUser()
            return user && !user.expired ? user.access_token : null
          },
          onUnauthorized: () => {
            void manager.removeUser()
            setMe(null)
            setStatus('signedOut')
          },
          onInactive: () => setMe((current) => (current && current.active !== false ? { ...current, active: false } : current)),
        })
        manager.events.addSilentRenewError(() => {
          void manager.removeUser()
          setMe(null)
          setStatus('signedOut')
        })

        const user = await manager.getUser()
        if (!user || user.expired) {
          setStatus('signedOut')
          return
        }
        await loadMe()
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.reason : 'Sign-in is not available right now.')
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [loadMe])

  const value = useMemo<AuthState>(
    () => ({
      status,
      me,
      error,
      signIn: async (returnTo?: string) => {
        const manager = managerRef.current
        if (!manager) return
        const state: ReturnState = { returnTo: returnTo ?? window.location.pathname + window.location.search }
        await manager.signinRedirect({ state })
      },
      signOut: async () => {
        const manager = managerRef.current
        setMe(null)
        if (!manager) {
          setStatus('signedOut')
          return
        }
        // Ends the Keycloak session too, so the next sign-in asks for the password again
        await manager.signoutRedirect()
      },
      hasRole: (role: Role) => me?.roles.includes(role) ?? false,
      refreshMe: loadMe,
    }),
    [status, me, error, loadMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
