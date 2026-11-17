import { categoryOptions, imageUrl, paragraphs } from './images'

describe('image and text helpers', () => {
  it('builds image addresses, keeping the slashes of the key', () => {
    expect(imageUrl('products/PEN 01/abc-400.jpg')).toBe('/api/public/images/products/PEN%2001/abc-400.jpg')
    expect(imageUrl(null)).toBeNull()
  })

  it('splits a description into paragraphs on blank lines only', () => {
    expect(paragraphs('Smooth ink.\r\nBlue.\n\n\nPack of one.  ')).toEqual(['Smooth ink.\nBlue.', 'Pack of one.'])
    expect(paragraphs(null)).toEqual([])
  })

  it('lists sub-categories under their main category', () => {
    expect(
      categoryOptions([
        { id: 1, name: 'Office', active: true, children: [{ id: 2, name: 'Pens', active: false }] },
      ]),
    ).toEqual([
      { value: '1', label: 'Office' },
      { value: '2', label: 'Office › Pens (off)' },
    ])
  })
})
