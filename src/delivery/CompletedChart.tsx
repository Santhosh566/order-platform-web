import { Box, Button, Group, Table, Text, Tooltip, useComputedColorScheme } from '@mantine/core'
import { useState } from 'react'
import { niceMax, type HistoryBucket } from './stats'

/** Validated as a pair (dataviz palette check) for each scheme; blue and orange stay apart for colour-blind readers. */
const COLOURS = {
  light: { delivered: '#1c7ed6', pickups: '#f08c00' },
  dark: { delivered: '#339af0', pickups: '#e8590c' },
}

const HEIGHT = 160

/**
 * Completed work per hour, day or month as stacked bars: deliveries below, return pickups above.
 * Hovering (or focusing) a bar gives its figures; the table view gives them all.
 */
export function CompletedChart({ buckets, title }: { buckets: HistoryBucket[]; title: string }) {
  const scheme = useComputedColorScheme('light')
  const colours = COLOURS[scheme]
  const [asTable, setAsTable] = useState(false)
  const max = Math.max(1, ...buckets.map((b) => b.delivered + b.pickupsCollected))
  const top = niceMax(max)
  // Room for about 8 labels, so they never run into each other on a phone
  const every = Math.max(1, Math.ceil(buckets.length / 8))
  const total = buckets.reduce((sum, b) => sum + b.delivered + b.pickupsCollected, 0)

  return (
    <Box>
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Group gap="md" aria-label="Legend">
          <Legend colour={colours.delivered} label="Deliveries" />
          <Legend colour={colours.pickups} label="Return pickups" />
        </Group>
        <Button variant="subtle" size="compact-sm" onClick={() => setAsTable((t) => !t)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </Button>
      </Group>

      {asTable ? (
        <Table.ScrollContainer minWidth={320}>
          <Table striped aria-label={title}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th ta="right">Delivered</Table.Th>
                <Table.Th ta="right">Pickups</Table.Th>
                <Table.Th ta="right">Failed</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {buckets.map((b) => (
                <Table.Tr key={b.start}>
                  <Table.Td>{b.label}</Table.Td>
                  <Table.Td ta="right">{b.delivered}</Table.Td>
                  <Table.Td ta="right">{b.pickupsCollected}</Table.Td>
                  <Table.Td ta="right">{b.failed}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : total === 0 ? (
        <Text c="dimmed" size="sm" py="lg" ta="center">
          Nothing completed in this period yet.
        </Text>
      ) : (
        <Box role="img" aria-label={`${title}: ${total} completed`}>
          <Box pos="relative" h={HEIGHT} ml={28}>
            {/* Recessive grid: zero, half and the top */}
            {[0, 0.5, 1].map((f) => (
              <Box
                key={f}
                pos="absolute"
                left={0}
                right={0}
                bottom={f * HEIGHT}
                style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
              >
                <Text size="xs" c="dimmed" pos="absolute" left={-28} top={-9} w={22} ta="right">
                  {Math.round(top * f)}
                </Text>
              </Box>
            ))}
            <Group gap={2} align="flex-end" h="100%" wrap="nowrap" pos="relative">
              {buckets.map((b) => (
                <Tooltip
                  key={b.start}
                  withArrow
                  label={`${b.label}: ${b.delivered} delivered, ${b.pickupsCollected} pickups, ${b.failed} failed`}
                >
                  {/* The whole column is the hover target, not just the bar */}
                  <Box
                    tabIndex={0}
                    h="100%"
                    style={{ flex: 1, minWidth: 4, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2 }}
                  >
                    {b.pickupsCollected > 0 && (
                      <Box
                        h={(b.pickupsCollected / top) * HEIGHT - 2}
                        bg={colours.pickups}
                        style={{ borderRadius: '4px 4px 0 0', minHeight: 2 }}
                      />
                    )}
                    {b.delivered > 0 && (
                      <Box
                        h={(b.delivered / top) * HEIGHT}
                        bg={colours.delivered}
                        style={{ borderRadius: b.pickupsCollected > 0 ? 0 : '4px 4px 0 0', minHeight: 2 }}
                      />
                    )}
                  </Box>
                </Tooltip>
              ))}
            </Group>
          </Box>
          <Group gap={2} wrap="nowrap" ml={28} mt={4} aria-hidden>
            {buckets.map((b, i) => (
              <Text key={b.start} size="xs" c="dimmed" ta="center" style={{ flex: 1, minWidth: 4, whiteSpace: 'nowrap', overflow: 'visible' }}>
                {i % every === 0 ? shortLabel(b.label) : ''}
              </Text>
            ))}
          </Group>
        </Box>
      )}
    </Box>
  )
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box w={10} h={10} bg={colour} style={{ borderRadius: 2 }} />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Group>
  )
}

/** "Wed 12" → "12" under a month's bars; hours and months stay as they are. */
function shortLabel(label: string): string {
  const day = /^[A-Z][a-z]{2} (\d+)$/.exec(label)
  return day ? day[1] : label.replace(':00', '')
}
