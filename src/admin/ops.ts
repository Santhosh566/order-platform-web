import type { DeadLetter } from '../api/adminTypes'

/** Still waiting for an operator: neither replayed nor dismissed. */
export function isOpen(d: Pick<DeadLetter, 'replayed' | 'dismissedAt'>): boolean {
  return !d.replayed && d.dismissedAt === null
}

/** The message as indented JSON when it is JSON, as it is otherwise. */
export function pretty(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    return payload
  }
}
