'use client';

import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0c081e] text-white text-center">
            <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-8 max-w-xs">
                An unexpected error occurred. Please try again.
            </p>
            <div className="flex gap-4">
                <Button
                    onClick={reset}
                    className="bg-primary hover:bg-primary/90 rounded-xl px-6"
                >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Try Again
                </Button>
                <Button
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                    className="border-white/10 hover:bg-white/5 rounded-xl px-6"
                >
                    <Home className="w-4 h-4 mr-2" />
                    Back Home
                </Button>
            </div>
            {process.env.NODE_ENV === 'development' && (
                <pre className="mt-12 p-4 bg-black/40 rounded-lg text-left text-xs overflow-auto max-w-full border border-white/5 text-rose-300">
                    {error?.toString()}
                </pre>
            )}
        </div>
    );
}
