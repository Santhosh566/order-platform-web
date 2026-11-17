import { z } from 'zod'
import type { ShippingAddress } from '../api/types'
import { findState, INDIAN_STATES } from '../lib/indianStates'

/** The same rules as OrderValidator.validateAddress, checked before the request is sent. */
export const addressSchema = z.object({
  recipientName: z.string().trim().min(1, 'Enter the name of the person receiving the parcel').max(255),
  recipientPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{5,30}$/, 'Enter a phone number the driver can call'),
  line1: z.string().trim().min(1, 'Enter the house number and street').max(255),
  line2: z.string().trim().max(255),
  city: z.string().trim().min(1, 'Enter the city or town').max(255),
  state: z.string().refine((value) => INDIAN_STATES.some((s) => s.name === value), 'Choose a state'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Enter a 6-digit PIN code'),
})

export type AddressValues = z.infer<typeof addressSchema>

export function toFormValues(address: ShippingAddress | null | undefined): AddressValues {
  // A saved address may hold an abbreviation or code; show the name the select knows
  const state = findState(address?.state)?.name ?? ''
  return {
    recipientName: address?.recipientName ?? '',
    recipientPhone: address?.recipientPhone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    state,
    postalCode: address?.postalCode ?? '',
  }
}

export function toAddress(values: AddressValues): ShippingAddress {
  return {
    recipientName: values.recipientName.trim(),
    recipientPhone: values.recipientPhone.trim(),
    line1: values.line1.trim(),
    line2: values.line2.trim() || null,
    city: values.city.trim(),
    state: values.state,
    postalCode: values.postalCode.trim(),
    country: 'IN',
  }
}
