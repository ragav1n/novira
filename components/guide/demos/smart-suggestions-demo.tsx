'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Coffee, CreditCard, MapPin, Box } from 'lucide-react';
import { AutoPlay } from './auto-play';
import { SNAPPY, FADE, STAGGER_FAST } from './transitions';

export function SmartSuggestionsDemo() {
  return (
    <AutoPlay ariaLabel="Typing Starbucks into the description field, then category, payment method, and location chips appearing as suggestions">
      {(inView) => <Inner play={inView} />}
    </AutoPlay>
  );
}

const TARGET = 'Starbucks';

function Inner({ play }: { play: boolean }) {
  const [text, setText] = useState('');
  const [suggestionsOn, setOn] = useState(false);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    function loop() {
      setText('');
      setOn(false);
      TARGET.split('').forEach((_, i) => {
        timeouts.push(setTimeout(() => !cancelled && setText(TARGET.slice(0, i + 1)), 220 + i * 100));
      });
      timeouts.push(setTimeout(() => !cancelled && setOn(true), 220 + TARGET.length * 100 + 350));
      timeouts.push(setTimeout(loop, 220 + TARGET.length * 100 + 350 + 2800));
    }
    loop();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [play]);

  const suggestions = [
    { icon: Coffee,     label: 'Food',      tone: 'amber' },
    { icon: CreditCard, label: 'Credit',    tone: 'sky' },
    { icon: MapPin,     label: 'MG Road',   tone: 'rose' },
    { icon: Box,        label: 'Coffee jar', tone: 'fuchsia' },
  ] as const;

  const tones: Record<string, string> = {
    amber:   'border-amber-400/30   bg-amber-500/10   text-amber-300',
    sky:     'border-sky-400/30     bg-sky-500/10     text-sky-300',
    rose:    'border-rose-400/30    bg-rose-500/10    text-rose-300',
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300',
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
        <div className="text-[10px] uppercase tracking-widest text-foreground/65">Description</div>
        <div className="mt-2 flex items-baseline">
          <span className="font-medium text-foreground">{text || <span className="text-foreground/50">Where did you spend?</span>}</span>
          <motion.span
            aria-hidden
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
            className="ml-0.5 inline-block h-5 w-[2px] bg-primary align-middle"
          />
        </div>
        {/* Reserved height for the suggestion chips (one row + label) so the
            section content below doesn't shift when chips fade in. */}
        <div className="mt-4 h-[64px]">
          <AnimatePresence>
            {suggestionsOn && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={FADE}
                className="flex flex-wrap gap-1.5 transform-gpu"
              >
                <div className="mb-0.5 w-full text-[10px] uppercase tracking-widest text-foreground/65">
                  Smart suggestions
                </div>
                {suggestions.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, scale: 0.85, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ ...SNAPPY, delay: i * STAGGER_FAST }}
                      style={{ willChange: 'transform, opacity' }}
                      className={`inline-flex items-center gap-1.5 transform-gpu rounded-full border px-2.5 py-1 text-[12px] ${tones[s.tone]}`}
                    >
                      <Icon className="h-3 w-3" />
                      {s.label}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-foreground/75">
          When you type a description Novira recognizes, it offers fills from your past expenses — one tap pulls in the category, payment method, location, and bucket all at once.
        </p>
      </div>
    </div>
  );
}
