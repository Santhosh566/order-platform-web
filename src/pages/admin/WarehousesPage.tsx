import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowsExchange, IconBuildingWarehouse, IconPlus } from '@tabler/icons-react'
import { lazy, Suspense, useState } from 'react'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { stateName } from '../../lib/indianStates'
import type { MapPoint } from '../../tracking/TrackingMap'
import {
  formatCutoff,
  useSaveWarehouse,
  useTransfer,
  useWarehouses,
  type Warehouse,
  type WarehouseRequest,
  type WarehouseSummary,
} from '../../warehouses/queries'

const TrackingMap = lazy(() => import('../../tracking/TrackingMap'))

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/

/**
 * Where stock is kept. Each warehouse has its own GST registration and invoice series; orders ship from the nearest
 * one that holds all of them. Admins open warehouses, change their details, close them, and move stock between them.
 */
export function WarehousesPage() {
  const warehouses = useWarehouses()
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null)
  const [moving, setMoving] = useState(false)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Title order={2}>Warehouses</Title>
          <Text c="dimmed" size="sm">
            Orders ship from the nearest open warehouse that has everything in them, under its own GSTIN.
          </Text>
        </div>
        <Group gap="sm">
          <Button variant="default" leftSection={<IconArrowsExchange size={18} />} onClick={() => setMoving(true)}>
            Move stock
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing('new')}>
            Add warehouse
          </Button>
        </Group>
      </Group>

      <QueryState query={warehouses}>
        {(rows) => (
          <>
            <Paper withBorder radius="md" p="sm">
              <Suspense fallback={<Loader size="sm" />}>
                <TrackingMap points={rows.map(toPoint)} height={320} />
              </Suspense>
            </Paper>
            <Paper withBorder radius="md">
              <Table.ScrollContainer minWidth={860}>
                <Table verticalSpacing="sm" highlightOnHover aria-label="Warehouses">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Warehouse</Table.Th>
                      <Table.Th>Registration</Table.Th>
                      <Table.Th>Leaves same day if packed by</Table.Th>
                      <Table.Th ta="right">Products</Table.Th>
                      <Table.Th ta="right">Available</Table.Th>
                      <Table.Th ta="right">Reserved</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map(({ warehouse: w, products, available, reserved }) => (
                      <Table.Tr key={w.id}>
                        <Table.Td>
                          <Group gap={6}>
                            <Text fw={600} size="sm">
                              {w.code}
                            </Text>
                            {w.isDefault && (
                              <Badge size="xs" variant="light">
                                Default
                              </Badge>
                            )}
                            {!w.active && (
                              <Badge size="xs" color="gray">
                                Closed
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm">{w.name}</Text>
                          <Text size="xs" c="dimmed">
                            {w.address}, {w.pin}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{stateName(w.stateCode)}</Text>
                          <Text size="xs" c="dimmed" ff="monospace">
                            {w.gstin}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Invoices {w.invoicePrefix}/…, credit notes {w.creditNotePrefix}/…
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatCutoff(w.cutoffTime)}</Text>
                        </Table.Td>
                        <Table.Td ta="right">{products.toLocaleString('en-IN')}</Table.Td>
                        <Table.Td ta="right">{available.toLocaleString('en-IN')}</Table.Td>
                        <Table.Td ta="right">{reserved.toLocaleString('en-IN')}</Table.Td>
                        <Table.Td>
                          <Button size="xs" variant="subtle" onClick={() => setEditing(w)}>
                            Edit
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
            <Modal opened={moving} onClose={() => setMoving(false)} title="Move stock between warehouses">
              <TransferForm warehouses={rows} onDone={() => setMoving(false)} />
            </Modal>
          </>
        )}
      </QueryState>

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a warehouse' : `Edit ${editing?.code ?? ''}`}
        size="lg"
      >
        {editing !== null && <WarehouseForm warehouse={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Stack>
  )
}

function toPoint({ warehouse: w }: WarehouseSummary): MapPoint {
  return { latitude: w.latitude, longitude: w.longitude, kind: 'warehouse', label: `${w.code} · ${w.name}`, stale: !w.active }
}

/**
 * A new warehouse, or changes to one. The code, PIN, GSTIN and document prefixes are fixed once it exists: invoices
 * have been issued under them. Without a position, the centre of the PIN code is used.
 */
function WarehouseForm({ warehouse, onDone }: { warehouse: Warehouse | null; onDone: () => void }) {
  const save = useSaveWarehouse(warehouse?.id)
  const fixed = warehouse !== null
  const [v, setV] = useState({
    code: warehouse?.code ?? '',
    name: warehouse?.name ?? '',
    address: warehouse?.address ?? '',
    pin: warehouse?.pin ?? '',
    gstin: warehouse?.gstin ?? '',
    invoicePrefix: warehouse?.invoicePrefix ?? '',
    creditNotePrefix: warehouse?.creditNotePrefix ?? '',
    cutoffTime: warehouse ? warehouse.cutoffTime.slice(0, 5) : '14:00',
    latitude: warehouse?.latitude ?? (null as number | null),
    longitude: warehouse?.longitude ?? (null as number | null),
    active: warehouse?.active ?? true,
  })
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((current) => ({ ...current, [key]: value }))
  const gstinOk = GSTIN.test(v.gstin.trim().toUpperCase())

  const submit = () => {
    const request: WarehouseRequest = fixed
      ? {
          name: v.name,
          address: v.address,
          cutoffTime: v.cutoffTime,
          active: v.active,
          ...(v.latitude !== warehouse.latitude || v.longitude !== warehouse.longitude
            ? { latitude: v.latitude, longitude: v.longitude }
            : {}),
        }
      : {
          code: v.code,
          name: v.name,
          address: v.address,
          pin: v.pin,
          gstin: v.gstin,
          invoicePrefix: v.invoicePrefix,
          creditNotePrefix: v.creditNotePrefix,
          cutoffTime: v.cutoffTime,
          active: v.active,
          ...(v.latitude !== null && v.longitude !== null ? { latitude: v.latitude, longitude: v.longitude } : {}),
        }
    save.mutate(request, {
      onSuccess: (saved) => {
        notifications.show({ color: 'green', title: fixed ? 'Warehouse saved' : 'Warehouse opened', message: saved.name })
        onDone()
      },
      onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
    })
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput label="Code" description="Short name people use, e.g. GGN" withAsterisk disabled={fixed}
          value={v.code} onChange={(e) => set('code', e.currentTarget.value.toUpperCase())} />
        <TextInput label="Name" withAsterisk value={v.name} onChange={(e) => set('name', e.currentTarget.value)} />
      </SimpleGrid>
      <TextInput label="Address" withAsterisk value={v.address} onChange={(e) => set('address', e.currentTarget.value)} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput label="PIN code" withAsterisk disabled={fixed} maxLength={6} value={v.pin}
          onChange={(e) => set('pin', e.currentTarget.value.replace(/\D/g, ''))} />
        <TextInput
          label="GSTIN"
          description={gstinOk ? `Registered in ${stateName(v.gstin.slice(0, 2))}` : 'The state comes from its first two digits'}
          withAsterisk
          disabled={fixed}
          maxLength={15}
          value={v.gstin}
          error={v.gstin && !gstinOk && !fixed ? '15 characters, like 06AABCO1234F1Z9' : undefined}
          onChange={(e) => set('gstin', e.currentTarget.value.toUpperCase())}
        />
        <TextInput label="Invoice prefix" description="2 or 3 letters, e.g. GGI" withAsterisk disabled={fixed} maxLength={3}
          value={v.invoicePrefix} onChange={(e) => set('invoicePrefix', e.currentTarget.value.toUpperCase())} />
        <TextInput label="Credit note prefix" description="2 or 3 letters, e.g. GGC" withAsterisk disabled={fixed} maxLength={3}
          value={v.creditNotePrefix} onChange={(e) => set('creditNotePrefix', e.currentTarget.value.toUpperCase())} />
        <TextInput label="Same-day cut-off" description="Orders packed by then leave that day" type="time"
          value={v.cutoffTime} onChange={(e) => set('cutoffTime', e.currentTarget.value)} />
        <Switch mt="lg" label="Open: new orders can ship from it" checked={v.active}
          disabled={warehouse?.isDefault} onChange={(e) => set('active', e.currentTarget.checked)} />
        <NumberInput label="Latitude" description="Leave empty to use the PIN code's centre" decimalScale={6}
          value={v.latitude ?? ''} onChange={(n) => set('latitude', typeof n === 'number' ? n : null)} />
        <NumberInput label="Longitude" decimalScale={6} value={v.longitude ?? ''}
          onChange={(n) => set('longitude', typeof n === 'number' ? n : null)} />
      </SimpleGrid>
      {fixed && (
        <Text size="xs" c="dimmed">
          The code, PIN, GSTIN and prefixes cannot change: invoices were issued under them. Open a new warehouse instead.
        </Text>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={save.isPending} disabled={!fixed && !gstinOk}>
          {fixed ? 'Save' : 'Open warehouse'}
        </Button>
      </Group>
    </Stack>
  )
}

/** Moves units of one product: they leave one warehouse and arrive in the other at once. */
function TransferForm({ warehouses, onDone }: { warehouses: WarehouseSummary[]; onDone: () => void }) {
  const transfer = useTransfer()
  const options = warehouses.map(({ warehouse: w }) => ({ value: String(w.id), label: `${w.code} · ${w.name}` }))
  const [sku, setSku] = useState('')
  const [from, setFrom] = useState<string | null>(options[0]?.value ?? null)
  const [to, setTo] = useState<string | null>(options[1]?.value ?? null)
  const [quantity, setQuantity] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const ready = sku.trim() && from && to && from !== to && typeof quantity === 'number' && quantity > 0

  const submit = () => {
    if (!ready) return
    transfer.mutate(
      { sku: sku.trim(), fromWarehouseId: Number(from), toWarehouseId: Number(to), quantity: quantity as number, reason: reason || undefined },
      {
        onSuccess: (r) => {
          notifications.show({
            color: 'green',
            title: 'Stock moved',
            message: `${quantity} × ${r.out.sku}: ${r.out.availableAfter} left in the first, ${r.in.availableAfter} in the second`,
          })
          onDone()
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not moved', message: errorMessage(error) }),
      },
    )
  }

  return (
    <Stack gap="sm">
      <TextInput label="Product SKU" withAsterisk value={sku} onChange={(e) => setSku(e.currentTarget.value)}
        leftSection={<IconBuildingWarehouse size={16} />} />
      <SimpleGrid cols={2} spacing="sm">
        <Select label="From" data={options} value={from} onChange={setFrom} allowDeselect={false} />
        <Select label="To" data={options} value={to} onChange={setTo} allowDeselect={false}
          error={from && from === to ? 'Choose another warehouse' : undefined} />
      </SimpleGrid>
      <NumberInput label="Units" withAsterisk min={1} allowDecimal={false} value={quantity}
        onChange={(n) => setQuantity(typeof n === 'number' ? n : '')} />
      <TextInput label="Reason" placeholder="e.g. Festive demand in the north" value={reason}
        onChange={(e) => setReason(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={transfer.isPending} disabled={!ready}>
          Move
        </Button>
      </Group>
    </Stack>
  )
}
