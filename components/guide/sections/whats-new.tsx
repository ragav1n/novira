import { Sparkles, Smartphone, Hand, Bell, BarChart2, Wallet, Layers, Receipt, MapPin, type LucideIcon } from 'lucide-react';
import { GuideSection } from '../guide-section';
import { Callout } from '../callout';

type ReleaseItem = {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  href?: string;
};

type Release = {
  version: string;
  /** ISO date for sort + display */
  date: string;
  /** Headline summary of the release */
  headline: string;
  items: ReleaseItem[];
};

const RELEASES: Release[] = [
  {
    version: '2.61',
    date: '2026-05-13',
    headline: 'Install anywhere, gesture-first, push reminders, custom date ranges.',
    items: [
      {
        icon: Smartphone,
        title: 'Install on any device',
        description: (
          <>One-tap install on iPhone (Share → Add to Home Screen), Android (Install app), Mac and Windows (address-bar install icon). Service worker keeps offline data and assets fresh, and Background Sync flushes the queue the moment you reconnect.</>
        ),
        href: '#getting-started',
      },
      {
        icon: Hand,
        title: 'Swipe-to-edit, swipe-to-delete',
        description: (
          <>Swipe-left on any transaction row to reveal <strong>Edit</strong> and <strong>Delete</strong> with a satisfying spring. Pull-to-refresh anywhere on the dashboard, drag panels in Settings → Dashboard layout to reorder per device.</>
        ),
        href: '#gestures',
      },
      {
        icon: Bell,
        title: 'Bills, pace warnings & digests',
        description: (
          <>Opt into push notifications in Settings → Notifications. Choose your notice (off, 1 day, 3 days, a week), get an 80%-of-allowance pace nudge, and a daily or weekly digest — with quiet hours (default 22:00 → 07:00).</>
        ),
        href: '#notifications',
      },
      {
        icon: BarChart2,
        title: 'Custom date ranges + presets in Analytics',
        description: (
          <>Pick <em>This Week</em>, <em>Last 7 Days</em>, <em>Year-to-Date</em>, or a fully custom range. The What-If simulator translates a category cut into monthly savings, yearly savings, and how many months sooner you’d hit each active goal.</>
        ),
        href: '#analytics',
      },
      {
        icon: Wallet,
        title: 'Weighted-pace forecasting',
        description: (
          <>Month forecasting now blends 60% of your last-7-day run-rate with 40% of your month-to-date pace — so a mid-month spending shift moves the projection instead of being smoothed away.</>
        ),
        href: '#dashboard',
      },
    ],
  },
  {
    version: '2.55',
    date: '2026-04-02',
    headline: 'Forex wallets, layered account framing, base-currency stability.',
    items: [
      {
        icon: Wallet,
        title: 'Per-currency opening balances',
        description: <>Multi-currency wallets can now hold a separate opening balance for each currency. Credit-card sign and single-currency wallet display are correct end-to-end.</>,
      },
      {
        icon: Layers,
        title: 'Layered account framing',
        description: <>Accounts now lead with the right metric for the account type — spent for simple accounts, balance for credit and forex — so the headline number always reflects what you actually care about.</>,
      },
      {
        icon: BarChart2,
        title: 'Rate drift fixed in recap & insights',
        description: <>If your base currency changed over time, totals used to drift. They now reconcile against the rate at the moment of each transaction.</>,
      },
    ],
  },
  {
    version: '2.40',
    date: '2026-02-18',
    headline: 'AI receipt scanning, custom map pins, smart settle.',
    items: [
      {
        icon: Receipt,
        title: 'AI receipt scanning',
        description: <>Point your camera at any receipt and Novira extracts amount, merchant, date, and category in under two seconds — no manual entry from paper slips.</>,
        href: '#adding-transactions',
      },
      {
        icon: MapPin,
        title: 'Drop a pin anywhere',
        description: <>In the Expense Map, drag and drop a custom pin to tag any location on earth — not just places Novira detected automatically.</>,
      },
      {
        icon: Sparkles,
        title: 'Smart Settle',
        description: <>Settle all your debts at once with the fewest transfers possible, or mark incoming payments as received in a single tap.</>,
        href: '#splits',
      },
    ],
  },
];

function formatReleaseDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function WhatsNewSection() {
  return (
    <GuideSection
      id="whats-new"
      icon={Sparkles}
      eyebrow="Releases"
      title="What’s new"
      intro="A running log of what shipped, in plain language. Most recent at the top. Tap an item to jump to its detailed section."
    >
      <div className="not-prose space-y-8">
        {RELEASES.map((release, i) => (
          <div key={release.version} className="relative">
            {/* Version header */}
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/8 pb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary">
                v{release.version}
              </span>
              <span className="text-[12px] font-medium uppercase tracking-widest text-foreground/55">
                {formatReleaseDate(release.date)}
              </span>
              {i === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  Latest
                </span>
              )}
              <p className="basis-full text-[14px] leading-relaxed text-foreground/85">
                {release.headline}
              </p>
            </div>

            {/* Items */}
            <ul className="grid gap-2 sm:grid-cols-2">
              {release.items.map((item) => {
                const Inner = (
                  <div className="group h-full rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.04]">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-xl border border-white/10 bg-primary/10 p-2 text-primary transition-transform group-hover:scale-110">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 text-[14px] font-semibold text-foreground">{item.title}</h4>
                        <p className="text-[13px] leading-relaxed text-foreground/75">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={item.title}>
                    {item.href ? (
                      <a href={item.href} className="block">{Inner}</a>
                    ) : (
                      Inner
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Callout type="note" title="Older releases">
        Novira ships small fixes and polish constantly — the entries above are the ones worth surfacing as user-visible changes. For the full commit history, the source is the source of truth.
      </Callout>
    </GuideSection>
  );
}
