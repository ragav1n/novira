'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tx = {
  id: string;
  desc: string;
  category: string;
  amount: number;
  tags: string[];
  date: string;
};

const TXNS: Tx[] = [
  { id: '1', desc: 'Uber to airport',     category: 'Transport',   amount: 980,   tags: ['work', 'travel'], date: 'Apr 24' },
  { id: '2', desc: 'Starbucks',            category: 'Food',        amount: 320,   tags: ['coffee'],         date: 'Apr 24' },
  { id: '3', desc: 'Spotify Premium',      category: 'Subscription',amount: 199,   tags: [],                 date: 'Apr 21' },
  { id: '4', desc: 'Zara — Spring jacket', category: 'Shopping',    amount: 4_240, tags: ['clothes'],        date: 'Apr 20' },
  { id: '5', desc: 'Trader Joe\'s',        category: 'Groceries',   amount: 2_180, tags: [],                 date: 'Apr 19' },
  { id: '6', desc: 'Bali villa deposit',   category: 'Travel',      amount: 18_500,tags: ['travel', 'trip'], date: 'Apr 18' },
  { id: '7', desc: 'Blue Tokai coffee',    category: 'Food',        amount: 380,   tags: ['coffee'],         date: 'Apr 17' },
  { id: '8', desc: 'Netflix',              category: 'Subscription',amount: 649,   tags: [],                 date: 'Apr 15' },
  { id: '9', desc: 'Uber pool',            category: 'Transport',   amount: 156,   tags: ['work'],           date: 'Apr 14' },
  { id: '10', desc: 'Pizza Friday',        category: 'Food',        amount: 1_240, tags: ['friends'],        date: 'Apr 12' },
];

type Op = '>' | '<' | '>=' | '<=' | '=';
type Token =
  | { kind: 'text'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'op'; op: Op; value: number };

function parse(query: string): { tokens: Token[]; invalid: string[] } {
  const tokens: Token[] = [];
  const invalid: string[] = [];
  for (const raw of query.split(/\s+/).filter(Boolean)) {
    if (raw.startsWith('#')) {
      tokens.push({ kind: 'tag', value: raw.slice(1).toLowerCase() });
      continue;
    }
    const m = raw.match(/^(>=|<=|>|<|=)(\d+(?:\.\d+)?)$/);
    if (m) {
      tokens.push({ kind: 'op', op: m[1] as Op, value: Number(m[2]) });
      continue;
    }
    if (/^[<>=]/.test(raw)) {
      invalid.push(raw);
      continue;
    }
    tokens.push({ kind: 'text', value: raw.toLowerCase() });
  }
  return { tokens, invalid };
}

function matches(tx: Tx, tokens: Token[]): boolean {
  for (const t of tokens) {
    if (t.kind === 'text') {
      const hay = tx.desc.toLowerCase();
      if (!hay.includes(t.value)) return false;
    } else if (t.kind === 'tag') {
      if (!tx.tags.map((s) => s.toLowerCase()).includes(t.value)) return false;
    } else if (t.kind === 'op') {
      const a = tx.amount;
      const v = t.value;
      const ok =
        (t.op === '>' && a > v) ||
        (t.op === '<' && a < v) ||
        (t.op === '>=' && a >= v) ||
        (t.op === '<=' && a <= v) ||
        (t.op === '=' && a === v);
      if (!ok) return false;
    }
  }
  return true;
}

const PRESETS = ['uber', '#travel', '>1000', 'coffee #coffee', '<500'];

export function SearchPlaygroundDemo() {
  const [q, setQ] = useState('');
  const { tokens, invalid } = useMemo(() => parse(q), [q]);
  const results = useMemo(() => (tokens.length ? TXNS.filter((t) => matches(t, tokens)) : TXNS), [tokens]);

  return (
    <div
      role="region"
      aria-label="Try Novira's search syntax — type a query and watch results filter live"
      className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-primary/[0.04] to-transparent p-5"
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary/85">
        <SearchIcon className="h-3 w-3" />
        Try the search syntax — live
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-background/60 px-3 py-2.5 focus-within:border-primary/40 focus-within:bg-background/80">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          aria-label="Search query"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: uber #travel >500"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setQ('')}
            className="rounded-full p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Preset chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setQ(p)}
            className="rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-0.5 font-mono text-[11px] text-foreground/75 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {p}
          </button>
        ))}
      </div>

      {/* What we understood */}
      {tokens.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground/70">Looking for:</span>
          {tokens.map((t, i) => {
            const tone =
              t.kind === 'text'
                ? 'border-sky-400/30 bg-sky-500/10 text-sky-300'
                : t.kind === 'tag'
                ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300'
                : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300';
            const label =
              t.kind === 'text'
                ? `name contains “${t.value}”`
                : t.kind === 'tag'
                ? `tagged #${t.value}`
                : `amount ${t.op} ${t.value}`;
            return (
              <span key={i} className={cn('rounded-full border px-2 py-0.5', tone)}>
                {label}
              </span>
            );
          })}
          {invalid.map((s, i) => (
            <span key={`bad-${i}`} className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 font-mono text-red-300">
              didn’t understand: {s}
            </span>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="mt-4 rounded-xl border border-white/10 bg-background/40">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[11px]">
          <span className="text-muted-foreground/70">
            {results.length} {results.length === 1 ? 'result' : 'results'} of {TXNS.length}
          </span>
          {tokens.length === 0 && <span className="text-muted-foreground/50">Showing all — start typing</span>}
        </div>
        <ul className="h-[260px] overflow-y-auto divide-y divide-white/5">
          <AnimatePresence initial={false}>
            {results.map((tx) => (
              <motion.li
                key={tx.id}
                layout="position"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
                style={{ willChange: 'transform, opacity' }}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 text-[12px] transform-gpu"
              >
                <div className="min-w-0">
                  <div className="truncate text-foreground/95">{tx.desc}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{tx.category}</span>
                    <span>·</span>
                    <span>{tx.date}</span>
                    {tx.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-fuchsia-300/80">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="font-mono text-foreground/85">−₹{tx.amount.toLocaleString('en-IN')}</div>
              </motion.li>
            ))}
          </AnimatePresence>
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No matches. Try one of the chips above.
            </li>
          )}
        </ul>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground/80">
        This works exactly like the real Search inside the app. Mix words, amounts (<code className="rounded bg-white/5 px-1">{'>'}500</code>), and tags (<code className="rounded bg-white/5 px-1">#travel</code>) — every part has to match.
      </p>
    </div>
  );
}
