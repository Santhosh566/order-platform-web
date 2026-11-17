import { api, ApiError, configureApi } from './client'

function reply(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('api', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the token and reads JSON', async () => {
    const fetchMock = reply(200, { ok: true })
    vi.stubGlobal('fetch', fetchMock)
    configureApi({ getToken: async () => 'abc', onUnauthorized: () => {} })

    await expect(api('/api/me')).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })

  it('turns the backend reason into an ApiError', async () => {
    vi.stubGlobal('fetch', reply(409, { status: 'CONFLICT', reason: 'Only 1 of SKU-1 can still be returned' }))
    const error = await api('/api/returns', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(409)
    expect((error as ApiError).reason).toBe('Only 1 of SKU-1 can still be returned')
  })

  it('signs the user out on 401', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal('fetch', reply(401))
    configureApi({ getToken: async () => 'old', onUnauthorized })
    await expect(api('/api/me')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('does not send a token to public endpoints', async () => {
    const fetchMock = reply(200, [])
    vi.stubGlobal('fetch', fetchMock)
    configureApi({ getToken: async () => 'abc', onUnauthorized: () => {} })
    await api('/api/public/catalog', { anonymous: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})
