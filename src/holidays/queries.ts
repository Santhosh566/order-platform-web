import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

/** A day without deliveries; stateCode null means the whole country. */
export interface Holiday {
  id: number
  day: string
  name: string
  stateCode: string | null
  stateName: string | null
}

export interface NewHoliday {
  day: string
  name: string
  /** A state's name or GST code; null for the whole country */
  stateCode: string | null
}

const key = (year: number) => ['admin', 'holidays', year] as const

export function useHolidays(year: number) {
  return useQuery({
    queryKey: key(year),
    queryFn: ({ signal }) => api<Holiday[]>(`/api/admin/holidays?year=${year}`, { signal }),
  })
}

export function useAddHoliday() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (holiday: NewHoliday) => api<Holiday>('/api/admin/holidays', { method: 'POST', body: holiday }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'holidays'] })
      // Delivery dates in the shop change with the calendar
      void client.invalidateQueries({ queryKey: ['catalogue', 'delivery'] })
    },
  })
}

export function useRemoveHoliday() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/admin/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'holidays'] })
      void client.invalidateQueries({ queryKey: ['catalogue', 'delivery'] })
    },
  })
}
