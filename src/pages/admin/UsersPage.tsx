import { Badge, Group, Pagination, Paper, SegmentedControl, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { Role } from '../../api/types'
import { PAGE_SIZE, ROLE_COLORS, ROLE_LABELS, useUsers, type StatusFilter } from '../../admin/users'
import { QueryState } from '../../components/QueryState'
import { formatDate } from '../../lib/format'
import { UserAvatar } from '../../profile/UserAvatar'

const ROLE_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'DELIVERY', label: 'Drivers' },
  { value: 'ADMIN', label: 'Admins' },
]

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

/** Every user, searchable by name, email, phone or id; the search lives in the URL. */
export function UsersPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const role = (params.get('role') || null) as Role | null
  const status = (params.get('status') || null) as StatusFilter
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [text, setText] = useState(params.get('q') ?? '')
  const [q] = useDebouncedValue(text.trim(), 300)
  const users = useUsers(q, role, page - 1, status)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace: true },
    )

  // A new search starts on page 1
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) update({ q: q || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Users</Title>
        <Text c="dimmed" size="sm">
          Customers, drivers and staff. Open one to see their profile and activity.
        </Text>
      </div>
      <Group gap="sm" wrap="wrap">
        <TextInput
          aria-label="Search users"
          placeholder="Name, email, phone or user id"
          leftSection={<IconSearch size={16} />}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          w={{ base: '100%', sm: 340 }}
        />
        <SegmentedControl
          aria-label="Role"
          data={ROLE_FILTERS}
          value={role ?? ''}
          onChange={(value) => update({ role: value || null, page: null })}
        />
        <SegmentedControl
          aria-label="Status"
          data={STATUS_FILTERS}
          value={status ?? ''}
          onChange={(value) => update({ status: value || null, page: null })}
        />
      </Group>
      <QueryState query={users}>
        {(data) => (
          <Paper withBorder radius="md">
            {data.items.length === 0 ? (
              <Text c="dimmed" size="sm" p="lg">
                No users match.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={720}>
                <Table highlightOnHover verticalSpacing="sm" aria-label="Users">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Mobile</Table.Th>
                      <Table.Th>Roles</Table.Th>
                      <Table.Th>Joined</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.items.map((user) => (
                      <Table.Tr
                        key={user.userId}
                        style={{ cursor: 'pointer' }}
                        onClick={() => void navigate(`/admin/users/${encodeURIComponent(user.userId)}`)}
                      >
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <UserAvatar userId={user.userId} name={user.fullName} photoVersion={user.photoVersion} size="md" />
                            <div>
                              <Text size="sm" fw={500}>
                                {user.fullName}
                                {!user.active && (
                                  <Badge ml={6} size="xs" color="red" variant="light">
                                    Inactive
                                  </Badge>
                                )}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {user.email ?? 'No email'} · {user.userId}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{user.phone ?? '—'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {user.roles.map((r) => (
                              <Badge key={r} size="sm" variant="light" color={ROLE_COLORS[r]}>
                                {ROLE_LABELS[r]}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatDate(user.createdAt)}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            <Group justify="space-between" p="sm">
              <Text size="sm" c="dimmed">
                {data.total.toLocaleString('en-IN')} {data.total === 1 ? 'user' : 'users'}
              </Text>
              {data.total > PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(data.total / PAGE_SIZE)}
                  value={page}
                  onChange={(next) => update({ page: next === 1 ? null : String(next) })}
                  size="sm"
                />
              )}
            </Group>
          </Paper>
        )}
      </QueryState>
    </Stack>
  )
}
