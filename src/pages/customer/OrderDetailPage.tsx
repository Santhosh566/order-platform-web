import { RateDelivery } from '../../delivery/RateDelivery'
import { DeliveryPartnerCard } from '../../delivery/DeliveryPartnerCard'
import {
  Alert,
  Anchor,
  Button,
  Grid,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconInfoCircle,
  IconKey,
  IconListCheck,
  IconX,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { Order, OrderStatus, ReturnRequest } from '../../api/types'
import { AddressBlock } from '../../components/AddressBlock'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import { notifyFailure } from '../../lib/notifyFailure'
import { StatusBadge } from '../../components/StatusBadge'
import { useCancelOrder, useCreditNotes, useOrder, useReturns } from '../../customer/queries'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import { stateName } from '../../lib/indianStates'
import { CancelItemsDialog } from '../../components/order/CancelItemsDialog'
import {
  canCancelItems,
  canRequestReturn,
  endedUnfulfilled,
  hasInvoice,
  isCancellable,
  progressStep,
  PROGRESS_STEPS,
  returnableUnits,
  returnWindowCloses,
  shortOrderId,
} from '../../lib/orderStatus'
import { CreditNotes, Fact, InvoiceButton, Items, PaymentAndSlot } from '../../components/order/OrderParts'
import { ChangeOrderMenu, OrderChangeHistory } from '../../components/order/OrderChanges'
import { ReturnDialog } from './ReturnDialog'
import { ReturnStatusBadge } from '../../components/ReturnStatusBadge'
import { describeRefund } from '../../wallet/refundSplit'

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const order = useOrder(orderId)
  const live = useLiveOrders()

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Anchor component={Link} to="/orders" size="sm">
          ← My orders
        </Anchor>
      </Group>
      <QueryState query={order}>{(data) => <OrderView order={data} live={<LiveIndicator state={live} />} />}</QueryState>
    </Stack>
  )
}

function OrderView({ order, live }: { order: Order; live: ReactNode }) {
  const returns = useReturns()
  const orderReturns = (returns.data ?? []).filter((r) => r.orderId === order.orderId)
  const creditNotes = useCreditNotes(
    order.orderId,
    order.refundedTotal > 0 || (order.cancelledTotal ?? 0) > 0 || orderReturns.length > 0,
  )
  const [returnOpen, setReturnOpen] = useState(false)
  const [cancelItemsOpen, setCancelItemsOpen] = useState(false)

  const returnable = returnableUnits(order, orderReturns)
  const unitsLeft = [...returnable.values()].reduce((a, b) => a + b, 0)
  const returnsOpen = canRequestReturn(order) && returns.isSuccess && unitsLeft > 0
  const closes = returnWindowCloses(order)

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
            Placed {formatDateTime(order.createdAt)} · {order.orderId}
          </Text>
        </div>
        <Group gap="sm">
          {hasInvoice(order) && <InvoiceButton orderId={order.orderId} />}
          {returnsOpen && (
            <Button variant="light" leftSection={<IconArrowBackUp size={18} />} onClick={() => setReturnOpen(true)}>
              Return items
            </Button>
          )}
          <ChangeOrderMenu order={order} />
          {canCancelItems(order) && (
            <Button variant="default" leftSection={<IconListCheck size={18} />} onClick={() => setCancelItemsOpen(true)}>
              Cancel items
            </Button>
          )}
          {isCancellable(order.status) && <CancelButton order={order} />}
        </Group>
      </Group>

      <Progress order={order} />

      <Grid gap="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Items order={order} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Title order={4}>Delivery</Title>
                <PaymentAndSlot order={order} />
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
                    {order.trackingNumber && <> · Tracking {order.trackingNumber}</>}
                  </Text>
                )}
                {order.deliveredAt && <Text size="sm">Delivered {formatDateTime(order.deliveredAt)}</Text>}
                {closes && (
                  <Text size="sm" c="dimmed">
                    {canRequestReturn(order) ? 'Returns accepted until ' : 'Return window closed on '}
                    {formatDate(closes.toISOString())}
                  </Text>
                )}
              </Stack>
            </Paper>
            <DeliveryPartnerCard orderId={order.orderId} status={order.status} />
            {order.deliveredAt && <RateDelivery orderId={order.orderId} />}
            <Paper withBorder radius="md" p="md">
              <Stack gap={4}>
                <Title order={4} mb={4}>
                  Tax invoice
                </Title>
                <Fact label="Invoice no." value={order.invoiceNumber ?? 'Issued once paid'} />
                {order.invoiceDate && <Fact label="Invoice date" value={formatDate(order.invoiceDate)} />}
                <Fact label="Place of supply" value={stateName(order.placeOfSupply)} />
                {order.sellerGstin && <Fact label="Seller GSTIN" value={order.sellerGstin} />}
                {order.externalReference && <Fact label="Your reference" value={order.externalReference} />}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      <OrderChangeHistory order={order} />

      {(orderReturns.length > 0 || (creditNotes.data?.length ?? 0) > 0) && (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          {orderReturns.length > 0 && <OrderReturns order={order} returns={orderReturns} />}
          {(creditNotes.data?.length ?? 0) > 0 && <CreditNotes notes={creditNotes.data ?? []} />}
        </SimpleGrid>
      )}

      <Modal opened={cancelItemsOpen} onClose={() => setCancelItemsOpen(false)} title="Cancel items" size="lg">
        <CancelItemsDialog order={order} onDone={() => setCancelItemsOpen(false)} />
      </Modal>

      <Modal opened={returnOpen} onClose={() => setReturnOpen(false)} title="Return items" size="lg">
        <ReturnDialog order={order} returnable={returnable} onDone={() => setReturnOpen(false)} />
      </Modal>
    </Stack>
  )
}

