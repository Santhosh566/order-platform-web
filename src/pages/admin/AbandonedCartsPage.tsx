import { Anchor, Badge, Group, Pagination, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { Link, useSearchParams } from 'react-router'
import {
  CART_PAGE_SIZE,
  CART_STATUS_COLORS,
  CART_STATUS_LABELS,
  useCarts,
  useCartStats,
  type CartStats,
  type CartStatus,
} from '../../admin/carts'
import { QueryState } from '../../components/QueryState'
import { formatDateTime, formatMoney } from '../../lib/format'

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  ...(Object.keys(CART_STATUS_LABELS) as CartStatus[]).map((s) => ({ value: s, label: CART_STATUS_LABELS[s] })),
]

/** Carts customers left, the reminder emails, and how many came back to order. */
export function AbandonedCartsPage() {
  const [params, setParams] = useSearchParams()
  const days = Number(params.get('days') ?? '30') || 30
  const status = (params.get('status') || null) as CartStatus | null
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const stats = useCartStats(days)
  const carts = useCarts(status, page - 1)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Abandoned carts</Title>
          <Text c="dimmed" size="sm">
            Customers are emailed an hour after they leave a cart, and again a day later with a personal coupon.
          </Text>
        </div>
        <SegmentedControl
          aria-label="Period"
          data={PERIODS}
          value={String(days)}
          onChange={(value) => update({ days: value === '30' ? null : value })}
        />
      </Group>

      <QueryState query={stats}>{(data) => <Figures stats={data} />}</QueryState>

      <Group justify="space-between" wrap="wrap">
        <Title order={4}>Carts</Title>
        <SegmentedControl
          aria-label="Cart status"
          data={STATUS_FILTERS}
          value={status ?? ''}
          onChange={(value) => update({ status: value || null, page: null })}
        />
      </Group>
      <QueryState query={carts}>
        {(data) => (
          <Paper withBorder radius="md">
            {data.items.length === 0 ? (
              <Text c="dimmed" size="sm" p="lg">
                No carts.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={820}>
                <Table verticalSpacing="sm" aria-label="Carts">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>In the cart</Table.Th>
                      <Table.Th ta="right">Value now</Table.Th>
                      <Table.Th>Last change</Table.Th>
                      <Table.Th>Reminders</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.items.map((cart) => (
                      <Table.Tr key={cart.cartId}>
                        <Table.Td>
                          <Anchor component={Link} to={`/admin/users/${encodeURIComponent(cart.customerId)}`} size="sm" fw={500}>
                            {cart.customerName}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {cart.customerEmail ?? cart.customerId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {cart.items.length === 0
                              ? '—'
                              : cart.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm">{formatMoney(cart.value)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatDateTime(cart.updatedAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {cart.remindersSent === 0 ? 'None' : `${cart.remindersSent} sent`}
                          </Text>
                          {cart.reminderCoupon && (
                            <Text size="xs" c="dimmed">
                              Coupon {cart.reminderCoupon}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={CART_STATUS_COLORS[cart.status]}>
                            {CART_STATUS_LABELS[cart.status]}
                          </Badge>
                          {cart.orderId && (
                            <Anchor
                              component={Link}
                              to={`/admin/orders/${encodeURIComponent(cart.orderId)}`}
                              size="xs"
                              display="block"
                            >
                              View order
                            </Anchor>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            <Group justify="space-between" p="sm">
              <Text size="sm" c="dimmed">
                {data.totalItems.toLocaleString('en-IN')} {data.totalItems === 1 ? 'cart' : 'carts'}
              </Text>
              {data.totalItems > CART_PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(data.totalItems / CART_PAGE_SIZE)}
                  value={page}
                  onChange={(p) => update({ page: p === 1 ? null : String(p) })}
                  size="sm"
                />
              )}
            </Group>
          </Paper>
        )}
      </QueryState>
    </Stack>
  )
}

function Figures({ stats }: { stats: CartStats }) {
  const rate = stats.recoveryRate === null ? '—' : `${Math.round(stats.recoveryRate * 100)}%`
  return (
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
      <Figure label="Carts started" value={stats.started.toLocaleString('en-IN')}
        note={`${stats.ordered} ordered without a reminder`} />
      <Figure label="Reminded" value={stats.reminded.toLocaleString('en-IN')}
        note={`${stats.emptied} emptied, ${stats.expired} expired`} />
      <Figure label="Recovered" value={rate} note={`${stats.recovered} of ${stats.reminded} reminded carts ordered`} />
      <Figure label="Recovered sales" value={formatMoney(stats.recoveredRevenue)}
        note={`Coupons: ${stats.couponsUsed} used of ${stats.couponsSent} sent`} />
      <Figure label="Open now" value={stats.open.toLocaleString('en-IN')} note={`${formatMoney(stats.openValue)} in them`} />
    </SimpleGrid>
  )
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Paper withBorder radius="md" p="md" role="group" aria-label={label}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {note}
      </Text>
    </Paper>
  )
}
