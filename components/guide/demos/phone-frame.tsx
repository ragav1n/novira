import { cn } from '@/lib/utils';

/**
 * A stylized phone bezel that wraps demo content. Visually anchors small
 * UI mock-ups so they read as "what you'd see in the app."
 */
export function PhoneFrame({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-full max-w-[300px]', className)}>
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-2 shadow-[0_30px_60px_-30px_rgba(138,43,226,0.4),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
        {/* Notch / pill */}
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/80" aria-hidden />
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#0c081e] min-h-[420px]">
          {children}
        </div>
      </div>
      {label && (
        <div className="mt-2.5 text-center text-[11px] text-muted-foreground/80">{label}</div>
      )}
    </div>
  );
}
