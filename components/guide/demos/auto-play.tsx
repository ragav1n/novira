'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { FADE } from './transitions';

/**
 * Wraps a demo so it only animates when scrolled into view.
 * Saves CPU on long pages with many demos. Uses transform-only entrance for
 * smoothness; will-change hint promotes to its own compositing layer.
 */
export function AutoPlay({
  children,
  className,
  ariaLabel,
}: {
  children: (isInView: boolean) => React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35, margin: '0px 0px -8% 0px' });

  return (
    <motion.div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      className={cn('relative w-full transform-gpu', className)}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 10 }}
      transition={FADE}
      style={{ willChange: 'transform, opacity' }}
    >
      {children(inView)}
    </motion.div>
  );
}
