import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { CategoryNode } from '../../api/types'
import {
  useAdminCategories,
  useCategorySpecKeys,
  useCreateCategory,
  useDeleteCategory,
  useEditCategory,
  useSaveCategorySpecKeys,
} from '../../admin/queries'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'

type Editing = { mode: 'new'; parentId: number | null } | { mode: 'edit'; category: CategoryNode } | null

/**
 * The shop's categories, two levels deep. A category with products cannot be deleted, only switched
 * off: it then disappears from the shop, and its products stay on sale under "All".
 */
export function CategoriesPage() {
  const categories = useAdminCategories()
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <Stack gap="md" maw={900}>
      <Group justify="space-between">
        <div>
          <Title order={2}>Categories</Title>
          <Text size="sm" c="dimmed">
            Main categories show as filters in the shop; sub-categories group products inside them.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ mode: 'new', parentId: null })}>
          New category
        </Button>
      </Group>
      <QueryState query={categories}>
        {(tree) =>
          tree.length === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Text c="dimmed" ta="center">
                No categories yet. Add one, then choose it on each product’s page.
              </Text>
            </Paper>
          ) : (
            <Paper withBorder radius="md">
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Address</Table.Th>
                    <Table.Th ta="right">Products</Table.Th>
                    <Table.Th>Shown</Table.Th>
                    <Table.Th w={170} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tree.flatMap((main, i) => [
                    <CategoryRow
                      key={main.id}
                      category={main}
                      siblings={tree}
                      index={i}
                      onEdit={() => setEditing({ mode: 'edit', category: main })}
                      onAddSub={() => setEditing({ mode: 'new', parentId: main.id })}
                    />,
                    ...main.children.map((sub, j) => (
                      <CategoryRow
                        key={sub.id}
                        category={sub}
                        siblings={main.children}
                        index={j}
                        sub
                        onEdit={() => setEditing({ mode: 'edit', category: sub })}
                      />
                    )),
                  ])}
                </Table.Tbody>
              </Table>
            </Paper>
          )
        }
      </QueryState>
      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Edit category' : 'New category'}
      >
        {editing && (
          <CategoryForm editing={editing} tree={categories.data ?? []} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </Stack>
  )
}

function CategoryRow({
  category: c,
  siblings,
  index,
  sub,
  onEdit,
  onAddSub,
}: {
  category: CategoryNode
  siblings: CategoryNode[]
  index: number
  sub?: boolean
  onEdit: () => void
  onAddSub?: () => void
}) {
  const edit = useEditCategory()
  const remove = useDeleteCategory()
  const products = c.productCount ?? 0
  const blocked = products > 0 || c.children.length > 0

  // New categories all start at 0, so swapping two numbers is not enough: the siblings are
  // numbered 10, 20, 30… in their new order, and only the ones that change are saved
  const move = (offset: -1 | 1) => {
    const order = [...siblings]
    const [moved] = order.splice(index, 1)
    order.splice(index + offset, 0, moved)
    order.forEach((sibling, i) => {
      const sortOrder = (i + 1) * 10
      if (sibling.sortOrder !== sortOrder) edit.mutate({ id: sibling.id, input: { sortOrder } })
    })
  }

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete “${c.name}”?`,
      children: <Text size="sm">It has no products and no sub-categories, so nothing else changes.</Text>,
      labels: { confirm: 'Delete', cancel: 'Keep' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(c.id, {
          onError: (error) => notifications.show({ color: 'red', title: 'Not deleted', message: errorMessage(error) }),
        }),
    })

  return (
    <Table.Tr>
      <Table.Td pl={sub ? 'xl' : undefined}>
        <Text fw={sub ? 400 : 600} size="sm">
          {sub ? '↳ ' : ''}
          {c.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">
          /shop?category={c.slug}
        </Text>
      </Table.Td>
      <Table.Td ta="right">{products}</Table.Td>
      <Table.Td>
        <Switch
          aria-label={`Show ${c.name} in the shop`}
          checked={c.active}
          onChange={(e) => edit.mutate({ id: c.id, input: { active: e.currentTarget.checked } })}
        />
      </Table.Td>
      <Table.Td>
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <ActionIcon variant="subtle" aria-label={`Move ${c.name} up`} disabled={index === 0} onClick={() => move(-1)}>
            <IconArrowUp size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            aria-label={`Move ${c.name} down`}
            disabled={index === siblings.length - 1}
            onClick={() => move(1)}
          >
            <IconArrowDown size={16} />
          </ActionIcon>
          {onAddSub && (
            <Tooltip label="Add a sub-category">
              <ActionIcon variant="subtle" aria-label={`Add a sub-category to ${c.name}`} onClick={onAddSub}>
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <ActionIcon variant="subtle" aria-label={`Edit ${c.name}`} onClick={onEdit}>
            <IconPencil size={16} />
          </ActionIcon>
          <Tooltip label={blocked ? 'Has products or sub-categories: switch it off instead' : 'Delete'}>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Delete ${c.name}`}
              disabled={blocked}
              onClick={confirmDelete}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

