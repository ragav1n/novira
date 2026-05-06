import { Home } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { PullToRefreshDemo } from '../demos/pull-to-refresh-demo';

export function DashboardSection() {
  return (
    <GuideSection
      id="dashboard"
      icon={Home}
      eyebrow="Start here"
      title="The dashboard"
      intro="Your home base. Everything you need to know about this month — and a couple of shortcuts to make tomorrow easier — without scrolling past three ad blocks."
      demo={<PullToRefreshDemo />}
    >
      <h3>Anatomy of the dashboard</h3>
      <FactGrid>
        <FactRow label="Workspace header">
          Your avatar, name, and the current workspace (Personal, your couple, your home, or a trip group). Tap to switch contexts.
        </FactRow>
        <FactRow label="Available this month">
          Big number showing what’s left of your monthly allowance, after spending and excluding anything you’ve marked as “not allowance”.
        </FactRow>
        <FactRow label="Spending overview">
          A monthly budget gauge with category breakdown — red when you’ve overshot, green when you’re on pace.
        </FactRow>
        <FactRow label="Focus selector">
          A pill that lets you pivot the dashboard to a single bucket (e.g. “Tokyo trip”). All charts and stats then show only that bucket’s data.
        </FactRow>
        <FactRow label="Recent transactions">
          The latest 100 transactions. Pull to refresh, swipe to edit, tap “Load more” for older entries.
        </FactRow>
        <FactRow label="Upcoming recurring">
          A small panel showing bills and subscriptions due in the next few days, with quick-pay shortcuts.
        </FactRow>
        <FactRow label="What-if & insights">
          Cards that surface as the system finds something useful: a category cut suggestion, a price-drift alert, a weekly recap.
        </FactRow>
      </FactGrid>

      <h3>Customize the layout</h3>
      <p>
        Open <strong>Settings → Dashboard layout</strong> to drag panels into the order you like, or hide ones you don’t use. Changes save to that device — set up a different layout on your phone vs. your laptop.
      </p>

      <Callout type="tip" title="Privacy mode">
        Tap the eye icon in the dashboard header to blur every amount on screen — handy in coffee shops or shared screens. Tap again to reveal.
      </Callout>

      <h3>Quick gestures</h3>
      <ul>
        <li><strong>Pull down</strong> from the top of the page to refresh.</li>
        <li><strong>Swipe left</strong> on any transaction to reveal Edit and Delete.</li>
        <li><strong>Tap the workspace pill</strong> in the header to switch between Personal, Couple, Home, and any group.</li>
        <li><strong>Tap “Focus”</strong> to lock the whole dashboard to a single bucket.</li>
      </ul>
    </GuideSection>
  );
}
