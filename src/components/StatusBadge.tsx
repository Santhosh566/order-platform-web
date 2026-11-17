import { Badge } from '@mantine/core'
import type { OrderStatus } from '../api/types'
import { statusColor, statusLabel } from '../lib/orderStatus'

export function StatusBadge({ status, size = 'md' }: { status: OrderStatus; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Badge color={statusColor(status)} variant="light" size={size}>
      {statusLabel(status)}
    </Badge>
  )
}
