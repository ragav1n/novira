import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Novira — Smarter personal finance'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0c081e 0%, #1a0836 55%, #0c081e 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(138,43,226,0.28) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            display: 'flex',
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6D28D9, #A855F7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            fontSize: 44,
            fontWeight: 800,
            color: 'white',
            boxShadow: '0 0 50px rgba(138,43,226,0.55)',
          }}
        >
          N
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: 'white',
            letterSpacing: '-3px',
            marginBottom: 18,
            display: 'flex',
          }}
        >
          Novira
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            color: 'rgba(255,255,255,0.68)',
            textAlign: 'center',
            maxWidth: 680,
            lineHeight: 1.4,
            display: 'flex',
          }}
        >
          Smarter finance, beautifully simple.
        </div>

        {/* Feature pills */}
        <div style={{ marginTop: 52, display: 'flex', gap: 28 }}>
          {['Track spending', 'Split with friends', 'Works offline'].map((feat) => (
            <div
              key={feat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(138,43,226,0.18)',
                border: '1px solid rgba(138,43,226,0.35)',
                borderRadius: 999,
                padding: '10px 20px',
                color: 'rgba(255,255,255,0.8)',
                fontSize: 18,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#34d399',
                  flexShrink: 0,
                  display: 'flex',
                }}
              />
              {feat}
            </div>
          ))}
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            color: 'rgba(255,255,255,0.3)',
            fontSize: 16,
            letterSpacing: '0.08em',
            display: 'flex',
          }}
        >
          novira.one
        </div>
      </div>
    ),
    { ...size }
  )
}
