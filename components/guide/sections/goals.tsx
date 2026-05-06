import { Target } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { GoalProgressDemo } from '../demos/goal-progress-demo';

export function GoalsSection() {
  return (
    <GuideSection
      id="goals"
      icon={Target}
      eyebrow="Plan & track"
      title="Savings goals"
      tryIt={{ href: '/goals', label: 'Open Goals' }}
      intro="Save for a thing, watch the bar fill, log every deposit. Novira keeps the contribution history, projects when you’ll get there, and nudges you when deadlines approach."
      demo={<GoalProgressDemo />}
    >
      <h3>Create a goal</h3>
      <StepList>
        <Step n={1}>
          Tap <strong>Goals</strong> in the nav, then <strong>+ New goal</strong>.
        </Step>
        <Step n={2}>
          Name it. Pick an icon and a color (12 icons, 8 colors — make it yours).
        </Step>
        <Step n={3}>
          Set the target amount and optionally a deadline. Currency can be different from your home currency — useful for trip funds or international purchases.
        </Step>
        <Step n={4}>
          Save. Your goal appears in the list with a 0% progress bar and tick marks at 25, 50, and 75%.
        </Step>
      </StepList>

      <h3>Adding deposits</h3>
      <p>
        Tap your goal → <strong>+ Deposit</strong>. Enter the amount and a note. The progress bar updates, the deposit lands in the goal’s history, and Novira recalculates your monthly velocity and projected completion date.
      </p>

      <Callout type="tip" title="Milestone markers">
        Goal progress bars show tick marks at <strong>25%</strong>, <strong>50%</strong>, and <strong>75%</strong> so you can read your status at a glance. The 100% mark is the bar’s end — that’s the finish line.
      </Callout>

      <h3>Find what you need</h3>
      <FactGrid>
        <FactRow label="Search">Type to filter goals by name.</FactRow>
        <FactRow label="Sort by">Deadline (soonest), progress (highest %), remaining amount, name, recently created.</FactRow>
        <FactRow label="Filter">All / In-progress / Due-soon / Overdue.</FactRow>
        <FactRow label="Show achieved">Toggle to surface or hide completed goals.</FactRow>
      </FactGrid>

      <Callout type="note" title="Deadlines are reminders, not deadlines">
        A missed deadline doesn’t invalidate the goal — Novira just flags it as overdue and nudges you a few days before. Update the date or carry on.
      </Callout>

      <Callout type="pro" title="Project completion dates">
        Once you have a few deposits in, Novira estimates when you’ll hit the target at your current pace. Look at the goal’s history sheet for a chart of contributions over time — useful for spotting whether you’re slipping or speeding up.
      </Callout>
    </GuideSection>
  );
}
