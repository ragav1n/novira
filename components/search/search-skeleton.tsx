import { Skeleton } from '@/components/ui/skeleton';

export function SearchSkeleton() {
    return (
        <div className="space-y-1.5" role="status" aria-label="Loading search results">
            <div className="px-2 pt-2 pb-1.5">
                <Skeleton tone="chip" className="h-[10px] w-20 rounded" />
            </div>
            {/* The pulse used to sit on this row wrapper. `animate-pulse` animates opacity,
                so nesting compounds it — a parent going 1→0.5 over a child going 1→0.5
                troughs at 0.25, a visibly deeper pulse than intended. Per-shape is the
                only placement that composes. */}
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="relative overflow-hidden rounded-xl">
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-card" style={{ borderLeft: '3px solid rgba(255,255,255,0.06)' }}>
                        <Skeleton tone="chip" className="w-9 h-9 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <Skeleton tone="chip" className="h-[13px] w-2/3 rounded" />
                                <Skeleton tone="chip" className="h-[14px] w-14 rounded shrink-0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-[10px] w-16 rounded" />
                                <Skeleton className="h-[10px] w-8 rounded" />
                                <Skeleton className="h-[10px] w-10 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
