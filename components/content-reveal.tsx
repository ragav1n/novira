'use client';

import { motion, type Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.07,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Wraps a stack of content elements and fades+slides them in on mount, in
 * sequence, the same way the landing page hero animates. Use it on any
 * static long-form page (privacy, terms) so they pick up the same "settle in"
 * feel as the rest of the public surface.
 *
 * For per-child stagger, use <RevealItem> for each child.
 */
export function ContentReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * A single child in a ContentReveal stack — wraps content in a motion element
 * that uses the shared item variants so the parent's stagger picks it up.
 */
export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'header' | 'footer';
}) {
  const MotionTag = motion[as];
  return (
    <MotionTag variants={itemVariants} className={className}>
      {children}
    </MotionTag>
  );
}
