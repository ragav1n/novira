import { Users } from 'lucide-react';
import { GuideSection, Step, StepList } from '../guide-section';
import { Callout } from '../callout';
import { SplitExpenseDemo } from '../demos/split-expense-demo';

export function SplitsSection() {
  return (
    <GuideSection
      id="splits"
      icon={Users}
      eyebrow="Money in & out"
      title="Splitting expenses"
      tryIt={{ href: '/add', label: 'Try a split' }}
      intro="Pizza Friday, the apartment Wi-Fi bill, that group beach house. Novira tracks who paid, who owes, and lets everyone settle in two taps."
      demo={<SplitExpenseDemo />}
    >
      <h3>Split a single expense</h3>
      <StepList>
        <Step n={1}>
          Open Add Expense. Fill in the amount, description, and category as usual.
        </Step>
        <Step n={2}>
          Toggle <strong>Split</strong>. Pick the group (or individual friends) you’re splitting with.
        </Step>
        <Step n={3}>
          Choose how to split — <strong>evenly</strong>, by <strong>percentage</strong>, by <strong>shares</strong>, or with <strong>custom amounts</strong>.
        </Step>
        <Step n={4}>
          Save. Each person sees their share appear on their balance with the original transaction as the source.
        </Step>
      </StepList>

      <Callout type="note" title="Shared workspaces auto-split">
        If you’re inside a Couple or Home workspace, the split toggle is on by default and the group is preselected. One tap, done.
      </Callout>

      <h3>Settling up</h3>
      <p>
        Open <strong>Groups → Settlements</strong>. Novira shows the net of all splits between you and each friend or group member: who owes whom, how much, in which currency.
      </p>
      <ul>
        <li><strong>Suggested settlements</strong> minimize the number of payments — instead of three people paying back two others separately, you get a clean two-step plan.</li>
        <li><strong>Mark as settled</strong> when money has actually moved. Novira creates a settlement transaction in both ledgers so the balance returns to zero.</li>
        <li><strong>Batch settle</strong> if you want to clear several friends at once.</li>
      </ul>

      <Callout type="warning" title="Settlement transactions are read-only">
        Once you mark a balance settled, the resulting transaction is locked. To undo, delete it from the Settlements list — it’ll restore the original outstanding balance.
      </Callout>

      <Callout type="tip" title="Why income can’t be split">
        Income is treated as personal earnings — it would muddle the math to split it across people. If you’re tracking a shared rental income or business payout, log it as a regular expense (negative amount) in the group instead.
      </Callout>
    </GuideSection>
  );
}
