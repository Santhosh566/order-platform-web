import {
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconPackageImport, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { ItemCondition } from '../../api/adminTypes'
import type { ReturnRequest, ReturnStatus } from '../../api/types'
import { useAdminReturns, useApproveReturn, useReceiveReturn, useRejectReturn } from '../../admin/queries'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, formatMoney } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'
import { ReturnStatusBadge } from '../../components/ReturnStatusBadge'
import { ItemLine, ItemLines } from '../../components/ItemLines'
import { useThumbnails } from '../../components/thumbnails'

type Tab = ReturnStatus | 'ALL'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'REQUESTED', label: 'To review' },
  { value: 'APPROVED', label: 'Awaiting pickup' },
  { value: 'PICKED_UP', label: 'To inspect' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
]

type Dialog = { kind: 'approve' | 'reject' | 'receive'; request: ReturnRequest } | null

/**
 * The returns queue: decide on requests, then mark the goods received once they reach the
 * warehouse, which refunds the customer and issues the credit note.
 */
export function AdminReturnsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'REQUESTED') as Tab
  const returns = useAdminReturns(tab)
  const [dialog, setDialog] = useState<Dialog>(null)

  return (
    <Stack gap="md">
      <Title order={2}>Returns & refunds</Title>
      <Tabs value={tab} onChange={(value) => setParams(value && value !== 'REQUESTED' ? { tab: value } : {})}>
        <Tabs.List>
          {TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <QueryState query={returns}>
        {(rows) =>
          rows.length === 0 ? (
            <Text c="dimmed">{tab === 'REQUESTED' ? 'No returns waiting for a decision.' : 'None.'}</Text>
          ) : (
            <Stack gap="sm">
              {rows.map((r) => (
                <ReturnCard key={r.returnId} request={r} onAction={(kind) => setDialog({ kind, request: r })} />
              ))}
            </Stack>
          )
        }
      </QueryState>

      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog?.kind === 'approve'
            ? 'Approve return'
            : dialog?.kind === 'reject'
              ? 'Reject return'
              : 'Goods received'
        }
      >
        {dialog?.kind === 'approve' && <DecisionForm request={dialog.request} approve onDone={() => setDialog(null)} />}
        {dialog?.kind === 'reject' && <DecisionForm request={dialog.request} onDone={() => setDialog(null)} />}
        {dialog?.kind === 'receive' && <ReceiveForm request={dialog.request} onDone={() => setDialog(null)} />}
      </Modal>
    </Stack>
  )
}

