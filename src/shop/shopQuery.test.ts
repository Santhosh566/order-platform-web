import { activeFilterCount, readShopQuery, toFilter, toggle, writeShopQuery } from './shopQuery'

describe('shop address', () => {
  it('reads every filter from the address, and ignores nonsense', () => {
    const query = readShopQuery(
      new URLSearchParams('q=pen&category=pens,office&brand=Linkr&min=100&max=900&stock=1&rating=4&sort=PRICE_LOW_HIGH&page=2'),
    )
    expect(query).toEqual({
      q: 'pen',
      categories: ['pens', 'office'],
      brands: ['Linkr'],
      min: 100,
      max: 900,
      inStock: true,
      rating: 4,
      offer: '',
      sort: 'PRICE_LOW_HIGH',
      page: 2,
    })
    // A coupon code from a banner: capitals, letters and digits only
    expect(readShopQuery(new URLSearchParams('offer=diwali-20')).offer).toBe('DIWALI20')
    expect(toFilter(readShopQuery(new URLSearchParams('offer=DIWALI20'))).offer).toBe('DIWALI20')
    const junk = readShopQuery(new URLSearchParams('min=-5&rating=9&sort=CHEAPEST&page=x'))
    expect(junk).toMatchObject({ min: null, rating: null, sort: 'RELEVANCE', page: 1 })
  })

  it('writes only what differs from the defaults', () => {
    expect(writeShopQuery(readShopQuery(new URLSearchParams())).toString()).toBe('')
    const params = writeShopQuery({ ...readShopQuery(new URLSearchParams()), q: ' kurta ', brands: ['Rangoli'], page: 3 })
    expect(params.toString()).toBe('q=kurta&brand=Rangoli&page=3')
  })

  it('turns the address into the GraphQL filter and counts what is on', () => {
    const query = readShopQuery(new URLSearchParams('category=laptops&min=0&stock=1'))
    expect(toFilter(query)).toEqual({
      text: undefined,
      categories: ['laptops'],
      brands: undefined,
      minPrice: 0,
      maxPrice: undefined,
      inStockOnly: true,
      minRating: undefined,
    })
    expect(activeFilterCount(query)).toBe(3)
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggle(['a'], 'b')).toEqual(['a', 'b'])
  })
})
