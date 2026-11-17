import { zodResolver } from '@hookform/resolvers/zod'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Grid,
  Group,
  NumberInput,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import type { MovementType, PriceView, ProductView } from '../../api/adminTypes'
import {
  DESCRIPTION_MAX,
  editProductSchema,
  GST_OPTIONS,
  priceChangeSchema,
  stockChangeSchema,
  toServerDateTime,
  type EditProductValues,
  type PriceChangeValues,
  type StockChangeValues,
} from '../../admin/catalogSchema'
import {
  useAdminCategories,
  useCancelScheduledPrice,
  useChangePrice,
  useChangeStock,
  useEditProduct,
  useMovements,
  useProduct,
} from '../../admin/queries'
import { QueryState } from '../../components/QueryState'
import { ApiError } from '../../api/client'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatMoney, formatRate } from '../../lib/format'
import { categoryOptions } from '../../lib/images'
import { shortOrderId } from '../../lib/orderStatus'
import { ProductPhotos } from './ProductPhotos'
import { ProductSpecs } from './ProductSpecs'

export function ProductPage() {
  const { sku = '' } = useParams()
  const detail = useProduct(sku)
  return (
    <Stack gap="md">
      <Anchor component={Link} to="/admin/catalog" size="sm">
        ← Catalogue
      </Anchor>
      <QueryState query={detail}>
        {(data) => (
          <Stack gap="md">
            <Header product={data.product} />
            <Grid gap="md">
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <Stack gap="md">
                  {/* Remounted when the product changes, so the form shows what the server holds */}
                  <DetailsForm key={`d-${data.product.version}`} product={data.product} />
                  <ProductPhotos sku={data.product.sku} name={data.product.name} photos={data.images} />
                  <ProductSpecs
                    key={`s-${data.specs.map((s) => s.name + s.value).join('|')}`}
                    sku={data.product.sku}
                    specs={data.specs}
                    suggested={data.suggestedSpecs}
                  />
                  <StockForm product={data.product} />
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <Stack gap="md">
                  <PriceForm key={`p-${data.product.version}`} product={data.product} />
                  <PriceHistory sku={data.product.sku} prices={data.prices} />
                </Stack>
              </Grid.Col>
            </Grid>
            <Movements sku={data.product.sku} />
          </Stack>
        )}
      </QueryState>
    </Stack>
  )
}

function Header({ product }: { product: ProductView }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <div>
        <Group gap="sm">
          <Title order={2}>{product.name}</Title>
          {!product.active && (
            <Badge color="gray" variant="light">
              Off sale
            </Badge>
          )}
          {product.lowStock && (
            <Badge color="orange" variant="light">
              Low stock
            </Badge>
          )}
        </Group>
        <Text c="dimmed" size="sm">
          {product.sku} · last changed {formatDateTime(product.updatedAt)}
          {product.updatedBy && <> by {product.updatedBy}</>}
        </Text>
      </div>
      <Group gap="xl">
        <Figure label="Price (incl. GST)" value={formatMoney(product.unitPrice, product.currency)} />
        <Figure label="GST" value={formatRate(product.gstRate)} />
        <Figure label="Available" value={String(product.available)} />
        <Figure label="Reserved" value={String(product.reserved)} />
      </Group>
    </Group>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </div>
  )
}

/** A 409 means another admin saved first; say so plainly. */
function saveError(title: string, error: unknown) {
  const stale = error instanceof ApiError && error.status === 409
  notifications.show({
    color: 'red',
    title: stale ? 'Changed by someone else' : title,
    message: stale ? `${errorMessage(error)} The page now shows their version.` : errorMessage(error),
  })
}

