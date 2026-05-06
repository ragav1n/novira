'use client';

import { SmokeBackground } from '@/components/ui/spooky-smoke-animation';

/**
 * The exact three-layer background used on the landing page:
 *   1. Solid deep-purple base + WebGL smoke
 *   2. Radial + linear gradient overlay (multiply blend) to darken edges
 *   3. SVG grain (overlay blend) for that subtle film-noise texture
 *
 * Mounted once at the top of `MobileLayout`; it pins itself to the viewport
 * with `fixed inset-0` and stays out of the way. Visibility is controlled by
 * an opacity-fading wrapper in the layout, and the `paused` prop should be
 * forwarded as `paused={!isVisible}` so the WebGL animation loop stops when
 * the background isn't being shown — keeps dashboard pages snappy without
 * unmounting the GPU context.
 */
export function MarketingBackground({ paused = false }: { paused?: boolean }) {
  return (
    <>
      {/* Smoke base */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#0c081e' }} aria-hidden>
        <SmokeBackground smokeColor="#8A2BE2" paused={paused} />
      </div>

      {/* Soft overlay */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 50% at 50% 20%, rgba(12,8,30,0) 0%, rgba(10,0,24,0.55) 100%), linear-gradient(180deg, rgba(10,0,24,0.35), rgba(10,0,24,0.8))',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Film grain */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        aria-hidden
        style={{
          opacity: 0.07,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.85'/></svg>\")",
        }}
      />
    </>
  );
}
