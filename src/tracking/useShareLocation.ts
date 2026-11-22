import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import { metresBetween } from './queries'

export type ShareState = 'off' | 'starting' | 'sharing' | 'denied' | 'unsupported' | 'error'

export interface Sharing {
  state: ShareState
  /** When the last position reached the server */
  lastSentAt: number | null
  /** Why sharing does not work, for the driver */
  problem: string | null
}

/** A position is sent at least this often while the driver stands still */
export const SEND_EVERY_MS = 15_000
/** ... and sooner once they have moved this far, but never more often than the server keeps (10 s) */
export const SEND_AFTER_METRES = 50
const MIN_GAP_MS = 10_000

/**
 * Shares the phone's position while `active` (the driver has a parcel out for delivery), and stops when it is not.
 * Keeps the screen awake while sharing where the browser allows (Screen Wake Lock), since most phones stop
 * reporting positions to a page whose screen is off.
 */
const STARTING: Sharing = { state: 'starting', lastSentAt: null, problem: null }
const OFF: Sharing = { state: 'off', lastSentAt: null, problem: null }
const UNSUPPORTED: Sharing = { state: 'unsupported', lastSentAt: null, problem: 'This browser cannot share a location.' }

export function useShareLocation(active: boolean): Sharing {
  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation
  // Changed only by the GPS and the server's replies; off and unsupported are worked out below
  const [session, setSession] = useState<Sharing>(STARTING)
  const last = useRef<{ at: number; latitude: number; longitude: number } | null>(null)

  useEffect(() => {
    if (!active || !supported) return
    const geolocation = navigator.geolocation
    let stopped = false
    let sending = false
    let wakeLock: WakeLockSentinel | null = null

    const keepAwake = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // Not allowed (battery saver) or not supported: sharing still works while the screen is on
      }
    }
    void keepAwake()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void keepAwake()
    }
    document.addEventListener('visibilitychange', onVisible)

    const onPosition = (position: GeolocationPosition) => {
      if (stopped || sending) return
      const { latitude, longitude, accuracy, speed, heading } = position.coords
      const now = Date.now()
      const previous = last.current
      const due =
        !previous ||
        now - previous.at >= SEND_EVERY_MS ||
        (now - previous.at >= MIN_GAP_MS && metresBetween(previous, { latitude, longitude }) >= SEND_AFTER_METRES)
      if (!due) return
      sending = true
      api('/api/delivery/location', {
        method: 'POST',
        body: {
          latitude,
          longitude,
          accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
          speedMps: speed != null && Number.isFinite(speed) ? speed : null,
          headingDeg: heading != null && Number.isFinite(heading) ? heading : null,
        },
      })
        .then(() => {
          if (stopped) return
          last.current = { at: now, latitude, longitude }
          setSession({ state: 'sharing', lastSentAt: now, problem: null })
        })
        .catch((error: unknown) => {
          if (stopped) return
          // 409: no parcel out for delivery any more; the page stops sharing when its list catches up
          if (error instanceof ApiError && error.status === 409) return
          const problem = error instanceof Error ? error.message : 'Could not send your location.'
          setSession((s) => ({ ...s, state: 'error', problem }))
        })
        .finally(() => {
          sending = false
        })
    }

    const onError = (error: GeolocationPositionError) => {
      if (stopped) return
      if (error.code === error.PERMISSION_DENIED) {
        setSession((s) => ({
          ...s,
          state: 'denied',
          problem: 'Location is blocked for this site. Allow it in the browser settings so customers can see you coming.',
        }))
      } else {
        setSession((s) => ({ ...s, state: 'error', problem: 'Waiting for a GPS signal…' }))
      }
    }

    const watch = geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 30_000,
    })

    return () => {
      stopped = true
      geolocation.clearWatch(watch)
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLock?.release().catch(() => undefined)
      last.current = null
      // The next delivery starts afresh
      setSession(STARTING)
    }
  }, [active, supported])

  if (!active) return OFF
  if (!supported) return UNSUPPORTED
  return session
}
