import { Alert, Anchor, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import { IconFileTypeCsv } from '@tabler/icons-react'
import { useState } from 'react'
import { useImportPins, usePinDirectory, type PinImportResult } from '../../admin/queries'
import { errorMessage } from '../../lib/errors'

/**
 * The India Post PIN directory behind "Delivered by …". data.gov.in asks for a name and a captcha
 * before downloading, so an admin downloads it and uploads it here.
 */
export function PinDirectoryCard() {
  const directory = usePinDirectory()
  const upload = useImportPins()
  const [result, setResult] = useState<PinImportResult | null>(null)
  const count = directory.data?.pins ?? 0

  const onDrop = (files: File[]) => {
    const file = files[0]
    if (!file) return
    upload.mutate(file, {
      onSuccess: (r) => {
        setResult(r)
        notifications.show({ color: 'green', title: 'PIN directory imported', message: `${r.pins.toLocaleString('en-IN')} PIN codes` })
      },
      onError: (error) => notifications.show({ color: 'red', title: 'Not imported', message: errorMessage(error) }),
    })
  }

  return (
    <Paper withBorder radius="md" p="md" maw={760}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>PIN directory</Title>
          <Text size="sm" c={count ? undefined : 'orange.8'} fw={count ? undefined : 600}>
            {directory.isPending ? '…' : count ? `${count.toLocaleString('en-IN')} PIN codes` : 'Not imported'}
          </Text>
        </Group>
        <Text size="sm">
          Delivery dates on product pages use India Post’s directory. Download “All India Pincode Directory” (CSV) from{' '}
          <Anchor href="https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month" target="_blank" rel="noreferrer">
            data.gov.in
          </Anchor>{' '}
          and drop it here. Until then, dates are estimated from the PIN’s postal zone and marked approximate.
          Importing again updates it.
        </Text>
        <Dropzone onDrop={onDrop} accept={['text/csv', 'application/vnd.ms-excel', '.csv']} maxSize={30 * 1024 * 1024} multiple={false} loading={upload.isPending} aria-label="Upload the PIN directory">
          <Group justify="center" gap="sm" mih={60} style={{ pointerEvents: 'none' }}>
            <IconFileTypeCsv size={28} stroke={1.5} />
            <Text size="sm">Drop the CSV here, or click to choose (up to 30 MB)</Text>
          </Group>
        </Dropzone>
        {result && (
          <Alert color={result.unknownStates.length ? 'yellow' : 'green'} p="xs">
            <Text size="sm">
              {result.pins.toLocaleString('en-IN')} PIN codes from {result.rowsRead.toLocaleString('en-IN')} rows
              {result.rowsSkipped > 0 && `; ${result.rowsSkipped.toLocaleString('en-IN')} rows skipped`}.
            </Text>
            {result.unknownStates.length > 0 && (
              <Text size="xs">States not recognised: {result.unknownStates.join(', ')}</Text>
            )}
          </Alert>
        )}
        <Text size="xs" c="dimmed">
          Contains data from the Department of Posts, Government of India, under the Government Open Data Licence – India.
        </Text>
      </Stack>
    </Paper>
  )
}
