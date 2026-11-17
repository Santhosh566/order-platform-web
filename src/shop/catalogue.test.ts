import { buildSchema, parse, validate } from 'graphql'
// The backend's schema file itself: if a field is renamed there, these queries stop validating
import schemaText from '../../../order-integration-platform/src/main/resources/graphql/catalogue.graphqls?raw'
import { DELIVERY_QUERY, PRODUCT_QUERY, PRODUCTS_QUERY, SUGGESTIONS_QUERY } from './catalogue'

const schema = buildSchema(schemaText)

describe('catalogue queries', () => {
  it.each([
    ['products', PRODUCTS_QUERY],
    ['product', PRODUCT_QUERY],
    ['suggestions', SUGGESTIONS_QUERY],
    ['delivery estimate', DELIVERY_QUERY],
  ])('%s matches the server schema', (_name, query) => {
    expect(validate(schema, parse(query)).map((e) => e.message)).toEqual([])
  })

  it('notices a field the server does not have', () => {
    expect(validate(schema, parse('query { product(sku: "X") { colour } }'))).not.toHaveLength(0)
  })
})
