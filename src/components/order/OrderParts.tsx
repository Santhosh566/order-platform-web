import { Badge, Button, Group, Paper, Stack, Table, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileInvoice } from '@tabler/icons-react'
import { useState } from 'react'
import { apiBlob } from '../../api/client'
import type { CreditNote, Order } from '../../api/types'
import { errorMessage } from '../../lib/errors'
import { ItemPhoto } from '../ItemLines'
import { useThumbnails } from '../thumbnails'
import { formatDate, formatMoney, formatRate } from '../../lib/format'
import { formatSlot, PAYMENT_LABELS } from '../../checkout/labels'

/** Pieces of an order page shared by the customer's and the admin's views. */

export function Items({ order }: { order: Order }) {
  const interState = order.igstTotal > 0
  const discounted = (order.discountTotal ?? 0) > 0
  const legacy = order.items.length === 0
  const thumbnails = useThumbnails(order.items.map((i) => i.sku))
  // Cancelled units of a cash-on-delivery order were never paid, so they are not in refundedTotal
  const unpaidCancelled = order.paymentMethod === 'COD' ? (order.cancelledTotal ?? 0) : 0
  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="sm">
        Items
      </Title>
      {legacy ? (
        <Text c="dimmed" size="sm">
          This order was placed before item details were kept.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="right">Unit price</Table.Th>
                {discounted && <Table.Th ta="right">Discount</Table.Th>}
                <Table.Th ta="right">Taxable value</Table.Th>
                <Table.Th ta="right">GST</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {order.items.map((item, index) => (
                <Table.Tr key={`${item.sku}-${index}`}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <ItemPhoto thumbnail={thumbnails.get(item.sku)} name={item.productName ?? item.sku} size={44} />
                      <div>
                        <Text size="sm" fw={500}>
                          {item.productName ?? item.sku}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.sku}
                          {item.hsnCode && <> · HSN {item.hsnCode}</>}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    {item.quantity}
                    {(item.cancelledQuantity ?? 0) > 0 && (
                      <Text size="xs" c="red" style={{ whiteSpace: 'nowrap' }}>
                        {item.cancelledQuantity === item.quantity ? 'cancelled' : `${item.cancelledQuantity} cancelled`}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{formatMoney(item.price, order.currency)}</Table.Td>
                  {discounted && (
                    <Table.Td ta="right">{item.discount > 0 ? `− ${formatMoney(item.discount, order.currency)}` : '—'}</Table.Td>
                  )}
                  <Table.Td ta="right">{formatMoney(item.taxableValue, order.currency)}</Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">
                      {formatMoney(item.cgstAmount + item.sgstAmount + item.igstAmount, order.currency)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatRate(item.gstRate)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{formatMoney(item.lineTotal, order.currency)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Stack gap={4} mt="md" ml="auto" maw={320}>
        {discounted && (
          <Fact
            label={order.couponCode ? `Coupon ${order.couponCode}` : 'Discount'}
            value={`− ${formatMoney(order.discountTotal, order.currency)}`}
          />
        )}
        <Fact label="Taxable value" value={formatMoney(order.subtotal, order.currency)} />
        {interState ? (
          <Fact label="IGST" value={formatMoney(order.igstTotal, order.currency)} />
        ) : (
          <>
            <Fact label="CGST" value={formatMoney(order.cgstTotal, order.currency)} />
            <Fact label="SGST" value={formatMoney(order.sgstTotal, order.currency)} />
          </>
        )}
        <Fact label="Delivery" value="Free" />
        <Group justify="space-between" mt={4}>
          <Text fw={700}>Total</Text>
          <Text fw={700}>{formatMoney(order.total, order.currency)}</Text>
        </Group>
        {unpaidCancelled > 0 && (
          <>
            <Fact label="Cancelled items" value={`− ${formatMoney(unpaidCancelled, order.currency)}`} />
            <Group justify="space-between">
              <Text fw={600}>To pay at the door</Text>
              <Text fw={600}>{formatMoney(order.amountDue, order.currency)}</Text>
            </Group>
          </>
        )}
        {order.refundedTotal > 0 && (
          <>
            <Fact label="Refunded" value={`− ${formatMoney(order.refundedTotal, order.currency)}`} />
            {(order.walletRefunded ?? 0) > 0 && (
              <Text size="xs" c="dimmed" ta="right">
                {formatMoney(order.walletRefunded, order.currency)} of it back to the wallet
              </Text>
            )}
            <Group justify="space-between">
              <Text fw={600}>Net paid</Text>
              <Text fw={600}>{formatMoney(order.total - order.refundedTotal - unpaidCancelled, order.currency)}</Text>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  )
}

/** How it is paid and when it comes: shown on the customer's and the admin's order pages. */
export function PaymentAndSlot({ order }: { order: Order }) {
  const slot = formatSlot(order.deliveryDate, order.deliveryWindow)
  const cod = order.paymentMethod === 'COD'
  const collected = cod && order.paymentTransactionId !== null
  return (
    <Stack gap={4}>
      <Fact
        label="Payment"
        value={
          (order.walletAmount ?? 0) > 0
            ? order.cardAmount === 0
              ? 'Wallet'
              : `${PAYMENT_LABELS[order.paymentMethod ?? 'PREPAID']} and wallet`
            : PAYMENT_LABELS[order.paymentMethod ?? 'PREPAID']
        }
      />
      {(order.walletAmount ?? 0) > 0 && (
        <>
          <Fact label="From wallet" value={formatMoney(order.walletAmount, order.currency)} />
          {order.cardAmount > 0 && <Fact label="Online" value={formatMoney(order.cardAmount, order.currency)} />}
        </>
      )}
      {cod && !collected && !order.status.match(/CANCELLED|RETURNED|FAILED|OUT_OF_STOCK|REJECTED/) && (
        <Badge color="orange" variant="light" w="fit-content">
          Pay {formatMoney(order.amountDue ?? order.total, order.currency)} in cash at the door
        </Badge>
      )}
      {collected && <Fact label="Cash collected" value={order.paymentTransactionId!} />}
      <Fact label="Delivery" value={slot ?? 'Standard'} />
    </Stack>
  )
}

const CREDIT_NOTE_KINDS: Record<CreditNote['kind'], { label: string; color: string }> = {
  RETURN: { label: 'Return', color: 'blue' },
  GOODWILL: { label: 'Goodwill', color: 'grape' },
  CANCELLATION: { label: 'Cancelled items', color: 'red' },
}

export function CreditNotes({ notes }: { notes: CreditNote[] }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="sm">
        Credit notes
      </Title>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Number</Table.Th>
            <Table.Th>Issued</Table.Th>
            <Table.Th ta="right">GST</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {notes.map((note) => (
            <Table.Tr key={note.number}>
              <Table.Td>
                <Text size="sm">{note.number}</Text>
                <Badge size="xs" variant="light" color={CREDIT_NOTE_KINDS[note.kind].color}>
                  {CREDIT_NOTE_KINDS[note.kind].label}
                </Badge>
              </Table.Td>
              <Table.Td>{formatDate(note.issuedAt)}</Table.Td>
              <Table.Td ta="right">
                {formatMoney(note.cgstAmount + note.sgstAmount + note.igstAmount, note.currency)}
              </Table.Td>
              <Table.Td ta="right">{formatMoney(note.total, note.currency)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {value}
      </Text>
    </Group>
  )
}

export function InvoiceButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const open = async () => {
    // Opened now, while the click still counts, so pop-up blockers allow it
    const tab = window.open('', '_blank')
    setLoading(true)
    try {
      const pdf = await apiBlob(`/api/invoices/${encodeURIComponent(orderId)}`)
      const url = URL.createObjectURL(pdf)
      if (tab) {
        tab.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = `invoice-${orderId}.pdf`
        link.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      tab?.close()
      notifications.show({ color: 'red', title: 'Invoice not available', message: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button variant="default" leftSection={<IconFileInvoice size={18} />} loading={loading} onClick={() => void open()}>
      Invoice
    </Button>
  )
}
