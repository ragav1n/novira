'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Pure opacity fade — no scale, no filter, no transform. Animating
    // `transform` or `filter` would make this element a containing block for
    // `position: fixed` descendants and break the persistent
    // MarketingBackground (smoke would scroll away with the content). Plain
    // opacity has no such side effect, and the same fade is applied to every
    // page (including auth pages) so navigation between landing → /signin →
    // /forgot-password feels continuous instead of cut.
    return (
        <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
                duration: 0.3,
                ease: [0.23, 1, 0.32, 1],
            }}
            className="flex-1 flex flex-col w-full h-full"
        >
            {children}
        </motion.div>
    );
}
