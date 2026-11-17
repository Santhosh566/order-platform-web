import { Badge } from '@mantine/core'
import type { PickupStatus, ReturnStatus } from '../api/types'
import { returnLabel } from '../lib/returnStatus'

export function ReturnStatusBadge({ status, pickupStatus }: { status: ReturnStatus; pickupStatus?: PickupStatus | null }) {
  const info = returnLabel(status, pickupStatus)
  return (
    <Badge color={info.color} variant="light">
      {info.label}
    </Badge>
  )
}
