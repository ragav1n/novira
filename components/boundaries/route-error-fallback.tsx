'use client';

import { Database, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Reusable per-route error fallback.
 * Used by individual route error.tsx files to provide consistent error UX
 * while isolating crashes to the failing route segment.
 */
export function RouteErrorFallback({
    error,
    reset,
    routeName,
}: {
    error: Error & { digest?: string };
    reset: () => void;
    routeName: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center p-6 text-center min-h-[60dvh]">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-5">
                <Database className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
                {routeName} couldn&apos;t load
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                Something went wrong while loading this page. Your other data is safe.
            </p>

            {process.env.NODE_ENV === 'development' && (
                <pre className="text-[10px] bg-black/20 p-3 rounded-lg text-left overflow-auto w-full max-w-sm mb-6 text-orange-400 border border-orange-500/10">
                    {error.message}
                </pre>
            )}

            <Button
                onClick={reset}
                variant="outline"
                className="border-orange-500/20 hover:bg-orange-500/10 text-orange-500 rounded-xl"
            >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Try Again
            </Button>
        </div>
    );
}
