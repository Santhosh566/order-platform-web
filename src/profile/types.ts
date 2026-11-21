import type { Role } from '../api/types'

export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
export type VehicleType = 'BIKE' | 'SCOOTER' | 'EV_SCOOTER' | 'CYCLE' | 'CAR' | 'VAN' | 'ON_FOOT'

export interface CustomerPart {
  dateOfBirth: string | null
  gender: Gender | null
  /** Emails about a cart left without ordering, with their offers; order emails go out regardless */
  cartReminders?: boolean | null
}

export interface DriverPart {
  vehicleType: VehicleType | null
  vehicleNumber: string | null
  licenceNumber: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  upiId: string | null
}

export interface StaffPart {
  jobTitle: string | null
  department: string | null
}

/** GET /api/me/profile: a part is null when the user does not have that role. */
export interface Profile {
  userId: string
  email: string | null
  roles: Role[]
  fullName: string
  phone: string | null
  hasPhoto: boolean
  photoUpdatedAt: string | null
  memberSince: string
  customer: CustomerPart | null
  driver: DriverPart | null
  staff: StaffPart | null
}

/** PUT /api/me/profile */
export interface ProfileUpdate {
  fullName: string
  phone: string | null
  customer?: CustomerPart
  driver?: DriverPart
  staff?: StaffPart
}

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
}

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  BIKE: 'Motorbike',
  SCOOTER: 'Scooter',
  EV_SCOOTER: 'Electric scooter',
  CYCLE: 'Bicycle',
  CAR: 'Car',
  VAN: 'Van',
  ON_FOOT: 'On foot',
}

/** Needs a registration number and a driving licence (UserProfile.VehicleType.isMotorised). */
export function isMotorised(vehicle: VehicleType | null): boolean {
  return vehicle !== null && vehicle !== 'CYCLE' && vehicle !== 'ON_FOOT'
}
