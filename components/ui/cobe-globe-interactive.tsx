'use client'

import { useCallback, useEffect, useRef } from 'react'
import createGlobe from 'cobe'

export interface CurrencyMarker {
  id: string
  location: [number, number]
  currency: string
  region: string
  anchor?: 'top' | 'bottom' | 'left' | 'right'
}

const ANCHOR_TRANSFORMS: Record<NonNullable<CurrencyMarker['anchor']>, string> = {
  top: 'translate(-50%, -100%) translateY(-10px)',
  bottom: 'translate(-50%, 0%) translateY(10px)',
  left: 'translate(-100%, -50%) translateX(-10px)',
  right: 'translate(0%, -50%) translateX(10px)',
}

interface GlobeInteractiveProps {
  markers?: CurrencyMarker[]
  className?: string
  speed?: number
}

const defaultMarkers: CurrencyMarker[] = [
  { id: 'usd', location: [40.71, -74.01], currency: 'USD', region: 'New York', anchor: 'right' },
  { id: 'cad', location: [43.65, -79.38], currency: 'CAD', region: 'Toronto' },
  { id: 'mxn', location: [19.43, -99.13], currency: 'MXN', region: 'Mexico City' },
  { id: 'brl', location: [-23.55, -46.63], currency: 'BRL', region: 'São Paulo' },
  { id: 'gbp', location: [51.51, -0.13], currency: 'GBP', region: 'London' },
  { id: 'sek', location: [59.33, 18.07], currency: 'SEK', region: 'Stockholm' },
  { id: 'eur', location: [50.11, 8.68], currency: 'EUR', region: 'Germany', anchor: 'right' },
  { id: 'chf', location: [47.37, 8.55], currency: 'CHF', region: 'Zurich', anchor: 'bottom' },
  { id: 'rub', location: [55.75, 37.62], currency: 'RUB', region: 'Moscow', anchor: 'right' },
  { id: 'try', location: [41.01, 28.98], currency: 'TRY', region: 'Istanbul', anchor: 'right' },
  { id: 'zar', location: [-26.2, 28.05], currency: 'ZAR', region: 'Johannesburg' },
  { id: 'aed', location: [25.2, 55.27], currency: 'AED', region: 'Dubai' },
  { id: 'inr', location: [13.08, 80.27], currency: 'INR', region: 'Chennai' },
  { id: 'thb', location: [13.75, 100.5], currency: 'THB', region: 'Bangkok' },
  { id: 'vnd', location: [21.03, 105.85], currency: 'VND', region: 'Hanoi' },
  { id: 'myr', location: [3.14, 101.69], currency: 'MYR', region: 'Kuala Lumpur' },
  { id: 'sgd', location: [1.35, 103.82], currency: 'SGD', region: 'Singapore', anchor: 'right' },
  { id: 'idr', location: [-6.21, 106.85], currency: 'IDR', region: 'Jakarta', anchor: 'bottom' },
  { id: 'hkd', location: [22.3, 114.17], currency: 'HKD', region: 'Hong Kong', anchor: 'bottom' },
  { id: 'cny', location: [31.23, 121.47], currency: 'CNY', region: 'Shanghai', anchor: 'left' },
  { id: 'twd', location: [25.03, 121.57], currency: 'TWD', region: 'Taipei', anchor: 'right' },
  { id: 'php', location: [14.6, 120.98], currency: 'PHP', region: 'Manila', anchor: 'right' },
  { id: 'krw', location: [37.57, 126.98], currency: 'KRW', region: 'Seoul' },
  { id: 'jpy', location: [35.68, 139.65], currency: 'JPY', region: 'Tokyo' },
  { id: 'aud', location: [-33.87, 151.21], currency: 'AUD', region: 'Sydney' },
  { id: 'nzd', location: [-36.85, 174.76], currency: 'NZD', region: 'Auckland' },
]

const SURFACE = 0.85

