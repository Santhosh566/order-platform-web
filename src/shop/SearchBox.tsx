import { Autocomplete, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { useSuggestions, type Suggestion } from './catalogue'

const KIND_LABEL = { PRODUCT: 'Product', CATEGORY: 'Category', BRAND: 'Brand' } as const

/**
 * The shop's search: Enter searches the words; while typing, it offers matching categories, brands
 * and products (typos forgiven by the server).
 */
export function SearchBox({
  initial,
  onSearch,
  onPick,
}: {
  initial: string
  onSearch: (text: string) => void
  onPick: (suggestion: Suggestion) => void
}) {
  const [text, setText] = useState(initial)
  const [debounced] = useDebouncedValue(text, 200)
  const suggestions = useSuggestions(debounced)
  const options = (suggestions.data ?? []).map((s, i) => ({ value: `${i}:${s.label}`, label: s.label, suggestion: s }))

  return (
    <Autocomplete
      aria-label="Search products"
      placeholder="Search products, brands, categories"
      leftSection={<IconSearch size={16} />}
      value={text}
      onChange={setText}
      data={options.map((o) => o.value)}
      filter={({ options: all }) => all}
      renderOption={({ option }) => {
        const found = options.find((o) => o.value === option.value)
        return found ? (
          <div>
            <Text size="sm">{found.label}</Text>
            <Text size="xs" c="dimmed">
              {KIND_LABEL[found.suggestion.kind]}
            </Text>
          </div>
        ) : (
          option.value
        )
      }}
      onOptionSubmit={(value) => {
        const found = options.find((o) => o.value === value)
        if (!found) return
        // A picked product opens it; a category or brand becomes a filter, and the box clears
        setText(found.suggestion.kind === 'PRODUCT' ? found.label : '')
        onPick(found.suggestion)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.defaultPrevented) onSearch(text)
      }}
      w={{ base: '100%', sm: 380 }}
      comboboxProps={{ withinPortal: true }}
    />
  )
}