const ENDED_MESSAGES: Partial<Record<OrderStatus, string>> = {
  CANCELLED: 'This order was cancelled.',
  OUT_OF_STOCK: 'We could not reserve every item, so the order was not placed. You were not charged.',
  PAYMENT_FAILED: 'The payment did not go through, so the order was not placed.',
  FRAUD_REJECTED: 'We could not accept this order. Please contact support if you think this is a mistake.',
  FULFILLMENT_FAILED: 'We could not fulfil this order. Any payment is being refunded.',
  RETURNED: 'We could not deliver this order after several attempts. It came back to us and was refunded.',
}

function Progress({ order }: { order: Order }) {
  const step = progressStep(order.status)
  if (step === null || endedUnfulfilled(order.status)) {
    return (
      <Alert color="gray" icon={<IconInfoCircle size={18} />}>
        {ENDED_MESSAGES[order.status] ?? 'This order has ended.'}
        {order.refundedTotal > 0 && <> Refunded {formatMoney(order.refundedTotal, order.currency)}.</>}
      </Alert>
    )
  }
  return (
    <Stack gap="sm">
      <Paper withBorder radius="md" p="md">
        <Stepper active={order.status === 'DELIVERED' ? PROGRESS_STEPS.length : step} size="sm" allowNextStepsSelect={false}>
          {PROGRESS_STEPS.map((label) => (
            <Stepper.Step key={label} label={label} />
          ))}
        </Stepper>
      </Paper>
      {order.status === 'OUT_FOR_DELIVERY' && (
        <Alert color="orange" icon={<IconKey size={18} />} title="Your parcel arrives today">
          We emailed you a one-time delivery code. Give it to the driver only once you have the parcel in hand.
        </Alert>
      )}
      {order.status === 'DELIVERY_FAILED' && (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="We missed you">
          The delivery attempt did not succeed. The parcel is back at our hub and we will try again.
        </Alert>
      )}
    </Stack>
  )
}


function OrderReturns({ order, returns }: { order: Order; returns: ReturnRequest[] }) {
  const nameOf = (sku: string) => order.items.find((i) => i.sku === sku)?.productName ?? sku
  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="sm">
        Returns
      </Title>
      <Stack gap="sm">
        {returns.map((r) => (
          <div key={r.returnId}>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {r.items.map((i) => `${i.quantity} × ${nameOf(i.sku)}`).join(', ')}
              </Text>
              <ReturnStatusBadge status={r.status} pickupStatus={r.pickupStatus} />
            </Group>
            <Text size="xs" c="dimmed">
              Requested {formatDateTime(r.requestedAt)} · {r.reason}
            </Text>
            {r.decisionNote && <Text size="xs">Our note: {r.decisionNote}</Text>}
          </div>
        ))}
      </Stack>
    </Paper>
  )
}




function CancelButton({ order }: { order: Order }) {
  const cancel = useCancelOrder(order.orderId, order.version)
  const paid = order.paymentTransactionId !== null
  const confirm = () =>
    modals.openConfirmModal({
      title: 'Cancel this order?',
      children: (
        <Text size="sm">
          {paid
            ? (order.walletAmount ?? 0) > 0
              ? `The remaining ${formatMoney(order.total - order.refundedTotal, order.currency)} comes back: ${describeRefund(
                  order,
                  order.total - order.refundedTotal,
                  (n) => formatMoney(n, order.currency),
                )}.`
              : `The remaining ${formatMoney(order.total - order.refundedTotal, order.currency)} goes back to your original payment method.`
            : 'You have not been charged for this order.'}{' '}
          This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Cancel order', cancel: 'Keep order' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        cancel.mutate(undefined, {
          onSuccess: (reply) =>
            notifications.show({ color: 'green', title: 'Order cancelled', message: reply.message }),
          onError: (error) =>
            notifyFailure('Could not cancel', error),
        }),
    })
  return (
    <Button variant="light" color="red" leftSection={<IconX size={18} />} loading={cancel.isPending} onClick={confirm}>
      Cancel order
    </Button>
  )
}
