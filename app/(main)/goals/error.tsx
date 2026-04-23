'use client';

import { RouteErrorFallback } from '@/components/boundaries/route-error-fallback';

export default function GoalsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <RouteErrorFallback error={error} reset={reset} routeName="Goals" />;
}
