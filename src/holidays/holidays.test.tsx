import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routes } from '../router'
import { fakeBackend, type Call } from '../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../test/render'

afterEach(() => vi.unstubAllGlobals())

describe('delivery holidays', () => {
  it('lists the year and adds a state holiday', async () => {
    const year = new Date().getFullYear()
    const backend = fakeBackend({
      'GET /api/admin/holidays': (call: Call) => ({
        body:
          call.query.year === String(year)
            ? [{ id: 1, day: `${year}-08-15`, name: 'Independence Day', stateCode: null, stateName: null }]
            : [],
      }),
      'POST /api/admin/holidays': (call: Call) => ({
        status: 201,
        body: { id: 2, ...(call.body as object), stateName: 'Karnataka' },
      }),
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/holidays', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Holidays' })
    expect(within(table).getByText('Independence Day')).toBeInTheDocument()
    expect(within(table).getByText('All of India')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Day'), `${year}-11-01`)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Rajyotsava')
    await user.click(screen.getByRole('combobox', { name: 'Where' }))
    await user.click(await screen.findByRole('option', { name: 'Karnataka' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(backend.sent('POST', '/api/admin/holidays')).toHaveLength(1))
    expect(backend.sent('POST', '/api/admin/holidays')[0].body).toEqual({
      day: `${year}-11-01`,
      name: 'Rajyotsava',
      stateCode: '29',
    })

    await user.click(screen.getByRole('button', { name: 'Next year' }))
    expect(await screen.findByText(`No holidays in ${year + 1}.`)).toBeInTheDocument()
  })
})
