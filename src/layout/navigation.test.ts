import { homeFor } from '../auth/roles'
import { navigationFor } from './navigation'

describe('navigationFor', () => {
  it('shows a customer only the shop', () => {
    expect(navigationFor(['CUSTOMER']).map((s) => s.title)).toEqual(['Shop'])
  })

  it('shows each role a user holds', () => {
    expect(navigationFor(['ADMIN', 'CUSTOMER']).map((s) => s.title)).toEqual(['Shop', 'Administration'])
  })

  it('gives a service account no screens', () => {
    expect(navigationFor(['SERVICE'])).toEqual([])
  })
})

describe('homeFor', () => {
  it('starts each role on its own page', () => {
    expect(homeFor(['CUSTOMER'])).toBe('/shop')
    expect(homeFor(['DELIVERY'])).toBe('/delivery')
    expect(homeFor(['ADMIN', 'CUSTOMER'])).toBe('/admin')
    expect(homeFor(['SERVICE'])).toBe('/no-access')
  })
})
