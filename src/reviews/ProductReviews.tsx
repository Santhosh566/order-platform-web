import {
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Pagination,
  Paper,
  Progress,
  Rating,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconCircleCheck, IconPencil } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { QueryState } from '../components/QueryState'
import { formatDate } from '../lib/format'
import { ReviewDialog } from './ReviewDialog'
import { ReviewStatusBadge } from './ReviewStatusBadge'
import { useMyReviewOf, useProductReviews, type ProductReviews as Data, type ReviewSort } from './queries'

const SORTS: Array<{ value: ReviewSort; label: string }> = [
  { value: 'NEWEST', label: 'Newest first' },
  { value: 'HIGHEST', label: 'Highest rated' },
  { value: 'LOWEST', label: 'Lowest rated' },
]

/** The product page's ratings and reviews: the breakdown, the customer's own review, then the reviews. */
export function ProductReviews({ sku, name }: { sku: string; name: string }) {
  const [sort, setSort] = useState<ReviewSort>('NEWEST')
  const [page, setPage] = useState(0)
  const reviews = useProductReviews(sku, sort, page)

  return (
    <Stack gap="md" component="section" aria-labelledby="reviews-heading" id="reviews">
      <Title order={3} id="reviews-heading">
        Ratings and reviews
      </Title>
      <QueryState query={reviews}>
        {(data) =>
          data && (
            <Grid gap="xl">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="md">
                  <Summary data={data} />
                  <OwnReview sku={sku} name={name} />
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="md">
                  {data.reviews.totalItems > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {data.reviews.totalItems} {data.reviews.totalItems === 1 ? 'review' : 'reviews'}
                      </Text>
                      <Select
                        aria-label="Sort reviews"
                        data={SORTS}
                        value={sort}
                        onChange={(v) => {
                          setSort((v as ReviewSort) ?? 'NEWEST')
                          setPage(0)
                        }}
                        allowDeselect={false}
                        size="xs"
                        w={160}
                      />
                    </Group>
                  )}
                  {data.reviews.items.length === 0 ? (
                    <Text c="dimmed" size="sm">
                      {data.rating.count > 0
                        ? 'Customers have rated this product but no one has written a review yet.'
                        : 'No reviews yet. Customers who bought it can review it once it is delivered.'}
                    </Text>
                  ) : (
                    <Stack gap={0} role="list" aria-label="Reviews">
                      {data.reviews.items.map((r, i) => (
                        <div key={r.id} role="listitem" aria-label={`${r.author}, ${r.rating} stars`}>
                          {i > 0 && <Divider my="sm" />}
                          <Stack gap={4}>
                            <Group gap="xs">
                              <Rating value={r.rating} readOnly size="xs" aria-hidden />
                              {r.title && <Text fw={600}>{r.title}</Text>}
                            </Group>
                            {r.body && (
                              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                                {r.body}
                              </Text>
                            )}
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                {r.author} · {formatDate(r.createdAt)}
                                {r.edited ? ' · edited' : ''}
                              </Text>
                              {r.verifiedPurchase && (
                                <Badge size="xs" variant="light" color="green" leftSection={<IconCircleCheck size={10} />}>
                                  Verified purchase
                                </Badge>
                              )}
                            </Group>
                          </Stack>
                        </div>
                      ))}
                    </Stack>
                  )}
                  {data.reviews.totalPages > 1 && (
                    <Pagination
                      total={data.reviews.totalPages}
                      value={page + 1}
                      onChange={(p) => setPage(p - 1)}
                      size="sm"
                      getControlProps={(control) => ({ 'aria-label': `${control} page` })}
                    />
                  )}
                </Stack>
              </Grid.Col>
            </Grid>
          )
        }
      </QueryState>
    </Stack>
  )
}

function Summary({ data }: { data: Data }) {
  const { average, count, distribution } = data.rating
  if (count === 0) {
    return (
      <Text size="sm" c="dimmed">
        Not rated yet.
      </Text>
    )
  }
  return (
    <Stack gap="xs">
      <Group gap="sm" align="center">
        <Text fz={36} fw={700} lh={1}>
          {average.toFixed(1)}
        </Text>
        <Stack gap={2}>
          <Rating value={average} fractions={2} readOnly aria-label={`Rated ${average.toFixed(1)} out of 5`} />
          <Text size="xs" c="dimmed">
            {count} {count === 1 ? 'rating' : 'ratings'}
          </Text>
        </Stack>
      </Group>
      <Stack gap={4} role="list" aria-label="Ratings by stars">
        {[5, 4, 3, 2, 1].map((stars) => {
          const n = distribution[stars - 1] ?? 0
          const percent = count === 0 ? 0 : Math.round((n / count) * 100)
          return (
            <Group key={stars} gap="xs" wrap="nowrap" role="listitem" aria-label={`${stars} stars: ${n}`}>
              <Text size="xs" w={42} aria-hidden>
                {stars} star
              </Text>
              <Progress value={percent} flex={1} size="sm" color="yellow" aria-hidden />
              <Text size="xs" c="dimmed" w={28} ta="right" aria-hidden>
                {n}
              </Text>
            </Group>
          )
        })}
      </Stack>
    </Stack>
  )
}

/** "Write a review" for a customer who received it; their own review with its status once written. */
function OwnReview({ sku, name }: { sku: string; name: string }) {
  const { hasRole } = useAuth()
  const mine = useMyReviewOf(sku)
  const [open, setOpen] = useState(false)
  if (!hasRole('CUSTOMER') || !mine.data) return null
  const { canReview, review } = mine.data

  if (!review) {
    return canReview ? (
      <Paper withBorder radius="md" p="md">
        <Stack gap="xs">
          <Text fw={500}>You bought this</Text>
          <Text size="sm" c="dimmed">
            Help other customers: how is it?
          </Text>
          <Button variant="light" onClick={() => setOpen(true)} leftSection={<IconPencil size={16} />}>
            Write a review
          </Button>
          <ReviewDialog opened={open} onClose={() => setOpen(false)} sku={sku} name={name} existing={null} />
        </Stack>
      </Paper>
    ) : null
  }
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={500}>Your review</Text>
          <ReviewStatusBadge status={review.status} />
        </Group>
        <Rating value={review.rating} readOnly size="sm" aria-label={`You gave ${review.rating} stars`} />
        {review.title && <Text size="sm">{review.title}</Text>}
        {review.status === 'REJECTED' && review.decisionNote && (
          <Alert color="red" p="xs">
            {review.decisionNote}
          </Alert>
        )}
        <Group gap="sm">
          <Button variant="subtle" size="xs" onClick={() => setOpen(true)} leftSection={<IconPencil size={14} />}>
            Edit
          </Button>
          <Anchor component={Link} to="/reviews" size="xs">
            All my reviews
          </Anchor>
        </Group>
        <ReviewDialog opened={open} onClose={() => setOpen(false)} sku={sku} name={name} existing={review} />
      </Stack>
    </Paper>
  )
}
