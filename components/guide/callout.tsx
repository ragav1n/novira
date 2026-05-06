import { Info, Lightbulb, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalloutType = 'tip' | 'note' | 'warning' | 'pro';

const STYLES: Record<CalloutType, { icon: typeof Info; ring: string; tint: string; text: string; label: string }> = {
  tip:     { icon: Lightbulb,     ring: 'border-emerald-400/25',  tint: 'bg-emerald-500/[0.06]', text: 'text-emerald-300',  label: 'Tip' },
  note:    { icon: Info,          ring: 'border-sky-400/25',      tint: 'bg-sky-500/[0.06]',     text: 'text-sky-300',      label: 'Note' },
  warning: { icon: AlertTriangle, ring: 'border-amber-400/25',    tint: 'bg-amber-500/[0.06]',   text: 'text-amber-300',    label: 'Heads up' },
  pro:     { icon: Sparkles,      ring: 'border-fuchsia-400/25',  tint: 'bg-fuchsia-500/[0.06]', text: 'text-fuchsia-300',  label: 'Power tip' },
};

export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const s = STYLES[type];
  const Icon = s.icon;
  return (
    <div className={cn('not-prose my-5 rounded-2xl border px-4 py-3.5 backdrop-blur-sm', s.ring, s.tint)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0 rounded-lg p-1.5 ring-1', s.ring, s.tint)}>
          <Icon className={cn('h-3.5 w-3.5', s.text)} />
        </div>
        <div className="flex-1 text-sm leading-relaxed text-foreground/90">
          <div className={cn('mb-1 text-[11px] font-semibold uppercase tracking-wider', s.text)}>
            {title ?? s.label}
          </div>
          <div className="space-y-2 [&_code]:rounded-md [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:text-foreground/95 [&_strong]:text-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
