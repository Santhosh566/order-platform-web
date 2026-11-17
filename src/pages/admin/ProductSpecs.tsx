import { ActionIcon, Button, Chip, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { ProductSpec } from '../../api/adminTypes'
import { useSaveSpecs } from '../../admin/queries'
import { errorMessage } from '../../lib/errors'

/** The specification table customers see, e.g. RAM = 8 GB; the category suggests names. */
export function ProductSpecs({ sku, specs, suggested }: { sku: string; specs: ProductSpec[]; suggested: string[] }) {
  const save = useSaveSpecs(sku)
  const [rows, setRows] = useState<ProductSpec[]>(specs)
  const names = new Set(rows.map((r) => r.name.trim().toLowerCase()))
  const missing = suggested.filter((s) => !names.has(s.toLowerCase()))
  const dirty = JSON.stringify(rows) !== JSON.stringify(specs)

  const set = (i: number, change: Partial<ProductSpec>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)))
  const move = (i: number, offset: -1 | 1) => {
    const next = [...rows]
    const [row] = next.splice(i, 1)
    next.splice(i + offset, 0, row)
    setRows(next)
  }

  const submit = () =>
    save.mutate(
      rows.filter((r) => r.name.trim() || r.value.trim()),
      {
        onSuccess: (saved) => {
          setRows(saved)
          notifications.show({ color: 'green', title: 'Specifications saved', message: `${saved.length} lines` })
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
      },
    )

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={4}>Specifications</Title>
        {rows.length === 0 && (
          <Text size="sm" c="dimmed">
            None yet. Customers see these as a table on the product page.
          </Text>
        )}
        {rows.map((row, i) => (
          <Group key={i} gap={4} wrap="nowrap">
            <TextInput
              aria-label={`Specification ${i + 1} name`}
              placeholder="Name, e.g. RAM"
              value={row.name}
              maxLength={60}
              onChange={(e) => set(i, { name: e.currentTarget.value })}
              w="40%"
              size="xs"
            />
            <TextInput
              aria-label={`Specification ${i + 1} value`}
              placeholder="Value, e.g. 8 GB"
              value={row.value}
              maxLength={200}
              onChange={(e) => set(i, { value: e.currentTarget.value })}
              style={{ flex: 1 }}
              size="xs"
            />
            <ActionIcon variant="subtle" size="sm" aria-label={`Move ${row.name || 'line'} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              <IconArrowUp size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={`Move ${row.name || 'line'} down`}
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
            >
              <IconArrowDown size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" size="sm" color="red" aria-label={`Remove ${row.name || 'line'}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
        {missing.length > 0 && (
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              Suggested:
            </Text>
            {missing.map((name) => (
              <Chip key={name} size="xs" checked={false} onChange={() => setRows([...rows, { name, value: '' }])}>
                {name}
              </Chip>
            ))}
          </Group>
        )}
        <Group justify="space-between">
          <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setRows([...rows, { name: '', value: '' }])}>
            Add a line
          </Button>
          <Button size="xs" onClick={submit} disabled={!dirty} loading={save.isPending}>
            Save specifications
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
