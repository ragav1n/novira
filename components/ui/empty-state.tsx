import * as React from 'react'
import Link from 'next/link'
import { WifiOff, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { WorkspaceTheme } from '@/hooks/useWorkspaceTheme'

/* ── Accent ─────────────────────────────────────────────────────────────────
   An empty state carries the accent of whatever it sits inside: the workspace
   theme on themed views, or a fixed per-tab colour in the groups family (trips
   are sky, buckets are cyan). Both arrive as whole Tailwind class strings so the
   v4 source scanner can see them — nothing on this path is ever concatenated. */

export type EmptyAccent = {
  /** Solid CTA pill background. */
  solid: string
  /** Solid CTA pill hover background. */
  solidHover: string
  /** Ink *on* the solid pill — 400-weight accents need dark ink, not white. */
  on: string
  /** Link CTA and tinted icon colour. */
  text: string
  /** Icon tile tint, for `iconVariant="tile"`. */
  tile: string
}

export const EMPTY_ACCENTS = {
  primary: { solid: 'bg-primary', solidHover: 'hover:bg-primary/90', on: 'text-white', text: 'text-primary', tile: 'bg-primary/10' },
  sky: { solid: 'bg-sky-400', solidHover: 'hover:bg-sky-300', on: 'text-sky-950', text: 'text-sky-400', tile: 'bg-sky-400/10' },
  cyan: { solid: 'bg-cyan-400', solidHover: 'hover:bg-cyan-300', on: 'text-cyan-950', text: 'text-cyan-400', tile: 'bg-cyan-400/10' },
} satisfies Record<string, EmptyAccent>

/**
 * Bridge from `useWorkspaceTheme()` — analytics, goals, subscriptions, search and
 * calendar all already hold a `WorkspaceTheme` and shouldn't re-derive an accent.
 */
export function accentFromTheme(theme: WorkspaceTheme): EmptyAccent {
  return {
    solid: theme.bgSolid,
    solidHover: theme.hoverBtnBg,
    on: theme.textWhite,
    text: theme.text,
    tile: theme.bgLight,
  }
}

/* ── Action ─────────────────────────────────────────────────────────────────*/

export type EmptyAction = {
  label: string
  icon?: LucideIcon
  /** Renders a `<Link>`. Takes precedence over `onClick`. */
  href?: string
  onClick?: () => void
}

function EmptyCta({
  action,
  accent,
  tone,
}: {
  action: EmptyAction
  accent: EmptyAccent
  tone: 'solid' | 'link'
}) {
  const Icon = action.icon

  const className =
    tone === 'solid'
      ? cn(
          'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full',
          'text-xs font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          accent.solid,
          accent.solidHover,
          accent.on,
        )
      : cn(
          // `min-h-[36px]` isn't cosmetic: at 11px the natural line box is ~16px, so
          // every "How groups work →" / "Clear filters" affordance in the app was a
          // ~16px tap target.
          'inline-flex items-center gap-1.5 min-h-[36px] px-1 rounded-md',
          'text-meta font-semibold tracking-tight transition-colors hover:underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
          accent.text,
        )

  const content = (
    <>
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
      {action.label}
    </>
  )

  return action.href ? (
    <Link href={action.href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  )
}

/* ── EmptyState ─────────────────────────────────────────────────────────────*/

type EmptyStateCopy =
  | { eyebrow: string; title?: string }
  | { eyebrow?: string; title: string }

export type EmptyStateProps = EmptyStateCopy & {
  /**
   * `inline` — a dashed card inside a section that already has its own heading.
   * Left-aligned, because it reads as one more item in a list.
   * `page` — this whole region *is* the empty thing. Centred column, no frame.
   */
  size?: 'inline' | 'page'
  /**
   * `error` is a load failure, not a red alert. It renders identically to `empty`
   * on purpose — the copy carries the difference — but defaults the icon to
   * `WifiOff` and announces itself.
   */
  variant?: 'empty' | 'error'
  description?: React.ReactNode
  icon?: LucideIcon
  iconVariant?: 'bare' | 'tile'
  accent?: EmptyAccent
  action?: EmptyAction
  /** Always renders as a text link, never a second pill. */
  secondaryAction?: EmptyAction
  /**
   * Outer layout only — margin, grid placement, `col-span`. Restyling the state
   * itself through here is how the seven dialects happened; don't.
   */
  className?: string
}

/**
 * The one empty / error state.
 *
 * There were 26 hand-rolled empty states across 21 files in seven mutually
 * incompatible specs — ten vertical rhythms, five border treatments, six icon
 * treatments, six title specs and seven CTA styles, for what is always the same
 * three sentences and a button. Seven of them additionally hand-rolled an *error*
 * twin (`WifiOff` + "Try again") that was a visual clone of the empty twin three
 * lines above it in the same ternary, free to drift from it.
 *
 * The canonical spec is the groups family (`groups`/`trips`/`buckets`/`friends`
 * tabs): the only one repeated verbatim more than twice, and the only one with a
 * real information design — an eyebrow naming the *category* of emptiness, a
 * headline stating the *proposition*, and a body explaining the mechanic. The
 * search family independently converged on the identical eyebrow token, which is
 * the strongest agreement signal available in the codebase.
 */
export function EmptyState({
  size = 'inline',
  variant = 'empty',
  eyebrow,
  title,
  description,
  icon,
  iconVariant = 'bare',
  accent = EMPTY_ACCENTS.primary,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? (variant === 'error' ? WifiOff : undefined)
  const isPage = size === 'page'

  return (
    <div
      // A failed refetch replaces content after the fact, so it has to be
      // announced — none of the seven hand-rolled error states were. `status` is
      // polite; `alert` would interrupt for something the user can just retry.
      role={variant === 'error' ? 'status' : undefined}
      className={cn(
        isPage
          ? 'flex flex-col items-center justify-center py-16 px-6 text-center'
          : 'rounded-xl border border-dashed border-white/[0.14] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {Icon &&
        (iconVariant === 'tile' ? (
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
              accent.tile,
              isPage && 'mx-auto',
            )}
          >
            <Icon className={cn('w-5 h-5', accent.text)} aria-hidden="true" />
          </div>
        ) : (
          <Icon
            className={cn('w-7 h-7 mb-4 text-muted-foreground/40', isPage && 'mx-auto')}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ))}

      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-eyebrow uppercase text-muted-foreground/70">
            {eyebrow}
          </p>
        )}
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        {description && (
          // A <p> that is actually a <p>. The shadcn kit this replaces typed its
          // description as ComponentProps<'p'> but rendered a <div>, so any caller
          // passing phrasing content nested invalidly.
          <p
            className={cn(
              'text-xs text-muted-foreground leading-relaxed',
              isPage && 'max-w-[280px] mx-auto',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className={cn('flex items-center gap-2 mt-4', isPage && 'justify-center')}>
          {action && <EmptyCta action={action} accent={accent} tone="solid" />}
          {secondaryAction && <EmptyCta action={secondaryAction} accent={accent} tone="link" />}
        </div>
      )}
    </div>
  )
}
