import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

/** Calendar periods in India time; weeks start on Monday. */
export type StatsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export const PERIODS: readonly StatsPeriod[] = ['DAY', 'WEEK', 'MONTH', 'YEAR']

export const PERIOD_LABELS: Record<StatsPeriod, string> = {
  DAY: 'Today',
  WEEK: 'This week',
  MONTH: 'This month',
  YEAR: 'This year',
}

export const PERIOD_SHORT: Record<StatsPeriod, string> = { DAY: 'Day', WEEK: 'Week', MONTH: 'Month', YEAR: 'Year' }

/** What the comparison is with: the same stretch of the period before. */
export const PREVIOUS_LABELS: Record<StatsPeriod, string> = {
  DAY: 'yesterday',
  WEEK: 'last week',
  MONTH: 'last month',
  YEAR: 'last year',
}

export interface DriverFigures {
  delivered: number
  pickupsCollected: number
  /** Deliveries + pickups collected */
  completed: number
  failed: number
  /** Deliveries and pickups given to the driver in the period */
  tasks: number
  /** 0 to 1; null when nothing was completed or failed */
  successRate: number | null
  cashCollected: number
  /** What the finished attempts pay */
  earnings: number
  /** Customers' average rating of the period's deliveries; null when none were rated */
  rating: number | null
  ratingCount: number
}

export interface PeriodFigures {
  period: StatsPeriod
  from: string
  to: string
  figures: DriverFigures
  /** The same stretch of the period before */
  previous: DriverFigures
}

export interface DriverSummary {
  driverId: string
  driverName: string
  openNow: { deliveries: number; pickups: number }
  periods: Record<StatsPeriod, PeriodFigures>
  /** The newest customer comments, without who wrote them */
  feedback: { rating: number; comment: string; ratedAt: string }[]
}

export interface HistoryBucket {
  start: string
  label: string
  delivered: number
  pickupsCollected: number
  failed: number
}

export interface DriverHistory {
  period: StatsPeriod
  from: string
  to: string
  buckets: HistoryBucket[]
}

export interface LeaderboardRow {
  driverId: string
  driverName: string
  figures: DriverFigures
}

export interface Leaderboard {
  period: StatsPeriod
  from: string
  to: string
  drivers: LeaderboardRow[]
}

const REFRESH_MS = 60_000

export const statsKeys = {
  mine: ['delivery', 'stats'] as const,
  history: (driverId: string | null, period: StatsPeriod) => ['delivery', 'stats', 'history', driverId, period] as const,
  driver: (driverId: string) => ['admin', 'drivers', driverId, 'stats'] as const,
  leaderboard: (period: StatsPeriod) => ['admin', 'drivers', 'stats', period] as const,
}

/** The signed-in driver's figures. */
export function useMyStats() {
  return useQuery({
    queryKey: statsKeys.mine,
    queryFn: ({ signal }) => api<DriverSummary>('/api/delivery/stats', { signal }),
    refetchInterval: REFRESH_MS,
  })
}

/** A driver's figures for an admin. */
export function useDriverStats(driverId: string | null) {
  return useQuery({
    queryKey: statsKeys.driver(driverId ?? ''),
    queryFn: ({ signal }) =>
      api<DriverSummary>(`/api/admin/delivery/drivers/${encodeURIComponent(driverId ?? '')}/stats`, { signal }),
    enabled: driverId !== null,
  })
}

/** The chart's bars: the driver's own (driverId null) or, for an admin, a given driver's. */
export function useStatsHistory(driverId: string | null, period: StatsPeriod) {
  const path =
    driverId === null
      ? '/api/delivery/stats/history'
      : `/api/admin/delivery/drivers/${encodeURIComponent(driverId)}/stats/history`
  return useQuery({
    queryKey: statsKeys.history(driverId, period),
    queryFn: ({ signal }) => api<DriverHistory>(`${path}?period=${period}`, { signal }),
    refetchInterval: REFRESH_MS,
  })
}

export function useLeaderboard(period: StatsPeriod) {
  return useQuery({
    queryKey: statsKeys.leaderboard(period),
    queryFn: ({ signal }) => api<Leaderboard>(`/api/admin/delivery/drivers/stats?period=${period}`, { signal }),
  })
}

/** "▲ 12% vs last week", or null when there is nothing to compare with. */
export function change(now: number, before: number): { text: string; up: boolean | null } | null {
  if (before === 0) {
    return now === 0 ? null : { text: 'new', up: true }
  }
  const pct = Math.round(((now - before) / before) * 100)
  if (pct === 0) return { text: 'same', up: null }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, up: pct > 0 }
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

/** A round top for the scale: 4, 10, 20, 50, ... */
export function niceMax(value: number): number {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude
  }
  return 10 * magnitude
}
