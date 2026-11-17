import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconPencil, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import {
  useChangeCoupon,
  useCoupons,
  useCreateCoupon,
  type Coupon,
  type CouponChange,
  type NewCoupon,
} from '../../checkout/queries'
import { ProductMultiPicker, type PickedProduct } from '../../admin/ProductPicker'
import { useAdminCategories } from '../../admin/queries'
import { categoryOptions } from '../../lib/images'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatMoney } from '../../lib/format'

function discountText(c: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'>) {
  return c.discountType === 'PERCENT'
    ? `${c.discountValue}% off${c.maxDiscount ? `, up to ${formatMoney(c.maxDiscount)}` : ''}`
    : `${formatMoney(c.discountValue)} off`
}

function validity(c: Coupon) {
  const now = Date.now()
  if (!c.active) return { label: 'Off', color: 'gray' }
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { label: 'Expired', color: 'gray' }
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', color: 'blue' }
  if (c.usageLimit !== null && c.used >= c.usageLimit) return { label: 'Used up', color: 'orange' }
  return { label: 'Live', color: 'green' }
}

/**
 * Coupons customers type at checkout. The discount comes off the price before GST, shared across the
 * order's lines. A use counts while the order is live; a cancelled or failed order gives it back.
 */
export function CouponsPage() {
  const coupons = useCoupons()
  const change = useChangeCoupon()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  return (
    <Stack gap="md" maw={1100}>
      <Group justify="space-between">
        <Title order={2}>Coupons</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          New coupon
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        The discount is taken off the price including GST and GST is worked out on what is left, as the invoice
        shows. Uses given back by cancelled orders count again.
      </Text>
      <Paper withBorder radius="md" p="md">
        <QueryState query={coupons}>
          {(list) =>
            list.length === 0 ? (
              <Text c="dimmed">No coupons yet.</Text>
            ) : (
              <Table.ScrollContainer minWidth={820}>
                <Table verticalSpacing="sm" aria-label="Coupons">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Discount</Table.Th>
                      <Table.Th>Conditions</Table.Th>
                      <Table.Th>Used</Table.Th>
                      <Table.Th>Valid</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>On</Table.Th>
                      <Table.Th aria-label="Actions" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.map((c) => {
                      const state = validity(c)
                      return (
                        <Table.Tr key={c.code}>
                          <Table.Td>
                            <Text fw={600} ff="monospace">
                              {c.code}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {c.description}
                            </Text>
                          </Table.Td>
                          <Table.Td>{discountText(c)}</Table.Td>
                          <Table.Td>
                            {c.appliesTo.length > 0 && (
                              <Text size="xs" fw={600}>
                                On {c.appliesTo.map((t) => t.name).join(', ')}
                              </Text>
                            )}
                            <Text size="xs">
                              {c.minOrderValue > 0
                                ? `${c.appliesTo.length > 0 ? 'From' : 'Orders from'} ${formatMoney(c.minOrderValue)}`
                                : c.appliesTo.length > 0
                                  ? 'Any amount'
                                  : 'Any order'}
                              {c.firstOrderOnly ? ' · first order only' : ''}
                              {` · ${c.perCustomerLimit} per customer`}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {c.used}
                            {c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">
                              {c.startsAt ? `From ${formatDateTime(c.startsAt)}` : 'From now'}
                              <br />
                              {c.endsAt ? `Until ${formatDateTime(c.endsAt)}` : 'No end'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={state.color} variant="light">
                              {state.label}
                            </Badge>
                            {c.updatedAt && (
                              <Text size="xs" c="dimmed" mt={4}>
                                Changed{c.updatedBy ? ` by ${c.updatedBy}` : ''}, {formatDateTime(c.updatedAt)}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Switch
                              checked={c.active}
                              aria-label={`${c.code} on`}
                              onChange={(e) =>
                                change.mutate(
                                  { code: c.code, active: e.currentTarget.checked },
                                  {
                                    onError: (err) =>
                                      notifications.show({ color: 'red', title: 'Not changed', message: errorMessage(err) }),
                                  },
                                )
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon variant="subtle" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )
          }
        </QueryState>
      </Paper>
      <Modal opened={creating} onClose={() => setCreating(false)} title="New coupon" size="lg">
        {creating && <NewCouponForm onDone={() => setCreating(false)} />}
      </Modal>
      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={`Change ${editing?.code ?? ''}`} size="lg">
        {editing && <EditCouponForm coupon={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Stack>
  )
}

function NewCouponForm({ onDone }: { onDone: () => void }) {
  const create = useCreateCoupon()
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FLAT',
    discountValue: 10 as number | string,
    maxDiscount: '' as number | string,
    minOrderValue: 0 as number | string,
    startsAt: '',
    endsAt: '',
    usageLimit: '' as number | string,
    perCustomerLimit: 1 as number | string,
    firstOrderOnly: false,
    scope: 'ORDER' as Scope,
    products: [] as PickedProduct[],
    categoryIds: [] as string[],
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const num = (v: number | string) => (v === '' ? null : Number(v))

  const submit = () => {
    const coupon: NewCoupon = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscount: form.discountType === 'PERCENT' ? num(form.maxDiscount) : null,
      minOrderValue: Number(form.minOrderValue || 0),
      // datetime-local values are the admin's local time, sent as such
      startsAt: form.startsAt ? `${form.startsAt}:00` : null,
      endsAt: form.endsAt ? `${form.endsAt}:00` : null,
      usageLimit: num(form.usageLimit),
      perCustomerLimit: Number(form.perCustomerLimit || 1),
      firstOrderOnly: form.firstOrderOnly,
      skus: form.scope === 'PRODUCTS' ? form.products.map((p) => p.sku) : [],
      categoryIds: form.scope === 'PRODUCTS' ? form.categoryIds.map(Number) : [],
    }
    if (form.scope === 'PRODUCTS' && coupon.skus.length + coupon.categoryIds.length === 0) {
      notifications.show({ color: 'red', title: 'Not created', message: 'Choose the products or categories it is for' })
      return
    }
    create.mutate(coupon, {
      onSuccess: (c) => {
        notifications.show({ color: 'green', message: `${c.code} created` })
        onDone()
      },
      onError: (e) => notifications.show({ color: 'red', title: 'Not created', message: errorMessage(e) }),
    })
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="Code"
          description="Letters and digits, e.g. DIWALI25"
          value={form.code}
          onChange={(e) => set('code', e.currentTarget.value.toUpperCase())}
          maxLength={30}
          required
        />
        <TextInput
          label="Shown to customers"
          placeholder="15% off orders of ₹4,999 or more"
          value={form.description}
          onChange={(e) => set('description', e.currentTarget.value)}
          maxLength={200}
          required
        />
      </SimpleGrid>
      <SegmentedControl
        value={form.discountType}
        onChange={(v) => set('discountType', v as 'PERCENT' | 'FLAT')}
        data={[
          { value: 'PERCENT', label: 'Percent off' },
          { value: 'FLAT', label: 'Amount off' },
        ]}
        aria-label="Discount type"
        w="fit-content"
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <NumberInput
          label={form.discountType === 'PERCENT' ? 'Percent' : 'Amount (₹)'}
          value={form.discountValue}
          onChange={(v) => set('discountValue', v)}
          min={1}
          max={form.discountType === 'PERCENT' ? 90 : undefined}
          required
        />
        {form.discountType === 'PERCENT' && (
          <NumberInput
            label="At most (₹)"
            description="Empty: no cap"
            value={form.maxDiscount}
            onChange={(v) => set('maxDiscount', v)}
            min={1}
          />
        )}
        <NumberInput
          label="Minimum order (₹)"
          value={form.minOrderValue}
          onChange={(v) => set('minOrderValue', v)}
          min={0}
        />
      </SimpleGrid>
      <AppliesToFields
        value={{ scope: form.scope, products: form.products, categoryIds: form.categoryIds }}
        onChange={(v) => setForm((f) => ({ ...f, ...v }))}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput type="datetime-local" label="Starts" value={form.startsAt} onChange={(e) => set('startsAt', e.currentTarget.value)} />
        <TextInput type="datetime-local" label="Ends" value={form.endsAt} onChange={(e) => set('endsAt', e.currentTarget.value)} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput
          label="Uses in all"
          description="Empty: no limit"
          value={form.usageLimit}
          onChange={(v) => set('usageLimit', v)}
          min={1}
        />
        <NumberInput
          label="Uses per customer"
          value={form.perCustomerLimit}
          onChange={(v) => set('perCustomerLimit', v)}
          min={1}
        />
      </SimpleGrid>
      <Checkbox
        label="First order only"
        checked={form.firstOrderOnly}
        onChange={(e) => set('firstOrderOnly', e.currentTarget.checked)}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={create.isPending}>
          Create coupon
        </Button>
      </Group>
    </Stack>
  )
}

type Scope = 'ORDER' | 'PRODUCTS'

interface AppliesTo {
  scope: Scope
  products: PickedProduct[]
  /** As the MultiSelect holds them */
  categoryIds: string[]
}

/** Whole order, or chosen categories and products; shared by the new and change forms. */
function AppliesToFields({
  value,
  onChange,
  extraCategories = [],
}: {
  value: AppliesTo
  onChange: (value: AppliesTo) => void
  /** Categories the coupon is already for that are no longer listed (switched off), so they still show */
  extraCategories?: Array<{ value: string; label: string }>
}) {
  const categories = useAdminCategories()
  const listed = categoryOptions((categories.data ?? []).filter((c) => c.active)).filter((o) => !o.label.endsWith('(off)'))
  const categoryData = [...listed, ...extraCategories.filter((e) => !listed.some((o) => o.value === e.value))]
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Applies to
      </Text>
      <SegmentedControl
        value={value.scope}
        onChange={(v) => onChange({ ...value, scope: v as Scope })}
        data={[
          { value: 'ORDER', label: 'Whole order' },
          { value: 'PRODUCTS', label: 'Chosen products' },
        ]}
        aria-label="Applies to"
        w="fit-content"
      />
      {value.scope === 'PRODUCTS' && (
        <>
          <MultiSelect
            label="Categories"
            description="A main category includes its sub-categories"
            data={categoryData}
            value={value.categoryIds}
            onChange={(v) => onChange({ ...value, categoryIds: v })}
            searchable
            clearable
          />
          <ProductMultiPicker
            label="Products"
            description="The discount and the minimum count only these products and categories"
            value={value.products}
            onChange={(v) => onChange({ ...value, products: v })}
          />
        </>
      )}
    </Stack>
  )
}

/** What the coupon is for now, in the form's terms. */
function appliesToOf(coupon: Coupon): AppliesTo {
  return {
    scope: coupon.appliesTo.length > 0 ? 'PRODUCTS' : 'ORDER',
    products: coupon.appliesTo.flatMap((t) => (t.sku ? [{ sku: t.sku, name: t.name }] : [])),
    categoryIds: coupon.appliesTo.flatMap((t) => (t.categoryId !== null ? [String(t.categoryId)] : [])),
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x))

/** datetime-local holds minutes: 2026-11-27T10:00 */
const toLocalInput = (value: string | null) => (value ? value.slice(0, 16) : '')

/**
 * Changes what can change once customers know a coupon: what it is for, when it ends, and whether
 * it is on. Orders already placed keep the discount they got; carts are priced by the new terms.
 */
function EditCouponForm({ coupon, onDone }: { coupon: Coupon; onDone: () => void }) {
  const change = useChangeCoupon()
  const before = appliesToOf(coupon)
  const [target, setTarget] = useState<AppliesTo>(before)
  const [endsAt, setEndsAt] = useState(toLocalInput(coupon.endsAt))
  const [active, setActive] = useState(coupon.active)
  const extraCategories = coupon.appliesTo.flatMap((t) =>
    t.categoryId !== null ? [{ value: String(t.categoryId), label: t.name }] : [],
  )

  const targetChanged =
    target.scope !== before.scope ||
    (target.scope === 'PRODUCTS' &&
      (!sameSet(target.categoryIds, before.categoryIds) ||
        !sameSet(
          target.products.map((p) => p.sku),
          before.products.map((p) => p.sku),
        )))
  const endChanged = endsAt !== toLocalInput(coupon.endsAt)
  const nothingChanged = !targetChanged && !endChanged && active === coupon.active

  const submit = () => {
    const request: CouponChange = { code: coupon.code }
    if (targetChanged) {
      request.skus = target.scope === 'PRODUCTS' ? target.products.map((p) => p.sku) : []
      request.categoryIds = target.scope === 'PRODUCTS' ? target.categoryIds.map(Number) : []
      if (target.scope === 'PRODUCTS' && request.skus.length + request.categoryIds.length === 0) {
        notifications.show({ color: 'red', title: 'Not changed', message: 'Choose the products or categories it is for' })
        return
      }
    }
    if (endChanged) {
      if (endsAt) request.endsAt = `${endsAt}:00`
      else request.clearEndsAt = true
    }
    if (active !== coupon.active) request.active = active
    change.mutate(request, {
      onSuccess: (c) => {
        notifications.show({ color: 'green', message: `${c.code} changed` })
        onDone()
      },
      onError: (e) => notifications.show({ color: 'red', title: 'Not changed', message: errorMessage(e) }),
    })
  }

  return (
    <Stack gap="sm">
      <Paper withBorder radius="sm" p="sm" bg="var(--mantine-color-default-hover)" aria-label="Terms customers were told">
        <Text size="sm" fw={600}>
          {coupon.description}
        </Text>
        <Text size="xs" c="dimmed">
          {discountText(coupon)}
          {coupon.minOrderValue > 0 ? ` · from ${formatMoney(coupon.minOrderValue)}` : ''}
          {coupon.firstOrderOnly ? ' · first order only' : ''}
          {` · ${coupon.perCustomerLimit} per customer`}
          {coupon.usageLimit !== null ? ` · ${coupon.usageLimit} in all` : ''}
        </Text>
        <Text size="xs" c="dimmed" mt={4}>
          The code, discount and limits stay as they are: customers have been told them. For other terms, switch
          this one off and create a new coupon.
        </Text>
      </Paper>
      <AppliesToFields value={target} onChange={setTarget} extraCategories={extraCategories} />
      {target.scope !== before.scope && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />} title="Every cart with this code is repriced">
          {target.scope === 'ORDER'
            ? 'It will take money off the whole order, not just the chosen products.'
            : 'It will take money off only the chosen products; carts without them lose the discount.'}{' '}
          Orders already placed keep what they got.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          type="datetime-local"
          label="Ends"
          description={endsAt ? 'Clear it to let the coupon run until switched off' : 'No end: runs until switched off'}
          value={endsAt}
          onChange={(e) => setEndsAt(e.currentTarget.value)}
        />
        <Switch
          label="On"
          description="Off: no one can use it"
          checked={active}
          onChange={(e) => setActive(e.currentTarget.checked)}
          mt={{ sm: 'lg' }}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={change.isPending} disabled={nothingChanged}>
          Save changes
        </Button>
      </Group>
    </Stack>
  )
}
