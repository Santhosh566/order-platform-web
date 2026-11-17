import {
  Badge,
  Group,
  MultiSelect,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { OrderStatus } from '../../api/types'
import { useAdminOrders, useStatusCounts } from '../../admin/queries'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import { StatusBadge } from '../../components/StatusBadge'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { formatDateTime, formatMoney } from '../../lib/format'
import { ALL_STATUSES, shortOrderId, statusLabel } from '../../lib/orderStatus'

const PAGE_SIZE = 25

/** Every order, searchable and filterable; the filter lives in the URL so it can be shared and survives a reload. */
export function AdminOrdersPage() {
  const live = useLiveOrders()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '').split(',').filter(isStatus)
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [text, setText] = useState(params.get('q') ?? '')
  const [q] = useDebouncedValue(text, 300)
  const counts = useStatusCounts()

  // Typing waits a moment before searching, and a new search starts on page 1
  useEffect(() => {
    if ((params.get('q') ?? '') === q) return
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (q) next.set('q', q)
        else next.delete('q')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [q, params, setParams])

  const orders = useAdminOrders({ q, status, page: page - 1, size: PAGE_SIZE })

  const update = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Orders</Title>
        <LiveIndicator state={live} />
      </Group>

      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          label="Search"
          placeholder="Order id, customer, reference or invoice no."
          leftSection={<IconSearch size={16} />}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          w={{ base: '100%', sm: 340 }}
        />
        <MultiSelect
          label="Status"
          placeholder={status.length ? undefined : 'All statuses'}
          data={ALL_STATUSES.map((s) => ({
            value: s,
            label: `${statusLabel(s)}${counts.data ? ` (${counts.data[s] ?? 0})` : ''}`,
          }))}
          value={status}
          onChange={(values) => update({ status: values.join(',') || null, page: null })}
          clearable
          searchable
          w={{ base: '100%', sm: 340 }}
        />
      </Group>

      <QueryState query={orders}>
        {(result) =>
          result.items.length === 0 ? (
            <Text c="dimmed">No orders match.</Text>
          ) : (
            <Stack gap="sm">
              <Paper withBorder radius="md">
                <Table.ScrollContainer minWidth={860}>
                  <Table highlightOnHover verticalSpacing="sm" style={{ opacity: orders.isPlaceholderData ? 0.6 : 1 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Order</Table.Th>
                        <Table.Th>Placed</Table.Th>
                        <Table.Th>Customer</Table.Th>
                        <Table.Th>Deliver to</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th ta="right">Items</Table.Th>
                        <Table.Th ta="right">Total</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.items.map((row) => (
                        <Table.Tr
                          key={row.orderId}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/orders/${encodeURIComponent(row.orderId)}`)}
                        >
                          <Table.Td>
                            <Link
                              to={`/admin/orders/${encodeURIComponent(row.orderId)}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortOrderId(row.orderId)}
                            </Link>
                            {row.orderType === 'HIGH_VALUE' && (
                              <Badge size="xs" variant="outline" ml={6}>
                                High value
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>{formatDateTime(row.createdAt)}</Table.Td>
                          <Table.Td>
                            <Text size="sm">{row.recipientName ?? '—'}</Text>
                            <Text size="xs" c="dimmed">
                              {row.customerId}
                            </Text>
                          </Table.Td>
                          <Table.Td>{row.city ? `${row.city}, ${row.state ?? ''}` : '—'}</Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <StatusBadge status={row.status} size="sm" />
                              {row.returnStatus !== 'NONE' && (
                                <Badge size="sm" variant="outline" color="gray">
                                  {row.returnStatus === 'FULL' ? 'Returned' : 'Part returned'}
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">{row.itemCount}</Table.Td>
                          <Table.Td ta="right">
                            {formatMoney(row.total, row.currency)}
                            {row.refundedTotal > 0 && (
                              <Text size="xs" c="dimmed">
                                − {formatMoney(row.refundedTotal, row.currency)} refunded
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {result.totalItems.toLocaleString('en-IN')} orders
                </Text>
                {result.totalPages > 1 && (
                  <Pagination
                    total={result.totalPages}
                    value={page}
                    onChange={(p) => update({ page: p > 1 ? String(p) : null })}
                    size="sm"
                  />
                )}
              </Group>
            </Stack>
          )
        }
      </QueryState>
    </Stack>
  )
}

function isStatus(value: string): value is OrderStatus {
  return (ALL_STATUSES as readonly string[]).includes(value)
}
