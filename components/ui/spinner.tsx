import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Spinner({
  className,
  label = 'Loading',
  ...props
}: React.ComponentProps<'svg'> & {
  /**
   * Announced by the `role="status"` live region. Pass `null` when the parent
   * control already announces the busy state — a button reading
   * "<Spinner /> Importing…" would otherwise be announced twice, once for the
   * button's own text and once for the nested live region.
   */
  label?: string | null
}) {
  const silent = label === null

  return (
    <Loader2Icon
      role={silent ? undefined : 'status'}
      aria-label={silent ? undefined : label}
      aria-hidden={silent || undefined}
      // Deliberately not `motion-safe:animate-spin`. The reduced-motion block in
      // globals.css neutralises every animation *except* `[class*="animate-spin"]`,
      // which it exempts on purpose so loading feedback is never lost — a spinner
      // frozen mid-rotation reads as a hung app, not as a respected preference.
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
