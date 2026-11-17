import { ApiError, isOrderChanged } from '../api/client'
import type { OrderStatus } from '../api/types'
import { statusLabel } from './orderStatus'

/** The message to show for a failed request. */
export function errorMessage(error: unknown): string {
  // The page reloads the order by itself (see the order hooks), so say what happened, not "reload"
  if (isOrderChanged(error)) {
    return `This order was changed after you opened it, and is now ${statusLabel(error.body.orderStatus as OrderStatus)}. It has been reloaded: check it and try again.`
  }
  if (error instanceof ApiError) return error.reason
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
