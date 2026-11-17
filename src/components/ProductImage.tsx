import { Center, Image } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useState } from 'react'
import { imageUrl } from '../lib/images'

/**
 * A product photo, or a quiet placeholder when there is none or it cannot load (for example
 * while the photo storage is down): the shop never shows a broken image.
 */
export function ProductImage({
  imageKey,
  alt,
  ratio = 1,
  radius = 'sm',
  naturalWidth,
}: {
  imageKey: string | null | undefined
  alt: string
  ratio?: number
  radius?: string
  /** The photo's real width: it is never shown larger, so a small photo stays sharp instead of blurry. */
  naturalWidth?: number
}) {
  const src = imageUrl(imageKey)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <Center
        bg="var(--mantine-color-default-hover)"
        style={{ aspectRatio: ratio, borderRadius: `var(--mantine-radius-${radius})` }}
        role="img"
        aria-label={`${alt} (no photo)`}
      >
        <IconPhoto size={32} stroke={1.2} color="var(--mantine-color-dimmed)" />
      </Center>
    )
  }
  return (
    <Image
      src={src}
      alt={alt}
      radius={radius}
      fit="contain"
      loading="lazy"
      style={{
        aspectRatio: ratio,
        background: 'var(--mantine-color-white)',
        maxWidth: naturalWidth ? `min(100%, ${naturalWidth}px)` : undefined,
        marginInline: naturalWidth ? 'auto' : undefined,
      }}
      onError={() => setFailedSrc(src)}
    />
  )
}
