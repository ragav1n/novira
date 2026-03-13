'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Disable animations for auth pages to keep standard flow
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <motion.div
            key={pathname}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
            transition={{ 
                duration: 0.3, 
                ease: [0.23, 1, 0.32, 1] // Custom quintic ease-out
            }}
            className="flex-1 flex flex-col w-full h-full"
        >
            {children}
        </motion.div>
    );
}
