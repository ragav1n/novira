'use client';

import { usePathname } from 'next/navigation';

// Wrap the route components in a CSS animation container
// template.tsx creates a unique instance per route change (unlike layout.tsx)
// which allows entry animations to fire reliably
export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Disable animations for auth pages to keep standard flow
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <div
            className="w-full h-full animate-page-in"
        >
            {children}
        </div>
    );
}
