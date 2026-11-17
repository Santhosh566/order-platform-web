import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  Collapse,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconInfoCircle, IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { DeadLetter, RouteAction, RouteInfo } from '../../api/adminTypes'
import { useDeadLetters, useDismiss, useReplay, useRouteAction, useRoutes } from '../../admin/queries'
import { LiveIndicator } from '../../components/LiveIndicator'
import { QueryState } from '../../components/QueryState'
import { useLiveOrders } from '../../customer/useLiveOrders'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { shortOrderId } from '../../lib/orderStatus'
import { isOpen, pretty } from '../../admin/ops'
import { PinDirectoryCard } from './PinDirectoryCard'

type Tab = 'dlq' | 'routes' | 'data'

/** Messages the pipeline gave up on, and the switches for the routes that take messages in. */
export function OperationsPage() {
  const live = useLiveOrders()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'routes' || tabParam === 'data' ? tabParam : 'dlq'

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Operations</Title>
        <LiveIndicator state={live} />
      </Group>
      <Tabs value={tab} onChange={(v) => setParams(v && v !== 'dlq' ? { tab: v } : {})}>
        <Tabs.List>
          <Tabs.Tab value="dlq">Failed messages</Tabs.Tab>
          <Tabs.Tab value="routes">Routes</Tabs.Tab>
          <Tabs.Tab value="data">Reference data</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'dlq' ? <DeadLetters /> : tab === 'routes' ? <Routes /> : <PinDirectoryCard />}
    </Stack>
  )
}

// ── Dead letters ─────────────────────────────────────────────────────────────


function DeadLetters() {
  const deadLetters = useDeadLetters()
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [dismissing, setDismissing] = useState<DeadLetter | null>(null)

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed" maw={760}>
        Messages the order pipeline gave up on after its retries. <b>Replay</b> sends one through again once the
        cause is fixed (a provider back up, a service restarted). <b>Dismiss</b> closes it with a note when there is
        nothing to redo, for example because the order was cancelled.
      </Text>
      <SegmentedControl
        w="fit-content"
        value={show}
        onChange={(v) => setShow(v as 'open' | 'all')}
        data={[
          { value: 'open', label: 'Waiting for action' },
          { value: 'all', label: 'All, with history' },
        ]}
      />
      <QueryState query={deadLetters}>
        {(rows) => {
          const shown = show === 'open' ? rows.filter(isOpen) : rows
          if (shown.length === 0) {
            return <Text c="dimmed">{show === 'open' ? 'Nothing is waiting. All clear.' : 'No failed messages.'}</Text>
          }
          return (
            <Stack gap="sm">
              {shown.map((d) => (
                <DeadLetterCard key={d.id} dead={d} onDismiss={() => setDismissing(d)} />
              ))}
            </Stack>
          )
        }}
      </QueryState>
      <Modal opened={dismissing !== null} onClose={() => setDismissing(null)} title="Dismiss failed message">
        {dismissing && <DismissForm dead={dismissing} onDone={() => setDismissing(null)} />}
      </Modal>
    </Stack>
  )
}

