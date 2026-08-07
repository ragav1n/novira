/**
 * Shared motion presets so the whole app speaks one animation language.
 * Tuned for "butter smooth" — fast start, soft landing, no rubber-band bounce
 * unless explicitly asked. Ease curves use the Apple-favored
 * cubic-bezier(0.22, 1, 0.36, 1) which decelerates quickly and lands gently.
 *
 * `SOFT` is installed as the default transition on the app-shell <MotionConfig>
 * (app/layout.tsx), so a motion element with no `transition` prop inherits the
 * house spring instead of Framer's built-in default. Only override it when the
 * element needs a different character — reach for a token below first.
 *
 * Note: presets are intentionally untyped (no `Transition` annotation) so they
 * pass cleanly into both `motion.div`'s `transition` prop AND `useAnimate`'s
 * options parameter, which expect slightly different (narrower) shapes.
 */

/** Most things — entrances, position changes, soft transitions. The app default. */
export const SOFT = {
  type: 'spring' as const,
  damping: 26,
  stiffness: 200,
  mass: 0.85,
};

/** Snappier — chip pops, badges, reveals with a hint of life. */
export const SNAPPY = {
  type: 'spring' as const,
  damping: 22,
  stiffness: 320,
  mass: 0.6,
};

/** A subtle bounce — celebrations, milestone pops. Use sparingly. */
export const BOUNCE = {
  type: 'spring' as const,
  damping: 16,
  stiffness: 240,
  mass: 0.9,
};

/** Pure fade/opacity — when spring overshoot would look wrong. */
export const FADE = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Quick fades for chip stagger entries. */
export const QUICK_FADE = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

/** Linear — only for repeating spins or marquee-style motion. */
export const LINEAR_SPIN = {
  duration: 1.2,
  ease: 'linear' as const,
  repeat: Infinity,
};

/** Stagger helpers. */
export const STAGGER_FAST = 0.05;
export const STAGGER_NORMAL = 0.08;

/**
 * Cubic-bezier for `useAnimate` calls that want the same ease shape but
 * specified inline (not all `useAnimate` invocations accept Transition objects).
 */
export const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT_SOFT: [number, number, number, number] = [0.4, 0, 0.2, 1];

/**
 * iOS-style "emphasized decelerate" — stretches the final third of the curve
 * so motion melts into rest instead of clicking into place. Use for translation
 * and any element that visibly "locks" with a spring.
 */
export const EASE_GLIDE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Slide / translation tween that doesn't lock at endpoints. Use for swipes, drawers, snap-backs. */
export const GLIDE = {
  duration: 0.85,
  ease: EASE_GLIDE,
};

/** Smooth chip / badge entrance — for elements that fade in and stay (preferred over SNAPPY). */
export const POP = {
  duration: 0.55,
  ease: EASE_GLIDE,
};

// ─── App roles ────────────────────────────────────────────────────────────────
// The presets above describe motion *character*; the ones below name the app's
// recurring UI *roles* so sibling surfaces can't drift apart again. Each value
// is the previous majority spelling of that role, so adopting a token generally
// leaves the feel unchanged.

/** Bottom sheets, action bars, anything that rises from the bottom edge. */
export const SHEET = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 30,
  mass: 0.8,
};

/** Centered modal / dialog entrance. */
export const MODAL = {
  type: 'spring' as const,
  duration: 0.6,
  bounce: 0.3,
};

/** List row enter/exit. A tween, not a spring — rows must not overshoot into each other. */
export const ROW = {
  duration: 0.32,
  ease: EASE_OUT_SOFT,
};

/** Icon appearing inside a field / status chip. */
export const ICON_POP = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
};

// ─── Shared variants ──────────────────────────────────────────────────────────
// Module-scope objects (never inline in JSX) so Framer's variant identity check
// short-circuits instead of re-diffing a freshly allocated object each render.

/** Rises from the bottom edge. Pair with `SHEET`. */
export const sheetVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/** Centered dialog. Pair with `MODAL`. */
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

/** List row. Pair with `ROW`. Exit scales rather than collapsing height — animating
 *  `height` inside an AnimatePresence forces a layout pass per frame per row. */
export const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
};
