import { Badge, Tooltip } from '@mantine/core'
import type { LiveState } from '../customer/useLiveOrders'

export function LiveIndicator({ state }: { state: LiveState }) {
  if (state === 'live') {
    return (
      <Tooltip label="Changes appear here as they happen">
        <Badge color="green" variant="dot">
          Live
        </Badge>
      </Tooltip>
    )
  }
  return (
    <Tooltip label="Live updates are reconnecting; reload to see the latest">
      <Badge color="gray" variant="dot">
        {state === 'connecting' ? 'Connecting' : 'Offline'}
      </Badge>
    </Tooltip>
  )
}
