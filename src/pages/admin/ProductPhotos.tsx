import { ActionIcon, Badge, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { Dropzone, type FileRejection } from '@mantine/dropzone'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconArrowRight, IconPhotoPlus, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import type { ProductPhoto } from '../../api/adminTypes'
import { useDeletePhoto, useDescribePhoto, useReorderPhotos, useUploadPhoto } from '../../admin/queries'
import { ProductImage } from '../../components/ProductImage'
import { errorMessage } from '../../lib/errors'

/** What the backend accepts (ProductImageService): checked here first so the admin hears at once. */
export const PHOTO_LIMIT = 8
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
/** Below this the product page shows the photo smaller than its frame; above, it is crisp when enlarged. */
export const PHOTO_GOOD_SIDE = 800
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/** A product's photos: the first is the main one, shown on the product card. */
export function ProductPhotos({ sku, name, photos }: { sku: string; name: string; photos: ProductPhoto[] }) {
  const upload = useUploadPhoto(sku)
  const reorder = useReorderPhotos(sku)
  const remove = useDeletePhoto(sku)
  const [uploading, setUploading] = useState(0)
  const room = PHOTO_LIMIT - photos.length

  const onDrop = async (files: File[]) => {
    const accepted = files.slice(0, room)
    if (files.length > room) {
      notifications.show({
        color: 'orange',
        title: 'Too many photos',
        message: `A product has at most ${PHOTO_LIMIT} photos; ${files.length - room} were left out.`,
      })
    }
    // One at a time, so they keep the order they were chosen in
    for (const file of accepted) {
      setUploading((n) => n + 1)
      try {
        const added = await upload.mutateAsync({ file })
        if (Math.max(added.width, added.height) < PHOTO_GOOD_SIDE) {
          notifications.show({
            color: 'orange',
            title: `${file.name} is small`,
            message: `Only ${added.width} × ${added.height} px. It was added, but a photo of at least ${PHOTO_GOOD_SIDE} px looks sharper.`,
          })
        }
      } catch (error) {
        notifications.show({ color: 'red', title: `${file.name} not added`, message: errorMessage(error) })
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  const onReject = (rejections: FileRejection[]) =>
    rejections.forEach((r) =>
      notifications.show({
        color: 'red',
        title: `${r.file.name} not added`,
        message:
          r.errors[0]?.code === 'file-too-large'
            ? 'Pictures may be at most 5 MB.'
            : r.errors[0]?.code === 'file-invalid-type'
              ? 'Use a JPEG, PNG or WebP picture.'
              : (r.errors[0]?.message ?? 'Not accepted.'),
      }),
    )

  const move = (index: number, offset: -1 | 1) => {
    const ids = photos.map((p) => p.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + offset, 0, moved)
    reorder.mutate(ids, {
      onError: (error) => notifications.show({ color: 'red', title: 'Not moved', message: errorMessage(error) }),
    })
  }

  const confirmDelete = (photo: ProductPhoto, index: number) =>
    modals.openConfirmModal({
      title: 'Delete this photo?',
      children: (
        <Text size="sm">
          {index === 0 && photos.length > 1 ? 'The next photo becomes the main one. ' : ''}This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Keep' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(photo.id, {
          onError: (error) => notifications.show({ color: 'red', title: 'Not deleted', message: errorMessage(error) }),
        }),
    })

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>Photos</Title>
          <Text size="sm" c="dimmed">
            {photos.length} of {PHOTO_LIMIT}
          </Text>
        </Group>

        {photos.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            {photos.map((photo, index) => (
              <Stack key={photo.id} gap={4}>
                <div style={{ position: 'relative' }}>
                  <ProductImage imageKey={photo.thumbKey} alt={photo.altText ?? name} />
                  {index === 0 && (
                    <Badge size="xs" pos="absolute" top={6} left={6}>
                      Main
                    </Badge>
                  )}
                  {Math.max(photo.width, photo.height) < PHOTO_GOOD_SIDE && (
                    <Tooltip label={`Only ${photo.width} × ${photo.height} px: it shows small and blurs when enlarged. Use at least ${PHOTO_GOOD_SIDE} px.`}>
                      <Badge size="xs" color="orange" pos="absolute" bottom={6} left={6}>
                        Low resolution
                      </Badge>
                    </Tooltip>
                  )}
                </div>
                <Group gap={2} justify="center" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={`Move photo ${index + 1} earlier`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <IconArrowLeft size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={`Move photo ${index + 1} later`}
                    disabled={index === photos.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <IconArrowRight size={14} />
                  </ActionIcon>
                  <Tooltip label="Delete">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      color="red"
                      aria-label={`Delete photo ${index + 1}`}
                      onClick={() => confirmDelete(photo, index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <AltText sku={sku} photo={photo} index={index} />
              </Stack>
            ))}
          </SimpleGrid>
        )}

        {room > 0 ? (
          <Dropzone
            onDrop={(files) => void onDrop(files)}
            onReject={onReject}
            maxSize={PHOTO_MAX_BYTES}
            accept={ACCEPT}
            loading={uploading > 0}
            multiple
            aria-label="Add photos"
          >
            <Group justify="center" gap="md" mih={90} style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconPhotoPlus size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" fw={500}>
                  Drop photos here, or click to choose
                </Text>
                <Text size="xs" c="dimmed">
                  JPEG, PNG or WebP, up to 5 MB each; {PHOTO_GOOD_SIDE} × {PHOTO_GOOD_SIDE} pixels or larger looks
                  best. Phone photos are turned upright and their location data removed.
                </Text>
              </div>
            </Group>
          </Dropzone>
        ) : (
          <Text size="sm" c="dimmed">
            This product has the most photos allowed. Delete one to add another.
          </Text>
        )}
      </Stack>
    </Paper>
  )
}

/** What the photo shows, for screen readers and when it cannot load; saved when the field is left. */
function AltText({ sku, photo, index }: { sku: string; photo: ProductPhoto; index: number }) {
  const describe = useDescribePhoto(sku)
  const [value, setValue] = useState(photo.altText ?? '')
  const save = () => {
    if (value.trim() === (photo.altText ?? '')) return
    describe.mutate(
      { imageId: photo.id, altText: value.trim() },
      { onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }) },
    )
  }
  return (
    <TextInput
      size="xs"
      aria-label={`What photo ${index + 1} shows`}
      placeholder="What it shows"
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.currentTarget.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
