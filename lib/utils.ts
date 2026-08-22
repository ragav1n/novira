import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/* tailwind-merge only recognises t-shirt sizes and arbitrary lengths as
   `font-size`; every other `text-*` falls through to its catch-all *colour*
   group. So the named scale in globals.css (`text-meta`, `text-hero`, …) was
   being classified as a colour, and any colour class later in the same cn()
   silently evicted it — leaving the element with no font-size at all and
   inheriting 16px from the document. Registering the scale here is what makes
   `cn('text-meta', cond && 'text-amber-50')` keep both. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{
        text: ['micro', 'caption', 'meta', 'body', 'lead', 'eyebrow', 'hero'],
      }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