function CategoryForm({ editing, tree, onDone }: { editing: NonNullable<Editing>; tree: CategoryNode[]; onDone: () => void }) {
  const create = useCreateCategory()
  const edit = useEditCategory()
  const current = editing.mode === 'edit' ? editing.category : null
  const [name, setName] = useState(current?.name ?? '')
  const [slug, setSlug] = useState(current?.slug ?? '')
  const [parent, setParent] = useState<string>(
    String(editing.mode === 'new' ? (editing.parentId ?? 0) : (current?.parentId ?? 0)),
  )
  const [touched, setTouched] = useState(false)
  const [gstRule, setGstRule] = useState<string>(current?.gstRule ?? '')
  const specKeys = useCategorySpecKeys(current?.id ?? null)
  const saveKeys = useSaveCategorySpecKeys()
  const [keys, setKeys] = useState<string[] | null>(null)
  const shownKeys = keys ?? specKeys.data ?? []
  // A category with sub-categories must stay a main one
  const canHaveParent = !current || current.children.length === 0
  const parents = [
    { value: '0', label: '— None: a main category —' },
    ...tree.filter((m) => m.id !== current?.id).map((m) => ({ value: String(m.id), label: m.name })),
  ]

  const submit = () => {
    setTouched(true)
    if (!name.trim()) return
    const handlers = {
      onSuccess: (saved: CategoryNode) => {
        if (keys !== null) saveKeys.mutate({ id: saved.id, names: keys })
        notifications.show({ color: 'green', title: 'Saved', message: name.trim() })
        onDone()
      },
      onError: (error: unknown) => notifications.show({ color: 'red', title: 'Not saved', message: errorMessage(error) }),
    }
    if (current) {
      edit.mutate(
        { id: current.id, input: { name: name.trim(), slug: slug.trim() || undefined, parentId: Number(parent), gstRule } },
        handlers,
      )
    } else {
      create.mutate(
        { name: name.trim(), slug: slug.trim() || undefined, parentId: Number(parent) || undefined, gstRule: gstRule || undefined },
        handlers,
      )
    }
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        withAsterisk
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        maxLength={120}
        error={touched && !name.trim() ? 'Enter a name' : undefined}
      />
      <TextInput
        label="Address in the shop"
        description="Optional: made from the name if empty, e.g. “gel-pens”"
        value={slug}
        onChange={(e) => setSlug(e.currentTarget.value.toLowerCase())}
        leftSection={<Text size="xs" c="dimmed" pl={4}>/</Text>}
        maxLength={80}
      />
      <Select
        label="Inside"
        data={parents}
        value={parent}
        onChange={(v) => setParent(v ?? '0')}
        allowDeselect={false}
        disabled={!canHaveParent}
        description={canHaveParent ? undefined : 'It has sub-categories, so it stays a main category'}
      />
      <Select
        label="GST"
        description="Clothing and footwear: the rate follows each product's price"
        data={[
          { value: '', label: "Each product's own rate" },
          { value: 'APPAREL_2500', label: 'Clothing & footwear: 5% up to ₹2,500 a piece, 18% above' },
        ]}
        value={gstRule}
        onChange={(v) => setGstRule(v ?? '')}
        allowDeselect={false}
      />
      <TagsInput
        label="Suggested specifications"
        description="Offered on each product's page in this category, e.g. RAM, Storage"
        value={shownKeys}
        onChange={setKeys}
        maxTags={30}
        clearable
      />
      {current && !current.active && (
        <Badge color="gray" variant="light" w="fit-content">
          Hidden from the shop
        </Badge>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={create.isPending || edit.isPending}>
          Save
        </Button>
      </Group>
    </Stack>
  )
}
