import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MyDelivery, MyPickup } from '../../api/adminTypes'
import { routes } from '../../router'
import { fakeBackend } from '../../test/fakeBackend'
import { ALICE_ADDRESS, ORDER_ID } from '../../test/fixtures'
import { fakeAuth, renderRoutes } from '../../test/render'

const driver = () => fakeAuth(['DELIVERY'])

afterEach(() => vi.unstubAllGlobals())

function delivery(overrides: Partial<MyDelivery> = {}): MyDelivery {
  return {
    orderId: ORDER_ID,
    status: 'READY_FOR_DISPATCH',
    deliveryStatus: 'ASSIGNED',
    attempt: 1,
    recipientName: 'Alice Smith',
    recipientPhone: '+91-98450-00101',
    address: ALICE_ADDRESS,
    items: [{ sku: 'PEN-01', name: 'Gel pen', quantity: 2 }],
    codeAttemptsLeft: 5,
    ...overrides,
  }
}

const WAITING = {
  orderId: ORDER_ID,
  status: 'READY_FOR_DISPATCH',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560038',
  itemCount: 2,
  waitingSince: '2026-11-08T10:00:00',
}

describe('available orders', () => {
  it('takes an order and moves to my deliveries', async () => {
    let taken = false
    const backend = fakeBackend({
      'GET /api/delivery/available': () => ({ body: taken ? [] : [WAITING] }),
      'GET /api/delivery/mine': () => ({ body: taken ? [delivery()] : [] }),
      [`POST /api/delivery/orders/${ORDER_ID}/take`]: () => {
        taken = true
        return { body: delivery() }
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery', driver())

    expect(await screen.findByText('Bengaluru, 560038')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Take this order' }))

    expect(await screen.findByRole('heading', { name: 'My deliveries' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'I have collected it' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+919845000101')
    expect(screen.getByText('2 × Gel pen')).toBeInTheDocument()
    expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/take`)).toHaveLength(1)
  })

  it('says so when another driver took it first', async () => {
    fakeBackend({
      'GET /api/delivery/available': { body: [WAITING] },
      'GET /api/delivery/mine': { body: [] },
      [`POST /api/delivery/orders/${ORDER_ID}/take`]: {
        status: 409,
        body: { status: 'CONFLICT', reason: 'Order is already taken' },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery', driver())

    await user.click(await screen.findByRole('button', { name: 'Take this order' }))
    expect(await screen.findByText('Someone else took it')).toBeInTheDocument()
  })
})

describe('my deliveries', () => {
  it('asks before sending the customer their code', async () => {
    const backend = fakeBackend({
      'GET /api/delivery/mine': { body: [delivery({ deliveryStatus: 'PICKED_UP', status: 'IN_TRANSIT' })] },
      [`POST /api/delivery/orders/${ORDER_ID}/out-for-delivery`]: {
        body: delivery({ deliveryStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY' }),
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery/mine', driver())

    await user.click(await screen.findByRole('button', { name: 'Start delivery' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/emailed a one-time code/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Start delivery' }))
    await waitFor(() => expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/out-for-delivery`)).toHaveLength(1))
  })

  it('delivers with the code, and shows the tries left after a wrong one', async () => {
    let left = 5
    let delivered = false
    const backend = fakeBackend({
      'GET /api/delivery/mine': () => ({
        body: delivered
          ? []
          : [delivery({ deliveryStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY', codeAttemptsLeft: left })],
      }),
      [`POST /api/delivery/orders/${ORDER_ID}/deliver`]: (call) => {
        if ((call.body as { code: string }).code !== '123456') {
          left -= 1
          return { status: 400, body: { status: 'REJECTED', reason: 'Wrong delivery code' } }
        }
        delivered = true
        return { body: delivery({ deliveryStatus: 'DELIVERED', status: 'DELIVERED' }) }
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery/mine', driver())

    const confirm = await screen.findByRole('button', { name: 'Confirm delivery' })
    expect(confirm).toBeDisabled()
    const first = screen.getAllByRole('textbox')[0]
    await user.click(first)
    await user.keyboard('000000')
    await user.click(confirm)
    expect(await screen.findByText('Wrong delivery code')).toBeInTheDocument()
    expect(await screen.findByText('4 tries left')).toBeInTheDocument()

    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456')
    await user.click(screen.getByRole('button', { name: 'Confirm delivery' }))
    expect(await screen.findByText('Nothing in hand.')).toBeInTheDocument()
    expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/deliver`).map((c) => c.body)).toEqual([
      { code: '000000' },
      { code: '123456' },
    ])
  })

  it('asks for the cash of a cash-on-delivery order before the code', async () => {
    const backend = fakeBackend({
      'GET /api/delivery/mine': {
        body: [
          delivery({
            deliveryStatus: 'PICKED_UP',
            status: 'OUT_FOR_DELIVERY',
            paymentMethod: 'COD',
            amountToCollect: 640,
            currency: 'INR',
            deliveryDate: '2026-11-14',
            deliveryWindow: 'MORNING',
          }),
        ],
      },
      [`POST /api/delivery/orders/${ORDER_ID}/deliver`]: { body: delivery({ deliveryStatus: 'DELIVERED', status: 'DELIVERED' }) },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery/mine', driver())

    expect(await screen.findByText('Collect ₹640.00 cash')).toBeInTheDocument()
    expect(screen.getByText('Sat, 14 Nov, 9 AM – 1 PM')).toBeInTheDocument()
    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('123456')
    const confirm = screen.getByRole('button', { name: 'Confirm delivery' })
    expect(confirm).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'I collected ₹640.00 in cash' }))
    await user.click(confirm)
    await waitFor(() => expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/deliver`)).toHaveLength(1))
    expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/deliver`)[0].body).toEqual({
      code: '123456',
      cashCollected: true,
    })
  })

  it('stops asking for a code once the tries are used up', async () => {
    fakeBackend({
      'GET /api/delivery/mine': {
        body: [delivery({ deliveryStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY', codeAttemptsLeft: 0 })],
      },
    })
    renderRoutes(routes, '/delivery/mine', driver())
    expect(await screen.findByText('Too many wrong codes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm delivery' })).not.toBeInTheDocument()
  })

  it('records why a delivery failed', async () => {
    const backend = fakeBackend({
      'GET /api/delivery/mine': { body: [delivery({ deliveryStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY' })] },
      [`POST /api/delivery/orders/${ORDER_ID}/fail`]: {
        body: delivery({ deliveryStatus: 'FAILED', status: 'DELIVERY_FAILED' }),
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery/mine', driver())

    await user.click(await screen.findByRole('button', { name: 'Could not deliver' }))
    const dialog = await screen.findByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Not delivered' })
    expect(submit).toBeDisabled()
    await user.click(within(dialog).getByText('Customer not available'))
    await user.type(within(dialog).getByRole('textbox', { name: /More detail/ }), 'Called twice')
    await user.click(submit)

    await waitFor(() =>
      expect(backend.sent('POST', `/api/delivery/orders/${ORDER_ID}/fail`)[0]?.body).toEqual({
        reason: 'Customer not available: Called twice',
      }),
    )
  })
})

describe('return pickups', () => {
  const PICKUP: MyPickup = {
    returnId: 'RET-1',
    orderId: ORDER_ID,
    returnStatus: 'APPROVED',
    pickupStatus: 'ON_THE_WAY',
    attempt: 1,
    reason: 'Damaged or defective',
    recipientName: 'Alice Smith',
    recipientPhone: '+91-98450-00101',
    address: ALICE_ADDRESS,
    items: [{ sku: 'PEN-01', name: 'Gel pen', quantity: 1 }],
    codeAttemptsLeft: 5,
  }

  it('shows pickups beside orders, and takes one', async () => {
    let taken = false
    const backend = fakeBackend({
      'GET /api/delivery/available': { body: [] },
      'GET /api/delivery/mine': { body: [] },
      'GET /api/delivery/pickups/available': () => ({
        body: taken
          ? []
          : [
              {
                returnId: 'RET-1',
                orderId: ORDER_ID,
                city: 'Bengaluru',
                state: 'Karnataka',
                postalCode: '560038',
                itemCount: 1,
                approvedAt: '2026-11-09T09:00:00',
                attempts: 0,
              },
            ],
      }),
      'GET /api/delivery/pickups/mine': () => ({ body: taken ? [{ ...PICKUP, pickupStatus: 'ASSIGNED' }] : [] }),
      'POST /api/delivery/pickups/RET-1/take': () => {
        taken = true
        return { body: { ...PICKUP, pickupStatus: 'ASSIGNED' } }
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery', driver())

    await user.click(await screen.findByRole('button', { name: 'Take this pickup' }))
    expect(await screen.findByRole('button', { name: 'Start pickup' })).toBeInTheDocument()
    expect(screen.getByText('Customer’s reason: Damaged or defective')).toBeInTheDocument()
    expect(backend.sent('POST', '/api/delivery/pickups/RET-1/take')).toHaveLength(1)
  })

  it('collects only after the driver has checked the items, with the customer’s code', async () => {
    const backend = fakeBackend({
      'GET /api/delivery/mine': { body: [] },
      'GET /api/delivery/pickups/mine': { body: [PICKUP] },
      'POST /api/delivery/pickups/RET-1/collect': {
        body: { ...PICKUP, pickupStatus: 'COLLECTED', returnStatus: 'PICKED_UP' },
      },
    })
    const user = userEvent.setup()
    renderRoutes(routes, '/delivery/mine', driver())

    await user.click((await screen.findAllByRole('textbox'))[0])
    await user.keyboard('424242')
    const confirm = screen.getByRole('button', { name: 'Confirm pickup' })
    expect(confirm).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I have the items/ }))
    await user.click(confirm)

    await waitFor(() =>
      expect(backend.sent('POST', '/api/delivery/pickups/RET-1/collect')[0]?.body).toEqual({ code: '424242' }),
    )
  })
})
