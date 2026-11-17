import { ActionIcon, Group, Image, Modal, Stack, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect } from 'react'
import type { PublicImage } from '../api/types'
import { imageUrl } from '../lib/images'

/**
 * Full-screen photo viewer: previous/next buttons, the arrow keys, and Esc to close. On a phone the
 * browser's own pinch-zoom works on the picture.
 */
export function PhotoViewer({
  images,
  index,
  name,
  onChange,
  onClose,
}: {
  images: PublicImage[]
  /** The photo shown, or null when the viewer is closed. */
  index: number | null
  name: string
  onChange: (index: number) => void
  onClose: () => void
}) {
  const open = index !== null
  const count = images.length
  const current = open ? images[index] : null

  useEffect(() => {
    if (!open || count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onChange(((index ?? 0) + 1) % count)
      if (e.key === 'ArrowLeft') onChange(((index ?? 0) - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, count, onChange])

  return (
    <Modal
      opened={open}
      onClose={onClose}
      fullScreen
      title={name}
      transitionProps={{ transition: 'fade', duration: 150 }}
      styles={{ body: { height: 'calc(100% - 60px)' } }}
    >
      {current && (
        <Stack h="100%" gap="sm" justify="center">
          <Group wrap="nowrap" gap="xs" h="100%" justify="center" style={{ minHeight: 0, flex: 1 }}>
            {count > 1 && (
              <ActionIcon
                variant="default"
                size="xl"
                radius="xl"
                aria-label="Previous photo"
                onClick={() => onChange((index! - 1 + count) % count)}
              >
                <IconChevronLeft />
              </ActionIcon>
            )}
            <Image
              src={imageUrl(current.largeKey)}
              alt={current.altText ?? name}
              fit="contain"
              h="100%"
              mah="calc(100vh - 160px)"
              maw={`min(100%, ${current.width * 2}px)`}
              style={{ flex: 1, minWidth: 0, objectFit: 'contain' }}
            />
            {count > 1 && (
              <ActionIcon
                variant="default"
                size="xl"
                radius="xl"
                aria-label="Next photo"
                onClick={() => onChange((index! + 1) % count)}
              >
                <IconChevronRight />
              </ActionIcon>
            )}
          </Group>
          <Text ta="center" size="sm" c="dimmed">
            {current.altText ? `${current.altText} · ` : ''}
            {count > 1 ? `${index! + 1} of ${count}` : ''}
          </Text>
        </Stack>
      )}
    </Modal>
  )
}
