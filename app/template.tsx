'use client';

import { usePathname } from 'next/navigation';

export default function Template({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Disable animations for auth pages to keep standard flow
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
        </>
    );
}
