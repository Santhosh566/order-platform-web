import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DeadLetter, RouteInfo } from '../../api/adminTypes'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { ORDER_ID } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'

const admin = () => fakeAuth(['ADMIN'])

afterEach(() => vi.unstubAllGlobals())

function dead(overrides: Partial<DeadLetter> = {}): DeadLetter {
  return {
    id: 6,
    orderId: ORDER_ID,
    topic: 'order.created',
    payload: `{"orderId":"${ORDER_ID}"}`,
    errorMessage: 'Cannot obtain LRA id from LRA coordinator due to response status code 500',
    exceptionClass: 'java.util.concurrent.CompletionException',
    redeliveryAttempts: 3,
    failedAt: '2026-11-08T19:48:39',
    replayed: false,
    replayedAt: null,
    replayedBy: null,
    dismissedAt: null,
    dismissedBy: null,
    dismissNote: null,
    ...overrides,
  }
}

function route(overrides: Partial<RouteInfo>): RouteInfo {
  return {
    routeId: 'outbox-poller',
    status: 'Started',
    kind: 'CONSUMER',
    controllable: true,
    endpointUri: 'timer://outboxPoller?delay=5000&period=5000',
    description: null,
    uptime: '2h3m',
    inflight: 0,
    waiting: null,
    ...overrides,
  }
}

describe('failed messages', () => {
  it('shows only open entries at first, and the history on request', async () => {
    fakeBackend({
      'GET /api/dlq': {
        body: [
          dead(),
          dead({ id: 5, replayed: true, replayedAt: '2026-11-01T10:00:00', replayedBy: 'ADM-001' }),
        ],
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/ops', admin())

    expect(await screen.findByText('#6')).toBeInTheDocument()
    expect(screen.getByText('CompletionException · failed', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('#5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'All, with history' }))
    expect(await screen.findByText('#5')).toBeInTheDocument()
    expect(screen.getByText(/by ADM-001/)).toBeInTheDocument()
  })

  it('shows why a replay was refused', async () => {
    fakeBackend({
      'GET /api/dlq': { body: [dead()] },
      'POST /api/dlq/6/replay': {
        status: 409,
        body: { status: 'CONFLICT', reason: `Order ${ORDER_ID} is CANCELLED and cannot be processed again. Dismiss this entry instead.` },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/ops', admin())

    await user.click(await screen.findByRole('button', { name: 'Replay' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replay' }))
    expect(await screen.findByText(/is CANCELLED and cannot be processed again/)).toBeInTheDocument()
  })

  it('dismisses with a note', async () => {
    const backend = fakeBackend({
      'GET /api/dlq': { body: [dead()] },
      'POST /api/dlq/6/dismiss': { body: dead({ dismissedAt: '2026-11-08T22:00:00', dismissedBy: 'ADM-001' }) },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/ops', admin())

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }))
    expect(within(dialog).getByText('A note is required')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox'), 'Customer cancelled the order')
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() =>
      expect(backend.sent('POST', '/api/dlq/6/dismiss')[0]?.body).toEqual({ note: 'Customer cancelled the order' }),
    )
  })
})

describe('routes', () => {
  it('offers controls only for consumers, and pauses after confirming', async () => {
    const backend = fakeBackend({
      'GET /api/admin/routes': {
        body: [
          route({ waiting: { count: 3, unit: 'orders not yet sent to Kafka', orderStatus: 'PENDING', note: null } }),
          route({
            routeId: 'b2b-csv-file-watcher',
            waiting: { count: 2, unit: 'files waiting in data/inbox/csv', orderStatus: null, note: null },
            status: 'Suspended',
            endpointUri: 'file://data/inbox/csv?idempotent=true',
          }),
          route({
            routeId: 'process-order',
            kind: 'INTERNAL',
            controllable: false,
            endpointUri: 'direct://processOrder',
          }),
          route({
            routeId: 'route1',
            kind: 'API',
            controllable: false,
            status: 'Stopped',
            endpointUri: 'rest://post:/api/orders',
          }),
        ],
      },
      'POST /api/admin/routes/outbox-poller/suspend': {
        body: { routeId: 'outbox-poller', status: 'Suspended', by: 'ADM-001' },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/admin/ops?tab=routes', admin())

    expect(await screen.findByText('Publishes saved orders to Kafka')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    // Running: the queue, linked to the orders; paused: what the pause holds back
    expect(screen.getByRole('link', { name: '3 orders not yet sent to Kafka' })).toHaveAttribute(
      'href',
      '/admin/orders?status=PENDING',
    )
    expect(screen.getByText('Held back:', { exact: false })).toHaveTextContent('Held back: 2 files waiting in data/inbox/csv')
    // One Pause button: the running consumer only, never the pipeline step or the API
    expect(screen.getAllByRole('button', { name: 'Pause' })).toHaveLength(1)
    expect(screen.getByText('Routes not running')).toBeInTheDocument()
    expect(screen.getByText('route1 (Stopped)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('New orders wait in the outbox table.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Pause' }))
    await waitFor(() => expect(backend.sent('POST', '/api/admin/routes/outbox-poller/suspend')).toHaveLength(1))
  })
})
