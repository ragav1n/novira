export function SearchSkeleton() {
    return (
        <div className="space-y-1.5">
            <div className="px-2 pt-2 pb-1.5">
                <div className="h-[10px] w-20 bg-white/[0.06] rounded animate-pulse" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="relative overflow-hidden rounded-xl animate-pulse">
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-card" style={{ borderLeft: '3px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-9 h-9 rounded-full bg-secondary/20 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="h-[13px] w-2/3 bg-secondary/20 rounded" />
                                <div className="h-[14px] w-14 bg-secondary/20 rounded shrink-0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-[10px] w-16 bg-secondary/15 rounded" />
                                <div className="h-[10px] w-8 bg-secondary/10 rounded" />
                                <div className="h-[10px] w-10 bg-secondary/10 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
