import { ActionIcon, Badge, CopyButton, Group, Paper, Stack, Text, Title, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy, IconDiscount } from '@tabler/icons-react'
import { offerHeadline, offerTerms } from './offerText'
import type { Offer } from './queries'

/** On the product page: every coupon that takes money off it, with its code to copy. */
export function ProductOffers({ offers }: { offers: readonly Offer[] | undefined }) {
  if (!offers || offers.length === 0) return null
  return (
    <Paper withBorder radius="md" p="sm" component="section" aria-label="Offers">
      <Stack gap="xs">
        <Group gap={6}>
          <IconDiscount size={18} color="var(--mantine-color-green-filled)" />
          <Title order={5}>Offers</Title>
        </Group>
        <Stack gap={8} role="list">
          {offers.map((o) => {
            const terms = offerTerms(o)
            return (
              <Group key={o.code} justify="space-between" wrap="nowrap" align="flex-start" role="listitem" aria-label={o.code}>
                <div>
                  <Text size="sm">
                    <b>{offerHeadline(o)}</b> with{' '}
                    <Text span ff="monospace" fw={600}>
                      {o.code}
                    </Text>
                    {o.targeted && (
                      <Badge ml={6} size="xs" variant="light" color="green">
                        On this product
                      </Badge>
                    )}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {o.description}
                    {terms.length > 0 ? ` · ${terms.join(' · ')}` : ''}
                  </Text>
                </div>
                <CopyButton value={o.code}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy code'} withArrow>
                      <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label={`Copy ${o.code}`}>
                        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            )
          })}
        </Stack>
        <Text size="xs" c="dimmed">
          Enter the code in your cart. The discount comes off before GST.
        </Text>
      </Stack>
    </Paper>
  )
}
