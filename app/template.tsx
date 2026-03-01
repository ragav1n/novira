'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Wrap the route components in a framer-motion container
// template.tsx creates a unique instance per route change (unlike layout.tsx)
// which allows entry/exit animations to fire reliably
export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Disable animations for auth pages to keep standard flow
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
                duration: 0.25,
                ease: [0.32, 0.72, 0, 1] // Native-feeling easing curve
            }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
}
