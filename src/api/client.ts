/**
 * The one place the app talks to the backend. Adds the access token, sends and reads JSON,
 * and turns the backend's error replies ({"status": "...", "reason": "..."}) into ApiError.
 */

export class ApiError extends Error {
  readonly status: number
  readonly reason: string
  /** The parsed reply, for callers that need more than the reason (e.g. {"status":"DUPLICATE"}). */
  readonly body: unknown

  constructor(status: number, reason: string, body?: unknown) {
    super(reason)
    this.name = 'ApiError'
    this.status = status
    this.reason = reason
    this.body = body
  }
}

type TokenProvider = () => Promise<string | null>

let getToken: TokenProvider = async () => null
let onUnauthorized: () => void = () => {}
let onInactive: () => void = () => {}

/** Called once by AuthProvider when sign-in is ready. */
export function configureApi(options: { getToken: TokenProvider; onUnauthorized: () => void; onInactive?: () => void }) {
  getToken = options.getToken
  onUnauthorized = options.onUnauthorized
  onInactive = options.onInactive ?? (() => {})
}

/** The backend's answer to every call from a user an admin turned off (InactiveAccountFilter). */
export function isAccountInactive(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    typeof error.body === 'object' &&
    error.body !== null &&
    (error.body as { status?: unknown }).status === 'ACCOUNT_INACTIVE'
  )
}

/** The current access token, for the few calls fetch cannot make (the live EventSource stream). */
export function accessToken(): Promise<string | null> {
  return getToken()
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  /** Public endpoints are called without a token. */
  anonymous?: boolean
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (!options.anonymous) {
    const token = await getToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  // The browser sets multipart/form-data with its boundary itself
  if (options.body !== undefined && !isForm) {
    headers['Content-Type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'The server cannot be reached. Check your connection and try again.')
  }

  if (response.status === 401) {
    onUnauthorized()
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const data: unknown = text ? safeJson(text) : undefined
  if (!response.ok) {
    const error = new ApiError(response.status, reasonFrom(data, response.status), data)
    // Turned off while using the app: every page switches to "contact the administrator"
    if (isAccountInactive(error)) onInactive()
    throw error
  }
  return data as T
}

/**
 * A file from the API (an invoice PDF): fetched with the token, since a plain link cannot send it.
 */
export async function apiBlob(path: string): Promise<Blob> {
  const token = await getToken()
  let response: Response
  try {
    response = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError(0, 'The server cannot be reached. Check your connection and try again.')
  }
  if (response.status === 401) {
    onUnauthorized()
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(response.status, reasonFrom(text ? safeJson(text) : undefined, response.status))
  }
  return response.blob()
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function reasonFrom(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'reason' in data && typeof data.reason === 'string') {
    return data.reason
  }
  if (status === 403) {
    return 'You are not allowed to do this.'
  }
  if (status === 404) {
    return 'Not found.'
  }
  if (status >= 500) {
    return 'Something went wrong on the server. Please try again.'
  }
  return `Request failed (${status}).`
}
