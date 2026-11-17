import { notifications } from '@mantine/notifications'
import { isOrderChanged } from '../api/client'
import { errorMessage } from './errors'

/**
 * Tells the person an action did not go through. When the order changed after they opened it,
 * that is not an error of theirs: a yellow notice says what it is now (the page has reloaded it).
 */
export function notifyFailure(title: string, error: unknown) {
  if (isOrderChanged(error)) {
    notifications.show({ color: 'yellow', title: 'This order changed', message: errorMessage(error), autoClose: 10000 })
    return
  }
  notifications.show({ color: 'red', title, message: errorMessage(error) })
}
