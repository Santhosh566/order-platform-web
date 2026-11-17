import { screen } from '@testing-library/react'
import { routes } from '../router'
import { fakeAuth, renderRoutes } from '../test/render'

describe('route guards', () => {
  it('sends a signed-out visitor to the welcome page', async () => {
    renderRoutes(routes, '/orders', fakeAuth(null))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('opens a customer page for a customer', async () => {
    renderRoutes(routes, '/orders', fakeAuth(['CUSTOMER']))
    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeInTheDocument()
  })

  it('refuses an admin page to a customer', async () => {
    renderRoutes(routes, '/admin/catalog', fakeAuth(['CUSTOMER']))
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('sends each user from / to their start page', async () => {
    renderRoutes(routes, '/', fakeAuth(['ADMIN']))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows only the menu for the user’s roles', async () => {
    renderRoutes(routes, '/delivery', fakeAuth(['DELIVERY']))
    expect(await screen.findByRole('link', { name: 'My deliveries' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Catalogue & stock' })).not.toBeInTheDocument()
  })
})
