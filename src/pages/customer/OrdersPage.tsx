import { Button, Card, Group, Paper, Stack, Table, Text, Title, UnstyledButton } from '@mantine/core'
import { IconReceipt } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router'
import type { OrderSummary } from '../../api/types'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import { StatusBadge } from '../../components/StatusBadge'
import { useOrders } from '../../customer/queries'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { formatDateTime, formatMoney } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'

/** The customer's orders, newest first. A table on wide screens, cards on phones. */
export function OrdersPage() {
  const orders = useOrders()
  const live = useLiveOrders()

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>My orders</Title>
        <LiveIndicator state={live} />
      </Group>
      <QueryState query={orders}>{(rows) => <OrderList rows={rows} />}</QueryState>
    </Stack>
  )
}

function OrderList({ rows }: { rows: OrderSummary[] }) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" maw={640}>
        <Stack align="center" gap="sm">
          <IconReceipt size={40} stroke={1.4} />
          <Text>You have not ordered anything yet.</Text>
          <Button component={Link} to="/shop">
            Start shopping
          </Button>
        </Stack>
      </Paper>
    )
  }

  const open = (orderId: string) => navigate(`/orders/${encodeURIComponent(orderId)}`)

  return (
    <>
      <Paper withBorder radius="md" visibleFrom="sm">
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Order</Table.Th>
              <Table.Th>Placed</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th ta="right">Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.order_id} style={{ cursor: 'pointer' }} onClick={() => open(row.order_id)}>
                <Table.Td>
                  <Link to={`/orders/${encodeURIComponent(row.order_id)}`} onClick={(e) => e.stopPropagation()}>
                    {shortOrderId(row.order_id)}
                  </Link>
                </Table.Td>
                <Table.Td>{formatDateTime(row.created_at)}</Table.Td>
                <Table.Td>
                  <StatusBadge status={row.status} size="sm" />
                </Table.Td>
                <Table.Td ta="right">{formatMoney(row.total, row.currency)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Stack gap="sm" hiddenFrom="sm">
        {rows.map((row) => (
          <UnstyledButton key={row.order_id} onClick={() => open(row.order_id)}>
            <Card withBorder radius="md" padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={600}>{shortOrderId(row.order_id)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(row.created_at)}
                  </Text>
                </div>
                <Stack gap={4} align="flex-end">
                  <Text fw={600}>{formatMoney(row.total, row.currency)}</Text>
                  <StatusBadge status={row.status} size="sm" />
                </Stack>
              </Group>
            </Card>
          </UnstyledButton>
        ))}
      </Stack>
    </>
  )
}
