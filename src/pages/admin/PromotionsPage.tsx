import {
  ActionIcon,
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconPhoto, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { ProductSelect, type PickedProduct } from '../../admin/ProductPicker'
import { useAdminCategories } from '../../admin/queries'
import { useCoupons } from '../../checkout/queries'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { categoryOptions, imageUrl } from '../../lib/images'
import { BannerSlide } from '../../promotions/PromoCarousel'
import {
  useDeletePromotion,
  usePromotionImage,
  usePromotions,
  useSavePromotion,
  useSetPromotionActive,
  type Banner,
  type Promotion,
  type PromotionRequest,
  type PromotionStatus,
  type TargetType,
  type Theme,
} from '../../promotions/queries'

const STATUS: Record<PromotionStatus, { label: string; color: string }> = {
  LIVE: { label: 'Live', color: 'green' },
  SCHEDULED: { label: 'Scheduled', color: 'blue' },
  ENDED: { label: 'Ended', color: 'gray' },
  OFF: { label: 'Off', color: 'gray' },
  UNAVAILABLE: { label: 'Not shown', color: 'orange' },
}

const THEMES: Array<{ value: Theme; label: string }> = [
  { value: 'BLUE', label: 'Blue' },
  { value: 'GREEN', label: 'Green' },
  { value: 'ORANGE', label: 'Orange' },
  { value: 'GRAPE', label: 'Purple' },
  { value: 'RED', label: 'Red' },
  { value: 'DARK', label: 'Dark' },
]

function target(p: Promotion): string {
  switch (p.targetType) {
    case 'PRODUCT':
      return `Product: ${p.productName ?? p.sku}`
    case 'CATEGORY':
      return `Category: ${p.categoryName ?? p.categoryId}`
    case 'COUPON':
      return `Coupon: ${p.couponCode}`
  }
}

function clickRate(p: Promotion): string {
  return p.impressions === 0 ? '—' : `${((p.clicks / p.impressions) * 100).toFixed(1)}%`
}

/**
 * Promotions: the banners at the top of the shop. A banner opens a product, a category, or the products
 * a coupon is for. It is taken down by itself when what it advertises can no longer be bought.
 */
export function PromotionsPage() {
  const promotions = usePromotions()
  const setActive = useSetPromotionActive()
  const remove = useDeletePromotion()
  // null: closed; 'new'; or the promotion being changed
  const [editing, setEditing] = useState<'new' | Promotion | null>(null)

  const confirmDelete = (p: Promotion) =>
    modals.openConfirmModal({
      title: `Delete “${p.title}”?`,
      children: <Text size="sm">The banner and its figures are removed. To stop it for now, switch it off instead.</Text>,
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(p.id, {
          onSuccess: () => notifications.show({ color: 'green', message: `“${p.title}” deleted` }),
          onError: (e) => notifications.show({ color: 'red', title: 'Not deleted', message: errorMessage(e) }),
        }),
    })

  return (
    <Stack gap="md" maw={1200}>
      <Group justify="space-between">
        <Title order={2}>Promotions</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          New promotion
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Banners at the top of the shop, highest priority first (at most 8 at once). A banner for a coupon opens the
        products the coupon is for. Banners whose product is off sale, whose category is hidden or whose coupon has
        ended are not shown.
      </Text>
      <Paper withBorder radius="md" p="md">
        <QueryState query={promotions}>
          {(list) =>
            list.length === 0 ? (
              <Text c="dimmed">No promotions yet.</Text>
            ) : (
              <Table.ScrollContainer minWidth={980}>
                <Table verticalSpacing="sm" aria-label="Promotions">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Banner</Table.Th>
                      <Table.Th>Opens</Table.Th>
                      <Table.Th>When</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th ta="right">Views</Table.Th>
                      <Table.Th ta="right">Clicks</Table.Th>
                      <Table.Th ta="right">Click rate</Table.Th>
                      <Table.Th>On</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.map((p) => {
                      const status = STATUS[p.status]
                      return (
                        <Table.Tr key={p.id}>
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <Thumb promotion={p} />
                              <div>
                                <Text fw={600} size="sm">
                                  {p.title}
                                </Text>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {p.message ?? ' '}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Priority {p.priority}
                                </Text>
                              </div>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{target(p)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">
                              {p.startsAt ? `From ${formatDateTime(p.startsAt)}` : 'From now'}
                              <br />
                              {p.endsAt ? `Until ${formatDateTime(p.endsAt)}` : 'No end'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label={p.unavailableReason} disabled={!p.unavailableReason} withArrow>
                              <Badge color={status.color} variant="light">
                                {status.label}
                              </Badge>
                            </Tooltip>
                            {p.unavailableReason && (
                              <Text size="xs" c="dimmed" maw={160}>
                                {p.unavailableReason}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="right">{p.impressions.toLocaleString('en-IN')}</Table.Td>
                          <Table.Td ta="right">{p.clicks.toLocaleString('en-IN')}</Table.Td>
                          <Table.Td ta="right">{clickRate(p)}</Table.Td>
                          <Table.Td>
                            <Switch
                              checked={p.active}
                              aria-label={`${p.title} on`}
                              onChange={(e) =>
                                setActive.mutate(
                                  { id: p.id, active: e.currentTarget.checked },
                                  {
                                    onError: (err) =>
                                      notifications.show({ color: 'red', title: 'Not changed', message: errorMessage(err) }),
                                  },
                                )
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap="nowrap">
                              <ActionIcon variant="subtle" aria-label={`Edit ${p.title}`} onClick={() => setEditing(p)}>
                                <IconEdit size={16} />
                              </ActionIcon>
                              <ActionIcon variant="subtle" color="red" aria-label={`Delete ${p.title}`} onClick={() => confirmDelete(p)}>
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
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
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New promotion' : 'Change promotion'}
        size="xl"
      >
        {editing !== null && (
          <PromotionForm
            key={editing === 'new' ? 'new' : editing.id}
            promotion={editing === 'new' ? null : editing}
            onSaved={(saved, created) => (created ? setEditing(saved) : setEditing(null))}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </Stack>
  )
}

function Thumb({ promotion }: { promotion: Promotion }) {
  const src = imageUrl(promotion.imageKey)
  return src ? (
    <img src={src} alt="" width={96} height={32} style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
  ) : (
    <div
      aria-hidden
      style={{
        width: 96,
        height: 32,
        borderRadius: 4,
        flexShrink: 0,
        background: `var(--mantine-color-${THEME_COLOURS[promotion.theme]}-7)`,
      }}
    />
  )
}

const THEME_COLOURS: Record<Theme, string> = { BLUE: 'blue', GREEN: 'green', ORANGE: 'orange', GRAPE: 'grape', RED: 'red', DARK: 'dark' }

/** datetime-local wants "2026-11-16T10:30"; the server sends seconds too. */
function toLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : ''
}

function PromotionForm({
  promotion,
  onSaved,
  onCancel,
}: {
  promotion: Promotion | null
  /** created: it was new, so the form stays open for a picture */
  onSaved: (saved: Promotion, created: boolean) => void
  onCancel: () => void
}) {
  const save = useSavePromotion()
  const image = usePromotionImage()
  // The list refreshes after a picture changes; the form shows that, not the copy it opened with
  const current = usePromotions().data?.find((p) => p.id === promotion?.id) ?? promotion
  const categories = useAdminCategories()
  const coupons = useCoupons()
  const [form, setForm] = useState({
    title: promotion?.title ?? '',
    message: promotion?.message ?? '',
    callToAction: promotion?.callToAction ?? '',
    theme: promotion?.theme ?? ('BLUE' as Theme),
    imageAlt: promotion?.imageAlt ?? '',
    targetType: promotion?.targetType ?? ('COUPON' as TargetType),
    product: promotion?.sku ? ({ sku: promotion.sku, name: promotion.productName ?? promotion.sku } as PickedProduct) : null,
    categoryId: promotion?.categoryId ? String(promotion.categoryId) : null,
    couponCode: promotion?.couponCode ?? null,
    startsAt: toLocalInput(promotion?.startsAt ?? null),
    endsAt: toLocalInput(promotion?.endsAt ?? null),
    priority: (promotion?.priority ?? 0) as number | string,
    active: promotion?.active ?? true,
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const categoryData = categoryOptions(categories.data ?? [])
  const couponData = (coupons.data ?? []).map((c) => ({
    value: c.code,
    label: `${c.code} · ${c.description}${c.active ? '' : ' (off)'}`,
  }))
  const chosenCoupon = coupons.data?.find((c) => c.code === form.couponCode)

  const request: PromotionRequest = {
    title: form.title.trim(),
    message: form.message.trim() || null,
    callToAction: form.callToAction.trim() || null,
    theme: form.theme,
    imageAlt: form.imageAlt.trim() || null,
    targetType: form.targetType,
    sku: form.targetType === 'PRODUCT' ? (form.product?.sku ?? null) : null,
    categoryId: form.targetType === 'CATEGORY' && form.categoryId ? Number(form.categoryId) : null,
    couponCode: form.targetType === 'COUPON' ? form.couponCode : null,
    startsAt: form.startsAt ? `${form.startsAt}:00` : null,
    endsAt: form.endsAt ? `${form.endsAt}:00` : null,
    priority: Number(form.priority || 0),
    active: form.active,
  }

  // What the shop would show, as it is typed
  const preview: Banner = {
    id: promotion?.id ?? 0,
    title: request.title || 'Your headline',
    message: request.message,
    callToAction: request.callToAction,
    theme: form.theme,
    imageKey: current?.imageKey ?? null,
    imageAlt: request.imageAlt,
    targetType: form.targetType,
    sku: request.sku,
    productName: form.product?.name ?? null,
    categorySlug: null,
    categoryName: categoryData.find((c) => c.value === form.categoryId)?.label.split(' › ').pop() ?? null,
    couponCode: request.couponCode,
    offer: chosenCoupon
      ? {
          code: chosenCoupon.code,
          description: chosenCoupon.description,
          discountType: chosenCoupon.discountType,
          discountValue: chosenCoupon.discountValue,
          maxDiscount: chosenCoupon.maxDiscount,
          minOrderValue: chosenCoupon.minOrderValue,
          endsAt: chosenCoupon.endsAt,
          firstOrderOnly: chosenCoupon.firstOrderOnly,
          targeted: chosenCoupon.appliesTo.length > 0,
        }
      : null,
    appliesTo: chosenCoupon?.appliesTo.map((t) => t.name) ?? [],
  }

  const submit = () =>
    save.mutate(
      { id: promotion?.id ?? null, request },
      {
        onSuccess: (saved) => {
          notifications.show({
            color: 'green',
            message: promotion ? 'Promotion saved' : 'Promotion created. Add a picture, or close to keep the coloured banner.',
          })
          onSaved(saved, promotion === null)
        },
        onError: (e) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(e) }),
      },
    )

  const upload = (file: File | null) => {
    if (!promotion) return
    image.mutate(
      { id: promotion.id, file },
      {
        onSuccess: () => notifications.show({ color: 'green', message: file ? 'Picture uploaded' : 'Picture removed' }),
        onError: (e) => notifications.show({ color: 'red', title: 'Picture not changed', message: errorMessage(e) }),
      },
    )
  }

  return (
    <Stack gap="sm">
      <div aria-label="Preview">
        <BannerSlide banner={preview} position="Preview" preview />
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label="Headline"
          placeholder="Diwali sale: 20% off lamps"
          value={form.title}
          onChange={(e) => set('title', e.currentTarget.value)}
          maxLength={80}
          required
        />
        <TextInput
          label="Button"
          placeholder="Shop now"
          value={form.callToAction}
          onChange={(e) => set('callToAction', e.currentTarget.value)}
          maxLength={30}
        />
      </SimpleGrid>
      <TextInput
        label="Message"
        placeholder="Brighten up your home this festive season"
        value={form.message}
        onChange={(e) => set('message', e.currentTarget.value)}
        maxLength={200}
      />

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Opens
        </Text>
        <SegmentedControl
          value={form.targetType}
          onChange={(v) => set('targetType', v as TargetType)}
          data={[
            { value: 'COUPON', label: 'A coupon’s products' },
            { value: 'PRODUCT', label: 'A product' },
            { value: 'CATEGORY', label: 'A category' },
          ]}
          aria-label="Opens"
          w="fit-content"
        />
      </Stack>
      {form.targetType === 'PRODUCT' && (
        <ProductSelect label="Product" value={form.product} onChange={(v) => set('product', v)} required />
      )}
      {form.targetType === 'CATEGORY' && (
        <Select
          label="Category"
          data={categoryData}
          value={form.categoryId}
          onChange={(v) => set('categoryId', v)}
          searchable
          required
        />
      )}
      {form.targetType === 'COUPON' && (
        <Select
          label="Coupon"
          description="Create coupons under Coupons; one for chosen products makes the banner open just those"
          data={couponData}
          value={form.couponCode}
          onChange={(v) => set('couponCode', v)}
          searchable
          required
        />
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Select
          label="Colour"
          description="Behind the words when there is no picture"
          data={THEMES}
          value={form.theme}
          onChange={(v) => set('theme', (v as Theme) ?? 'BLUE')}
          allowDeselect={false}
        />
        <NumberInput
          label="Priority"
          description="0 to 100; higher shows first"
          value={form.priority}
          onChange={(v) => set('priority', v)}
          min={0}
          max={100}
          allowDecimal={false}
        />
        <Switch
          label="On"
          checked={form.active}
          onChange={(e) => set('active', e.currentTarget.checked)}
          mt={{ base: 0, sm: 32 }}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput type="datetime-local" label="Starts" value={form.startsAt} onChange={(e) => set('startsAt', e.currentTarget.value)} />
        <TextInput type="datetime-local" label="Ends" value={form.endsAt} onChange={(e) => set('endsAt', e.currentTarget.value)} />
      </SimpleGrid>

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Picture
            </Text>
            {promotion ? (
              <Group gap="xs">
                <FileButton onChange={upload} accept="image/jpeg,image/png,image/webp">
                  {(props) => (
                    <Button {...props} size="xs" variant="light" leftSection={<IconPhoto size={14} />} loading={image.isPending}>
                      {current?.imageKey ? 'Change picture' : 'Upload picture'}
                    </Button>
                  )}
                </FileButton>
                {current?.imageKey && (
                  <Button size="xs" variant="subtle" color="red" onClick={() => upload(null)} disabled={image.isPending}>
                    Remove
                  </Button>
                )}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                Save the promotion first, then add a picture
              </Text>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            A wide JPEG, PNG or WebP picture; the middle is cut to 1500 × 500 pixels. Keep the left side calm: the
            words go there.
          </Text>
          <TextInput
            label="Picture description"
            description="For people using screen readers"
            value={form.imageAlt}
            onChange={(e) => set('imageAlt', e.currentTarget.value)}
            maxLength={200}
          />
        </Stack>
      </Paper>

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          {promotion ? 'Close' : 'Cancel'}
        </Button>
        <Button onClick={submit} loading={save.isPending}>
          {promotion ? 'Save changes' : 'Create promotion'}
        </Button>
      </Group>
    </Stack>
  )
}
