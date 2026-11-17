import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { graphql } from '../api/graphql'
import { useAuth } from '../auth/AuthContext'

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ReviewSort = 'NEWEST' | 'HIGHEST' | 'LOWEST'

/** A review as its author or an admin sees it. */
export interface Review {
  id: number
  sku: string
  productName: string
  customerId: string
  /** "Alice S." */
  author: string
  orderId: string
  rating: number
  title: string | null
  body: string | null
  status: ReviewStatus
  createdAt: string
  updatedAt: string | null
  decidedAt: string | null
  decidedBy: string | null
  /** Why it was rejected; the customer was emailed it */
  decisionNote: string | null
}

/** A published review on the product page. */
export interface PublicReview {
  id: string
  author: string
  rating: number
  title: string | null
  body: string | null
  createdAt: string
  edited: boolean
  verifiedPurchase: boolean
}

export interface ProductReviews {
  rating: { average: number; count: number; distribution: number[]; reviewCount: number }
  reviews: { items: PublicReview[]; totalItems: number; totalPages: number; page: number; size: number }
}

export interface ToReview {
  sku: string
  name: string
  deliveredAt: string | null
}

export const REVIEWS_PAGE_SIZE = 5

export const PRODUCT_REVIEWS_QUERY = `
  query ProductReviews($sku: ID!, $sort: ReviewSort, $page: Int, $size: Int) {
    product(sku: $sku) {
      rating { average count distribution reviewCount }
      reviews(sort: $sort, page: $page, size: $size) {
        totalItems totalPages page size
        items { id author rating title body createdAt edited verifiedPurchase }
      }
    }
  }`

export const reviewKeys = {
  product: (sku: string) => ['catalogue', 'reviews', sku] as const,
  mine: ['reviews', 'mine'] as const,
  mineFor: (sku: string) => ['reviews', 'mine', sku] as const,
  admin: (status: ReviewStatus) => ['admin', 'reviews', status] as const,
}

/** The rating breakdown and one page of published reviews. */
export function useProductReviews(sku: string, sort: ReviewSort, page: number) {
  return useQuery<ProductReviews | null>({
    queryKey: [...reviewKeys.product(sku), sort, page],
    queryFn: ({ signal }) =>
      graphql<{ product: ProductReviews | null }>(
        PRODUCT_REVIEWS_QUERY,
        { sku, sort, page, size: REVIEWS_PAGE_SIZE },
        signal,
      ).then((d) => d.product),
    placeholderData: keepPreviousData,
  })
}

/** The signed-in customer's reviews and the products they could review. Not fetched for staff. */
export function useMyReviews() {
  const { hasRole } = useAuth()
  return useQuery({
    queryKey: reviewKeys.mine,
    queryFn: ({ signal }) => api<{ reviews: Review[]; toReview: ToReview[] }>('/api/reviews', { signal }),
    enabled: hasRole('CUSTOMER'),
  })
}

/** May the customer review this product, and their review of it if any. */
export function useMyReviewOf(sku: string) {
  const { hasRole } = useAuth()
  return useQuery({
    queryKey: reviewKeys.mineFor(sku),
    queryFn: ({ signal }) =>
      api<{ canReview: boolean; review: Review | null }>(`/api/reviews/${encodeURIComponent(sku)}`, { signal }),
    enabled: hasRole('CUSTOMER'),
  })
}

export interface ReviewInput {
  rating: number
  title: string
  body: string
}

/** After a change the product's numbers and the customer's lists are fetched again. */
function useRefreshAfterReview() {
  const client = useQueryClient()
  return (sku: string) => {
    void client.invalidateQueries({ queryKey: reviewKeys.product(sku) })
    void client.invalidateQueries({ queryKey: ['catalogue', 'product', sku] })
    void client.invalidateQueries({ queryKey: reviewKeys.mine })
  }
}

export function useSubmitReview() {
  const refresh = useRefreshAfterReview()
  return useMutation({
    mutationFn: ({ sku, input }: { sku: string; input: ReviewInput }) =>
      api<Review>(`/api/reviews/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        body: { rating: input.rating, title: input.title.trim() || null, body: input.body.trim() || null },
      }),
    onSuccess: (review) => refresh(review.sku),
  })
}

export function useDeleteReview() {
  const refresh = useRefreshAfterReview()
  return useMutation({
    mutationFn: (sku: string) => api<void>(`/api/reviews/${encodeURIComponent(sku)}`, { method: 'DELETE' }),
    onSuccess: (_, sku) => refresh(sku),
  })
}

export function useAdminReviews(status: ReviewStatus) {
  return useQuery({
    queryKey: reviewKeys.admin(status),
    queryFn: ({ signal }) => api<Review[]>(`/api/admin/reviews?status=${status}`, { signal }),
  })
}

export function useDecideReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: number; approve: boolean; note?: string }) =>
      api<Review>(`/api/admin/reviews/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: approve ? undefined : { note },
      }),
    onSuccess: (review) => {
      void client.invalidateQueries({ queryKey: ['admin', 'reviews'] })
      void client.invalidateQueries({ queryKey: reviewKeys.product(review.sku) })
    },
  })
}
