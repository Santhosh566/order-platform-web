import type { PickupStatus, ReturnStatus } from '../api/types'

/** Where a return stands, in the customer's words. An approved return also says how its pickup is going. */
export function returnLabel(status: ReturnStatus, pickupStatus?: PickupStatus | null): { label: string; color: string } {
  switch (status) {
    case 'REQUESTED':
      return { label: 'Waiting for review', color: 'blue' }
    case 'APPROVED':
      if (pickupStatus === 'ON_THE_WAY') return { label: 'Driver on the way', color: 'orange' }
      if (pickupStatus === 'ASSIGNED') return { label: 'Pickup scheduled', color: 'orange' }
      return { label: 'Approved – arranging pickup', color: 'orange' }
    case 'PICKED_UP':
      return { label: 'Picked up – being checked', color: 'indigo' }
    case 'REJECTED':
      return { label: 'Not accepted', color: 'red' }
    case 'REFUNDED':
      return { label: 'Refunded', color: 'green' }
  }
}
