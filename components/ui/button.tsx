import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Sized and shaped for this app, not stock shadcn.
 *
 * Every size shipped below the 44px touch target the rest of the codebase
 * standardises on (61 `min-h-[44px]`, 35 `min-w-[44px]`, 46 `h-11`, 37 `h-12` in
 * source, and the accessibility pass that made all 8 back buttons 44×44):
 * `default` was `h-9` (36px), `sm` `h-8` (32px), `lg` `h-10` (40px), `icon`
 * `size-9`. And 32 of the 35 explicit `size=` call sites passed `sm` or `icon`, so
 * those were live sub-44px targets.
 *
 * The radius was `rounded-md` (10px) while the house radius is `rounded-xl` /
 * `rounded-full`. Between the two, `<Button>` couldn't be used at house standard
 * without a `className` override — which is why 295 sites hand-roll a `<button>`
 * instead. `h-11 rounded-xl` isn't invented: sampling the raw primary CTAs, it is
 * already the single most common spec, and `rounded-xl` dominates their radius.
 *
 * `sm` (36px) and `icon-sm` (36px) stay deliberately below 44px: they exist for
 * genuinely dense inline contexts — a chip row, a toolbar inside a card — where a
 * 44px control would break the layout. Prefer `default` anywhere a thumb is the
 * primary input.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // 44px — the minimum comfortable touch target, and the app's house CTA.
        default: 'h-11 px-4 py-2 has-[>svg]:px-3',
        // 36px, dense inline contexts only. See the note above.
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-6 has-[>svg]:px-4',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
