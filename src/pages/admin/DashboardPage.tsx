import { Anchor, Group, Paper, Progress, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core'
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCurrencyRupee,
  IconMessageStar,
  IconPackage,
  IconReceipt,
  IconTruckDelivery,
  type Icon,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { StatusCounts } from '../../api/adminTypes'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import {
  useAdminCatalog,
  useAdminReturns,
  useMetrics,
  useStatusCounts,
  useWaitingDeliveries,
} from '../../admin/queries'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { useAdminReviews } from '../../reviews/queries'
import { formatMoney } from '../../lib/format'
import { ALL_STATUSES, statusLabel } from '../../lib/orderStatus'

/** Headline numbers, then the work waiting for someone, then where orders are. */
export function DashboardPage() {
  const live = useLiveOrders()
  const metrics = useMetrics()
  const counts = useStatusCounts()
  const toReview = useAdminReturns('REQUESTED')
  const waiting = useWaitingDeliveries()
  const reviews = useAdminReviews('PENDING')
  const catalog = useAdminCatalog({ q: '', includeInactive: false, page: 0, size: 100 })
  const lowStock = catalog.data?.items.filter((p) => p.lowStock).length

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Dashboard</Title>
        <LiveIndicator state={live} />
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md">
        <Tile
          icon={IconCurrencyRupee}
          label="Revenue (net of refunds)"
          value={metrics.data ? formatMoney(metrics.data.totalRevenue, metrics.data.currency) : undefined}
          hint="Paid orders that were not cancelled or returned"
        />
        <Tile
          icon={IconReceipt}
          label="Orders"
          value={metrics.data?.totalOrders.toLocaleString('en-IN')}
          link={{ to: '/admin/orders', label: 'All orders' }}
        />
        <Tile
          icon={IconArrowBackUp}
          label="Returns to review"
          value={toReview.data?.length.toLocaleString('en-IN')}
          attention={(toReview.data?.length ?? 0) > 0}
          link={{ to: '/admin/returns', label: 'Review returns' }}
        />
        <Tile
          icon={IconMessageStar}
          label="Reviews to moderate"
          value={reviews.data?.length.toLocaleString('en-IN')}
          attention={(reviews.data?.length ?? 0) > 0}
          link={{ to: '/admin/reviews', label: 'Moderate reviews' }}
        />
        <Tile
          icon={IconTruckDelivery}
          label="Waiting for a driver"
          value={waiting.data?.length.toLocaleString('en-IN')}
          attention={(waiting.data?.length ?? 0) > 0}
          link={{ to: '/admin/deliveries', label: 'Assign drivers' }}
        />
        <Tile
          icon={IconPackage}
          label="Products at or below reorder level"
          value={lowStock?.toLocaleString('en-IN')}
          attention={(lowStock ?? 0) > 0}
          hint={catalog.data && catalog.data.totalItems > 100 ? 'Of the first 100 products' : undefined}
          link={{ to: '/admin/catalog', label: 'Catalogue & stock' }}
        />
        <Tile
          icon={IconAlertTriangle}
          label="Failed messages (dead letters)"
          value={metrics.data?.dlqQuarantinedCount.toLocaleString('en-IN')}
          attention={(metrics.data?.dlqQuarantinedCount ?? 0) > 0}
          hint={
            metrics.data
              ? `${metrics.data.activeRoutesCount} of ${metrics.data.totalRoutesCount} routes running`
              : undefined
          }
          link={{ to: '/admin/ops', label: 'Operations' }}
        />
      </SimpleGrid>

      <Paper withBorder radius="md" p="lg" maw={760}>
        <Title order={4} mb={4}>
          Orders by status
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Every order ever placed. Select a status to see its orders.
        </Text>
        <QueryState query={counts}>{(data) => <StatusBreakdown counts={data} />}</QueryState>
      </Paper>
    </Stack>
  )
}

function Tile({
  icon: TileIcon,
  label,
  value,
  hint,
  attention,
  link,
}: {
  icon: Icon
  label: string
  value: string | undefined
  hint?: string
  attention?: boolean
  link?: { to: string; label: string }
}) {
  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          {value === undefined ? (
            <Skeleton h={34} w={120} mt={2} />
          ) : (
            <Text fw={700} fz={28} lh={1.2}>
              {value}
            </Text>
          )}
          {attention && (
            <Text size="xs" fw={600} c="orange.8">
              Needs attention
            </Text>
          )}
          {hint && (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          )}
        </Stack>
        <ThemeIcon variant="light" color={attention ? 'orange' : 'gray'} size="lg" radius="md">
          <TileIcon size={20} stroke={1.6} />
        </ThemeIcon>
      </Group>
      {link && (
        <Anchor component={Link} to={link.to} size="sm" mt="xs" display="inline-block">
          {link.label} →
        </Anchor>
      )}
    </Paper>
  )
}

/**
 * One bar per status that has orders, in life-cycle order. One series, so one hue and no
 * legend: the label and the count are written beside every bar.
 */
export function StatusBreakdown({ counts }: { counts: StatusCounts }) {
  const rows = ALL_STATUSES.map((status) => ({ status, count: counts[status] ?? 0 })).filter((r) => r.count > 0)
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const max = Math.max(1, ...rows.map((r) => r.count))

  if (rows.length === 0) {
    return <Text c="dimmed">No orders yet.</Text>
  }
  return (
    <Stack gap={10} component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map(({ status, count }) => (
        <li key={status}>
          <BarRow
            label={
              <Anchor component={Link} to={`/admin/orders?status=${status}`} size="sm" c="inherit">
                {statusLabel(status)}
              </Anchor>
            }
            value={count}
            share={count / total}
            width={(count / max) * 100}
          />
        </li>
      ))}
    </Stack>
  )
}

function BarRow({ label, value, share, width }: { label: ReactNode; value: number; share: number; width: number }) {
  const percent = `${Math.round(share * 100)}%`
  return (
    <Tooltip label={`${value.toLocaleString('en-IN')} orders · ${percent} of all`} position="top-start" withinPortal>
      <div>
        <Group justify="space-between" gap="sm" mb={4} wrap="nowrap">
          {label}
          <Text size="sm" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value.toLocaleString('en-IN')}
          </Text>
        </Group>
        <Progress value={width} size={8} radius="xl" aria-label={`${value} orders`} />
      </div>
    </Tooltip>
  )
}