function DetailsForm({ product }: { product: ProductView }) {
  const edit = useEditProduct(product.sku)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditProductValues>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      name: product.name,
      hsnCode: product.hsnCode ?? '',
      reorderLevel: product.reorderLevel,
      active: product.active,
      categoryId: product.categoryId ? String(product.categoryId) : '',
      description: product.description ?? '',
      brand: product.brand ?? '',
      maxPerOrder: product.maxPerOrder ?? undefined,
    },
  })
  const categories = useAdminCategories()
  const description = useWatch({ control, name: 'description' })

  const submit = handleSubmit(({ categoryId, description: text, maxPerOrder, ...values }) =>
    edit.mutate(
      {
        expectedVersion: product.version,
        ...values,
        // 0 takes it out of its category; "" removes the description; 0 removes the limit
        categoryId: categoryId ? Number(categoryId) : 0,
        description: text,
        maxPerOrder: maxPerOrder ?? 0,
      },
      {
        onSuccess: () => notifications.show({ color: 'green', title: 'Saved', message: product.sku }),
        onError: (error) => saveError('Not saved', error),
      },
    ),
  )

  return (
    <Paper withBorder radius="md" p="md">
      <form onSubmit={submit} noValidate>
        <Stack gap="sm">
          <Title order={4}>Details</Title>
          <TextInput label="Name" withAsterisk error={errors.name?.message} {...register('name')} />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="Brand" error={errors.brand?.message} {...register('brand')} />
            <Controller
              control={control}
              name="maxPerOrder"
              render={({ field }) => (
                <NumberInput
                  label="Most per order"
                  description="Empty: no limit"
                  min={1}
                  max={1000}
                  allowDecimal={false}
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                  error={errors.maxPerOrder?.message}
                />
              )}
            />
          </SimpleGrid>
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="HSN code" withAsterisk error={errors.hsnCode?.message} {...register('hsnCode')} />
            <Controller
              control={control}
              name="reorderLevel"
              render={({ field }) => (
                <NumberInput
                  label="Reorder level"
                  min={0}
                  allowDecimal={false}
                  value={field.value}
                  onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)}
                  error={errors.reorderLevel?.message}
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <Select
                label="Category"
                placeholder={categories.data?.length ? 'No category' : 'No categories yet: add them under Categories'}
                data={categoryOptions(categories.data ?? [])}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? '')}
                clearable
                searchable
              />
            )}
          />
          <Textarea
            label="Description"
            description={`Shown on the product page. Plain text; leave a blank line between paragraphs. ${description.length}/${DESCRIPTION_MAX}`}
            autosize
            minRows={4}
            maxRows={14}
            error={errors.description?.message}
            {...register('description')}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                label="On sale in the shop"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Group justify="flex-end">
            <Button type="submit" disabled={!isDirty} loading={edit.isPending}>
              Save details
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}

