import { Button, Group, Paper, Rating, Stack, Text, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'

export interface DeliveryRatingStatus {
  orderId: string
  canRate: boolean
  reason: string | null
  driverName: string | null
  deliveredAt: string | null
  closesAt: string | null
  rating: number | null
  comment: string | null
}

const key = (orderId: string) => ['delivery-rating', orderId] as const

/** The customer rates how a delivered order reached them, for the driver who brought it. */
export function RateDelivery({ orderId }: { orderId: string }) {
  const client = useQueryClient()
  const status = useQuery({
    queryKey: key(orderId),
    queryFn: ({ signal }) => api<DeliveryRatingStatus>(`/api/delivery-ratings/${encodeURIComponent(orderId)}`, { signal }),
  })
  const save = useMutation({
    mutationFn: (body: { rating: number; comment: string }) =>
      api<DeliveryRatingStatus>(`/api/delivery-ratings/${encodeURIComponent(orderId)}`, { method: 'PUT', body }),
    onSuccess: (saved) => {
      client.setQueryData(key(orderId), saved)
      setEditing(false)
      notifications.show({ color: 'teal', message: 'Thank you for rating your delivery' })
    },
    onError: (e) => notifications.show({ color: 'red', message: errorMessage(e) }),
  })
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const s = status.data
  // Orders a courier delivered, or still on the way, have nothing to rate
  if (!s || !s.driverName || (!s.canRate && s.rating === null)) {
    return null
  }

  const startEditing = () => {
    setRating(s.rating ?? 0)
    setComment(s.comment ?? '')
    setEditing(true)
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="xs">
        <Title order={4}>Your delivery</Title>
        {s.rating !== null && !editing ? (
          <>
            <Group gap="sm">
              <Rating value={s.rating} readOnly aria-label={`You rated ${s.rating} out of 5`} />
              {s.canRate && (
                <Button variant="subtle" size="compact-sm" onClick={startEditing}>
                  Change
                </Button>
              )}
            </Group>
            {s.comment && <Text size="sm">“{s.comment}”</Text>}
          </>
        ) : editing || s.rating === null ? (
          <>
            <Text size="sm">How was the delivery by {s.driverName}?</Text>
            <Rating
              value={rating}
              onChange={(v) => {
                setRating(v)
                if (!editing) setEditing(true)
              }}
              size="lg"
              aria-label="Delivery rating"
            />
            {editing && (
              <>
                <Textarea
                  label="Anything to add? (optional)"
                  maxLength={500}
                  autosize
                  minRows={2}
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                />
                <Group gap="sm">
                  <Button
                    size="xs"
                    disabled={rating < 1}
                    loading={save.isPending}
                    onClick={() => save.mutate({ rating, comment })}
                  >
                    Send rating
                  </Button>
                  <Button size="xs" variant="subtle" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </Group>
              </>
            )}
            {s.closesAt && (
              <Text size="xs" c="dimmed">
                You can rate it until {formatDate(s.closesAt)}
              </Text>
            )}
          </>
        ) : null}
      </Stack>
    </Paper>
  )
}
