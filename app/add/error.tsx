'use client';

import { RouteErrorFallback } from '@/components/boundaries/route-error-fallback';

export default function AddError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <RouteErrorFallback error={error} reset={reset} routeName="Add expense" />;
}
