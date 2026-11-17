import { ApiError } from '../api/client'

/** The message to show for a failed request. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.reason
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
