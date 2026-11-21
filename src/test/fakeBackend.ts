/**
 * A stand-in for the backend in page tests: answers fetch calls from a table of routes and
 * records every request, so a test can check what the page sent.
 */

export interface Call {
  method: string
  path: string
  /** The query string as parameters, e.g. {status: 'SHIPPED'} */
  query: Record<string, string>
  body: unknown
  /** The request's headers, e.g. {'If-Match': '"4"'} */
  headers: Record<string, string>
}

type Reply = { status?: number; body?: unknown } | ((call: Call) => { status?: number; body?: unknown })

export function fakeBackend(routes: Record<string, Reply>) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const call: Call = {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}) },
    }
    calls.push(call)
    const route = routes[`${method} ${url.pathname}`]
    if (!route) {
      return new Response(JSON.stringify({ status: 'NOT_FOUND', reason: `No fake for ${method} ${url.pathname}` }), {
        status: 404,
      })
    }
    const reply = typeof route === 'function' ? route(call) : route
    const status = reply.status ?? 200
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    sent: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  }
}

/**
 * A /graphql reply chosen by which query the page sent (products, product or suggestions).
 * The variables of each call are recorded, so a test can check the filter that was sent.
 */
export function graphqlReplies(replies: {
  products?: unknown
  product?: unknown
  suggestions?: unknown
  deliveryEstimate?: unknown
  categories?: unknown
  /** The product page's ratings and reviews (ProductReviews query); none by default */
  reviews?: unknown
}) {
  return (call: Call) => {
    const query = (call.body as { query: string }).query
    if (/\bCategoryTree\b/.test(query)) return { body: { data: { categories: replies.categories ?? [] } } }
    if (/\bdeliveryEstimate\(/.test(query)) return { body: { data: { deliveryEstimate: replies.deliveryEstimate } } }
    if (/\bProductReviews\b/.test(query)) return { body: { data: { product: replies.reviews ?? NO_REVIEWS } } }
    if (/\bsuggestions\(/.test(query)) return { body: { data: { suggestions: replies.suggestions ?? [] } } }
    if (/\bproducts\(/.test(query)) return { body: { data: { products: replies.products } } }
    if (/\bproduct\(/.test(query)) return { body: { data: { product: replies.product ?? null } } }
    return { status: 400, body: { errors: [{ message: 'unknown query' }] } }
  }
}

const NO_REVIEWS = {
  rating: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0], reviewCount: 0 },
  reviews: { items: [], totalItems: 0, totalPages: 0, page: 0, size: 5 },
}

interface FakeCartLine {
  sku: string
  quantity: number
  priceSeen: number
}

/**
 * Routes for /api/cart that keep one cart like the server does: PUT replaces it, a merge keeps the larger
 * quantity, and a line keeps the price it was put in at. Spread into fakeBackend({...cartRoutes(), ...}).
 */
export function cartRoutes(initial: FakeCartLine[] = []): Record<string, Reply> {
  let lines = [...initial]
  const reply = () => ({
    body: {
      lines: lines.map((l) => ({
        sku: l.sku,
        name: l.sku,
        quantity: l.quantity,
        priceSeen: l.priceSeen,
        product: { sku: l.sku, name: l.sku, price: l.priceSeen, stockStatus: 'IN_STOCK' },
        available: true,
        priceDropped: false,
      })),
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      total: lines.reduce((n, l) => n + l.priceSeen * l.quantity, 0),
      updatedAt: null,
    },
  })
  const keep = (sent: FakeCartLine[]) =>
    sent.map((s) => ({ ...s, priceSeen: lines.find((l) => l.sku === s.sku)?.priceSeen ?? s.priceSeen }))
  return {
    'GET /api/cart': () => reply(),
    'PUT /api/cart': (call) => {
      lines = keep(call.body as FakeCartLine[])
      return reply()
    },
    'POST /api/cart/merge': (call) => {
      for (const s of call.body as FakeCartLine[]) {
        const found = lines.find((l) => l.sku === s.sku)
        if (found) found.quantity = Math.max(found.quantity, s.quantity)
        else lines.push({ ...s })
      }
      return reply()
    },
    'DELETE /api/cart': () => {
      lines = []
      return { status: 204 }
    },
  }
}
