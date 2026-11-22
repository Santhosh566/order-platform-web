import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Checkbox,
  Divider,
  Grid,
  Group,
  NumberInput,
  Paper,
  Radio,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconInfoCircle, IconShoppingCart, IconTrash } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, ApiError } from '../../api/client'
import type { ShippingAddress } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useCart } from '../../cart/CartContext'
import {
  atCatalogPrices,
  cartTotal,
  itemCount,
  lineTotal,
  MAX_QUANTITY,
  priceChanges,
  unavailableLines,
} from '../../cart/cart'
import { AddressBlock } from '../../components/AddressBlock'
import { AddressForm } from '../../components/AddressForm'
import { ProductImage } from '../../components/ProductImage'
import { errorMessage } from '../../lib/errors'
import { useCatalog, usePlaceOrder } from '../../customer/queries'
import { CouponBox } from '../../checkout/CouponBox'
import { DeliveryChoice, type ChosenSlot } from '../../checkout/DeliveryChoice'
import type { PaymentMethod } from '../../checkout/labels'
import { PaymentChoice } from '../../checkout/PaymentChoice'
import { useQuote } from '../../checkout/queries'
import { formatMoney } from '../../lib/format'
import { useWallet } from '../../wallet/queries'

type AddressChoice = 'saved' | 'other'

/**
 * The cart and checkout on one page. Prices are refreshed from the catalogue when the page opens;
 * the backend prices the order again, so what is charged is always the server's figure.
 */