function project(lat: number, lng: number, phi: number, theta: number) {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)

  const xi = cosLat * Math.cos(lngRad)
  const yi = Math.sin(latRad)
  const zi = -cosLat * Math.sin(lngRad)

  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  const c = cosP * xi + sinP * zi
  const s = sinP * sinT * xi + cosT * yi - cosP * sinT * zi
  const zv = -sinP * cosT * xi + sinT * yi + cosP * cosT * zi

  return { x: c * SURFACE, y: s * SURFACE, z: zv * SURFACE }
}

export function GlobeInteractive({
  markers = defaultMarkers,
  className = '',
  speed = 0.003,
}: GlobeInteractiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current = Math.max(-0.6, Math.min(0.6, thetaOffsetRef.current + dragOffset.current.theta))
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId = 0
    let isVisible = true
    let labelEls: HTMLDivElement[] = []
    let half = 0
    let phi = -Math.PI / 2

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const effectiveSpeed = reducedMotion ? 0 : speed

    function animate() {
      if (!isVisible || !globe) {
        animationId = 0
        return
      }
      if (!isPausedRef.current) phi += effectiveSpeed
      const currentPhi = phi + phiOffsetRef.current + dragOffset.current.phi
      const currentTheta = 0.25 + thetaOffsetRef.current + dragOffset.current.theta
      globe.update({ phi: currentPhi, theta: currentTheta })

      for (let i = 0; i < markers.length; i++) {
        const el = labelEls[i]
        if (!el) continue
        const m = markers[i]
        const p = project(m.location[0], m.location[1], currentPhi, currentTheta)
        const px = half + half * p.x
        const py = half - half * p.y
        const visible = p.z > 0.1
        el.style.transform = `translate(${px}px, ${py}px) ${ANCHOR_TRANSFORMS[m.anchor ?? 'top']}`
        el.style.opacity = visible ? '0.92' : '0'
        el.style.filter = visible ? 'blur(0px)' : 'blur(6px)'
      }
      animationId = requestAnimationFrame(animate)
    }

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return
      half = width / 2
      labelEls = labelsRef.current
        ? (Array.from(labelsRef.current.children) as HTMLDivElement[])
        : []

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi,
        theta: 0.25,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.18, 0.1, 0.3],
        markerColor: [0.75, 0.52, 0.99],
        glowColor: [0.54, 0.17, 0.89],
        markers: markers.map((m) => ({ location: m.location, size: 0.045 })),
      })

      animate()
      requestAnimationFrame(() => {
        if (canvas) canvas.style.opacity = '1'
      })
    }

    const io = new IntersectionObserver(
      (entries) => {
        const next = entries[0]?.isIntersecting ?? true
        const wasVisible = isVisible
        isVisible = next
        if (next && !wasVisible && globe && !animationId) animate()
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    let ro: ResizeObserver | null = null
    if (canvas.offsetWidth > 0) {
      init()
    } else {
      ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro?.disconnect()
          ro = null
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      io.disconnect()
      ro?.disconnect()
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed])

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 1.2s ease',
          borderRadius: '50%',
          touchAction: 'none',
          contain: 'layout paint size',
        }}
      />
      <div
        ref={labelsRef}
        aria-hidden="false"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {markers.map((m) => (
          <div
            key={m.id}
            aria-label={`${m.currency} — ${m.region}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(20,10,40,0.92)',
              border: '1px solid rgba(164,132,215,0.5)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontFamily: 'var(--font-mono), ui-monospace, monospace',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              boxShadow: '0 4px 14px rgba(0,0,0,0.45), 0 0 12px rgba(138,43,226,0.25)',
              opacity: 0,
              transition: 'opacity 0.35s ease, filter 0.35s ease',
              willChange: 'transform, opacity',
              whiteSpace: 'nowrap',
            }}
          >
            {m.currency}
          </div>
        ))}
      </div>
    </div>
  )
}
