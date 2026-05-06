import { CalendarDays } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { CalendarHeatmapDemo } from '../demos/calendar-heatmap-demo';

export function CashflowSection() {
  return (
    <GuideSection
      id="cashflow"
      icon={CalendarDays}
      eyebrow="Plan & track"
      title="Cash flow calendar"
      tryIt={{ href: '/cashflow', label: 'Open Cash Flow' }}
      intro="A month-at-a-glance view: which bills are due, which goals deadline, and where your wallet will feel tightest before the next paycheck."
      demo={<CalendarHeatmapDemo />}
    >
      <h3>What you see</h3>
      <FactGrid>
        <FactRow label="Recurring bills">Every due date for your subscriptions and recurring bills is shown on the calendar, color-coded by category.</FactRow>
        <FactRow label="One-off bills">Add ad-hoc events (annual insurance, a wedding gift) on a specific date with an amount and label.</FactRow>
        <FactRow label="Goal deadlines">Savings goals with a deadline appear as flag markers.</FactRow>
        <FactRow label="Bucket end dates">Trips and projects ending soon get a marker so you don’t forget to lock them.</FactRow>
        <FactRow label="Heatmap">Calendar cells shaded by spending intensity — quickly spot heavy and light days.</FactRow>
        <FactRow label="Tightest day">Novira flags the day in the month where your running balance dipped lowest.</FactRow>
      </FactGrid>

      <h3>Adding a one-off bill</h3>
      <p>
        Tap any day on the calendar to open its detail sheet. Tap <strong>+ Add event</strong>, enter a label, optional amount, optional currency, optional notes. Useful for bills that aren’t monthly — annual subscriptions, kids’ tuition, a friend’s wedding.
      </p>

      <p>
        Mark events <strong>completed</strong> as you handle them. Completed events stay on the calendar, just dimmed.
      </p>

      <Callout type="tip" title="Schedule from the calendar">
        Tap a day → <strong>Schedule expense</strong> to jump into the Add Expense form pre-filled with that date and the recurring toggle on. Saves three taps when you’re planning ahead.
      </Callout>

      <Callout type="pro" title="Bill reminders">
        Settings → Notifications → <strong>Bill reminders</strong> lets you choose a lead time (1, 3, or 7 days). Novira pings you that many days before each recurring bill’s due date — and you only get one reminder per bill, even if Novira would otherwise check more than once.
      </Callout>
    </GuideSection>
  );
}
