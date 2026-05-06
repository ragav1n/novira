import { Globe } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';

export function MultiCurrencySection() {
  return (
    <GuideSection
      id="multi-currency"
      icon={Globe}
      eyebrow="Money in & out"
      title="Multi-currency & trips"
      tryIt={{ href: '/add', label: 'Open Add Expense' }}
      intro="Travel without spreadsheet math. Pay in yen, see the total in your home currency, and trust that yesterday’s totals don’t shift when today’s rates do."
    >
      <h3>How currencies work</h3>
      <p>
        Every expense knows two things: the currency you actually paid in, and what that comes to in your home currency. Novira looks up the exchange rate at the moment you save, and then locks it in — so a year from now, that ¥10,000 dinner still shows the rupee total it had on the day you ate it.
      </p>

      <FactGrid>
        <FactRow label="Currencies you can use">
          20 — INR, USD, EUR, GBP, CHF, SGD, VND, TWD, JPY, KRW, HKD, MYR, PHP, THB, CAD, AUD, MXN, BRL, IDR, AED.
        </FactRow>
        <FactRow label="Where exchange rates come from">A live rate service on the web. Novira keeps a backup source in case the main one is having a bad day.</FactRow>
        <FactRow label="Past dates">Once Novira has looked up a past rate, it remembers it forever — those numbers don’t change.</FactRow>
        <FactRow label="Today’s rate">Refreshed every few hours so it stays current.</FactRow>
        <FactRow label="Where rates show up">Your transactions, your bucket totals, every chart in Analytics, and the what-if simulator.</FactRow>
      </FactGrid>

      <h3>Trip mode</h3>
      <p>
        Going to Tokyo for two weeks? Make a bucket called “Tokyo trip,” set its currency to <CodePill>JPY</CodePill> and a budget like <CodePill>¥150,000</CodePill>. Add the trip dates, and you’re set.
      </p>

      <ul>
        <li>Add expenses in yen without thinking about conversion — Novira handles it.</li>
        <li>The bucket’s progress bar shows how much yen you have left, in yen.</li>
        <li>Your home dashboard still shows the rupee/dollar/euro totals, so the bigger picture stays consistent.</li>
        <li>When the trip ends, archive the bucket — the historical exchange rates stay locked in.</li>
      </ul>

      <Callout type="tip" title="A different currency for each part of your life">
        Each bucket can have its own currency. A trip bucket in EUR, a side-business bucket in USD, your everyday spending in INR — they all sit happily on the same dashboard.
      </Callout>

      <Callout type="note" title="Where to set your defaults">
        <strong>Settings → Locale → Currency</strong> sets your home currency. <strong>Settings → Quick-add defaults</strong> lets you change the default for new expenses if you usually pay in something different.
      </Callout>
    </GuideSection>
  );
}
