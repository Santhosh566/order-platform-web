import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../test/render'
import { api, configureApi } from '../api/client'

afterEach(() => {
  vi.unstubAllGlobals()
})

const inactive = (roles: Parameters<typeof fakeAuth>[0]) => {
  const auth = fakeAuth(roles)
  return { ...auth, me: { ...auth.me!, active: false } }
}

describe('inactive account', () => {
  it('shows "no access" on every page, but keeps the menu and sign-out', async () => {
    const backend = fakeBackend({})
    const user = userEvent.setup()
    renderRoutes(routes, '/orders', inactive(['CUSTOMER']))

    expect(await screen.findByRole('heading', { name: 'You have no access' })).toBeInTheDocument()
    expect(screen.getByText(/Please contact the administrator/)).toBeInTheDocument()
    // The page's own data is never asked for
    expect(backend.calls.filter((c) => c.path === '/api/orders')).toHaveLength(0)

    await user.click(screen.getByRole('link', { name: 'Products' }))
    expect(await screen.findByRole('heading', { name: 'You have no access' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('a driver sees the same', async () => {
    fakeBackend({})
    renderRoutes(routes, '/delivery/mine', inactive(['DELIVERY']))
    expect(await screen.findByRole('heading', { name: 'You have no access' })).toBeInTheDocument()
  })

  it('tells the app when the server says the account was turned off', async () => {
    fakeBackend({
      'GET /api/orders': {
        status: 403,
        body: { status: 'ACCOUNT_INACTIVE', reason: 'Your account is inactive. Please contact the administrator.' },
      },
    })
    const onInactive = vi.fn()
    configureApi({ getToken: async () => 'token', onUnauthorized: () => {}, onInactive })
    await expect(api('/api/orders')).rejects.toThrow('Your account is inactive')
    await waitFor(() => expect(onInactive).toHaveBeenCalledTimes(1))
    configureApi({ getToken: async () => null, onUnauthorized: () => {} })
  })
})
