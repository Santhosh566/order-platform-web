import {
  Checkbox,
  Anchor,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconMap2, IconPhone, IconTruckDelivery } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { MyDelivery, MyPickup } from '../../api/adminTypes'
import { AddressBlock } from '../../components/AddressBlock'
import { QueryState } from '../../components/QueryState'
import { mapsLink, stageOf, telLink, useDriverAction, useMine, useMyPickups, usePickupAction } from '../../delivery/queries'
import { errorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'
import { CodeEntry } from './CodeEntry'
import { DeliveryTerms } from './DeliveryTerms'
import { MyPickupCard } from './PickupCards'
import { LocationSharingBanner } from '../../tracking/LocationSharingBanner'
import { useShareLocation } from '../../tracking/useShareLocation'

type Failing = { kind: 'delivery'; item: MyDelivery } | { kind: 'pickup'; item: MyPickup }

/** The driver's deliveries and return pickups in hand, each showing only the next thing to do. */
export function MyDeliveriesPage() {
  const mine = useMine()
  const pickups = useMyPickups()
  const [failing, setFailing] = useState<Failing | null>(null)
  const pickupRows = pickups.data ?? []
  // Customers can follow the driver while any parcel is out for delivery, and only then
  const sharing = useShareLocation((mine.data ?? []).some((d) => d.status === 'OUT_FOR_DELIVERY'))

  return (
    <Stack gap="md" maw={560}>
      <Title order={2}>My deliveries</Title>
      <LocationSharingBanner sharing={sharing} />
      <QueryState query={mine}>
        {(rows) =>
          rows.length === 0 && pickupRows.length === 0 ? (
            <Card withBorder radius="md" p="xl">
              <Stack align="center" gap="xs">
                <IconTruckDelivery size={40} stroke={1.4} />
                <Text>Nothing in hand.</Text>
                <Button component={Link} to="/delivery" variant="light">
                  See available orders
                </Button>
              </Stack>
            </Card>
          ) : (
            <Stack gap="md">
              {rows.map((d) => (
                <DeliveryCard key={d.orderId} delivery={d} onFail={() => setFailing({ kind: 'delivery', item: d })} />
              ))}
              {pickupRows.map((p) => (
                <MyPickupCard key={p.returnId} pickup={p} onFail={() => setFailing({ kind: 'pickup', item: p })} />
              ))}
            </Stack>
          )
        }
      </QueryState>
      <Modal opened={failing !== null} onClose={() => setFailing(null)} title={failing ? failTitle(failing) : ''}>
        {failing?.kind === 'delivery' && <DeliveryFail delivery={failing.item} onDone={() => setFailing(null)} />}
        {failing?.kind === 'pickup' && <PickupFail pickup={failing.item} onDone={() => setFailing(null)} />}
      </Modal>
    </Stack>
  )
}

function failTitle(failing: Failing): string {
  if (failing.kind === 'delivery') {
    return stageOf(failing.item) === 'collect' ? 'Give this order back' : 'Could not deliver'
  }
  return failing.item.pickupStatus === 'ON_THE_WAY' ? 'Could not collect' : 'Give this pickup back'
}

const STAGE_LABEL = {
  collect: { text: 'Collect from hub', color: 'blue' },
  start: { text: 'Picked up', color: 'indigo' },
  handover: { text: 'Out for delivery', color: 'orange' },
} as const

function DeliveryCard({ delivery: d, onFail }: { delivery: MyDelivery; onFail: () => void }) {
  const stage = stageOf(d)
  const action = useDriverAction()
  const tel = telLink(d.recipientPhone)
  const maps = mapsLink(d.address)

  const run = (step: 'pickup' | 'out-for-delivery', done: string) =>
    action.mutate(
      { orderId: d.orderId, action: step },
      {
        onSuccess: () => notifications.show({ color: 'green', title: done, message: shortOrderId(d.orderId) }),
        onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
      },
    )

  const startDelivery = () =>
    modals.openConfirmModal({
      title: 'Start this delivery?',
      children: (
        <Text size="sm">
          The customer is emailed a one-time code now. Start when you are on your way to them.
        </Text>
      ),
      labels: { confirm: 'Start delivery', cancel: 'Not yet' },
      onConfirm: () => run('out-for-delivery', 'Code sent to the customer'),
    })

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>{shortOrderId(d.orderId)}</Text>
          <Group gap={6}>
            {d.attempt > 1 && (
              <Badge color="yellow" variant="light">
                Try {d.attempt}
              </Badge>
            )}
            <Badge color={STAGE_LABEL[stage].color} variant="light">
              {STAGE_LABEL[stage].text}
            </Badge>
          </Group>
        </Group>

        <DeliveryTerms terms={d} />
        {d.address && <AddressBlock address={d.address} />}
        <Group grow gap="xs">
          {tel && (
            <Button component="a" href={tel} variant="default" leftSection={<IconPhone size={18} />}>
              Call
            </Button>
          )}
          {maps && (
            <Button
              component="a"
              href={maps}
              target="_blank"
              rel="noreferrer"
              variant="default"
              leftSection={<IconMap2 size={18} />}
            >
              Map
            </Button>
          )}
        </Group>

        <div>
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            In the parcel
          </Text>
          {d.items.map((item) => (
            <Text key={item.sku} size="sm">
              {item.quantity} × {item.name ?? item.sku}
            </Text>
          ))}
        </div>

        <Divider />
        {stage === 'collect' && (
          <Button size="lg" fullWidth loading={action.isPending} onClick={() => run('pickup', 'Picked up')}>
            I have collected it
          </Button>
        )}
        {stage === 'start' && (
          <Button size="lg" fullWidth loading={action.isPending} onClick={startDelivery}>
            Start delivery
          </Button>
        )}
        {stage === 'handover' && <Handover delivery={d} />}
        <Anchor component="button" type="button" size="sm" c="red" onClick={onFail} ta="center">
          {stage === 'collect' ? 'I can’t take this one' : 'Could not deliver'}
        </Anchor>
      </Stack>
    </Card>
  )
}

