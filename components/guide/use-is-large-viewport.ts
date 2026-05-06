'use client';

import { useEffect, useState } from 'react';

const LG_BREAKPOINT = 1024;

/**
 * Returns true on lg+ viewports. Uses matchMedia (not Tailwind responsive
 * utilities) so it works regardless of CSS load timing or class generation.
 * Returns false on the server and during the first client render to avoid
 * hydration mismatches; the correct value lands on the next paint.
 */
export function useIsLargeViewport(): boolean {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
    const update = () => setIsLarge(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isLarge;
}
