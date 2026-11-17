import {
  IconChartBar,
  IconArrowBackUp,
  IconBuildingWarehouse,
  IconCalendarOff,
  IconCategory,
  IconDashboard,
  IconDiscount,
  IconHeart,
  IconListDetails,
  IconMapPin,
  IconMessageStar,
  IconStar,
  IconPackage,
  IconReceipt,
  IconSettingsAutomation,
  IconSpeakerphone,
  IconUsers,
  IconShoppingBag,
  IconShoppingCart,
  IconTruckDelivery,
  type Icon,
} from '@tabler/icons-react'
import type { Role } from '../api/types'

export interface NavItem {
  label: string
  to: string
  icon: Icon
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const SECTIONS: Record<Exclude<Role, 'SERVICE'>, NavSection> = {
  CUSTOMER: {
    title: 'Shop',
    items: [
      { label: 'Products', to: '/shop', icon: IconShoppingBag },
      { label: 'Cart', to: '/cart', icon: IconShoppingCart },
      { label: 'Wishlist', to: '/wishlist', icon: IconHeart },
      { label: 'My orders', to: '/orders', icon: IconReceipt },
      { label: 'My returns', to: '/returns', icon: IconArrowBackUp },
      { label: 'My reviews', to: '/reviews', icon: IconStar },
      { label: 'Delivery address', to: '/account/address', icon: IconMapPin },
    ],
  },
  ADMIN: {
    title: 'Administration',
    items: [
      { label: 'Dashboard', to: '/admin', icon: IconDashboard },
      { label: 'Orders', to: '/admin/orders', icon: IconListDetails },
      { label: 'Catalogue & stock', to: '/admin/catalog', icon: IconPackage },
      { label: 'Categories', to: '/admin/categories', icon: IconCategory },
      { label: 'Returns & refunds', to: '/admin/returns', icon: IconArrowBackUp },
      { label: 'Reviews', to: '/admin/reviews', icon: IconMessageStar },
      { label: 'Coupons', to: '/admin/coupons', icon: IconDiscount },
      { label: 'Promotions', to: '/admin/promotions', icon: IconSpeakerphone },
      { label: 'Deliveries', to: '/admin/deliveries', icon: IconBuildingWarehouse },
      { label: 'Delivery holidays', to: '/admin/holidays', icon: IconCalendarOff },
      { label: 'Users', to: '/admin/users', icon: IconUsers },
      { label: 'Operations', to: '/admin/ops', icon: IconSettingsAutomation },
    ],
  },
  DELIVERY: {
    title: 'Deliveries',
    items: [
      { label: 'Available orders', to: '/delivery', icon: IconTruckDelivery },
      { label: 'My deliveries', to: '/delivery/mine', icon: IconListDetails },
      { label: 'My dashboard', to: '/delivery/dashboard', icon: IconChartBar },
    ],
  },
}

/** The menu a user sees: one section per role they hold, in a fixed order. */
export function navigationFor(roles: readonly Role[]): NavSection[] {
  const order: Array<keyof typeof SECTIONS> = ['CUSTOMER', 'DELIVERY', 'ADMIN']
  return order.filter((role) => roles.includes(role)).map((role) => SECTIONS[role])
}
