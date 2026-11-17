import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { Me, Role } from '../api/types'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { CartProvider } from '../cart/CartProvider'
import { AppThemeProvider } from '../AppThemeProvider'

/** An AuthState for tests: signed in with the given roles, or signed out when roles is null. */
export function fakeAuth(roles: Role[] | null, overrides: Partial<AuthState> = {}): AuthState {
  const me: Me | null = roles
    ? { userId: 'CUST-100', fullName: 'Alice Smith', email: 'alice@example.com', roles, defaultAddress: null }
    : null
  return {
    status: roles ? 'signedIn' : 'signedOut',
    me,
    error: null,
    signIn: async () => {},
    signOut: async () => {},
    hasRole: (role) => roles?.includes(role) ?? false,
    refreshMe: async () => {},
    ...overrides,
  }
}

export function renderRoutes(routes: RouteObject[], path: string, auth: AuthState) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  // A fresh cache per test, without retries, so one test's data never leaks into another
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <AppThemeProvider env="test" initialStyle="classic">
      <Notifications />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </ModalsProvider>
    </AppThemeProvider>,
  )
  return { ...view, router, queryClient }
}

export function renderWithProviders(ui: ReactElement, auth: AuthState) {
  return renderRoutes([{ path: '*', element: ui }], '/', auth)
}
