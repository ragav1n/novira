/**
 * The guide demos' motion presets now live in the app-wide module at
 * `lib/motion.ts` — they were always general-purpose, they just hadn't been
 * promoted out of this folder. Re-exported here so the demo imports keep
 * working; prefer importing from `@/lib/motion` in new code.
 */
export * from '@/lib/motion';
