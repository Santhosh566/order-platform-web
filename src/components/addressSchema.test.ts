import { addressSchema, toAddress, toFormValues } from './addressSchema'

const valid = {
  recipientName: 'Alice Smith',
  recipientPhone: '+91 98450 00101',
  line1: '12, 4th Cross',
  line2: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560038',
}

describe('address form rules', () => {
  it('accepts an Indian address and sends it with country IN', () => {
    const values = addressSchema.parse(valid)
    expect(toAddress(values)).toMatchObject({ state: 'Karnataka', country: 'IN', line2: null })
  })

  it('refuses a PIN code that is not 6 digits or starts with 0', () => {
    expect(addressSchema.safeParse({ ...valid, postalCode: '56003' }).success).toBe(false)
    expect(addressSchema.safeParse({ ...valid, postalCode: '060038' }).success).toBe(false)
  })

  it('refuses a missing state and a phone with letters', () => {
    expect(addressSchema.safeParse({ ...valid, state: '' }).success).toBe(false)
    expect(addressSchema.safeParse({ ...valid, recipientPhone: 'call me' }).success).toBe(false)
  })

  it('shows a saved abbreviation or GST code as the state name', () => {
    const saved = { ...valid, line2: null, country: 'IN' }
    expect(toFormValues({ ...saved, state: 'ka' }).state).toBe('Karnataka')
    expect(toFormValues({ ...saved, state: '27' }).state).toBe('Maharashtra')
    expect(toFormValues({ ...saved, state: 'Atlantis' }).state).toBe('')
  })
})
