'use client';

type TooltipEntry = {
    name?: string | number;
    value?: number | string;
    stroke?: string;
    color?: string;
    fill?: string;
};

interface Props {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string | number;
    formatCurrency: (amount: number) => string;
}

export function AnalyticsTooltip({ active, payload, label, formatCurrency }: Props) {
    if (!active || !payload || !payload.length) return null;
    const visible = payload.filter(p => Number(p.value) > 0.5);
    if (!visible.length) return null;
    return (
        <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-50">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">{label}</p>
            <div className="space-y-1.5">
                {visible.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: entry.stroke || entry.color || entry.fill }}
                            />
                            <span className="text-foreground/80 font-medium capitalize">{entry.name}</span>
                        </div>
                        <span className="font-mono font-bold">{formatCurrency(Math.round(Number(entry.value)))}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
