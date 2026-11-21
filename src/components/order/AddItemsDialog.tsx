import { ActionIcon, Alert, Button, Checkbox, Group, NumberInput, Select, Stack, Table, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { Order, PublicProduct } from '../../api/types'
import { useCatalog } from '../../customer/queries'
import { formatMoney } from '../../lib/format'
import { notifyFailure } from '../../lib/notifyFailure'
import { useAddItems } from '../../orders/changes'
import { useWallet } from '../../wallet/queries'
import { ItemLine } from '../ItemLines'
import { useThumbnails } from '../thumbnails'

const MAX_UNITS = 99

interface Line {
  product: PublicProduct
  quantity: number
}

/**
 * Adds products to an order that is not packed yet. They are priced at today's price without the order's coupon,
 * reserved at once and paid now (wallet first if the customer wants, then card), or owed at the door with cash on
 * delivery. The amounts here are an estimate; the server prices them.
 */
export function AddItemsDialog({ order, staff = false, onDone }: { order: Order; staff?: boolean; onDone: () => void }) {
  const add = useAddItems(order.orderId, order.version)
  const catalog = useCatalog()
  const cod = order.paymentMethod === 'COD'
  const wallet = useWallet(!staff && !cod)
  const [lines, setLines] = useState<Line[]>([])
  const [picking, setPicking] = useState<string | null>(null)
  const [useBalance, setUseBalance] = useState(true)
  const thumbnails = useThumbnails(lines.map((l) => l.product.sku))

  const onOrder = useMemo(() => {
    const units = new Map<string, number>()
    order.items.forEach((i) => units.set(i.sku, (units.get(i.sku) ?? 0) + (i.activeQuantity ?? i.quantity)))
    return units
  }, [order.items])
  const maxFor = (p: PublicProduct) =>
    Math.max(0, Math.min(MAX_UNITS, staff || !p.maxPerOrder ? MAX_UNITS : p.maxPerOrder - (onOrder.get(p.sku) ?? 0)))

  const options = (catalog.data ?? [])
    .filter((p) => p.stockStatus !== 'OUT_OF_STOCK' && !lines.some((l) => l.product.sku === p.sku) && maxFor(p) > 0)
    .map((p) => ({ value: p.sku, label: `${p.name} · ${formatMoney(p.unitPrice, p.currency)}` }))

  const extra = Math.round(lines.reduce((sum, l) => sum + l.product.unitPrice * l.quantity, 0) * 100) / 100
  const available = wallet.data?.available ?? 0
  const walletOn = !staff && !cod && available > 0 && useBalance
  const fromWallet = walletOn ? Math.min(available, extra) : 0
  const byCard = Math.round((extra - fromWallet) * 100) / 100

  const pick = (sku: string | null) => {
    const product = catalog.data?.find((p) => p.sku === sku)
    if (product) setLines((current) => [...current, { product, quantity: 1 }])
    setPicking(null)
  }

  const submit = async () => {
    if (lines.length === 0) return
    try {
      const reply = await add.mutateAsync({
        items: lines.map((l) => ({ sku: l.product.sku, quantity: l.quantity })),
        useWallet: walletOn,
      })
      const paid = reply.payment
      notifications.show({
        color: 'green',
        title: 'Items added',
        message: !paid
          ? 'They come in the same delivery.'
          : paid.cashOnDelivery > 0
            ? `Cash due at the door is now ${formatMoney(reply.order.amountDue, order.currency)}.`
            : [
                paid.fromWallet > 0 ? `${formatMoney(paid.fromWallet, order.currency)} from the wallet` : null,
                paid.byCard > 0 ? `${formatMoney(paid.byCard, order.currency)} charged to the card` : null,
              ]
                .filter(Boolean)
                .join(' and ') + '.',
      })
      onDone()
    } catch (error) {
      notifyFailure('Items not added', error)
    }
  }

  return (
    <Stack gap="md">
      <Select
        label="Add a product"
        placeholder={catalog.isPending ? 'Loading products…' : 'Type a name'}
        data={options}
        value={picking}
        onChange={pick}
        searchable
        clearable
        nothingFoundMessage="No product in stock matches"
        disabled={add.isPending || lines.length >= 20}
        comboboxProps={{ withinPortal: false }}
      />
      {lines.length > 0 && (
        <Table aria-label="Items to add">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th w={100}>Qty</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => (
              <Table.Tr key={l.product.sku}>
                <Table.Td>
                  <ItemLine
                    sku={l.product.sku}
                    name={l.product.name}
                    thumbnail={thumbnails.get(l.product.sku)}
                    detail={`${formatMoney(l.product.unitPrice, l.product.currency)} each`}
                    size={40}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    aria-label={`Units of ${l.product.name} to add`}
                    value={l.quantity}
                    onChange={(v) =>
                      setLines((current) =>
                        current.map((c) => (c.product.sku === l.product.sku ? { ...c, quantity: typeof v === 'number' ? v : 1 } : c)),
                      )
                    }
                    min={1}
                    max={maxFor(l.product)}
                    clampBehavior="strict"
                    allowDecimal={false}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td ta="right">{formatMoney(l.product.unitPrice * l.quantity, l.product.currency)}</Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Remove ${l.product.name}`}
                    onClick={() => setLines((current) => current.filter((c) => c.product.sku !== l.product.sku))}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {lines.length > 0 && (
        <Stack gap={6}>
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              To pay for these
            </Text>
            <Text size="sm" fw={600} aria-label="Added amount">
              {formatMoney(extra, order.currency)}
            </Text>
          </Group>
          {cod ? (
            <Text size="sm">
              Added to the cash due at the door: about {formatMoney(order.amountDue + extra, order.currency)} in all.
            </Text>
          ) : staff ? (
            <Text size="sm">Charged to the customer's card when you add them.</Text>
          ) : (
            <>
              {available > 0 && (
                <Checkbox
                  label={`Use my wallet balance (${formatMoney(available, order.currency)})`}
                  checked={useBalance}
                  onChange={(e) => setUseBalance(e.currentTarget.checked)}
                />
              )}
              <Text size="sm">
                {fromWallet > 0 && byCard > 0
                  ? `${formatMoney(fromWallet, order.currency)} from your wallet and ${formatMoney(byCard, order.currency)} charged to your card now.`
                  : fromWallet > 0
                    ? `${formatMoney(fromWallet, order.currency)} from your wallet now.`
                    : `${formatMoney(byCard, order.currency)} charged to your card now.`}
              </Text>
            </>
          )}
        </Stack>
      )}

      <Alert color="gray" icon={<IconInfoCircle size={18} />} p="xs">
        Items are added at today's price{order.couponCode ? `; coupon ${order.couponCode} does not apply to them` : ''}.
        They come in the same delivery, and can be added until the order is packed.
      </Alert>

      <Group justify="flex-end">
        <Button variant="default" onClick={onDone} disabled={add.isPending}>
          Close
        </Button>
        <Button onClick={() => void submit()} loading={add.isPending} disabled={lines.length === 0}>
          {lines.length === 0 ? 'Add items' : `Add for ${formatMoney(extra, order.currency)}`}
        </Button>
      </Group>
    </Stack>
  )
}
