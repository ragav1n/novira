import { cn } from '@/lib/utils';

export function CodePill({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warn';
  className?: string;
}) {
  const tone = {
    default: 'bg-white/5 text-foreground/90 border-white/10',
    accent:  'bg-primary/10 text-primary border-primary/30',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
    warn:    'bg-amber-500/10 text-amber-300 border-amber-400/30',
  }[variant];

  return (
    <code
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[12px] tracking-tight',
        tone,
        className
      )}
    >
      {children}
    </code>
  );
}
