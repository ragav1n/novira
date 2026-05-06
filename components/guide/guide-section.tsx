import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionLinkButton } from './section-link-button';
import { TryItLink } from './try-it-link';

export function GuideSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  intro,
  demo,
  tryIt,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  demo?: React.ReactNode;
  /** Inline "Try it →" link rendered next to the section title. */
  tryIt?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-24 border-b border-white/5 pb-16 pt-12 first:pt-6 last:border-b-0', className)}
    >
      <header className="mb-8 flex items-start gap-4">
        <div className="mt-1 hidden shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/15 to-fuchsia-500/10 p-2.5 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:block">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
              {eyebrow}
            </div>
          )}
          <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <span>{title}</span>
            <SectionLinkButton sectionId={id} title={title} />
            {tryIt && <TryItLink href={tryIt.href} label={tryIt.label} className="hidden sm:inline-flex" />}
          </h2>
          {intro && (
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/85">
              {intro}
            </p>
          )}
          {tryIt && (
            <div className="mt-3 sm:hidden">
              <TryItLink href={tryIt.href} label={tryIt.label} />
            </div>
          )}
        </div>
      </header>

      {demo && (
        <div className="mb-8">
          {demo}
        </div>
      )}

      <div className="prose prose-invert max-w-none text-[15px] leading-relaxed text-foreground [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:my-3 [&_p]:text-foreground [&_ul]:my-3 [&_ul]:list-none [&_ul]:pl-0 [&_ul]:text-foreground [&_ol]:my-3 [&_ol]:pl-5 [&_ol]:text-foreground [&_li]:my-1.5 [&_li]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * Bullet list with a colored dot, used inside sections for step lists.
 */
export function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="not-prose space-y-2.5 pl-0">{children}</ol>;
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-relaxed text-foreground">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[12px] font-semibold text-primary">
        {n}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}

/**
 * Two-column key/value table for reference content.
 */
export function FactRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-x-4 gap-y-1 border-b border-white/5 py-2.5 last:border-b-0 sm:grid-cols-[180px_1fr]">
      <div className="text-[13px] font-medium text-foreground/70">{label}</div>
      <div className="text-[14px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export function FactGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose my-4 rounded-2xl border border-white/8 bg-white/[0.015] px-4 py-1">
      {children}
    </div>
  );
}
