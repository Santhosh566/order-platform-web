import { Badge } from '@mantine/core'
import type { ReviewStatus } from './queries'

const LOOK: Record<ReviewStatus, { color: string; label: string }> = {
  PENDING: { color: 'yellow', label: 'Waiting for approval' },
  APPROVED: { color: 'green', label: 'Published' },
  REJECTED: { color: 'red', label: 'Not published' },
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const look = LOOK[status]
  return (
    <Badge color={look.color} variant="light">
      {look.label}
    </Badge>
  )
}