function DeadLetterCard({ dead: d, onDismiss }: { dead: DeadLetter; onDismiss: () => void }) {
  const [opened, { toggle }] = useDisclosure(false)
  const replay = useReplay()
  const open = isOpen(d)

  const confirmReplay = () =>
    modals.openConfirmModal({
      title: `Replay message #${d.id}?`,
      children: (
        <Text size="sm">
          The order goes through the pipeline again: stock, payment and fulfilment. Do this only once the cause of
          the failure is fixed.
        </Text>
      ),
      labels: { confirm: 'Replay', cancel: 'Not now' },
      onConfirm: () =>
        replay.mutate(d.id, {
          onSuccess: () => notifications.show({ color: 'green', title: 'Replayed', message: `Message #${d.id} sent again.` }),
          onError: (error) => notifications.show({ color: 'red', title: 'Not replayed', message: errorMessage(error) }),
        }),
    })

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ flex: 1, minWidth: 260 }}>
          <Group gap="xs">
            <Text fw={600}>#{d.id}</Text>
            {d.orderId ? (
              <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(d.orderId)}`} size="sm">
                {shortOrderId(d.orderId)}
              </Anchor>
            ) : (
              <Text size="sm" c="dimmed">
                No order id
              </Text>
            )}
            <StateBadge dead={d} />
          </Group>
          <Text size="sm">{d.errorMessage ?? 'No error message'}</Text>
          <Text size="xs" c="dimmed">
            {simpleName(d.exceptionClass)} · failed {formatDateTime(d.failedAt)} · {d.redeliveryAttempts} retries ·{' '}
            {d.topic}
          </Text>
          {d.replayed && (
            <Text size="xs">
              Replayed {formatDateTime(d.replayedAt)}
              {d.replayedBy && <> by {d.replayedBy}</>}
            </Text>
          )}
          {d.dismissedAt && (
            <Text size="xs">
              Dismissed {formatDateTime(d.dismissedAt)} by {d.dismissedBy}: {d.dismissNote}
            </Text>
          )}
          <Anchor component="button" type="button" size="xs" onClick={toggle} w="fit-content">
            {opened ? 'Hide message' : 'Show message'}
          </Anchor>
        </Stack>
        {open && (
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button size="xs" leftSection={<IconRefresh size={14} />} loading={replay.isPending} onClick={confirmReplay}>
              Replay
            </Button>
          </Group>
        )}
      </Group>
      <Collapse expanded={opened}>
        <Code block mt="sm" mah={320} style={{ overflow: 'auto' }}>
          {pretty(d.payload)}
        </Code>
      </Collapse>
    </Card>
  )
}

function StateBadge({ dead }: { dead: DeadLetter }) {
  if (dead.replayed) return <Badge color="green" variant="light">Replayed</Badge>
  if (dead.dismissedAt) return <Badge color="gray" variant="light">Dismissed</Badge>
  return <Badge color="red" variant="light">Needs action</Badge>
}

function DismissForm({ dead, onDone }: { dead: DeadLetter; onDone: () => void }) {
  const dismiss = useDismiss()
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const submit = () => {
    setTouched(true)
    if (!note.trim()) return
    dismiss.mutate(
      { id: dead.id, note: note.trim() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', title: 'Dismissed', message: `Message #${dead.id} is closed.` })
          onDone()
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not dismissed', message: errorMessage(error) }),
      },
    )
  }
  return (
    <Stack gap="sm">
      <Text size="sm">The message stays in the history with your note. It is not sent again.</Text>
      <Textarea
        label="Why is nothing to be done?"
        placeholder="e.g. Customer cancelled the order; test message"
        withAsterisk
        maxLength={500}
        autosize
        minRows={2}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        error={touched && !note.trim() ? 'A note is required' : undefined}
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Back
        </Button>
        <Button onClick={submit} loading={dismiss.isPending}>
          Dismiss
        </Button>
      </Group>
    </Stack>
  )
}

function simpleName(exceptionClass: string | null): string {
  if (!exceptionClass) return 'Unknown error'
  return exceptionClass.slice(exceptionClass.lastIndexOf('.') + 1)
}


// ── Routes ───────────────────────────────────────────────────────────────────

/** What each consumer does, and what pausing it means, in the operator's words. */
const CONSUMERS: Record<string, { title: string; paused: string }> = {
  'order-event-consumer': {
    title: 'Processes new orders from Kafka',
    paused: 'New orders stay “Placed”; they wait in Kafka and are processed on resume.',
  },
  'outbox-poller': {
    title: 'Publishes saved orders to Kafka',
    paused: 'New orders wait in the outbox table.',
  },
  'customer-notification-outbox': {
    title: 'Sends customer emails',
    paused: 'Emails, including delivery codes, wait in the outbox and go out late.',
  },
  'b2b-csv-file-watcher': {
    title: 'Imports partner CSV order files',
    paused: 'Files wait in data/inbox/csv.',
  },
  'supplier-xml-file-watcher': {
    title: 'Imports supplier XML order files',
    paused: 'Files wait in data/inbox/xml.',
  },
  'carrier-tracking-poller': {
    title: 'Moves shipped orders along with carrier updates',
    paused: 'Orders with outside carriers stop advancing.',
  },
  'catalog-price-scheduler': {
    title: 'Applies scheduled prices',
    paused: 'Scheduled prices take effect late.',
  },
  'live-events-consumer': {
    title: 'Passes live updates to browsers on this server',
    paused: 'Pages connected to this server stop updating live; they catch up when reloaded.',
  },
  'stuck-order-recovery': {
    title: 'Retries orders stuck in the pipeline',
    paused: 'Stuck orders are not picked up again until resumed.',
  },
}