export function CartPage() {
  const cart = useCart()
  const auth = useAuth()
  const navigate = useNavigate()
  const catalog = useCatalog()
  const placeOrder = usePlaceOrder()

  const savedAddress = auth.me?.defaultAddress ?? null
  const [choice, setChoice] = useState<AddressChoice>(savedAddress ? 'saved' : 'other')
  const [otherAddress, setOtherAddress] = useState<ShippingAddress | null>(null)
  const [saveAsDefault, setSaveAsDefault] = useState(!savedAddress)
  const [savingAddress, setSavingAddress] = useState(false)

  // The cart shows and totals today's catalogue prices; the server prices the order the same way
  const products = catalog.data
  const lines = useMemo(() => atCatalogPrices(cart.lines, products), [cart.lines, products])
  const changes = useMemo(() => priceChanges(cart.lines, products), [cart.lines, products])
  const unavailable = useMemo(() => unavailableLines(cart.lines, products), [cart.lines, products])
  // The shop's per-order limit for each product, where it has one
  const limits = useMemo(
    () => new Map((products ?? []).filter((p) => p.maxPerOrder).map((p) => [p.sku, Math.min(MAX_QUANTITY, p.maxPerOrder!)])),
    [products],
  )
  const photos = useMemo(() => new Map((products ?? []).map((p) => [p.sku, p.imageKey ?? null])), [products])
  const acceptPrices = () =>
    cart.reprice(new Map(changes.map((c) => [c.sku, { name: c.name, unitPrice: c.now }])))
  const address = choice === 'saved' ? savedAddress : otherAddress
  // A cart reminder email links here with its coupon: /cart?coupon=CARTX7K2QP
  const [searchParams] = useSearchParams()
  const [coupon, setCoupon] = useState<string | null>(() => searchParams.get('coupon')?.trim().toUpperCase() || null)
  const [payment, setPayment] = useState<PaymentMethod>('PREPAID')
  const [slot, setSlot] = useState<ChosenSlot | null>(null)
  // Store credit pays first when there is any, unless the customer unticks it
  const wallet = useWallet()
  const available = wallet.data?.available ?? 0
  const [walletChoice, setWalletChoice] = useState<boolean | null>(null)
  const wantsWallet = walletChoice ?? available > 0

  // The server prices the cart with the coupon and GST; the summary shows its figures once it has them
  const quoteRequest = useMemo(
    () =>
      address && unavailable.size === 0
        ? {
            items: cart.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
            shippingAddress: address,
            couponCode: coupon,
            paymentMethod: payment,
          }
        : null,
    [address, cart.lines, coupon, payment, unavailable.size],
  )
  const quote = useQuote(quoteRequest)
  const priced = quoteRequest ? quote.data : undefined
  const codRefused = payment === 'COD' && priced !== undefined && !priced.cashOnDelivery.available
  const orderTotal = priced?.total ?? cartTotal(lines)
  // The server takes min(available, total) as the order is placed; this shows the same split
  const fromWallet = payment === 'PREPAID' && wantsWallet && available > 0 ? Math.min(available, orderTotal) : 0
  const online = Math.round((orderTotal - fromWallet) * 100) / 100

  // One reference per cart, address and choices: a retry of the same checkout cannot place a second order
  const signature = JSON.stringify([cart.lines.map((l) => [l.sku, l.quantity]), address, coupon, payment, slot, fromWallet > 0])
  const reference = useMemo(() => newReference(signature), [signature])

  if (cart.lines.length === 0) {
    return (
      <Stack gap="md" maw={640}>
        <Title order={2}>Cart</Title>
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="sm">
            <IconShoppingCart size={40} stroke={1.4} />
            <Text>Your cart is empty.</Text>
            <Button component={Link} to="/shop">
              Browse products
            </Button>
          </Stack>
        </Paper>
      </Stack>
    )
  }

  const submit = async () => {
    if (!address) return
    try {
      if (choice === 'other' && saveAsDefault) {
        setSavingAddress(true)
        try {
          await api('/api/me/address', { method: 'PUT', body: address })
          await auth.refreshMe()
        } finally {
          setSavingAddress(false)
        }
      }
      const accepted = await placeOrder.mutateAsync({
        orderId: reference,
        items: cart.lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
        shippingAddress: address,
        // Only a coupon the server accepted; a refused one is left out rather than failing the order
        couponCode: priced?.couponCode ?? null,
        paymentMethod: payment,
        deliverySlot: slot,
        useWallet: fromWallet > 0,
      })
      cart.clear()
      notifications.show({
        color: 'green',
        title: 'Order placed',
        message:
          payment === 'COD'
            ? `Pay ${formatMoney(accepted.total, accepted.currency)} in cash when it arrives. We’ll keep you updated here and by email.`
            : fromWallet > 0
              ? `Total ${formatMoney(accepted.total, accepted.currency)}, paid ${
                  online > 0 ? `from your wallet and online` : 'from your wallet'
                }. We’ll keep you updated here and by email.`
              : `Total ${formatMoney(accepted.total, accepted.currency)}. We’ll keep you updated here and by email.`,
      })
      navigate(`/orders/${encodeURIComponent(accepted.orderId)}`)
    } catch (error) {
      if (isDuplicate(error)) {
        // The first attempt reached the server even though its reply was lost
        cart.clear()
        notifications.show({
          color: 'blue',
          title: 'Already placed',
          message: 'This order had already gone through. You can find it in My orders.',
        })
        navigate('/orders')
        return
      }
      notifications.show({ color: 'red', title: 'Order not placed', message: errorMessage(error) })
    }
  }

  const busy = placeOrder.isPending || savingAddress
  // Never split: items in different warehouses are ordered separately
  const splitNeeded = !!priced?.shippingProblem
  const canCheckout = !!address && unavailable.size === 0 && !busy && !codRefused && !splitNeeded

  return (
    <Stack gap="md">
      <Title order={2}>Cart</Title>

      {changes.length > 0 && (
        <Alert
          color="yellow"
          icon={<IconInfoCircle size={18} />}
          title="Prices changed since you added these"
          withCloseButton
          closeButtonLabel="OK"
          onClose={acceptPrices}
        >
          {changes.map((c) => (
            <div key={c.sku}>
              {c.name}: was {formatMoney(c.was)}, now {formatMoney(c.now)}
            </div>
          ))}
          The cart shows today’s prices.
        </Alert>
      )}

      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder radius="md" p="md">
            <Table.ScrollContainer minWidth={480}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th w={110}>Quantity</Table.Th>
                    <Table.Th ta="right">Amount</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lines.map((line) => (
                    <Table.Tr key={line.sku}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <div style={{ width: 48, flexShrink: 0 }}>
                            <ProductImage imageKey={photos.get(line.sku)} alt={line.name} />
                          </div>
                          <div>
                            <Text fw={500}>{line.name}</Text>
                            <Text size="xs" c="dimmed">
                              {formatMoney(line.unitPrice)} each
                            </Text>
                            {unavailable.has(line.sku) && (
                              <Text size="xs" c="red">
                                {unavailable.get(line.sku)}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          aria-label={`Quantity of ${line.name}`}
                          value={line.quantity}
                          onChange={(value) => typeof value === 'number' && cart.setQuantity(line.sku, value)}
                          min={1}
                          max={limits.get(line.sku) ?? MAX_QUANTITY}
                          clampBehavior="strict"
                          allowDecimal={false}
                          size="xs"
                          disabled={busy}
                        />
                      </Table.Td>
                      <Table.Td ta="right">{formatMoney(lineTotal(line))}</Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Remove ${line.name}`}
                          onClick={() => cart.remove(line.sku)}
                          disabled={busy}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Anchor component={Link} to="/shop" size="sm">
              Continue shopping
            </Anchor>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Title order={4}>Deliver to</Title>
                {savedAddress && (
                  <Radio.Group value={choice} onChange={(value) => setChoice(value as AddressChoice)}>
                    <Stack gap="xs">
                      <Radio value="saved" label="My saved address" />
                      <Radio value="other" label="A different address" />
                    </Stack>
                  </Radio.Group>
                )}
                {choice === 'saved' && savedAddress && <AddressBlock address={savedAddress} />}
                {choice === 'other' &&
                  (otherAddress ? (
                    <Stack gap="xs">
                      <AddressBlock address={otherAddress} />
                      <Button
                        variant="subtle"
                        size="xs"
                        w="fit-content"
                        onClick={() => setOtherAddress(null)}
                      >
                        Change address
                      </Button>
                    </Stack>
                  ) : (
                    <AddressForm initial={null} submitLabel="Use this address" onSubmit={setOtherAddress} />
                  ))}
                {choice === 'other' && (
                  <Checkbox
                    label="Save as my default address"
                    checked={saveAsDefault}
                    onChange={(e) => setSaveAsDefault(e.currentTarget.checked)}
                  />
                )}
              </Stack>
            </Paper>

            {address && (
              <Paper withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Title order={4}>Delivery day</Title>
                  <DeliveryChoice pin={address.postalCode} value={slot} onChange={setSlot} disabled={busy} />
                </Stack>
              </Paper>
            )}

            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Title order={4}>Payment</Title>
                {available > 0 && (
                  <Checkbox
                    label={`Use my wallet balance (${formatMoney(available)})`}
                    description={
                      payment === 'COD'
                        ? 'Not with cash on delivery: choose Pay online to use it'
                        : fromWallet > 0 && online === 0
                          ? 'Your wallet pays the whole order'
                          : fromWallet > 0
                            ? `${formatMoney(fromWallet)} from the wallet, the rest online`
                            : undefined
                    }
                    checked={wantsWallet && payment === 'PREPAID'}
                    onChange={(e) => setWalletChoice(e.currentTarget.checked)}
                    disabled={busy || payment === 'COD'}
                  />
                )}
                {!(fromWallet > 0 && online === 0) && (
                  <PaymentChoice value={payment} onChange={setPayment} quote={priced} disabled={busy} />
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Title order={4}>Summary</Title>
                <CouponBox
                  applied={coupon}
                  quote={priced}
                  onApply={setCoupon}
                  onRemove={() => setCoupon(null)}
                  disabled={busy || !address}
                />
                <Group justify="space-between">
                  <Text>Items ({itemCount(lines)})</Text>
                  <Text>{formatMoney(priced?.itemsTotal ?? cartTotal(lines))}</Text>
                </Group>
                {priced && priced.discount > 0 && (
                  <Group justify="space-between">
                    <Text>Coupon {priced.couponCode}</Text>
                    <Text c="green">− {formatMoney(priced.discount)}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text>Delivery</Text>
                  <Text c="green">Free</Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text fw={700}>{payment === 'COD' ? 'To pay on delivery' : 'Total'} (incl. GST)</Text>
                  <Text fw={700} size="lg" aria-label="Order total">
                    {formatMoney(orderTotal)}
                  </Text>
                </Group>
                {fromWallet > 0 && (
                  <>
                    <Group justify="space-between">
                      <Text>From wallet</Text>
                      <Text c="green">− {formatMoney(fromWallet)}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text fw={600}>To pay online</Text>
                      <Text fw={600} aria-label="To pay online">
                        {formatMoney(online)}
                      </Text>
                    </Group>
                  </>
                )}
                <Text size="xs" c="dimmed">
                  {priced
                    ? `Includes ${formatMoney(priced.taxTotal)} GST (${
                        priced.igstTotal > 0 ? 'IGST' : 'CGST + SGST'
                      }), worked out on the price after any discount.`
                    : 'The GST split (CGST + SGST, or IGST) depends on the delivery state and is shown on your order and invoice.'}
                </Text>
                {priced?.shipsFrom && (
                  <Text size="xs" c="dimmed">
                    Ships from our {priced.shipsFrom.name}.
                  </Text>
                )}
                {splitNeeded && (
                  <Alert color="orange" icon={<IconAlertTriangle size={18} />} p="xs" title="Order these separately">
                    {priced?.shippingProblem}
                  </Alert>
                )}
                {codRefused && (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />} p="xs">
                    Choose Pay online to place this order.
                  </Alert>
                )}
                {unavailable.size > 0 && (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />} p="xs">
                    Remove the items that can no longer be ordered.
                  </Alert>
                )}
                <Button size="md" onClick={() => void submit()} disabled={!canCheckout} loading={busy}>
                  Place order
                </Button>
                {!address && (
                  <Text size="xs" c="dimmed" ta="center">
                    Add a delivery address to place the order.
                  </Text>
                )}
                {payment === 'PREPAID' && online > 0 && (
                  <Text size="xs" c="dimmed" ta="center">
                    Payments run in test mode: no real money is charged.
                  </Text>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function isDuplicate(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    !!error.body &&
    typeof error.body === 'object' &&
    'status' in error.body &&
    error.body.status === 'DUPLICATE'
  )
}

// The signature is only a dependency: a new reference is made whenever the cart or address changes
function newReference(_signature: string): string {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `WEB-${id}`
}
