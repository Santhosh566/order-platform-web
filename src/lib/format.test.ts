import { formatDateTime, formatMoney, formatRate } from './format'

describe('formatMoney', () => {
  it('groups rupees in lakhs and crores', () => {
    expect(formatMoney(12345678.5)).toBe('₹1,23,45,678.50')
    expect(formatMoney(8499)).toBe('₹8,499.00')
    expect(formatMoney('999.9')).toBe('₹999.90')
  })

  it('shows a dash for a missing amount', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('not a number')).toBe('—')
  })

  it('names other currencies', () => {
    expect(formatMoney(45, 'USD')).toContain('45.00')
  })
})

describe('formatRate', () => {
  it('drops trailing zeros', () => {
    expect(formatRate(18)).toBe('18%')
    expect(formatRate('0.25')).toBe('0.25%')
  })
})

describe('formatDateTime', () => {
  it('keeps text it cannot read', () => {
    expect(formatDateTime('soon')).toBe('soon')
    expect(formatDateTime(null)).toBe('—')
  })
})
