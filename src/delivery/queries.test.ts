import { mapsLink, stageOf, telLink } from './queries'

describe('driver helpers', () => {
  it('picks the next step from the delivery and order status', () => {
    expect(stageOf({ deliveryStatus: 'ASSIGNED', status: 'READY_FOR_DISPATCH' })).toBe('collect')
    expect(stageOf({ deliveryStatus: 'PICKED_UP', status: 'IN_TRANSIT' })).toBe('start')
    expect(stageOf({ deliveryStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY' })).toBe('handover')
  })

  it('makes call and map links a phone can open', () => {
    expect(telLink('+91-98450 00101')).toBe('tel:+919845000101')
    expect(telLink(null)).toBeNull()
    expect(
      mapsLink({
        recipientName: 'A',
        recipientPhone: '1',
        line1: '12, 4th Cross',
        line2: null,
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'IN',
      }),
    ).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('12, 4th Cross, Bengaluru, Karnataka, 560038, India'),
    )
  })
})