function Routes() {
  const routes = useRoutes()
  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={18} />} maw={760}>
        Only routes that take messages in (Kafka, files, timers) can be paused; their messages wait and are handled
        on resume. A change applies to <b>this server only</b>, and a restart starts every route again.
      </Alert>
      <QueryState query={routes}>
        {(rows) => {
          const consumers = rows.filter((r) => r.controllable)
          const others = rows.filter((r) => !r.controllable)
          const notRunning = others.filter((r) => r.status !== 'Started')
          return (
            <Stack gap="md">
              <Stack gap="sm">
                {consumers.map((r) => (
                  <ConsumerCard key={r.routeId} route={r} />
                ))}
              </Stack>
              {notRunning.length > 0 && (
                <Alert color="red" title="Routes not running">
                  {notRunning.map((r) => `${r.routeId} (${r.status})`).join(', ')}
                </Alert>
              )}
              <Accordion variant="contained" radius="md">
                <Accordion.Item value="others">
                  <Accordion.Control>
                    API and pipeline routes ({others.length}, {others.length - notRunning.length} running) — view only
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Table.ScrollContainer minWidth={640}>
                      <Table verticalSpacing={4} fz="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Route</Table.Th>
                            <Table.Th>Kind</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>From</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {others.map((r) => (
                            <Table.Tr key={r.routeId}>
                              <Table.Td>{r.routeId}</Table.Td>
                              <Table.Td>{r.kind === 'API' ? 'API' : 'Pipeline step'}</Table.Td>
                              <Table.Td>{r.status}</Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {decodeURIComponent(r.endpointUri)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          )
        }}
      </QueryState>
    </Stack>
  )
}

/** What is queued for this consumer; while paused it is what the pause is holding back. */
function Backlog({ waiting, paused }: { waiting: NonNullable<RouteInfo['waiting']>; paused: boolean }) {
  if (waiting.note) {
    return (
      <Text size="xs" c="dimmed">
        {waiting.note}
      </Text>
    )
  }
  const text = `${waiting.count.toLocaleString('en-IN')} ${waiting.unit}`
  const attention = paused && waiting.count > 0
  return (
    <Text size="sm" fw={attention ? 600 : undefined} c={attention ? 'orange.7' : undefined}>
      {attention && 'Held back: '}
      {waiting.orderStatus && waiting.count > 0 ? (
        <Anchor component={Link} to={`/admin/orders?status=${waiting.orderStatus}`} size="sm" c="inherit" underline="always">
          {text}
        </Anchor>
      ) : (
        text
      )}
    </Text>
  )
}

const STATUS_COLOR: Record<string, string> = { Started: 'green', Suspended: 'yellow', Stopped: 'red' }

function ConsumerCard({ route: r }: { route: RouteInfo }) {
  const action = useRouteAction()
  const info = CONSUMERS[r.routeId]
  const running = r.status === 'Started'

  const run = (verb: RouteAction, done: string) =>
    action.mutate(
      { routeId: r.routeId, action: verb },
      {
        onSuccess: (reply) => notifications.show({ color: 'green', title: done, message: `${r.routeId} is ${reply.status}.` }),
        onError: (error) => notifications.show({ color: 'red', title: 'Not changed', message: errorMessage(error) }),
      },
    )

  const confirm = (verb: 'suspend' | 'stop') =>
    modals.openConfirmModal({
      title: `${verb === 'stop' ? 'Stop' : 'Pause'} ${r.routeId}?`,
      children: (
        <Stack gap="xs">
          <Text size="sm">{info?.paused ?? 'Messages for this route wait until it runs again.'}</Text>
          {r.inflight > 0 && (
            <Text size="sm" fw={600}>
              {r.inflight} message(s) are being handled right now; they finish first.
            </Text>
          )}
        </Stack>
      ),
      labels: { confirm: verb === 'stop' ? 'Stop' : 'Pause', cancel: 'Cancel' },
      confirmProps: { color: verb === 'stop' ? 'red' : 'yellow' },
      onConfirm: () => run(verb, verb === 'stop' ? 'Stopped' : 'Paused'),
    })

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
          <Group gap="xs">
            <Text fw={600}>{info?.title ?? r.routeId}</Text>
            <Badge color={STATUS_COLOR[r.status] ?? 'gray'} variant="light">
              {r.status === 'Suspended' ? 'Paused' : r.status}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {r.routeId} · {decodeURIComponent(r.endpointUri).split('?')[0]}
            {running && r.uptime && <> · up {r.uptime}</>}
            {r.inflight > 0 && <> · {r.inflight} in flight</>}
          </Text>
          {r.waiting && <Backlog waiting={r.waiting} paused={!running} />}
        </Stack>
        <Group gap="xs">
          {running && (
            <>
              <Tooltip label="Stop taking new messages for now">
                <Button
                  size="xs"
                  variant="light"
                  color="yellow"
                  leftSection={<IconPlayerPause size={14} />}
                  loading={action.isPending}
                  onClick={() => confirm('suspend')}
                >
                  Pause
                </Button>
              </Tooltip>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconPlayerStop size={14} />}
                disabled={action.isPending}
                onClick={() => confirm('stop')}
              >
                Stop
              </Button>
            </>
          )}
          {r.status === 'Suspended' && (
            <Button
              size="xs"
              leftSection={<IconPlayerPlay size={14} />}
              loading={action.isPending}
              onClick={() => run('resume', 'Resumed')}
            >
              Resume
            </Button>
          )}
          {r.status === 'Stopped' && (
            <Button
              size="xs"
              leftSection={<IconPlayerPlay size={14} />}
              loading={action.isPending}
              onClick={() => run('start', 'Started')}
            >
              Start
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  )
}
