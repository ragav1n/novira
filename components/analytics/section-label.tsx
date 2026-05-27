'use client';

interface Props {
    label: string;
}

export function SectionLabel({ label }: Props) {
    return (
        <div className="flex items-center gap-3 pt-2 pb-1 px-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60 shrink-0">
                {label}
            </span>
            <div className="flex-1 border-t border-white/5" />
        </div>
    );
}