/** At the door: the customer reads out the code from their email. */
function Handover({ delivery: d }: { delivery: MyDelivery }) {
  const action = useDriverAction()
  const cash = d.amountToCollect ?? null
  const [collected, setCollected] = useState(false)
  return (
    <CodeEntry
      attemptsLeft={d.codeAttemptsLeft}
      instruction={
        cash
          ? `Collect ${formatMoney(cash, d.currency)} in cash, then ask for the 6-digit code from the customer's email.`
          : 'Ask the customer for the 6-digit code from their email. Hand over the parcel first.'
      }
      lockedText="This delivery can no longer be completed with a code. Mark it as not delivered and take the parcel back to the hub."
      confirmLabel="Confirm delivery"
      busy={action.isPending}
      ready={!cash || collected}
      onConfirm={(code, onError) =>
        action.mutate(
          { orderId: d.orderId, action: 'deliver', body: cash ? { code, cashCollected: true } : { code } },
          {
            onSuccess: () =>
              notifications.show({ color: 'green', title: 'Delivered', message: `${shortOrderId(d.orderId)} is done.` }),
            onError: (e) => onError(errorMessage(e)),
          },
        )
      }
    >
      {cash ? (
        <Checkbox
          size="md"
          label={`I collected ${formatMoney(cash, d.currency)} in cash`}
          checked={collected}
          onChange={(e) => setCollected(e.currentTarget.checked)}
        />
      ) : null}
    </CodeEntry>
  )
}

const REASONS = {
  collect: ['Vehicle problem', 'Too far for me today', 'Parcel not at the hub'],
  road: ['Customer not available', 'Address not found', 'Customer refused the parcel', 'Wrong code too many times'],
  pickupBefore: ['Vehicle problem', 'Too far for me today'],
  pickupDoor: ['Customer not available', 'Address not found', 'Items not ready', 'Items do not match the return', 'Wrong code too many times'],
}

function DeliveryFail({ delivery, onDone }: { delivery: MyDelivery; onDone: () => void }) {
  const action = useDriverAction()
  const beforePickup = stageOf(delivery) === 'collect'
  return (
    <FailForm
      reasons={beforePickup ? REASONS.collect : REASONS.road}
      explanation={
        beforePickup
          ? 'The order goes back on the list for another driver.'
          : 'The parcel goes back to the hub and the office arranges another try. The customer is told.'
      }
      submitLabel={beforePickup ? 'Give it back' : 'Not delivered'}
      busy={action.isPending}
      onSubmit={(reason) =>
        action.mutate(
          { orderId: delivery.orderId, action: 'fail', body: { reason } },
          {
            onSuccess: () => {
              notifications.show({
                color: 'orange',
                title: beforePickup ? 'Given back' : 'Marked as not delivered',
                message: beforePickup ? 'Another driver can take it.' : 'Take the parcel back to the hub.',
              })
              onDone()
            },
            onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
          },
        )
      }
      onCancel={onDone}
    />
  )
}

function PickupFail({ pickup, onDone }: { pickup: MyPickup; onDone: () => void }) {
  const action = usePickupAction()
  const atDoor = pickup.pickupStatus === 'ON_THE_WAY'
  return (
    <FailForm
      reasons={atDoor ? REASONS.pickupDoor : REASONS.pickupBefore}
      explanation={
        atDoor
          ? 'Leave the items with the customer. The pickup goes back on the list for another try, and the customer is told.'
          : 'The pickup goes back on the list for another driver.'
      }
      submitLabel={atDoor ? 'Not collected' : 'Give it back'}
      busy={action.isPending}
      onSubmit={(reason) =>
        action.mutate(
          { returnId: pickup.returnId, action: 'fail', body: { reason } },
          {
            onSuccess: () => {
              notifications.show({
                color: 'orange',
                title: atDoor ? 'Marked as not collected' : 'Given back',
                message: 'Another try will be arranged.',
              })
              onDone()
            },
            onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
          },
        )
      }
      onCancel={onDone}
    />
  )
}

function FailForm({
  reasons,
  explanation,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  reasons: string[]
  explanation: string
  submitLabel: string
  busy: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<string>('')
  const [details, setDetails] = useState('')
  const text = [reason, details.trim()].filter(Boolean).join(': ').slice(0, 255)

  return (
    <Stack gap="sm">
      <Text size="sm">{explanation}</Text>
      <Chip.Group value={reason} onChange={(v) => setReason(v as string)}>
        <Group gap="xs">
          {reasons.map((r) => (
            <Chip key={r} value={r}>
              {r}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      <Textarea
        label="More detail"
        description={reason ? 'Optional' : 'Or describe what happened'}
        value={details}
        onChange={(e) => setDetails(e.currentTarget.value)}
        maxLength={200}
        autosize
        minRows={2}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Back
        </Button>
        <Button color="red" disabled={!text} loading={busy} onClick={() => onSubmit(text)}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  )
}
