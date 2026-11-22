import {
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCash, IconListCheck, IconPackageImport, IconX } from '@tabler/icons-react'
import { useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router'
import type { AdminOrderExtras } from '../../api/adminTypes'
import type { Order } from '../../api/types'
import {
  useAdminCancel,
  useAdminReturns,
  useDeliveryAttempts,
  useGoodwillRefund,
  useReturnToStock,
} from '../../admin/queries'
import { AddressBlock } from '../../components/AddressBlock'
import { LiveIndicator } from '../../components/LiveIndicator'
import { CreditNotes, Fact, InvoiceButton, Items, PaymentAndSlot } from '../../components/order/OrderParts'
import { ChangeOrderMenu, OrderChangeHistory } from '../../components/order/OrderChanges'
import { QueryState } from '../../components/QueryState'
import { StatusBadge } from '../../components/StatusBadge'
import { useCreditNotes, useOrder } from '../../customer/queries'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { notifyFailure } from '../../lib/notifyFailure'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { stateName } from '../../lib/indianStates'
import { canCancelItems, hasInvoice, isCancellable, shortOrderId, statusLabel } from '../../lib/orderStatus'
import { CancelItemsDialog } from '../../components/order/CancelItemsDialog'
import { ReturnStatusBadge } from '../../components/ReturnStatusBadge'
import { AssignDriver } from './AssignDriver'
import { LiveTrackingCard } from '../../tracking/LiveTrackingCard'
import { ShipsFrom } from '../../warehouses/ShipsFrom'

type AdminOrder = Order & Partial<AdminOrderExtras>

export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams()
  const order = useOrder(orderId)
  const live = useLiveOrders()
  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/orders" size="sm">
        ← Orders
      </Anchor>
      <QueryState query={order}>
        {(data) => <AdminOrderView order={data as AdminOrder} live={<LiveIndicator state={live} />} />}
      </QueryState>
    </Stack>
  )
}

