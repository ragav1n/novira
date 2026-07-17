import Link from 'next/link';
import { Compass, Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-primary/15 rounded-full flex items-center justify-center mb-6">
                <Compass className="w-10 h-10 text-primary" aria-hidden="true" />
            </div>
            <p className="text-xs font-bold tracking-[0.3em] text-muted-foreground/70 uppercase mb-2">Error 404</p>
            <h1 className="text-2xl font-bold mb-2">This page doesn&apos;t exist</h1>
            <p className="text-muted-foreground mb-8 max-w-xs text-sm">
                The link may be outdated, or the page may have moved.
            </p>
            <div className="flex gap-4">
                <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl px-6">
                    <Link href="/">
                        <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                        Back Home
                    </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl px-6">
                    <Link href="/search">
                        <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                        Search
                    </Link>
                </Button>
            </div>
        </div>
    );
}
