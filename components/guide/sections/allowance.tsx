import { Wallet } from 'lucide-react';
import { GuideSection, Step, StepList } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';

export function AllowanceSection() {
  return (
    <GuideSection
      id="allowance"
      icon={Wallet}
      eyebrow="Plan & track"
      title="Monthly allowance"
      tryIt={{ href: '/settings', label: 'Open Settings' }}
      intro="Your top-line budget. Set a monthly amount, decide what shouldn’t count, and let unspent money roll forward to next month."
    >
      <h3>Setting your allowance</h3>
      <StepList>
        <Step n={1}>
          Open <strong>Settings → General → Monthly allowance</strong>.
        </Step>
        <Step n={2}>
          Enter the amount you want to give yourself each month, in your home currency. (Multi-currency users can set per-currency budgets.)
        </Step>
        <Step n={3}>
          Save. The dashboard’s “Available this month” card recalculates immediately.
        </Step>
      </StepList>

      <h3>What counts and what doesn’t</h3>
      <p>
        By default, every transaction reduces your allowance. But some things — rent, transfers between your own accounts, big one-off purchases — aren’t really discretionary. Use the <strong>Exclude from allowance</strong> checkbox in the Add Expense form to keep those out of the gauge.
      </p>

      <ul>
        <li><strong>Rent &amp; fixed bills</strong> — exclude. They’re committed; tracking them against discretionary money is misleading.</li>
        <li><strong>Transfers to savings</strong> — exclude. The money didn’t leave your control.</li>
        <li><strong>Income</strong> — automatically excluded.</li>
        <li><strong>Settlement transactions</strong> — automatically excluded so paying back a friend doesn’t double-count.</li>
      </ul>

      <Callout type="note" title="Carryover">
        If you spend less than your allowance, the leftover is calculated as carryover — Novira tells you about it on the first of the next month. Carryover is opt-in: it doesn’t change your budget number itself, just nudges you about the slack.
      </Callout>

      <Callout type="tip" title="Spending pace alerts">
        Turn on <CodePill>Spending pace</CodePill> in Settings → Notifications and Novira will warn you mid-month if your daily spend implies you’ll overshoot. The warning weighs your recent week more than the rest of the month, so it adapts as your habits change.
      </Callout>
    </GuideSection>
  );
}
