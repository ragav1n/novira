import * as React from 'react'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const WIDTHS = {
  md: 'max-w-md',
  '2xl': 'max-w-md lg:max-w-2xl',
  '4xl': 'max-w-md lg:max-w-4xl',
} as const

/**
 * The loading shell every dynamically-imported route renders.
 *
 * The same header triplet — avatar circle, title bar, action circle — was
 * copy-pasted verbatim into nine `app/**\/page.tsx` files, along with the page
 * padding around it. Two latent bugs came along for free:
 *
 * - `min-h-screen` measures against the *largest* mobile viewport, so every route
 *   rendered a scrollbar during load. `100dvh` tracks the visible viewport.
 * - Three of the nine (settings, goals, subscriptions) omitted the trailing chip
 *   under `justify-between`, which pushed their title placeholder flush right —
 *   while the real `ViewHeader` centres its `<h1>` by absolute positioning. The
 *   title visibly jumped left-to-centre on hand-off. `trailing={false}` now emits
 *   an inert spacer so the centring matches.
 *
 * Also adds the `role="status"` none of them had.
 */
export function PageSkeleton({
  width = '2xl',
  title = 'w-32',
  trailing = true,
  className,
  children,
}: {
  width?: keyof typeof WIDTHS
  /** Width utility for the title bar — routes differ (w-24 / w-32 / w-40). */
  title?: string
  /** Whether the header has a trailing action. `false` still reserves its space. */
  trailing?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex flex-col min-h-[100dvh] p-5 space-y-6 mx-auto', WIDTHS[width], className)}
    >
      <div className="flex justify-between items-center pt-2 gap-2 opacity-50">
        <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
        <Skeleton tone="chip" className={cn('h-6 rounded-lg', title)} />
        {trailing ? (
          <Skeleton tone="chip" className="w-10 h-10 rounded-full" />
        ) : (
          <span className="w-10 shrink-0" aria-hidden="true" />
        )}
      </div>
      {children}
    </div>
  )
}
