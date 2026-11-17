import { lazy, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import type { Role } from './api/types'
import { RequireRole } from './auth/RequireRole'
import { AppLayout } from './layout/AppLayout'
import { HomeRedirect } from './pages/HomeRedirect'
import { NoAccessPage } from './pages/NoAccessPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { WelcomePage } from './pages/WelcomePage'

/**
 * Screens load when first opened, one bundle per page, so a customer never downloads the admin
 * console. AppLayout shows a spinner meanwhile.
 */
function load<K extends string>(factory: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => factory().then((module) => ({ default: module[name] })))
}

const ShopPage = load(() => import('./pages/customer/ShopPage'), 'ShopPage')
const ProductDetailPage = load(() => import('./pages/customer/ProductDetailPage'), 'ProductDetailPage')
const CartPage = load(() => import('./pages/customer/CartPage'), 'CartPage')
const OrdersPage = load(() => import('./pages/customer/OrdersPage'), 'OrdersPage')
const OrderDetailPage = load(() => import('./pages/customer/OrderDetailPage'), 'OrderDetailPage')
const ReturnsPage = load(() => import('./pages/customer/ReturnsPage'), 'ReturnsPage')
const WishlistPage = load(() => import('./pages/customer/WishlistPage'), 'WishlistPage')
const MyReviewsPage = load(() => import('./pages/customer/MyReviewsPage'), 'MyReviewsPage')
const AddressPage = load(() => import('./pages/customer/AddressPage'), 'AddressPage')

const DashboardPage = load(() => import('./pages/admin/DashboardPage'), 'DashboardPage')
const AdminOrdersPage = load(() => import('./pages/admin/AdminOrdersPage'), 'AdminOrdersPage')
const AdminOrderDetailPage = load(() => import('./pages/admin/AdminOrderDetailPage'), 'AdminOrderDetailPage')
const CategoriesPage = load(() => import('./pages/admin/CategoriesPage'), 'CategoriesPage')
const CatalogPage = load(() => import('./pages/admin/CatalogPage'), 'CatalogPage')
const ProductPage = load(() => import('./pages/admin/ProductPage'), 'ProductPage')
const AdminReturnsPage = load(() => import('./pages/admin/AdminReturnsPage'), 'AdminReturnsPage')
const AdminReviewsPage = load(() => import('./pages/admin/AdminReviewsPage'), 'AdminReviewsPage')
const HolidaysPage = load(() => import('./pages/admin/HolidaysPage'), 'HolidaysPage')
const CouponsPage = load(() => import('./pages/admin/CouponsPage'), 'CouponsPage')
const PromotionsPage = load(() => import('./pages/admin/PromotionsPage'), 'PromotionsPage')
const DeliveriesPage = load(() => import('./pages/admin/DeliveriesPage'), 'DeliveriesPage')
const OperationsPage = load(() => import('./pages/admin/OperationsPage'), 'OperationsPage')
const AvailablePage = load(() => import('./pages/delivery/AvailablePage'), 'AvailablePage')
const MyDeliveriesPage = load(() => import('./pages/delivery/MyDeliveriesPage'), 'MyDeliveriesPage')
const DriverDashboardPage = load(() => import('./pages/delivery/DriverDashboardPage'), 'DriverDashboardPage')
const UsersPage = load(() => import('./pages/admin/UsersPage'), 'UsersPage')
const UserDetailPage = load(() => import('./pages/admin/UserDetailPage'), 'UserDetailPage')
const ProfilePage = load(() => import('./pages/ProfilePage'), 'ProfilePage')

/** A finished screen for some roles. */
function screen(path: string, roles: Role[], element: ReactNode): RouteObject {
  return { path, element: <RequireRole roles={roles}>{element}</RequireRole> }
}

const CUSTOMER: Role[] = ['CUSTOMER']
const ADMIN: Role[] = ['ADMIN']
const DELIVERY: Role[] = ['DELIVERY']

export const routes: RouteObject[] = [
  { path: '/welcome', element: <WelcomePage /> },
  {
    element: (
      <RequireRole roles={['CUSTOMER', 'ADMIN', 'DELIVERY']}>
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'no-access', element: <NoAccessPage /> },
      // Everyone signed in has a profile, whatever their role
      { path: 'profile', element: <ProfilePage /> },

      screen('shop', CUSTOMER, <ShopPage />),
      screen('shop/:sku', CUSTOMER, <ProductDetailPage />),
      screen('cart', CUSTOMER, <CartPage />),
      screen('orders', CUSTOMER, <OrdersPage />),
      screen('orders/:orderId', CUSTOMER, <OrderDetailPage />),
      screen('returns', CUSTOMER, <ReturnsPage />),
      screen('wishlist', CUSTOMER, <WishlistPage />),
      screen('reviews', CUSTOMER, <MyReviewsPage />),
      screen('account/address', CUSTOMER, <AddressPage />),

      screen('admin', ADMIN, <DashboardPage />),
      screen('admin/orders', ADMIN, <AdminOrdersPage />),
      screen('admin/orders/:orderId', ADMIN, <AdminOrderDetailPage />),
      screen('admin/catalog', ADMIN, <CatalogPage />),
      screen('admin/catalog/:sku', ADMIN, <ProductPage />),
      screen('admin/categories', ADMIN, <CategoriesPage />),
      screen('admin/returns', ADMIN, <AdminReturnsPage />),
      screen('admin/reviews', ADMIN, <AdminReviewsPage />),
      screen('admin/coupons', ADMIN, <CouponsPage />),
      screen('admin/promotions', ADMIN, <PromotionsPage />),
      screen('admin/deliveries', ADMIN, <DeliveriesPage />),
      screen('admin/holidays', ADMIN, <HolidaysPage />),
      screen('admin/ops', ADMIN, <OperationsPage />),
      screen('admin/users', ADMIN, <UsersPage />),
      screen('admin/users/:userId', ADMIN, <UserDetailPage />),

      screen('delivery', DELIVERY, <AvailablePage />),
      screen('delivery/mine', DELIVERY, <MyDeliveriesPage />),
      screen('delivery/dashboard', DELIVERY, <DriverDashboardPage />),

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
