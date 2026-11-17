import { isOpen, pretty } from './ops'

describe('operations helpers', () => {
  it('counts an entry as open until it is replayed or dismissed', () => {
    expect(isOpen({ replayed: false, dismissedAt: null })).toBe(true)
    expect(isOpen({ replayed: true, dismissedAt: null })).toBe(false)
    expect(isOpen({ replayed: false, dismissedAt: '2026-11-08T10:00:00' })).toBe(false)
  })

  it('indents JSON messages and leaves others alone', () => {
    expect(pretty('{"orderId":"ORD-1"}')).toBe('{\n  "orderId": "ORD-1"\n}')
    expect(pretty('id,sku\n1,PEN')).toBe('id,sku\n1,PEN')
  })
})
