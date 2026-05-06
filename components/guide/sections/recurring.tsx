import { Repeat } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { RecurringDetectDemo } from '../demos/recurring-detect-demo';

export function RecurringSection() {
  return (
    <GuideSection
      id="recurring"
      icon={Repeat}
      eyebrow="Money in & out"
      title="Recurring & subscriptions"
      tryIt={{ href: '/subscriptions', label: 'Open Subscriptions' }}
      intro="Bills, subscriptions, paychecks — anything that repeats. Novira can manage them for you, spot the ones you forgot to add, and let you know when prices quietly creep up."
      demo={<RecurringDetectDemo />}
    >
      <h3>Set up a recurring expense</h3>
      <StepList>
        <Step n={1}>
          Open the Add Expense form and fill in the amount and description like normal.
        </Step>
        <Step n={2}>
          Toggle <strong>Recurring</strong>. Pick how often it repeats — <em>daily</em>, <em>weekly</em>, <em>monthly</em>, or <em>yearly</em>.
        </Step>
        <Step n={3}>
          Pick the next date it’ll happen. Novira uses that as the starting point for everything that follows.
        </Step>
        <Step n={4}>
          Save. The expense is added today, and the next ones get scheduled automatically.
        </Step>
      </StepList>

      <Callout type="note" title="Smart with short months">
        A monthly bill set on the 31st automatically lands on the 28th, 29th, or 30th in shorter months — it never skips ahead into the next month.
      </Callout>

      <h3>Subscriptions Novira spots for you</h3>
      <p>
        Novira watches your last three months of spending. When it sees the same name come up three or more times, charged for about the same amount, on a regular rhythm — that’s probably a subscription. A card pops up on the dashboard suggesting you start tracking it. Confirm in one tap, or dismiss if you’d rather not.
      </p>

      <FactGrid>
        <FactRow label="What counts as “same”">Three or more charges with the same name and amounts that stay close to each other.</FactRow>
        <FactRow label="Daily">Roughly one to two days apart.</FactRow>
        <FactRow label="Weekly">Roughly five to nine days apart.</FactRow>
        <FactRow label="Monthly">Roughly four weeks apart.</FactRow>
        <FactRow label="Yearly">Roughly twelve months apart.</FactRow>
      </FactGrid>

      <h3>The Subscriptions view</h3>
      <p>
        Tap <strong>Subs</strong> in the nav for the master list. Sort, filter, pause, edit amounts, pin your favorites. Each row shows the next due date, the monthly cost (so you can compare a yearly Spotify plan to a monthly one), and a small badge if the most recent charge was noticeably different from before.
      </p>

      <ul>
        <li><strong>Pause</strong> a subscription until a date you pick — useful when you cancel for a month or two.</li>
        <li><strong>Pin</strong> the ones you check often (rent, salary).</li>
        <li><strong>Bulk edit</strong> several at once — change the amount, the rhythm, or the bucket they go into.</li>
        <li><strong>Price drift</strong>: a small orange badge appears when, say, Spotify quietly raised your plan from ₹199 to ₹229.</li>
      </ul>

      <Callout type="pro" title="Income works the same way">
        Recurring isn’t just for bills. Your monthly salary or freelance retainer fits the same pattern — turn on the <strong>Income</strong> toggle and Novira keeps it out of the subscriptions list and folds it into your cash flow forecasts instead.
      </Callout>

      <Callout type="tip" title="Send your bill schedule to your calendar">
        Settings → Data Management → <strong>Export to calendar</strong> creates a calendar file with all of your active recurring items as repeating events. Open it in Google Calendar, Apple Calendar, or Outlook to see your bill rhythm next to the rest of your life.
      </Callout>
    </GuideSection>
  );
}
