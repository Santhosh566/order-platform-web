import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../test/render'
import type { Profile } from '../profile/types'
import { ageOn } from '../profile/profileSchema'

afterEach(() => {
  vi.unstubAllGlobals()
})

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: 'CUST-100',
    email: 'alice@example.com',
    roles: ['CUSTOMER'],
    fullName: 'Alice Smith',
    phone: null,
    hasPhoto: false,
    photoUpdatedAt: null,
    memberSince: '2026-01-05T10:00:00',
    customer: { dateOfBirth: null, gender: null },
    driver: null,
    staff: null,
    ...overrides,
  }
}

describe('profile', () => {
  it('is in the account menu for every role', async () => {
    fakeBackend({ 'GET /api/me/profile': { body: profile() } })
    const user = userEvent.setup()
    renderRoutes(routes, '/profile', fakeAuth(['DELIVERY']))

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(await screen.findByRole('menuitem', { name: 'Edit profile' })).toHaveAttribute('href', '/profile')
  })

  it('lets a customer save their details, with only the customer part', async () => {
    const refreshMe = vi.fn(async () => {})
    const backend = fakeBackend({
      'GET /api/me/profile': { body: profile() },
      'PUT /api/me/profile': {
        body: profile({ fullName: 'Alice Rao', phone: '+91-98450-00101', customer: { dateOfBirth: '1990-04-12', gender: null } }),
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/profile', fakeAuth(['CUSTOMER'], { refreshMe }))

    expect(await screen.findByRole('heading', { name: 'My profile' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vehicle' })).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Email')).toHaveAttribute('readonly')

    const name = screen.getByRole('textbox', { name: /Full name/ })
    await user.clear(name)
    await user.type(name, 'Alice Rao')
    await user.type(screen.getByRole('textbox', { name: /Mobile number/ }), '12345')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('A 10-digit Indian mobile number')).toBeInTheDocument()
    expect(backend.sent('PUT', '/api/me/profile')).toHaveLength(0)

    const phone = screen.getByRole('textbox', { name: /Mobile number/ })
    await user.clear(phone)
    await user.type(phone, '98450 00101')
    await user.type(screen.getByLabelText(/Date of birth/), '1990-04-12')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(backend.sent('PUT', '/api/me/profile')).toHaveLength(1))
    expect(backend.sent('PUT', '/api/me/profile')[0].body).toEqual({
      fullName: 'Alice Rao',
      phone: '98450 00101',
      customer: { dateOfBirth: '1990-04-12', gender: null },
    })
    await waitFor(() => expect(refreshMe).toHaveBeenCalled())
  })

  it('asks a driver for vehicle and licence numbers, except on a bicycle', async () => {
    const driver = profile({
      userId: 'DEL-1',
      roles: ['DELIVERY'],
      phone: '+91-98765-43210',
      customer: null,
      driver: {
        vehicleType: null,
        vehicleNumber: null,
        licenceNumber: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        upiId: null,
      },
    })
    const backend = fakeBackend({ 'GET /api/me/profile': { body: driver }, 'PUT /api/me/profile': { body: driver } })
    const user = userEvent.setup()
    renderRoutes(routes, '/profile', fakeAuth(['DELIVERY']))

    const vehicle = await screen.findByRole('combobox', { name: /How do you deliver/ })
    await user.click(vehicle)
    await user.click(await screen.findByRole('option', { name: 'Motorbike' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Like KA01AB1234 (or 22BH1234AA)')).toBeInTheDocument()
    expect(screen.getByText('15 characters, like KA0120190001234')).toBeInTheDocument()

    // The emergency contact must be someone else
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ravi')
    const contact = within(screen.getByRole('heading', { name: 'Emergency contact' }).closest('.mantine-Paper-root') as HTMLElement)
      .getByRole('textbox', { name: 'Mobile number' })
    await user.type(contact, '9876543210')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Someone else’s number, not your own')).toBeInTheDocument()

    await user.clear(contact)
    await user.type(contact, '9123456789')
    await user.click(vehicle)
    await user.click(await screen.findByRole('option', { name: 'Bicycle' }))
    expect(screen.queryByRole('textbox', { name: /Vehicle number/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(backend.sent('PUT', '/api/me/profile')).toHaveLength(1))
    expect(backend.sent('PUT', '/api/me/profile')[0].body).toMatchObject({
      driver: { vehicleType: 'CYCLE', emergencyContactName: 'Ravi', emergencyContactPhone: '9123456789' },
    })
  })

  it('uploads a photo', async () => {
    const backend = fakeBackend({
      'GET /api/me/profile': { body: profile() },
      'POST /api/me/photo': { body: profile({ hasPhoto: true, photoUpdatedAt: '2026-11-16T10:00:00' }) },
      'GET /api/users/CUST-100/photo': { body: {} },
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:photo', revokeObjectURL: () => {} }))
    const user = userEvent.setup()
    const { container } = renderRoutes(routes, '/profile', fakeAuth(['CUSTOMER']))

    await screen.findByRole('button', { name: 'Add photo' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' }))

    await waitFor(() => expect(backend.sent('POST', '/api/me/photo')).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Change photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('counts age in whole years', () => {
    expect(ageOn('2008-11-17', new Date(2026, 10, 16))).toBe(17)
    expect(ageOn('2008-11-16', new Date(2026, 10, 16))).toBe(18)
  })
})
