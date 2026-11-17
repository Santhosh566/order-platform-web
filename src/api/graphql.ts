import { ApiError } from './client'

/**
 * The shop's GraphQL catalogue (/graphql): public and read-only, so no token is sent. A GraphQL
 * error comes back with status 200 and an "errors" list; it is turned into an ApiError like any
 * other failure.
 */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'The server cannot be reached. Check your connection and try again.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, `The catalogue is not available right now (${response.status}).`)
  }
  const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) {
    throw new ApiError(400, body.errors[0].message)
  }
  return body.data as T
}
