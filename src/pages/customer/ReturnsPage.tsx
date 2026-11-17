import { Alert, Anchor, Button, Card, Group, Paper, Stack, Text, Timeline, Title } from '@mantine/core'
import { IconArrowBackUp } from '@tabler/icons-react'
import { Link } from 'react-router'
import { IconKey } from '@tabler/icons-react'
import type { ReturnRequest } from '../../api/types'
import { ItemLines } from '../../components/ItemLines'
import { ReturnStatusBadge } from '../../components/ReturnStatusBadge'
import { QueryState } from '../../components/QueryState'
import { useReturns } from '../../customer/queries'
import { formatDateTime } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'

/** Every return the customer asked for, newest first, with where it stands. */
export function ReturnsPage() {
  const returns = useReturns()
  return (
    <Stack gap="md" maw={880}>
      <div>
        <Title order={2}>My returns</Title>
        <Text c="dimmed" size="sm">
          To return something, open the delivered order and choose Return items. Returns are accepted for 7 days
          after delivery; we collect them from your address and refund you once they are checked.
        </Text>
      </div>
      <QueryState query={returns}>{(rows) => <ReturnList rows={rows} />}</QueryState>
    </Stack>
  )
}

function ReturnList({ rows }: { rows: ReturnRequest[] }) {
  if (rows.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="sm">
          <IconArrowBackUp size={40} stroke={1.4} />
          <Text>You have no returns.</Text>
          <Button component={Link} to="/orders" variant="light">
            Go to my orders
          </Button>
        </Stack>
      </Paper>
    )
  }
  const sorted = [...rows].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  return (
    <Stack gap="sm">
      {sorted.map((r) => (
        <Card key={r.returnId} withBorder radius="md" padding="md">
          <Group justify="space-between" align="flex-start" mb="xs">
            <div>
              <Text fw={600}>
                Return for{' '}
                <Anchor component={Link} to={`/orders/${encodeURIComponent(r.orderId)}`}>
                  {shortOrderId(r.orderId)}
                </Anchor>
              </Text>
              <ItemLines items={r.items} label={`Items in return for ${shortOrderId(r.orderId)}`} />
              <Text size="xs" c="dimmed">
                {r.reason}
              </Text>
            </div>
            <ReturnStatusBadge status={r.status} pickupStatus={r.pickupStatus} />
          </Group>
          {r.pickupStatus === 'ON_THE_WAY' && (
            <Alert color="orange" icon={<IconKey size={18} />} mb="sm" p="xs">
              Our delivery partner is on the way to collect it. We emailed you a one-time code: give it to them
              only after you have handed over the items.
            </Alert>
          )}
          <Timeline active={stepOf(r)} bulletSize={14} lineWidth={2}>
            <Timeline.Item title="Requested">
              <Text size="xs" c="dimmed">
                {formatDateTime(r.requestedAt)}
              </Text>
            </Timeline.Item>
            <Timeline.Item title={r.status === 'REJECTED' ? 'Not accepted' : 'Approved'}>
              <Text size="xs" c="dimmed">
                {r.decidedAt ? formatDateTime(r.decidedAt) : 'We review returns within one working day'}
              </Text>
              {r.decisionNote && <Text size="xs">{r.decisionNote}</Text>}
            </Timeline.Item>
            {r.status !== 'REJECTED' && (
              <Timeline.Item title="Picked up">
                <Text size="xs" c="dimmed">
                  {r.pickedUpAt
                    ? formatDateTime(r.pickedUpAt)
                    : r.pickupStatus === 'ON_THE_WAY'
                      ? 'Driver on the way'
                      : r.pickupStatus === 'ASSIGNED'
                        ? 'A driver is scheduled'
                        : 'We collect it from your delivery address'}
                </Text>
              </Timeline.Item>
            )}
            {r.status !== 'REJECTED' && (
              <Timeline.Item title="Checked and refunded">
                <Text size="xs" c="dimmed">
                  {r.receivedAt
                    ? `${formatDateTime(r.receivedAt)} · the credit note is on the order`
                    : 'After the items reach our warehouse'}
                </Text>
              </Timeline.Item>
            )}
          </Timeline>
        </Card>
      ))}
    </Stack>
  )
}

function stepOf(r: ReturnRequest): number {
  switch (r.status) {
    case 'REQUESTED':
      return 0
    case 'APPROVED':
    case 'REJECTED':
      return 1
    case 'PICKED_UP':
      return 2
    case 'REFUNDED':
      return 3
  }
}
