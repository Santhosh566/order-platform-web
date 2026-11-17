import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import type { ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { ShippingAddress } from '../api/types'
import { INDIAN_STATES } from '../lib/indianStates'
import { addressSchema, toAddress, toFormValues, type AddressValues } from './addressSchema'

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s.name, label: s.name }))

/** A delivery address in India. The parent decides what happens with it. */
export function AddressForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  extraActions,
}: {
  initial: ShippingAddress | null | undefined
  submitLabel: string
  busy?: boolean
  onSubmit: (address: ShippingAddress) => void
  extraActions?: ReactNode
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: toFormValues(initial),
  })

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(toAddress(values)))} noValidate>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Full name"
            autoComplete="name"
            withAsterisk
            error={errors.recipientName?.message}
            {...register('recipientName')}
          />
          <TextInput
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            withAsterisk
            error={errors.recipientPhone?.message}
            {...register('recipientPhone')}
          />
        </SimpleGrid>
        <TextInput
          label="Flat, house no., building, street"
          autoComplete="address-line1"
          withAsterisk
          error={errors.line1?.message}
          {...register('line1')}
        />
        <TextInput
          label="Area, landmark"
          autoComplete="address-line2"
          error={errors.line2?.message}
          {...register('line2')}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <TextInput
            label="City"
            autoComplete="address-level2"
            withAsterisk
            error={errors.city?.message}
            {...register('city')}
          />
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <Select
                label="State"
                data={STATE_OPTIONS}
                searchable
                withAsterisk
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                onBlur={field.onBlur}
                error={errors.state?.message}
              />
            )}
          />
          <TextInput
            label="PIN code"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            withAsterisk
            error={errors.postalCode?.message}
            {...register('postalCode')}
          />
        </SimpleGrid>
        <Group justify="flex-end" gap="sm">
          {extraActions}
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
