import { cn } from '@/lib/utils'

/**
 * The two fills the app already uses, written down.
 *
 * A sweep of all 137 `animate-pulse` shapes found 64 on `bg-secondary/10` and 48 on
 * `bg-secondary/20`, with 10 stragglers — that isn't variance, it's a two-tier
 * system nobody had named. `block` is the large surface (cards, chart wells, list
 * rows); `chip` is the smaller placeholder that has to read *against* a block.
 */
const SKELETON_TONES = {
  block: 'bg-secondary/10',
  chip: 'bg-secondary/20',
} as const

function Skeleton({
  className,
  tone = 'block',
  ...props
}: React.ComponentProps<'div'> & { tone?: keyof typeof SKELETON_TONES }) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      // Was `bg-accent`, which rendered at full opacity and made the one component
      // using this primitive the brightest skeleton in the app by a wide margin.
      // `--accent` and `--secondary` are the same oklch triple in all three
      // palettes, so this moves alpha only — the hue is unchanged.
      //
      // `animate-pulse` belongs on each shape, never on a wrapper: nesting
      // compounds the opacity, so a parent 1→0.5 over a child 1→0.5 troughs at
      // 0.25 and reads as a visibly deeper pulse.
      //
      // Deliberately not `motion-safe:animate-pulse` — the reduced-motion block in
      // globals.css already neutralises every animation except `animate-spin`.
      className={cn('animate-pulse rounded-md', SKELETON_TONES[tone], className)}
      {...props}
    />
  )
}

export { Skeleton }