function PriceForm({ product }: { product: ProductView }) {
  const change = useChangePrice(product.sku)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PriceChangeValues>({
    resolver: zodResolver(priceChangeSchema),
    defaultValues: {
      unitPrice: product.unitPrice ?? undefined,
      gstRate: String(product.gstRate),
      when: 'now',
      effectiveFrom: '',
      reason: '',
    },
  })
  const when = useWatch({ control, name: 'when' })

  const submit = handleSubmit((values) =>
    change.mutate(
      {
        expectedVersion: product.version,
        unitPrice: values.unitPrice,
        gstRate: Number(values.gstRate),
        effectiveFrom: values.when === 'later' ? toServerDateTime(values.effectiveFrom) : undefined,
        reason: values.reason || undefined,
      },
      {
        onSuccess: (result) => {
          notifications.show({
            color: 'green',
            title: result.price.state === 'SCHEDULED' ? 'Price scheduled' : 'Price changed',
            message:
              result.price.state === 'SCHEDULED'
                ? `${formatMoney(result.price.unitPrice)} from ${formatDateTime(result.price.effectiveFrom)}`
                : `${formatMoney(result.price.unitPrice)} from now on`,
          })
          reset({ ...values, reason: '' })
        },
        onError: (error) => saveError('Price not changed', error),
      },
    ),
  )

  return (
    <Paper withBorder radius="md" p="md">
      <form onSubmit={submit} noValidate>
        <Stack gap="sm">
          <Title order={4}>Change price</Title>
          <SimpleGrid cols={2} spacing="sm">
            <Controller
              control={control}
              name="unitPrice"
              render={({ field }) => (
                <NumberInput
                  label="Price including GST"
                  withAsterisk
                  prefix="₹"
                  decimalScale={2}
                  thousandSeparator=","
                  min={0}
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                  error={errors.unitPrice?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gstRate"
              render={({ field }) => (
                <Select
                  label="GST rate"
                  data={GST_OPTIONS}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? '')}
                  allowDeselect={false}
                  error={errors.gstRate?.message}
                  disabled={product.gstRule === 'APPAREL_2500'}
                  description={product.gstRule === 'APPAREL_2500' ? 'Set by the price: 5% up to ₹2,625, 18% above' : undefined}
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="when"
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={field.onChange}
                data={[
                  { value: 'now', label: 'From now' },
                  { value: 'later', label: 'From a later time' },
                ]}
              />
            )}
          />
          {when === 'later' && (
            <TextInput
              type="datetime-local"
              label="Takes effect at (IST)"
              withAsterisk
              error={errors.effectiveFrom?.message}
              {...register('effectiveFrom')}
            />
          )}
          <TextInput label="Reason" placeholder="e.g. Supplier price rise" {...register('reason')} />
          <Text size="xs" c="dimmed">
            Orders already placed keep the price they were charged.
          </Text>
          <Group justify="flex-end">
            <Button type="submit" loading={change.isPending}>
              {when === 'later' ? 'Schedule price' : 'Change price'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}

const PRICE_STATE_COLOR = { SCHEDULED: 'blue', APPLIED: 'green', CANCELLED: 'gray' } as const

function PriceHistory({ sku, prices }: { sku: string; prices: PriceView[] }) {
  const cancel = useCancelScheduledPrice(sku)
  const confirmCancel = (price: PriceView) =>
    modals.openConfirmModal({
      title: 'Cancel the scheduled price?',
      children: (
        <Text size="sm">
          {formatMoney(price.unitPrice)} from {formatDateTime(price.effectiveFrom)} will not take effect.
        </Text>
      ),
      labels: { confirm: 'Cancel price', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        cancel.mutate(price.id, {
          onError: (error) => notifications.show({ color: 'red', title: 'Not cancelled', message: errorMessage(error) }),
        }),
    })

  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="sm">
        Price history
      </Title>
      {prices.length === 0 ? (
        <Text size="sm" c="dimmed">
          No price changes yet.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={460}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>From</Table.Th>
                <Table.Th ta="right">Price</Table.Th>
                <Table.Th ta="right">GST</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {prices.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Text size="sm">{formatDateTime(p.effectiveFrom)}</Text>
                    <Text size="xs" c="dimmed">
                      {[p.reason, p.createdBy].filter(Boolean).join(' · ')}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{formatMoney(p.unitPrice)}</Table.Td>
                  <Table.Td ta="right">{formatRate(p.gstRate)}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={PRICE_STATE_COLOR[p.state]}>
                      {p.state.toLowerCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {p.state === 'SCHEDULED' && (
                      <Tooltip label="Cancel this scheduled price">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Cancel the price from ${formatDateTime(p.effectiveFrom)}`}
                          onClick={() => confirmCancel(p)}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  )
}

const STOCK_TYPES = [
  { value: 'RECEIPT', label: 'Goods received' },
  { value: 'ADJUSTMENT', label: 'Stock count correction' },
  { value: 'WRITE_OFF', label: 'Write-off (damaged, lost)' },
]

function StockForm({ product }: { product: ProductView }) {
  const change = useChangeStock(product.sku)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StockChangeValues>({
    resolver: zodResolver(stockChangeSchema),
    defaultValues: { type: 'RECEIPT', quantity: undefined, reason: '' },
  })
  const type = useWatch({ control, name: 'type' })

  const submit = handleSubmit((values) =>
    change.mutate(
      { type: values.type, quantity: values.quantity, reason: values.reason || undefined },
      {
        onSuccess: (movement) => {
          notifications.show({
            color: 'green',
            title: 'Stock updated',
            message: `${signed(movement.availableChange)} units · ${movement.availableAfter} available now`,
          })
          reset({ type: values.type, quantity: undefined, reason: '' })
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Stock not changed', message: errorMessage(error) }),
      },
    ),
  )

  return (
    <Paper withBorder radius="md" p="md">
      <form onSubmit={submit} noValidate>
        <Stack gap="sm">
          <Title order={4}>Change stock</Title>
          <SimpleGrid cols={2} spacing="sm">
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  label="What happened"
                  data={STOCK_TYPES}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 'RECEIPT')}
                  allowDeselect={false}
                />
              )}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  label={type === 'ADJUSTMENT' ? 'Change (+ or −)' : 'Units'}
                  withAsterisk
                  allowDecimal={false}
                  allowNegative={type === 'ADJUSTMENT'}
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                  error={errors.quantity?.message}
                />
              )}
            />
          </SimpleGrid>
          <TextInput
            label="Reason"
            withAsterisk={type !== 'RECEIPT'}
            placeholder={type === 'RECEIPT' ? 'e.g. Supplier invoice no.' : 'e.g. Cycle count on 8 Nov'}
            error={errors.reason?.message}
            {...register('reason')}
          />
          {type === 'WRITE_OFF' && product.available === 0 && (
            <Alert color="yellow" icon={<IconInfoCircle size={18} />} p="xs">
              Nothing is available to write off.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" loading={change.isPending}>
              Record
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}

const MOVEMENT_LABEL: Record<MovementType, string> = {
  OPENING: 'Opening stock',
  RECEIPT: 'Received',
  ADJUSTMENT: 'Correction',
  WRITE_OFF: 'Written off',
  RESERVE: 'Reserved for order',
  RELEASE: 'Released',
  SHIP: 'Shipped',
  RETURN: 'Returned',
}

function Movements({ sku }: { sku: string }) {
  const [page, setPage] = useState(1)
  const movements = useMovements(sku, page - 1)
  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb={4}>
        Stock history
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        Every change to this product’s stock, newest first. Rows are never edited or removed.
      </Text>
      <QueryState query={movements}>
        {(result) => (
          <Stack gap="sm">
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="xs" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>What</Table.Th>
                    <Table.Th ta="right">Available</Table.Th>
                    <Table.Th ta="right">Reserved</Table.Th>
                    <Table.Th>Order / reason</Table.Th>
                    <Table.Th>By</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {result.items.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Text size="xs">{formatDateTime(m.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>{MOVEMENT_LABEL[m.type] ?? m.type}</Table.Td>
                      <Table.Td ta="right">
                        <Change value={m.availableChange} /> → {m.availableAfter}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Change value={m.reservedChange} /> → {m.reservedAfter}
                      </Table.Td>
                      <Table.Td>
                        {m.orderId && (
                          <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(m.orderId)}`} size="sm">
                            {shortOrderId(m.orderId)}
                          </Anchor>
                        )}
                        {m.reason && <Text size="xs">{m.reason}</Text>}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{m.createdBy ?? '—'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {result.totalPages > 1 && (
              <Pagination total={result.totalPages} value={page} onChange={setPage} size="sm" />
            )}
          </Stack>
        )}
      </QueryState>
    </Paper>
  )
}

function Change({ value }: { value: number }) {
  if (value === 0) return <Text span size="sm" c="dimmed">0</Text>
  return (
    <Text span size="sm" fw={600}>
      {signed(value)}
    </Text>
  )
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`
}