function AdminOrderView({ order, live }: { order: AdminOrder; live: ReactElement }) {
  const returns = useAdminReturns('ALL')
  const orderReturns = (returns.data ?? []).filter((r) => r.orderId === order.orderId)
  const creditNotes = useCreditNotes(order.orderId, true)
  const attempts = useDeliveryAttempts(order.orderId)
  const [goodwillOpen, setGoodwillOpen] = useState(false)
  const [cancelItemsOpen, setCancelItemsOpen] = useState(false)
  // What was charged (on cash on delivery, the amount due after cancellations) less refunds: Order.refundableAmount
  const charged = order.paymentMethod === 'COD' ? (order.amountDue ?? order.total) : order.total
  const refundable = Math.round((charged - order.refundedTotal) * 100) / 100
  const awaitingDriver = order.status === 'READY_FOR_DISPATCH' || order.status === 'DELIVERY_FAILED'

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="sm">
            <Title order={2}>Order {shortOrderId(order.orderId)}</Title>
            <StatusBadge status={order.status} size="lg" />
            {live}
          </Group>
          <Text c="dimmed" size="sm">
            {order.customerId} · placed {formatDateTime(order.createdAt)} · {statusLabel(order.status)} since{' '}
            {formatDateTime(order.statusChangedAt)}
          </Text>
          <Text c="dimmed" size="xs">
            {order.orderId}
          </Text>
        </div>
        <Group gap="sm">
          {hasInvoice(order) && <InvoiceButton orderId={order.orderId} />}
          {order.status === 'DELIVERED' && refundable > 0 && (
            <Button variant="light" leftSection={<IconCash size={18} />} onClick={() => setGoodwillOpen(true)}>
              Goodwill refund
            </Button>
          )}
          {order.status === 'DELIVERY_FAILED' && <ReturnToStockButton order={order} />}
          <ChangeOrderMenu order={order} staff />
          {canCancelItems(order) && (
            <Button variant="default" leftSection={<IconListCheck size={18} />} onClick={() => setCancelItemsOpen(true)}>
              Cancel items
            </Button>
          )}
          {isCancellable(order.status) && <CancelButton order={order} />}
        </Group>
      </Group>

      {order.fraudStatus === 'REJECTED' && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Rejected by the fraud check">
          Score {order.fraudScore ?? '—'}. The customer was told the order could not be accepted.
        </Alert>
      )}

      {awaitingDriver && (
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={500}>
              {order.status === 'DELIVERY_FAILED'
                ? 'The last delivery attempt failed. Assign a driver to try again, or return the goods to stock.'
                : 'Ready to ship and waiting for a driver.'}
            </Text>
            <AssignDriver orderId={order.orderId} version={order.version} />
          </Group>
        </Paper>
      )}

      <LiveTrackingCard orderId={order.orderId} status={order.status} />

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Items order={order} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap={4}>
                <Title order={4} mb={4}>
                  Payment & risk
                </Title>
                <PaymentAndSlot order={order} />
                <Fact label="Payment" value={order.paymentTransactionId ?? 'Not charged'} />
                {order.paymentGateway && <Fact label="Gateway" value={order.paymentGateway} />}
                <Fact label="Refunded" value={formatMoney(order.refundedTotal, order.currency)} />
                <Fact
                  label="Fraud check"
                  value={
                    order.fraudStatus
                      ? `${order.fraudStatus}${order.fraudScore != null ? ` (score ${order.fraudScore})` : ''}`
                      : 'Screened only'
                  }
                />
                <Fact label="Order type" value={order.orderType === 'HIGH_VALUE' ? 'High value' : 'Standard'} />
                {order.shippingCost != null && (
                  <Fact label="Carrier cost (ours)" value={formatMoney(order.shippingCost, order.currency)} />
                )}
              </Stack>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Title order={4}>Delivery</Title>
                {order.shippingAddress ? (
                  <AddressBlock address={order.shippingAddress} />
                ) : (
                  <Text c="dimmed" size="sm">
                    No address recorded.
                  </Text>
                )}
                {order.carrier && (
                  <Text size="sm">
                    {order.carrier}
                    {order.trackingNumber && <> · {order.trackingNumber}</>}
                  </Text>
                )}
                <ShipsFrom warehouseId={order.warehouseId} />
                {order.deliveredAt && <Text size="sm">Delivered {formatDateTime(order.deliveredAt)}</Text>}
              </Stack>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Stack gap={4}>
                <Title order={4} mb={4}>
                  Tax invoice
                </Title>
                <Fact label="Invoice no." value={order.invoiceNumber ?? 'Not issued yet'} />
                {order.invoiceDate && <Fact label="Invoice date" value={formatDate(order.invoiceDate)} />}
                <Fact label="Place of supply" value={stateName(order.placeOfSupply)} />
                {order.sellerGstin && <Fact label="Seller GSTIN" value={order.sellerGstin} />}
                {order.externalReference && <Fact label="Customer reference" value={order.externalReference} />}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      <OrderChangeHistory order={order} staff />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {(attempts.data?.length ?? 0) > 0 && (
          <Paper withBorder radius="md" p="md">
            <Title order={4} mb="sm">
              Delivery attempts
            </Title>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Driver</Table.Th>
                  <Table.Th>Outcome</Table.Th>
                  <Table.Th>When</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {attempts.data?.map((a) => (
                  <Table.Tr key={a.attemptNumber}>
                    <Table.Td>{a.attemptNumber}</Table.Td>
                    <Table.Td>{a.deliveryUserId}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={attemptColor(a.status)}>
                        {a.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                      {a.failureReason && <Text size="xs">{a.failureReason}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {formatDateTime(a.deliveredAt ?? a.failedAt ?? a.pickedUpAt ?? a.assignedAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
        {orderReturns.length > 0 && (
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Returns</Title>
              <Anchor component={Link} to="/admin/returns" size="sm">
                Returns queue →
              </Anchor>
            </Group>
            <Stack gap="sm">
              {orderReturns.map((r) => (
                <div key={r.returnId}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {r.items.map((i) => `${i.quantity} × ${i.sku}`).join(', ')}
                    </Text>
                    <ReturnStatusBadge status={r.status} pickupStatus={r.pickupStatus} />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(r.requestedAt)} · {r.reason}
                  </Text>
                </div>
              ))}
            </Stack>
          </Paper>
        )}
        {(creditNotes.data?.length ?? 0) > 0 && <CreditNotes notes={creditNotes.data ?? []} />}
      </SimpleGrid>

      <Modal opened={cancelItemsOpen} onClose={() => setCancelItemsOpen(false)} title="Cancel items" size="lg">
        <CancelItemsDialog order={order} staff onDone={() => setCancelItemsOpen(false)} />
      </Modal>
      <Modal opened={goodwillOpen} onClose={() => setGoodwillOpen(false)} title="Goodwill refund">
        <GoodwillForm order={order} refundable={refundable} onDone={() => setGoodwillOpen(false)} />
      </Modal>
    </Stack>
  )
}

function attemptColor(status: string): string {
  if (status === 'DELIVERED') return 'green'
  if (status === 'FAILED') return 'red'
  if (status === 'ASSIGNED' || status === 'PICKED_UP') return 'blue'
  return 'gray'
}

/** Money back without goods coming back; the backend spreads it over the lines with their GST. */
export function GoodwillForm({ order, refundable, onDone }: { order: Order; refundable: number; onDone: () => void }) {
  const refund = useGoodwillRefund(order.orderId, order.version)
  const [amount, setAmount] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const amountError =
    amount === '' || amount <= 0
      ? 'Enter an amount'
      : amount > refundable
        ? `At most ${formatMoney(refundable, order.currency)}`
        : undefined
  const reasonError = reason.trim() ? undefined : 'The reason goes on the credit note'

  const submit = () => {
    setTouched(true)
    if (amountError || reasonError || amount === '') return
    refund.mutate(
      { amount, reason: reason.trim() },
      {
        onSuccess: (note) => {
          notifications.show({
            color: 'green',
            title: 'Refund issued',
            message: `${formatMoney(note.total, note.currency)} on credit note ${note.number}.`,
          })
          onDone()
        },
        onError: (error) => notifyFailure('Not refunded', error),
      },
    )
  }

  return (
    <Stack gap="sm">
      <Text size="sm">
        Up to {formatMoney(refundable, order.currency)} can still be refunded. A GST credit note is issued with the
        tax split the same way as the invoice.
      </Text>
      <NumberInput
        label="Amount (incl. GST)"
        value={amount}
        onChange={(v) => setAmount(typeof v === 'number' ? v : '')}
        min={0.01}
        max={refundable}
        // Too much is shown as an error, never silently lowered to the limit
        clampBehavior="none"
        decimalScale={2}
        prefix="₹"
        thousandSeparator=","
        withAsterisk
        error={touched ? amountError : undefined}
      />
      <Textarea
        label="Reason"
        placeholder="e.g. Arrived two days late"
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        maxLength={255}
        withAsterisk
        error={touched ? reasonError : undefined}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Close
        </Button>
        <Button onClick={submit} loading={refund.isPending}>
          Refund
        </Button>
      </Group>
    </Stack>
  )
}

function ReturnToStockButton({ order }: { order: Order }) {
  const action = useReturnToStock(order.orderId, order.version)
  const confirm = () =>
    modals.openConfirmModal({
      title: 'Give up on delivery?',
      children: (
        <Text size="sm">
          The goods go back into stock and the customer is refunded{' '}
          {formatMoney(order.total - order.refundedTotal, order.currency)}. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Return to stock and refund', cancel: 'Keep trying' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        action.mutate(undefined, {
          onSuccess: () => notifications.show({ color: 'green', title: 'Returned to stock', message: 'Refund issued.' }),
          onError: (error) => notifyFailure('Not returned', error),
        }),
    })
  return (
    <Button variant="light" color="orange" leftSection={<IconPackageImport size={18} />} loading={action.isPending} onClick={confirm}>
      Return to stock
    </Button>
  )
}

function CancelButton({ order }: { order: Order }) {
  const cancel = useAdminCancel(order.orderId, order.version)
  const confirm = () =>
    modals.openConfirmModal({
      title: 'Cancel this order for the customer?',
      children: (
        <Text size="sm">
          Reserved stock is released
          {order.paymentTransactionId
            ? ` and ${formatMoney(order.total - order.refundedTotal, order.currency)} is refunded`
            : ''}
          . The customer is emailed. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Cancel order', cancel: 'Keep order' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        cancel.mutate(undefined, {
          onSuccess: (reply) => notifications.show({ color: 'green', title: 'Order cancelled', message: reply.message }),
          onError: (error) => notifyFailure('Could not cancel', error),
        }),
    })
  return (
    <Button variant="light" color="red" leftSection={<IconX size={18} />} loading={cancel.isPending} onClick={confirm}>
      Cancel order
    </Button>
  )
}
