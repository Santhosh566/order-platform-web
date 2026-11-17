import { Button, Group, Input, Modal, Rating, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import { useSubmitReview, type Review } from './queries'

const RATING_WORDS = ['', 'Very poor', 'Poor', 'Average', 'Good', 'Excellent']

/**
 * Write or edit a review. Stars alone are published at once; a title or text is read by our team
 * first, which the dialog says before it is sent.
 */
export function ReviewDialog({
  opened,
  onClose,
  sku,
  name,
  existing,
}: {
  opened: boolean
  onClose: () => void
  sku: string
  name: string
  existing: Review | null
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={existing ? 'Edit your review' : 'Review this product'} size="lg">
      {/* Mounted only while open, so every opening starts from the saved review */}
      {opened && <ReviewForm sku={sku} name={name} existing={existing} onDone={onClose} />}
    </Modal>
  )
}

function ReviewForm({
  sku,
  name,
  existing,
  onDone,
}: {
  sku: string
  name: string
  existing: Review | null
  onDone: () => void
}) {
  const submit = useSubmitReview()
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const hasWords = title.trim() !== '' || body.trim() !== ''

  const save = async () => {
    if (rating < 1) {
      setError('Choose from 1 to 5 stars')
      return
    }
    try {
      const saved = await submit.mutateAsync({ sku, input: { rating, title, body } })
      notifications.show({
        color: 'green',
        title: 'Thank you',
        message:
          saved.status === 'APPROVED'
            ? 'Your rating is on the product page.'
            : 'We will publish your review once our team has read it, usually within a day.',
      })
      onDone()
    } catch (e) {
      notifications.show({ color: 'red', title: 'Review not saved', message: errorMessage(e) })
    }
  }

  return (
    <Stack gap="md">
      <Text fw={500}>{name}</Text>
      <Input.Wrapper label="Your rating" required error={error}>
        <Group gap="sm">
          <Rating
            value={rating}
            onChange={(v) => {
              setRating(v)
              setError(null)
            }}
            size="lg"
            aria-label="Your rating"
          />
          <Text size="sm" c="dimmed" aria-live="polite">
            {RATING_WORDS[rating]}
          </Text>
        </Group>
      </Input.Wrapper>
      <TextInput
        label="Title"
        placeholder="The most important thing in a few words"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        maxLength={120}
      />
      <Textarea
        label="Your review"
        placeholder="What did you like or dislike? How have you used it?"
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        maxLength={2000}
        autosize
        minRows={4}
        maxRows={10}
        description={`${body.length} / 2000`}
      />
      <Text size="xs" c="dimmed">
        {hasWords
          ? 'Reviews with words are read by our team before they appear. Please leave out phone numbers, links and personal details.'
          : 'A rating without words appears straight away. Your name is shown as first name and initial.'}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void save()} loading={submit.isPending}>
          {existing ? 'Save changes' : 'Submit review'}
        </Button>
      </Group>
    </Stack>
  )
}
