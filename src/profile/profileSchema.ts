import { z } from 'zod'
import type { Gender, Profile, ProfileUpdate, VehicleType } from './types'
import { isMotorised } from './types'

/** The same checks as ProfileService; the server checks again. Empty optional fields are ''. */
const MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/
const VEHICLE = /^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/
const LICENCE = /^[A-Z]{2}\d{13}$/
const UPI = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/

const digits = (value: string) => value.replace(/[\s()-]/g, '')
const plate = (value: string) => value.replace(/[\s-]/g, '').toUpperCase()

export function isMobile(value: string): boolean {
  return MOBILE.test(digits(value))
}

/** Age in whole years on `today`. */
export function ageOn(dateOfBirth: string, today: Date): number {
  const born = new Date(`${dateOfBirth}T00:00:00`)
  let age = today.getFullYear() - born.getFullYear()
  const beforeBirthday =
    today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export function profileSchema(roles: { customer: boolean; driver: boolean; staff: boolean }) {
  return z
    .object({
      fullName: z.string().trim().min(2, 'At least 2 characters').max(100, 'At most 100 characters'),
      phone: z.string(),
      dateOfBirth: z.string(),
      gender: z.string(),
      vehicleType: z.string(),
      vehicleNumber: z.string(),
      licenceNumber: z.string(),
      emergencyContactName: z.string().max(100, 'At most 100 characters'),
      emergencyContactPhone: z.string(),
      upiId: z.string(),
      jobTitle: z.string().max(100, 'At most 100 characters'),
      department: z.string().max(100, 'At most 100 characters'),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (v.phone.trim() && !isMobile(v.phone)) issue('phone', 'A 10-digit Indian mobile number')
      if (roles.driver && !v.phone.trim()) issue('phone', 'Customers call this number about their delivery')
      if (roles.customer && v.dateOfBirth) {
        const age = ageOn(v.dateOfBirth, new Date())
        if (Number.isNaN(age) || age > 120) issue('dateOfBirth', 'Check the date')
        else if (age < 18) issue('dateOfBirth', 'You must be at least 18')
      }
      if (roles.driver) {
        if (!v.vehicleType) issue('vehicleType', 'Choose how you deliver')
        if (isMotorised((v.vehicleType || null) as VehicleType | null)) {
          if (!VEHICLE.test(plate(v.vehicleNumber))) issue('vehicleNumber', 'Like KA01AB1234 (or 22BH1234AA)')
          if (!LICENCE.test(plate(v.licenceNumber))) issue('licenceNumber', '15 characters, like KA0120190001234')
        }
        const name = v.emergencyContactName.trim()
        const phone = v.emergencyContactPhone.trim()
        if (name && !phone) issue('emergencyContactPhone', 'Add their number too')
        if (phone && !name) issue('emergencyContactName', 'Add their name too')
        if (phone && !isMobile(phone)) issue('emergencyContactPhone', 'A 10-digit Indian mobile number')
        else if (phone && v.phone && digits(phone).slice(-10) === digits(v.phone).slice(-10))
          issue('emergencyContactPhone', 'Someone else’s number, not your own')
        if (v.upiId.trim() && !UPI.test(v.upiId.trim())) issue('upiId', 'Like name@bank')
      }
    })
}

export type ProfileValues = z.infer<ReturnType<typeof profileSchema>>

export function toFormValues(profile: Profile): ProfileValues {
  return {
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    dateOfBirth: profile.customer?.dateOfBirth ?? '',
    gender: profile.customer?.gender ?? '',
    vehicleType: profile.driver?.vehicleType ?? '',
    vehicleNumber: profile.driver?.vehicleNumber ?? '',
    licenceNumber: profile.driver?.licenceNumber ?? '',
    emergencyContactName: profile.driver?.emergencyContactName ?? '',
    emergencyContactPhone: profile.driver?.emergencyContactPhone ?? '',
    upiId: profile.driver?.upiId ?? '',
    jobTitle: profile.staff?.jobTitle ?? '',
    department: profile.staff?.department ?? '',
  }
}

const orNull = (value: string) => (value.trim() ? value.trim() : null)

export function toUpdate(values: ProfileValues, profile: Profile): ProfileUpdate {
  const update: ProfileUpdate = { fullName: values.fullName.trim(), phone: orNull(values.phone) }
  if (profile.customer) {
    update.customer = { dateOfBirth: orNull(values.dateOfBirth), gender: (orNull(values.gender) as Gender | null) }
  }
  if (profile.driver) {
    update.driver = {
      vehicleType: orNull(values.vehicleType) as VehicleType | null,
      vehicleNumber: orNull(values.vehicleNumber),
      licenceNumber: orNull(values.licenceNumber),
      emergencyContactName: orNull(values.emergencyContactName),
      emergencyContactPhone: orNull(values.emergencyContactPhone),
      upiId: orNull(values.upiId),
    }
  }
  if (profile.staff) {
    update.staff = { jobTitle: orNull(values.jobTitle), department: orNull(values.department) }
  }
  return update
}
