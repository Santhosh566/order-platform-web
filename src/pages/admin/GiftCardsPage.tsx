import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconDownload, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format'
import {
  useGiftCards,
  useIssueGiftCards,
  useVoidGiftCard,
  type GiftCard,
  type GiftCardStatus,
  type IssuedBatch,
} from '../../wallet/queries'

const STATUS: Record<GiftCardStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Not used', color: 'green' },
  REDEEMED: { label: 'Redeemed', color: 'blue' },
  VOID: { label: 'Stopped', color: 'red' },
  EXPIRED: { label: 'Expired', color: 'gray' },
}

type Filter = GiftCardStatus | 'ALL'

/** Issue gift cards in batches, see what became of each, and stop a lost one. */
export function GiftCardsPage() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const cards = useGiftCards(filter === 'ALL' ? null : filter)
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<IssuedBatch | null>(null)
  const [stopping, setStopping] = useState<GiftCard | null>(null)

  return (
    <Stack gap="md" maw={1100}>
      <Group justify="space-between">
        <Title order={2}>Gift cards</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setIssuing(true)}>
          Issue gift cards
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        A customer adds a card under Wallet, and its whole value goes into their wallet. Only the last four
        characters of each code are kept here: the full codes are shown once, when the cards are issued.
      </Text>
      <SegmentedControl
        w="fit-content"
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        data={[
          { value: 'ALL', label: 'All' },
          { value: 'ACTIVE', label: 'Not used' },
          { value: 'REDEEMED', label: 'Redeemed' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'VOID', label: 'Stopped' },
        ]}
      />
      <Paper withBorder radius="md" p="md">
        <QueryState query={cards}>
          {(list) =>
            list.length === 0 ? (
              <Text c="dimmed">No gift cards here.</Text>
            ) : (
              <Table.ScrollContainer minWidth={820}>
                <Table verticalSpacing="sm" aria-label="Gift cards">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Code</Table.Th>
                      <Table.Th>Value</Table.Th>
                      <Table.Th>Batch</Table.Th>
                      <Table.Th>Valid until</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th aria-label="Actions" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {list.map((c) => (
                      <Table.Tr key={c.id}>
                        <Table.Td>
                          <Text ff="monospace" size="sm">
                            {c.maskedCode}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Issued {formatDate(c.createdAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>{formatMoney(c.amount, c.currency)}</Table.Td>
                        <Table.Td>{c.label ?? '—'}</Table.Td>
                        <Table.Td>{formatDate(c.expiresAt)}</Table.Td>
                        <Table.Td>
                          <Badge color={STATUS[c.status].color} variant="light">
                            {STATUS[c.status].label}
                          </Badge>
                          {c.status === 'REDEEMED' && c.redeemedBy && (
                            <Text size="xs">
                              by{' '}
                              <Link to={`/admin/users/${encodeURIComponent(c.redeemedBy)}`}>
                                {c.redeemedByName ?? c.redeemedBy}
                              </Link>
                              , {formatDateTime(c.redeemedAt)}
                            </Text>
                          )}
                          {c.status === 'VOID' && (
                            <Text size="xs" c="dimmed">
                              {c.voidReason}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {(c.status === 'ACTIVE' || c.status === 'EXPIRED') && (
                            <Button
                              variant="subtle"
                              color="red"
                              size="xs"
                              onClick={() => setStopping(c)}
                              aria-label={`Stop card ${c.maskedCode}`}
                            >
                              Stop
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )
          }
        </QueryState>
      </Paper>

      <Modal opened={issuing} onClose={() => setIssuing(false)} title="Issue gift cards">
        <IssueForm
          onIssued={(batch) => {
            setIssuing(false)
            setIssued(batch)
          }}
        />
      </Modal>
      <Modal
        opened={issued !== null}
        onClose={() => setIssued(null)}
        title="Gift cards issued"
        size="lg"
        closeOnClickOutside={false}
      >
        {issued && <IssuedCodes batch={issued} onDone={() => setIssued(null)} />}
      </Modal>
      <Modal opened={stopping !== null} onClose={() => setStopping(null)} title="Stop this gift card?">
        {stopping && <StopForm card={stopping} onDone={() => setStopping(null)} />}
      </Modal>
    </Stack>
  )
}

function IssueForm({ onIssued }: { onIssued: (batch: IssuedBatch) => void }) {
  const issue = useIssueGiftCards()
  const [amount, setAmount] = useState<number | string>(500)
  const [count, setCount] = useState<number | string>(1)
  const [expires, setExpires] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const total = typeof amount === 'number' && typeof count === 'number' ? amount * count : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    issue.mutate(
      {
        amount: Number(amount),
        count: Number(count),
        expiresAt: expires ? `${expires}T23:59:59` : null,
        label: label.trim() || null,
      },
      { onSuccess: onIssued, onError: (err) => setError(errorMessage(err)) },
    )
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Group grow>
          <NumberInput
            label="Value of each card (₹)"
            value={amount}
            onChange={setAmount}
            min={10}
            max={10000}
            allowDecimal={false}
            required
          />
          <NumberInput
            label="How many"
            value={count}
            onChange={setCount}
            min={1}
            max={500}
            allowDecimal={false}
            required
          />
        </Group>
        <TextInput
          type="date"
          label="Valid until"
          description="Leave empty for a year from today"
          value={expires}
          onChange={(e) => setExpires(e.currentTarget.value)}
        />
        <TextInput
          label="Batch name"
          placeholder="e.g. Diwali corporate order"
          maxLength={80}
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
        {total !== null && total > 0 && (
          <Text size="sm">
            {count} card{count === 1 ? '' : 's'} worth {formatMoney(total)} in all.
          </Text>
        )}
        {error && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} p="xs">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={issue.isPending}>
            Issue
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function IssuedCodes({ batch, onDone }: { batch: IssuedBatch; onDone: () => void }) {
  const all = batch.cards.map((c) => c.code).join('\n')
  const download = () => {
    const rows = [
      'code,value_inr,valid_until,batch',
      ...batch.cards.map((c) => `${c.code},${c.amount},${c.expiresAt.slice(0, 10)},"${(batch.label ?? '').replace(/"/g, '""')}"`),
    ]
    const url = URL.createObjectURL(new Blob([rows.join('\n') + '\n'], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `gift-cards-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Stack gap="sm">
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
        Copy or download the codes now. They are not stored and cannot be shown again. Anyone with a code can
        spend it, so share them only with whoever the cards are for.
      </Alert>
      <Text size="sm">
        {batch.cards.length} card{batch.cards.length === 1 ? '' : 's'} of {formatMoney(batch.amount)}, valid until{' '}
        {formatDate(batch.expiresAt)}.
      </Text>
      <Paper withBorder p="sm" mah={300} style={{ overflow: 'auto' }}>
        <Stack gap={2} aria-label="Gift card codes">
          {batch.cards.map((c) => (
            <Text key={c.id} ff="monospace" size="sm">
              {c.code}
            </Text>
          ))}
        </Stack>
      </Paper>
      <Group justify="space-between">
        <Group gap="xs">
          <CopyButton value={all}>
            {({ copied, copy }) => (
              <Button variant="light" onClick={copy}>
                {copied ? 'Copied' : 'Copy codes'}
              </Button>
            )}
          </CopyButton>
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={download}>
            Download CSV
          </Button>
        </Group>
        <Button onClick={onDone}>Done</Button>
      </Group>
    </Stack>
  )
}

function StopForm({ card, onDone }: { card: GiftCard; onDone: () => void }) {
  const stop = useVoidGiftCard()
  const [reason, setReason] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    stop.mutate(
      { id: card.id, reason: reason.trim() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Card ${card.maskedCode} stopped` })
          onDone()
        },
        onError: (err) => notifications.show({ color: 'red', title: 'Not stopped', message: errorMessage(err) }),
      },
    )
  }
  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        <Text size="sm">
          Card {card.maskedCode} ({formatMoney(card.amount, card.currency)}) can no longer be added to a wallet. This
          cannot be undone.
        </Text>
        <TextInput
          label="Why"
          placeholder="e.g. Lost in the post"
          required
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button type="submit" color="red" loading={stop.isPending} disabled={!reason.trim()}>
            Stop card
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
