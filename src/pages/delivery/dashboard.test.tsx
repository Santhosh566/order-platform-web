import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { change, niceMax, type DriverFigures, type DriverSummary, type Leaderboard } from '../../delivery/stats'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { fakeAuth, renderRoutes } from '../../test/render'

afterEach(() => vi.unstubAllGlobals())

function figures(overrides: Partial<DriverFigures> = {}): DriverFigures {
  return {
    delivered: 0,
    pickupsCollected: 0,
    completed: 0,
    failed: 0,
    tasks: 0,
    successRate: null,
    cashCollected: 0,
    earnings: 0,
    rating: null,
    ratingCount: 0,
    ...overrides,
  }
}

const SUMMARY: DriverSummary = {
  driverId: 'DEL-001',
  driverName: 'Ravi Kumar',
  openNow: { deliveries: 3, pickups: 1 },
  feedback: [{ rating: 5, comment: 'Polite and careful', ratedAt: '2026-11-13T18:00:00' }],
  periods: {
    DAY: {
      period: 'DAY',
      from: '2026-11-14',
      to: '2026-11-14',
      figures: figures({ delivered: 7, pickupsCollected: 1, completed: 8, failed: 1, tasks: 10, successRate: 0.8889, cashCollected: 2450, earnings: 295 }),
      previous: figures({ completed: 6 }),
    },
    WEEK: {
      period: 'WEEK',
      from: '2026-11-09',
      to: '2026-11-15',
      figures: figures({ delivered: 35, pickupsCollected: 3, completed: 38, failed: 3, tasks: 41, successRate: 0.9268, rating: 4.6, ratingCount: 12 }),
      previous: figures({ completed: 34 }),
    },
    MONTH: {
      period: 'MONTH',
      from: '2026-11-01',
      to: '2026-11-30',
      figures: figures({ delivered: 90, completed: 90, tasks: 95, successRate: 0.95 }),
      previous: figures({ completed: 100 }),
    },
    YEAR: {
      period: 'YEAR',
      from: '2026-01-01',
      to: '2026-12-31',
      figures: figures({ delivered: 900, completed: 900, tasks: 950, successRate: 0.95 }),
      previous: figures(),
    },
  },
}

function history(period: string, labels: string[]) {
  return {
    period,
    from: '2026-11-09',
    to: '2026-11-15',
    buckets: labels.map((label, i) => ({ start: `2026-11-${10 + i}T00:00:00`, label, delivered: i, pickupsCollected: 1, failed: 0 })),
  }
}

describe('driver dashboard', () => {
  it("shows today's work and the chosen period, and asks for that period's chart", async () => {
    const backend = fakeBackend({
      'GET /api/delivery/stats': { body: SUMMARY },
      'GET /api/delivery/stats/history': (call) => ({
        body: call.query.period === 'YEAR' ? history('YEAR', ['Jan', 'Feb']) : history('WEEK', ['Mon 9', 'Tue 10']),
      }),
    })
    renderRoutes(routes, '/delivery/dashboard', fakeAuth(['DELIVERY']))

    expect(await screen.findByLabelText('To do now')).toHaveTextContent('4')
    expect(screen.getByLabelText('Delivered today')).toHaveTextContent('7')
    expect(screen.getByLabelText('Cash collected today')).toHaveTextContent('₹2,450.00')
    expect(screen.getByLabelText('Earned today')).toHaveTextContent('₹295.00')
    expect(screen.getByLabelText('Customer rating')).toHaveTextContent('4.6 ★')
    expect(screen.getByText(/Polite and careful/)).toBeInTheDocument()
    // This week, against the same stretch of last week
    expect(screen.getByLabelText('Completed')).toHaveTextContent('38')
    expect(screen.getByText('▲ 12% vs last week (34)')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /Completed, this week: 3 completed/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Year' }))
    expect(screen.getByLabelText('Completed')).toHaveTextContent('900')
    await waitFor(() => expect(backend.calls.some((c) => c.query.period === 'YEAR')).toBe(true))

    await userEvent.click(await screen.findByRole('button', { name: 'Show as table' }))
    const table = await screen.findByRole('table', { name: 'Completed, this year' })
    expect(within(table).getByText('Feb')).toBeInTheDocument()
  })
})

describe('driver performance for admins', () => {
  it('lists every driver, sorts by a column and opens a driver', async () => {
    const board: Leaderboard = {
      period: 'MONTH',
      from: '2026-11-01',
      to: '2026-11-14',
      drivers: [
        { driverId: 'DEL-001', driverName: 'Ravi Kumar', figures: figures({ completed: 90, failed: 2, successRate: 0.98 }) },
        { driverId: 'DEL-002', driverName: 'Sunita Rao', figures: figures({ completed: 60, failed: 9, successRate: 0.87 }) },
      ],
    }
    const empty = { body: [] }
    fakeBackend({
      'GET /api/admin/delivery/drivers/stats': { body: board },
      'GET /api/admin/delivery/drivers/DEL-002/stats': { body: { ...SUMMARY, driverId: 'DEL-002', driverName: 'Sunita Rao' } },
      'GET /api/admin/delivery/drivers/DEL-002/stats/history': { body: history('WEEK', ['Mon 9']) },
      'GET /api/admin/delivery/waiting': empty,
      'GET /api/admin/delivery/in-progress': empty,
      'GET /api/admin/delivery/drivers': empty,
      'GET /api/admin/pickups/waiting': empty,
      'GET /api/admin/pickups/in-progress': empty,
    })
    renderRoutes(routes, '/admin/deliveries', fakeAuth(['ADMIN']))

    const table = await screen.findByRole('table', { name: 'Driver performance' })
    const names = () => within(table).getAllByRole('button').filter((b) => /Kumar|Rao/.test(b.textContent ?? ''))
    expect(names().map((b) => b.textContent)).toEqual(['Ravi Kumar', 'Sunita Rao'])
    await userEvent.click(within(table).getByRole('button', { name: /Failed/ }))
    expect(names().map((b) => b.textContent)).toEqual(['Sunita Rao', 'Ravi Kumar'])

    await userEvent.click(within(table).getByRole('button', { name: 'Sunita Rao' }))
    expect(await screen.findByRole('dialog', { name: 'Sunita Rao' })).toBeInTheDocument()
  })
})

describe('figures', () => {
  it('compares with the period before, and rounds the scale', () => {
    expect(change(38, 34)).toEqual({ text: '▲ 12%', up: true })
    expect(change(5, 10)).toEqual({ text: '▼ 50%', up: false })
    expect(change(3, 0)).toEqual({ text: 'new', up: true })
    expect(change(0, 0)).toBeNull()
    expect(niceMax(3)).toBe(4)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(23)).toBe(25)
    expect(niceMax(130)).toBe(200)
  })
})
