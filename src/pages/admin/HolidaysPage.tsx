import { ActionIcon, Badge, Button, Group, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconChevronLeft, IconChevronRight, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { QueryState } from '../../components/QueryState'
import { useAddHoliday, useHolidays, useRemoveHoliday, type Holiday } from '../../holidays/queries'
import { errorMessage } from '../../lib/errors'
import { INDIAN_STATES } from '../../lib/indianStates'

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const COUNTRY = 'ALL'

function dayLabel(iso: string) {
  return WEEKDAY.format(new Date(`${iso}T00:00:00Z`))
}

/**
 * Days without deliveries. Delivery dates in the shop and the days a customer can book skip them:
 * a national holiday everywhere (hubs do not dispatch either), a state's holiday in that state only.
 */
export function HolidaysPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const holidays = useHolidays(year)

  return (
    <Stack gap="md" maw={860}>
      <Title order={2}>Delivery holidays</Title>
      <Text size="sm" c="dimmed">
        Sundays are never delivery days. The three national holidays are already listed for the coming years;
        add festivals each year once the government publishes its list, for the whole country or one state.
      </Text>
      <AddHoliday />
      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={4}>{year}</Title>
            <Group gap={4}>
              <ActionIcon variant="default" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon variant="default" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          </Group>
          <QueryState query={holidays}>
            {(list) =>
              list.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No holidays in {year}.
                </Text>
              ) : (
                <HolidayTable holidays={list} />
              )
            }
          </QueryState>
        </Stack>
      </Paper>
    </Stack>
  )
}

function HolidayTable({ holidays }: { holidays: Holiday[] }) {
  const remove = useRemoveHoliday()
  const confirm = (h: Holiday) =>
    modals.openConfirmModal({
      title: `Remove ${h.name}?`,
      children: <Text size="sm">Deliveries will be planned on {dayLabel(h.day)} again.</Text>,
      labels: { confirm: 'Remove', cancel: 'Keep' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(h.id, {
          onError: (e) => notifications.show({ color: 'red', title: 'Not removed', message: errorMessage(e) }),
        }),
    })
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table verticalSpacing="xs" aria-label="Holidays">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Day</Table.Th>
            <Table.Th>Holiday</Table.Th>
            <Table.Th>Where</Table.Th>
            <Table.Th w={40} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {holidays.map((h) => (
            <Table.Tr key={h.id}>
              <Table.Td>{dayLabel(h.day)}</Table.Td>
              <Table.Td>{h.name}</Table.Td>
              <Table.Td>
                {h.stateName ? (
                  <Text size="sm">{h.stateName}</Text>
                ) : (
                  <Badge variant="light" color="grape">
                    All of India
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <ActionIcon variant="subtle" color="red" aria-label={`Remove ${h.name}`} onClick={() => confirm(h)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function AddHoliday() {
  const add = useAddHoliday()
  const [day, setDay] = useState('')
  const [name, setName] = useState('')
  const [where, setWhere] = useState<string>(COUNTRY)

  const submit = () => {
    if (!day || !name.trim()) {
      notifications.show({ color: 'orange', message: 'Give the day and the name of the holiday' })
      return
    }
    add.mutate(
      { day, name: name.trim(), stateCode: where === COUNTRY ? null : where },
      {
        onSuccess: (h) => {
          notifications.show({ color: 'green', message: `${h.name} added for ${h.stateName ?? 'all of India'}` })
          setDay('')
          setName('')
        },
        onError: (e) => notifications.show({ color: 'red', title: 'Not added', message: errorMessage(e) }),
      },
    )
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={4}>Add a holiday</Title>
        <Group align="flex-end" gap="sm">
          <TextInput type="date" label="Day" value={day} onChange={(e) => setDay(e.currentTarget.value)} w={170} />
          <TextInput
            label="Name"
            placeholder="e.g. Diwali"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={100}
            flex={1}
            miw={180}
          />
          <Select
            label="Where"
            data={[{ value: COUNTRY, label: 'All of India' }, ...INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))]}
            value={where}
            onChange={(v) => setWhere(v ?? COUNTRY)}
            allowDeselect={false}
            searchable
            w={240}
          />
          <Button onClick={submit} loading={add.isPending}>
            Add
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
