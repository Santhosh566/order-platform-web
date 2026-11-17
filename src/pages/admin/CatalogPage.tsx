import { zodResolver } from '@hookform/resolvers/zod'
import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { GST_OPTIONS, newProductSchema, type NewProductValues } from '../../admin/catalogSchema'
import { useAdminCatalog, useAdminCategories, useCreateProduct } from '../../admin/queries'
import { categoryOptions } from '../../lib/images'
import { QueryState } from '../../components/QueryState'
import { errorMessage } from '../../lib/errors'
import { formatMoney, formatRate } from '../../lib/format'

/** Products with price and stock; open one for its prices, stock changes and history. */
export function CatalogPage() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [q] = useDebouncedValue(text, 300)
  const [includeInactive, setIncludeInactive] = useState(true)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const catalog = useAdminCatalog({ q, includeInactive, page: page - 1, size: 25 })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Catalogue & stock</Title>
        <Button leftSection={<IconPlus size={18} />} onClick={() => setCreating(true)}>
          New product
        </Button>
      </Group>
      <Group gap="md" align="flex-end">
        <TextInput
          label="Search"
          placeholder="SKU or name"
          leftSection={<IconSearch size={16} />}
          value={text}
          onChange={(e) => {
            setText(e.currentTarget.value)
            setPage(1)
          }}
          w={{ base: '100%', sm: 300 }}
        />
        <Switch
          label="Show products off sale"
          checked={includeInactive}
          onChange={(e) => {
            setIncludeInactive(e.currentTarget.checked)
            setPage(1)
          }}
          mb={8}
        />
      </Group>

      <QueryState query={catalog}>
        {(result) =>
          result.items.length === 0 ? (
            <Text c="dimmed">No products match.</Text>
          ) : (
            <Stack gap="sm">
              <Paper withBorder radius="md">
                <Table.ScrollContainer minWidth={820}>
                  <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Product</Table.Th>
                        <Table.Th ta="right">Price (incl. GST)</Table.Th>
                        <Table.Th ta="right">GST</Table.Th>
                        <Table.Th ta="right">Available</Table.Th>
                        <Table.Th ta="right">Reserved</Table.Th>
                        <Table.Th ta="right">Reorder at</Table.Th>
                        <Table.Th>State</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.items.map((p) => (
                        <Table.Tr
                          key={p.sku}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/catalog/${encodeURIComponent(p.sku)}`)}
                        >
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {p.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {p.sku}
                              {p.hsnCode && <> · HSN {p.hsnCode}</>}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">{formatMoney(p.unitPrice, p.currency)}</Table.Td>
                          <Table.Td ta="right">{formatRate(p.gstRate)}</Table.Td>
                          <Table.Td ta="right" fw={p.lowStock ? 700 : undefined}>
                            {p.available}
                          </Table.Td>
                          <Table.Td ta="right">{p.reserved}</Table.Td>
                          <Table.Td ta="right">{p.reorderLevel}</Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              {!p.active && (
                                <Badge size="sm" color="gray" variant="light">
                                  Off sale
                                </Badge>
                              )}
                              {p.lowStock && (
                                <Badge size="sm" color="orange" variant="light">
                                  Low stock
                                </Badge>
                              )}
                              {p.unitPrice === null && (
                                <Badge size="sm" color="red" variant="light">
                                  No price
                                </Badge>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {result.totalItems} products
                </Text>
                {result.totalPages > 1 && (
                  <Pagination total={result.totalPages} value={page} onChange={setPage} size="sm" />
                )}
              </Group>
            </Stack>
          )
        }
      </QueryState>

      <Modal opened={creating} onClose={() => setCreating(false)} title="New product" size="lg">
        <NewProductForm
          onCreated={(sku) => {
            setCreating(false)
            navigate(`/admin/catalog/${encodeURIComponent(sku)}`)
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </Stack>
  )
}

function NewProductForm({ onCreated, onCancel }: { onCreated: (sku: string) => void; onCancel: () => void }) {
  const create = useCreateProduct()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewProductValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: {
      sku: '',
      name: '',
      hsnCode: '',
      gstRate: '18',
      openingStock: 0,
      reorderLevel: 5,
      categoryId: '',
      description: '',
    },
  })
  const categories = useAdminCategories()

  const submit = handleSubmit((values) => {
    const parsed = newProductSchema.parse(values)
    create.mutate(
      {
        ...parsed,
        gstRate: Number(parsed.gstRate),
        categoryId: parsed.categoryId ? Number(parsed.categoryId) : null,
        description: parsed.description.trim() || undefined,
      },
      {
        onSuccess: (product) => {
          notifications.show({ color: 'green', title: 'Product created', message: `${product.name} is on sale.` })
          onCreated(product.sku)
        },
        onError: (error) => notifications.show({ color: 'red', title: 'Not created', message: errorMessage(error) }),
      },
    )
  })

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput label="SKU" withAsterisk error={errors.sku?.message} {...register('sku')} />
          <TextInput label="HSN code" withAsterisk inputMode="numeric" error={errors.hsnCode?.message} {...register('hsnCode')} />
        </SimpleGrid>
        <TextInput label="Name" withAsterisk error={errors.name?.message} {...register('name')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Controller
            control={control}
            name="unitPrice"
            render={({ field }) => (
              <NumberInput
                label="Price including GST"
                withAsterisk
                prefix="₹"
                decimalScale={2}
                thousandSeparator=","
                min={0}
                value={field.value ?? ''}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : undefined)}
                onBlur={field.onBlur}
                error={errors.unitPrice?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="gstRate"
            render={({ field }) => (
              <Select
                label="GST rate"
                withAsterisk
                data={GST_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v ?? '')}
                error={errors.gstRate?.message}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={control}
            name="openingStock"
            render={({ field }) => (
              <NumberInput
                label="Opening stock"
                min={0}
                allowDecimal={false}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)}
                error={errors.openingStock?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="reorderLevel"
            render={({ field }) => (
              <NumberInput
                label="Reorder level"
                description="Low-stock alert at or below this"
                min={0}
                allowDecimal={false}
                value={field.value}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)}
                error={errors.reorderLevel?.message}
              />
            )}
          />
        </SimpleGrid>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              label="Category"
              placeholder="No category"
              data={categoryOptions(categories.data ?? [])}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              clearable
              searchable
            />
          )}
        />
        <Textarea
          label="Description"
          description="Optional. Plain text; leave a blank line between paragraphs. Photos are added on the product page."
          autosize
          minRows={3}
          maxRows={8}
          error={errors.description?.message}
          {...register('description')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create product
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
