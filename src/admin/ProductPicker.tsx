import { MultiSelect, Select } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useState } from 'react'
import { useAdminCatalog } from './queries'

export interface PickedProduct {
  sku: string
  name: string
}

/** Products matching what the admin types, searched on the server (the catalogue can be large). */
function useProductOptions(search: string, picked: readonly PickedProduct[]) {
  const [q] = useDebouncedValue(search, 250)
  const found = useAdminCatalog({ q, includeInactive: false, page: 0, size: 20 })
  const options = new Map<string, string>()
  // What is chosen stays in the list, so its label shows even when the search no longer finds it
  picked.forEach((p) => options.set(p.sku, `${p.name} (${p.sku})`))
  found.data?.items.forEach((p) => options.set(p.sku, `${p.name} (${p.sku})`))
  const names = new Map<string, string>(picked.map((p) => [p.sku, p.name]))
  found.data?.items.forEach((p) => names.set(p.sku, p.name))
  return {
    data: [...options].map(([value, label]) => ({ value, label })),
    nameOf: (sku: string) => names.get(sku) ?? sku,
  }
}

export function ProductMultiPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description?: string
  value: PickedProduct[]
  onChange: (value: PickedProduct[]) => void
}) {
  const [search, setSearch] = useState('')
  const { data, nameOf } = useProductOptions(search, value)
  return (
    <MultiSelect
      label={label}
      description={description}
      placeholder={value.length ? undefined : 'Type a name or SKU'}
      data={data}
      value={value.map((p) => p.sku)}
      onChange={(skus) => onChange(skus.map((sku) => ({ sku, name: nameOf(sku) })))}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      // The server already matched; Mantine's own filter would hide SKU matches
      filter={({ options }) => options}
      nothingFoundMessage={search.trim() ? 'No product found' : 'Type to search'}
      clearable
      maxValues={100}
    />
  )
}

export function ProductSelect({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: PickedProduct | null
  onChange: (value: PickedProduct | null) => void
  required?: boolean
}) {
  const [search, setSearch] = useState('')
  const picked = value ? [value] : []
  const { data, nameOf } = useProductOptions(search, picked)
  return (
    <Select
      label={label}
      placeholder="Type a name or SKU"
      data={data}
      value={value?.sku ?? null}
      onChange={(sku) => onChange(sku ? { sku, name: nameOf(sku) } : null)}
      searchable
      onSearchChange={setSearch}
      filter={({ options }) => options}
      nothingFoundMessage="No product found"
      clearable
      required={required}
    />
  )
}
