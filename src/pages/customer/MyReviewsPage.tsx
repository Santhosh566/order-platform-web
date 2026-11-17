import { Alert, Anchor, Button, Group, Paper, Rating, Stack, Text, Title } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconPencil, IconStar, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ItemPhoto } from '../../components/ItemLines'
import { QueryState } from '../../components/QueryState'
import { useThumbnails } from '../../components/thumbnails'
import { errorMessage } from '../../lib/errors'
import { formatDate } from '../../lib/format'
import { ReviewDialog } from '../../reviews/ReviewDialog'
import { ReviewStatusBadge } from '../../reviews/ReviewStatusBadge'
import { useDeleteReview, useMyReviews, type Review } from '../../reviews/queries'

/** Products waiting for a review, then the customer's reviews with where each one stands. */
export function MyReviewsPage() {
  const mine = useMyReviews()
  const skus = [...(mine.data?.toReview ?? []).map((t) => t.sku), ...(mine.data?.reviews ?? []).map((r) => r.sku)]
  const photos = useThumbnails(skus)
  const [writing, setWriting] = useState<{ sku: string; name: string; existing: Review | null } | null>(null)
  const remove = useDeleteReview()

  const confirmDelete = (review: Review) =>
    modals.openConfirmModal({
      title: 'Delete your review?',
      children: <Text size="sm">Your rating and review of {review.productName} will be removed from the shop.</Text>,
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(review.sku, {
          onError: (e) => notifications.show({ color: 'red', title: 'Not deleted', message: errorMessage(e) }),
        }),
    })

  return (
    <Stack gap="lg" maw={860}>
      <Title order={2}>My reviews</Title>
      <QueryState query={mine}>
        {(data) => (
          <>
            {data.toReview.length > 0 && (
              <Stack gap="sm">
                <Title order={4}>Waiting for your review</Title>
                <Stack gap="xs" role="list" aria-label="Waiting for your review">
                  {data.toReview.map((t) => (
                    <Paper key={t.sku} withBorder radius="md" p="sm" role="listitem" aria-label={t.name}>
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <ItemPhoto thumbnail={photos.get(t.sku)} name={t.name} />
                          <div>
                            <Anchor component={Link} to={`/shop/${encodeURIComponent(t.sku)}`} fw={500} size="sm">
                              {t.name}
                            </Anchor>
                            {t.deliveredAt && (
                              <Text size="xs" c="dimmed">
                                Delivered {formatDate(t.deliveredAt)}
                              </Text>
                            )}
                          </div>
                        </Group>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconStar size={14} />}
                          onClick={() => setWriting({ sku: t.sku, name: t.name, existing: null })}
                          aria-label={`Rate ${t.name}`}
                        >
                          Rate
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            )}

            <Stack gap="sm">
              <Title order={4}>Your reviews</Title>
              {data.reviews.length === 0 ? (
                <Text c="dimmed" size="sm">
                  You have not reviewed anything yet. Products appear above once they are delivered.
                </Text>
              ) : (
                <Stack gap="xs" role="list" aria-label="Your reviews">
                  {data.reviews.map((r) => (
                    <Paper key={r.id} withBorder radius="md" p="sm" role="listitem" aria-label={r.productName}>
                      <Stack gap="xs">
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                          <Group gap="sm" wrap="nowrap" align="flex-start">
                            <ItemPhoto thumbnail={photos.get(r.sku)} name={r.productName} />
                            <Stack gap={2}>
                              <Anchor component={Link} to={`/shop/${encodeURIComponent(r.sku)}`} fw={500} size="sm">
                                {r.productName}
                              </Anchor>
                              <Rating value={r.rating} readOnly size="xs" aria-label={`${r.rating} stars`} />
                              {r.title && <Text size="sm" fw={500}>{r.title}</Text>}
                              {r.body && (
                                <Text size="sm" lineClamp={3} style={{ whiteSpace: 'pre-line' }}>
                                  {r.body}
                                </Text>
                              )}
                              <Text size="xs" c="dimmed">
                                {formatDate(r.updatedAt ?? r.createdAt)}
                              </Text>
                            </Stack>
                          </Group>
                          <ReviewStatusBadge status={r.status} />
                        </Group>
                        {r.status === 'REJECTED' && r.decisionNote && (
                          <Alert color="red" p="xs" title="Why it was not published">
                            {r.decisionNote} Edit it and we will look again.
                          </Alert>
                        )}
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconPencil size={14} />}
                            onClick={() => setWriting({ sku: r.sku, name: r.productName, existing: r })}
                            aria-label={`Edit review of ${r.productName}`}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => confirmDelete(r)}
                            aria-label={`Delete review of ${r.productName}`}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </>
        )}
      </QueryState>
      <ReviewDialog
        opened={writing !== null}
        onClose={() => setWriting(null)}
        sku={writing?.sku ?? ''}
        name={writing?.name ?? ''}
        existing={writing?.existing ?? null}
      />
    </Stack>
  )
}
