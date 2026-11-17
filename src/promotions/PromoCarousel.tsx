import { ActionIcon, Badge, Box, Button, Group, Paper, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { imageUrl } from '../lib/images'
import { offerHeadline, offerTerms } from './offerText'
import { bannerLink, reportBanner, useBanners, type Banner, type Theme } from './queries'

const COLOURS: Record<Theme, string> = {
  BLUE: 'blue',
  GREEN: 'green',
  ORANGE: 'orange',
  GRAPE: 'grape',
  RED: 'red',
  DARK: 'dark',
}

/** How long a banner stays before the next, unless the shopper is pointing at or tabbing through it. */
const INTERVAL_MS = 6000

/**
 * The banners at the top of the shop, one at a time. They move on by themselves, but not while the
 * pointer or keyboard focus is on them, nor for people who asked their system for less motion.
 * Nothing shows when there are none, or when they fail to load.
 */
export function PromoCarousel() {
  const banners = useBanners().data ?? []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()
  const seen = useRef(new Set<number>())
  const count = banners.length
  const current = count > 0 ? banners[index % count] : null

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [count, paused, reduceMotion])

  // Each banner counts one view per visit to the page
  useEffect(() => {
    if (current && !seen.current.has(current.id)) {
      seen.current.add(current.id)
      reportBanner(current.id, 'view')
    }
  }, [current])

  if (!current) return null
  const go = (step: number) => setIndex((i) => (((i + step) % count) + count) % count)

  return (
    <Box
      component="section"
      aria-roledescription="carousel"
      aria-label="Offers and promotions"
      pos="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <BannerSlide key={current.id} banner={current} position={`${(index % count) + 1} of ${count}`} />
      {count > 1 && (
        <>
          <ActionIcon
            variant="white"
            color="dark"
            radius="xl"
            size="lg"
            pos="absolute"
            left={8}
            top="50%"
            style={{ transform: 'translateY(-50%)', opacity: 0.85 }}
            onClick={() => go(-1)}
            aria-label="Previous offer"
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon
            variant="white"
            color="dark"
            radius="xl"
            size="lg"
            pos="absolute"
            right={8}
            top="50%"
            style={{ transform: 'translateY(-50%)', opacity: 0.85 }}
            onClick={() => go(1)}
            aria-label="Next offer"
          >
            <IconChevronRight size={18} />
          </ActionIcon>
          <Group gap={6} justify="center" pos="absolute" bottom={10} left={0} right={0}>
            {banners.map((b, i) => (
              <UnstyledButton
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`Show offer ${i + 1}: ${b.title}`}
                aria-current={i === index % count ? 'true' : undefined}
                style={{
                  width: i === index % count ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: 'white',
                  opacity: i === index % count ? 0.95 : 0.55,
                  transition: 'width 150ms',
                }}
              />
            ))}
          </Group>
        </>
      )}
    </Box>
  )
}

/** One banner. As a preview (the admin's form) its button goes nowhere and nothing is counted. */
export function BannerSlide({ banner, position, preview }: { banner: Banner; position: string; preview?: boolean }) {
  const colour = COLOURS[banner.theme] ?? 'blue'
  const picture = imageUrl(banner.imageKey)
  const [pictureFailed, setPictureFailed] = useState(false)
  const showPicture = picture && !pictureFailed
  const href = bannerLink(banner)
  const terms = banner.offer ? offerTerms(banner.offer) : []
  const onOpen = () => reportBanner(banner.id, 'click')

  return (
    <Paper
      radius="md"
      role="group"
      aria-roledescription="slide"
      aria-label={`${position}: ${banner.title}`}
      pos="relative"
      style={{
        overflow: 'hidden',
        minHeight: 170,
        aspectRatio: '3 / 1',
        background: `linear-gradient(120deg, var(--mantine-color-${colour}-9), var(--mantine-color-${colour}-6))`,
        color: 'white',
      }}
    >
      {showPicture && (
        <>
          <img
            src={picture}
            alt={banner.imageAlt ?? ''}
            onError={() => setPictureFailed(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Keeps the words readable over any picture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 80%)',
            }}
          />
        </>
      )}
      <Stack
        gap={6}
        pos="relative"
        h="100%"
        justify="center"
        px={{ base: 52, sm: 64 }}
        py="lg"
        maw={{ base: '100%', sm: '65%' }}
      >
        {banner.offer && (
          <Group gap={6}>
            <Badge color="yellow" c="dark" variant="filled" size="lg" tt="none">
              {offerHeadline(banner.offer)}
            </Badge>
            <Badge variant="white" c="dark" size="lg" tt="none" ff="monospace">
              Code {banner.couponCode}
            </Badge>
          </Group>
        )}
        <Title order={2} c="white" fz={{ base: 20, sm: 30 }} lh={1.15}>
          {banner.title}
        </Title>
        {banner.message && (
          <Text c="white" opacity={0.92} size="sm" lineClamp={2}>
            {banner.message}
          </Text>
        )}
        {banner.offer && (banner.appliesTo.length > 0 || terms.length > 0) && (
          <Text c="white" opacity={0.85} size="xs" lineClamp={2}>
            {banner.appliesTo.length > 0 ? `On ${banner.appliesTo.join(', ')}` : 'On any order'}
            {terms.length > 0 ? ` · ${terms.join(' · ')}` : ''}
          </Text>
        )}
        <div>
          {preview ? (
            <Button variant="white" color={colour} size="sm" mt={4} tabIndex={-1}>
              {banner.callToAction ?? defaultAction(banner)}
            </Button>
          ) : (
            <Button component={Link} to={href} onClick={onOpen} variant="white" color={colour} size="sm" mt={4}>
              {banner.callToAction ?? defaultAction(banner)}
            </Button>
          )}
        </div>
      </Stack>
    </Paper>
  )
}

function defaultAction(banner: Banner): string {
  switch (banner.targetType) {
    case 'PRODUCT':
      return 'View product'
    case 'CATEGORY':
      return `Shop ${banner.categoryName ?? 'now'}`
    case 'COUPON':
      return 'Shop the offer'
  }
}