function ReturnCard({
  request: r,
  onAction,
}: {
  request: ReturnRequest
  onAction: (kind: 'approve' | 'reject' | 'receive') => void
}) {
  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600}>
              <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(r.orderId)}`}>
                {shortOrderId(r.orderId)}
              </Anchor>{' '}
              · {r.customerId}
            </Text>
            <ReturnStatusBadge status={r.status} pickupStatus={r.pickupStatus} />
          </Group>
          <ItemLines items={r.items} label={`Items in return for ${shortOrderId(r.orderId)}`} />
          <Text size="sm" c="dimmed">
            “{r.reason}” · requested {formatDateTime(r.requestedAt)}
          </Text>
          {r.decisionNote && (
            <Text size="xs">
              Note by {r.decidedBy}: {r.decisionNote}
            </Text>
          )}
          {r.pickedUpAt && (
            <Text size="xs" c="dimmed">
              Picked up {formatDateTime(r.pickedUpAt)} by {r.pickedUpBy}
            </Text>
          )}
          {r.receivedAt && (
            <Text size="xs" c="dimmed">
              Received {formatDateTime(r.receivedAt)} by {r.receivedBy}
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          {r.status === 'REQUESTED' && (
            <>
              <Button size="xs" variant="light" color="red" leftSection={<IconX size={14} />} onClick={() => onAction('reject')}>
                Reject
              </Button>
              <Button size="xs" leftSection={<IconCheck size={14} />} onClick={() => onAction('approve')}>
                Approve
              </Button>
            </>
          )}
          {r.status === 'APPROVED' && (
            <>
              <Button size="xs" component={Link} to="/admin/deliveries" variant="light">
                {r.pickupStatus ? 'See pickup' : 'Assign pickup'}
              </Button>
              <Tooltip label="The goods reached the hub another way, e.g. by post">
                <Button size="xs" variant="default" onClick={() => onAction('receive')}>
                  Received without pickup
                </Button>
              </Tooltip>
            </>
          )}
          {r.status === 'PICKED_UP' && (
            <Button size="xs" leftSection={<IconPackageImport size={14} />} onClick={() => onAction('receive')}>
              Goods received
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  )
}

function DecisionForm({ request, approve, onDone }: { request: ReturnRequest; approve?: boolean; onDone: () => void }) {
  const approveReturn = useApproveReturn()
  const rejectReturn = useRejectReturn()
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const busy = approveReturn.isPending || rejectReturn.isPending
  const noteMissing = !approve && !note.trim()

  const submit = () => {
    setTouched(true)
    if (noteMissing) return
    const handlers = {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          title: approve ? 'Return approved' : 'Return rejected',
          message: 'The customer is emailed.',
        })
        onDone()
      },
      onError: (error: unknown) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
    }
    if (approve) {
      approveReturn.mutate({ returnId: request.returnId, body: note.trim() ? { note: note.trim() } : {} }, handlers)
    } else {
      rejectReturn.mutate({ returnId: request.returnId, body: { note: note.trim() } }, handlers)
    }
  }

  return (
    <Stack gap="sm">
      <ItemLines items={request.items} />
      <Text size="sm">Reason: “{request.reason}”</Text>
      <Textarea
        label={approve ? 'Note for the customer' : 'Why it is rejected'}
        description={approve ? 'Optional, e.g. pickup instructions' : 'The customer sees this'}
        withAsterisk={!approve}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        maxLength={255}
        autosize
        minRows={2}
        error={touched && noteMissing ? 'Tell the customer why' : undefined}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Close
        </Button>
        <Button color={approve ? undefined : 'red'} onClick={submit} loading={busy}>
          {approve ? 'Approve' : 'Reject'}
        </Button>
      </Group>
    </Stack>
  )
}

/** Inspect each SKU: sellable units go back on the shelf, damaged ones do not. Either way the customer is refunded. */
function ReceiveForm({ request, onDone }: { request: ReturnRequest; onDone: () => void }) {
  const receive = useReceiveReturn()
  const skus = [...new Set(request.items.map((i) => i.sku))]
  const thumbnails = useThumbnails(skus)
  const [conditions, setConditions] = useState<Record<string, ItemCondition>>(
    Object.fromEntries(skus.map((sku) => [sku, 'SELLABLE' as ItemCondition])),
  )

  const submit = () =>
    receive.mutate(
      { returnId: request.returnId, body: { conditions } },
      {
        onSuccess: (note) => {
          notifications.show({
            color: 'green',
            title: 'Refunded',
            message: `${formatMoney(note.total, note.currency)} on credit note ${note.number}.`,
          })
          onDone()
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not received', message: errorMessage(error) }),
      },
    )

  return (
    <Stack gap="sm">
      <Text size="sm">
        Mark what condition the goods arrived in. The customer is refunded for every unit, and a GST credit note is
        issued.
      </Text>
      <Table>
        <Table.Tbody>
          {skus.map((sku) => (
            <Table.Tr key={sku}>
              <Table.Td>
                <ItemLine
                  sku={sku}
                  quantity={request.items.filter((i) => i.sku === sku).reduce((n, i) => n + i.quantity, 0)}
                  thumbnail={thumbnails.get(sku)}
                />
              </Table.Td>
              <Table.Td>
                <SegmentedControl
                  size="xs"
                  aria-label={`Condition of ${sku}`}
                  value={conditions[sku]}
                  onChange={(value) => setConditions((c) => ({ ...c, [sku]: value as ItemCondition }))}
                  data={[
                    { value: 'SELLABLE', label: 'Back to stock' },
                    { value: 'DAMAGED', label: 'Damaged' },
                  ]}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Close
        </Button>
        <Button onClick={submit} loading={receive.isPending}>
          Receive and refund
        </Button>
      </Group>
    </Stack>
  )
}
