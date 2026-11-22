import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { fakeBackend } from '../test/fakeBackend'
import { fakeAuth, renderWithProviders } from '../test/render'
import { LiveTrackingCard, TrackingView } from './LiveTrackingCard'
import { ago, metresBetween, type Tracking } from './queries'
import { useShareLocation } from './useShareLocation'

// jsdom cannot lay out a Leaflet map; the points it would draw are enough
vi.mock('./TrackingMap', () => ({
  default: ({ points }: { points: Array<{ label: string; kind: string }> }) => (
    <div data-testid="map">{points.map((p) => `${p.kind}:${p.label}`).join(' ')}</div>
  ),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const LIVE: Tracking = {
  orderId: 'ORD-1',
  status: 'OUT_FOR_DELIVERY',
  live: true,
  message: null,
  driverName: 'Ravi',
  driver: { latitude: 12.9352, longitude: 77.6245, accuracyM: 15, headingDeg: null, recordedAt: new Date().toISOString(), stale: false },
  destination: { latitude: 12.97, longitude: 77.64, approximate: true, label: 'PIN 560038, Bengaluru', areaRadiusM: 1000 },
  distanceKm: 5.9,
  etaMinutes: 18,
  etaAt: '2026-11-21T19:42:00',
  inYourArea: false,
}

describe('live tracking card', () => {
  it('shows the driver, the arrival estimate, and that the destination is approximate', async () => {
    renderWithProviders(<TrackingView tracking={LIVE} />, fakeAuth(['CUSTOMER']))

    expect(screen.getByText('Arriving in about')).toBeInTheDocument()
    expect(screen.getByText('18 min')).toBeInTheDocument()
    expect(screen.getByText('About 5.9 km away by road')).toBeInTheDocument()
    expect(screen.getByText('PIN 560038, Bengaluru')).toBeInTheDocument()
    expect(screen.getByText('Updated just now')).toBeInTheDocument()
    expect(screen.getByText(/the middle of your PIN code, not your door/)).toBeInTheDocument()
    expect(await screen.findByTestId('map')).toHaveTextContent('driver:Ravi destination:Your area')
  })

  it('says when the driver is in the customer’s area', () => {
    renderWithProviders(<TrackingView tracking={{ ...LIVE, inYourArea: true, distanceKm: 0.6, etaMinutes: 2 }} />, fakeAuth(['CUSTOMER']))
    expect(screen.getByText('Ravi is in your area')).toBeInTheDocument()
    expect(screen.getByText(/delivery code ready/)).toBeInTheDocument()
  })

  it('says when the driver was last seen once their phone goes quiet', () => {
    const old = new Date(Date.now() - 6 * 60_000).toISOString()
    renderWithProviders(
      <TrackingView tracking={{ ...LIVE, driver: { ...LIVE.driver!, recordedAt: old, stale: true }, message: 'The driver’s phone has not sent a location for a few minutes' }} />,
      fakeAuth(['CUSTOMER']),
    )
    expect(screen.getByText('Last seen 6 min ago')).toBeInTheDocument()
    expect(screen.getByText(/has not sent a location/)).toBeInTheDocument()
  })

  it('asks for nothing until the order is out for delivery', async () => {
    const backend = fakeBackend({ 'GET /api/orders/ORD-1/tracking': { body: LIVE } })
    const before = renderWithProviders(<LiveTrackingCard orderId="ORD-1" status="IN_TRANSIT" />, fakeAuth(['CUSTOMER']))
    expect(before.container.textContent).not.toContain('Live tracking')
    expect(backend.sent('GET', '/api/orders/ORD-1/tracking')).toHaveLength(0)
    before.unmount()

    renderWithProviders(<LiveTrackingCard orderId="ORD-1" status="OUT_FOR_DELIVERY" />, fakeAuth(['CUSTOMER']))
    expect(await screen.findByText('18 min')).toBeInTheDocument()
  })
})

describe('sharing the driver’s location', () => {
  type Success = (p: GeolocationPosition) => void
  type Failure = (e: GeolocationPositionError) => void

  function fakeGps() {
    const gps = { success: null as Success | null, failure: null as Failure | null, cleared: 0 }
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        watchPosition: (s: Success, f: Failure) => {
          gps.success = s
          gps.failure = f
          return 7
        },
        clearWatch: () => {
          gps.cleared += 1
        },
      },
    })
    return gps
  }

  const at = (latitude: number, longitude: number) =>
    ({ coords: { latitude, longitude, accuracy: 12, speed: 5, heading: 90 }, timestamp: Date.now() }) as unknown as GeolocationPosition

  it('sends the position, then waits 15 s unless the driver moved, and stops when nothing is out', async () => {
    const gps = fakeGps()
    const backend = fakeBackend({ 'POST /api/delivery/location': { body: { stored: true, ordersTracked: 1, sendEverySeconds: 10 } } })
    const { result, rerender } = renderHook(({ active }) => useShareLocation(active), { initialProps: { active: true } })
    expect(result.current.state).toBe('starting')

    act(() => gps.success!(at(12.9352, 77.6245)))
    await waitFor(() => expect(result.current.state).toBe('sharing'))
    expect(backend.sent('POST', '/api/delivery/location')[0].body).toEqual({
      latitude: 12.9352, longitude: 77.6245, accuracyM: 12, speedMps: 5, headingDeg: 90,
    })

    // A few metres, a moment later: not sent
    act(() => gps.success!(at(12.93521, 77.62451)))
    expect(backend.sent('POST', '/api/delivery/location')).toHaveLength(1)

    rerender({ active: false })
    expect(result.current.state).toBe('off')
    expect(gps.cleared).toBe(1)
  })

  it('tells the driver when the browser blocks the location', () => {
    const gps = fakeGps()
    const { result } = renderHook(() => useShareLocation(true))
    act(() => gps.failure!({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError))
    expect(result.current.state).toBe('denied')
    expect(result.current.problem).toMatch(/Allow it in the browser settings/)
  })

  it('does nothing while no parcel is out', () => {
    const gps = fakeGps()
    const { result } = renderHook(() => useShareLocation(false))
    expect(result.current.state).toBe('off')
    expect(gps.success).toBeNull()
  })
})

describe('helpers', () => {
  it('measures metres between two points', () => {
    expect(metresBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111_195, -2)
    expect(metresBetween({ latitude: 12.97, longitude: 77.64 }, { latitude: 12.97, longitude: 77.64 })).toBe(0)
  })

  it('says how long ago', () => {
    const now = Date.parse('2026-11-21T19:00:00Z')
    expect(ago('2026-11-21T18:59:40Z', now)).toBe('just now')
    expect(ago('2026-11-21T18:55:00Z', now)).toBe('5 min ago')
    expect(ago('2026-11-21T16:00:00Z', now)).toBe('3 h ago')
  })
})
