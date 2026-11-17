import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../../test/render'
import type { UserDetail, UserPage } from '../../admin/users'

afterEach(() => {
  vi.unstubAllGlobals()
})

const PAGE: UserPage = {
  items: [
    {
      userId: 'CUST-100',
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      phone: '+91-98450-00101',
      roles: ['CUSTOMER'],
      active: true,
      photoVersion: null,
      createdAt: '2026-01-05T10:00:00',
    },
    {
      userId: 'DEL-1',
      fullName: 'Ravi Kumar',
      email: 'driver1@example.com',
      phone: '+91-98765-01234',
      roles: ['DELIVERY'],
      active: true,
      photoVersion: null,
      createdAt: '2026-02-01T10:00:00',
    },
  ],
  total: 2,
  page: 0,
  size: 25,
}

const DRIVER: UserDetail = {
  profile: {
    userId: 'DEL-1',
    email: 'driver1@example.com',
    roles: ['DELIVERY'],
    fullName: 'Ravi Kumar',
    phone: '+91-98765-01234',
    hasPhoto: false,
    photoUpdatedAt: null,
    memberSince: '2026-02-01T10:00:00',
    customer: null,
    driver: {
      vehicleType: 'SCOOTER',
      vehicleNumber: 'KA05MN4321',
      licenceNumber: 'KA0520180004321',
      emergencyContactName: 'Lakshmi',
      emergencyContactPhone: '+91-91234-56789',
      upiId: 'ravi@okicici',
    },
    staff: null,
  },
  active: true,
  tier: 'STANDARD',
  signInLinked: true,
  deactivation: null,
  customer: null,
  driver: {
    deliveries: 128,
    pickups: 9,
    failed: 3,
    earnings: 5560,
    rating: 4.7,
    ratingCount: 41,
    lastDeliveryAt: '2026-11-15T18:20:00',
  },
}

describe('admin users', () => {
  it('lists and filters users, and opens one', async () => {
    const backend = fakeBackend({
      'GET /api/admin/users': { body: PAGE },
      'GET /api/admin/users/DEL-1': { body: DRIVER },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/users', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Users' })
    expect(within(table).getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('2 users')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Drivers' }))
    await waitFor(() => expect(backend.calls.some((c) => c.path === '/api/admin/users' && c.query.role === 'DELIVERY')).toBe(true))

    await user.type(screen.getByRole('textbox', { name: 'Search users' }), 'ravi')
    await waitFor(() => expect(backend.calls.some((c) => c.path === '/api/admin/users' && c.query.q === 'ravi')).toBe(true))

    await user.click(within(table).getByText('Ravi Kumar'))
    expect(await screen.findByRole('heading', { name: 'As a driver' })).toBeInTheDocument()
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('★ 4.7')).toBeInTheDocument()
    expect(screen.getByText('KA0520180004321')).toBeInTheDocument()
    expect(screen.getByText('Lakshmi · +91-91234-56789')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'As a customer' })).not.toBeInTheDocument()
  })

  it('deactivates a driver with a reason, and activates them again', async () => {
    let current: UserDetail = DRIVER
    const backend = fakeBackend({
      'GET /api/admin/users/DEL-1': () => ({ body: current }),
      'POST /api/admin/users/DEL-1/deactivate': () => {
        current = {
          ...DRIVER,
          active: false,
          deactivation: { at: '2026-11-16T10:00:00', by: 'ADM-001', byName: 'Admin User', reason: 'Licence expired' },
        }
        return { body: { userId: 'DEL-1', active: false, deliveriesReleased: 2, pickupsReleased: 0 } }
      },
      'POST /api/admin/users/DEL-1/activate': () => {
        current = DRIVER
        return { body: { userId: 'DEL-1', active: true, deliveriesReleased: 0, pickupsReleased: 0 } }
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/users/DEL-1', fakeAuth(['ADMIN']))

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Jobs they have not started go back on the list/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    expect(within(dialog).getByText('Give a reason')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'Licence expired')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(backend.sent('POST', '/api/admin/users/DEL-1/deactivate')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/users/DEL-1/deactivate')[0].body).toEqual({ reason: 'Licence expired' })
    expect(await screen.findByText('2 jobs they had not started went back on the list.')).toBeInTheDocument()
    expect(await screen.findByText('Licence expired')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/users/DEL-1/activate')).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
  })

  it('offers no deactivate button for an admin account', async () => {
    fakeBackend({
      'GET /api/admin/users/ADM-2': {
        body: { ...DRIVER, profile: { ...DRIVER.profile, userId: 'ADM-2', roles: ['ADMIN'], driver: null, staff: { jobTitle: null, department: null } }, driver: null },
      },
    })
    renderRoutes(routes, '/admin/users/ADM-2', fakeAuth(['ADMIN']))
    expect(await screen.findByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('is in the admin menu', async () => {
    fakeBackend({ 'GET /api/admin/users': { body: PAGE } })
    renderRoutes(routes, '/admin/users', fakeAuth(['ADMIN']))
    expect(await screen.findByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users')
  })
})
