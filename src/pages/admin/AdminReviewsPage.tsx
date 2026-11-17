import { Anchor, Button, Group, Modal, Paper, Rating, SegmentedControl, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ItemPhoto } from '../../components/ItemLines'
import { QueryState } from '../../components/QueryState'
import { useThumbnails } from '../../components/thumbnails'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/format'
import { ReviewStatusBadge } from '../../reviews/ReviewStatusBadge'
import { useAdminReviews, useDecideReview, type Review, type ReviewStatus } from '../../reviews/queries'

const TABS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'PENDING', label: 'To moderate' },
  { value: 'APPROVED', label: 'Published' },
  { value: 'REJECTED', label: 'Rejected' },
]

/**
 * Reviews with words wait here before they are published. Ratings alone are published at once and
 * never appear in the queue. A rejection needs a note, which the customer is emailed.
 */
export function AdminReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus>('PENDING')
  const reviews = useAdminReviews(status)
  const photos = useThumbnails((reviews.data ?? []).map((r) => r.sku))
  const decide = useDecideReview()
  const [rejecting, setRejecting] = useState<Review | null>(null)

  const approve = (review: Review) =>
    decide.mutate(
      { id: review.id, approve: true },
      {
        onSuccess: () => notifications.show({ color: 'green', message: `Published ${review.author}’s review` }),
        onError: (e) => notifications.show({ color: 'red', title: 'Not published', message: errorMessage(e) }),
      },
    )

  return (
    <Stack gap="md" maw={960}>
      <Title order={2}>Reviews</Title>
      <Text size="sm" c="dimmed">
        Publish reviews that describe the product. Reject those with personal details, links, offensive words, or
        that are about something else (delivery problems belong in a return or a call). Ratings without words are
        published straight away.
      </Text>
      <SegmentedControl
        value={status}
        onChange={(v) => setStatus(v as ReviewStatus)}
        data={TABS}
        w="fit-content"
        aria-label="Which reviews"
      />
      <QueryState query={reviews}>
        {(list) =>
          list.length === 0 ? (
            <Text c="dimmed">{status === 'PENDING' ? 'Nothing to moderate.' : 'None yet.'}</Text>
          ) : (
            <Stack gap="sm" role="list" aria-label="Reviews">
              {list.map((r) => (
                <Paper key={r.id} withBorder radius="md" p="md" role="listitem" aria-label={`${r.author} on ${r.productName}`}>
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Group gap="sm" wrap="nowrap" align="flex-start">
                        <ItemPhoto thumbnail={photos.get(r.sku)} name={r.productName} />
                        <div>
                          <Anchor component={Link} to={`/admin/catalog/${encodeURIComponent(r.sku)}`} fw={500} size="sm">
                            {r.productName}
                          </Anchor>
                          <Text size="xs" c="dimmed">
                            {r.author} ({r.customerId}) · order{' '}
                            <Anchor component={Link} to={`/admin/orders/${encodeURIComponent(r.orderId)}`} size="xs">
                              {r.orderId.slice(0, 12)}…
                            </Anchor>{' '}
                            · {formatDateTime(r.updatedAt ?? r.createdAt)}
                          </Text>
                        </div>
                      </Group>
                      <ReviewStatusBadge status={r.status} />
                    </Group>
                    <Rating value={r.rating} readOnly size="sm" aria-label={`${r.rating} stars`} />
                    {r.title && <Text fw={600}>{r.title}</Text>}
                    {r.body && (
                      <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                        {r.body}
                      </Text>
                    )}
                    {r.decisionNote && (
                      <Text size="xs" c="dimmed">
                        Note to the customer: {r.decisionNote}
                      </Text>
                    )}
                    {r.decidedAt && (
                      <Text size="xs" c="dimmed">
                        Decided by {r.decidedBy} on {formatDateTime(r.decidedAt)}
                      </Text>
                    )}
                    {r.status === 'PENDING' && (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          leftSection={<IconCheck size={14} />}
                          onClick={() => approve(r)}
                          loading={decide.isPending && decide.variables?.id === r.id}
                        >
                          Publish
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<IconX size={14} />}
                          onClick={() => setRejecting(r)}
                        >
                          Reject
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )
        }
      </QueryState>
      <Modal opened={rejecting !== null} onClose={() => setRejecting(null)} title="Reject review">
        {rejecting && <RejectForm review={rejecting} onDone={() => setRejecting(null)} />}
      </Modal>
    </Stack>
  )
}

function RejectForm({ review, onDone }: { review: Review; onDone: () => void }) {
  const decide = useDecideReview()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reject = () => {
    if (!note.trim()) {
      setError('Tell the customer why; they are emailed this note')
      return
    }
    decide.mutate(
      { id: review.id, approve: false, note: note.trim() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Rejected; the customer was emailed your note' })
          onDone()
        },
        onError: (e) => notifications.show({ color: 'red', title: 'Not rejected', message: errorMessage(e) }),
      },
    )
  }
  return (
    <Stack gap="sm">
      <Text size="sm">
        {review.author}’s review of {review.productName}
      </Text>
      <Textarea
        label="Note to the customer"
        placeholder="e.g. Reviews may not contain phone numbers."
        value={note}
        onChange={(e) => {
          setNote(e.currentTarget.value)
          setError(null)
        }}
        error={error}
        maxLength={500}
        autosize
        minRows={3}
        data-autofocus
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button color="red" onClick={reject} loading={decide.isPending}>
          Reject review
        </Button>
      </Group>
    </Stack>
  )
}
