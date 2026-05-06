import { Users } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';

export function GroupsSection() {
  return (
    <GuideSection
      id="groups"
      icon={Users}
      eyebrow="Together"
      title="Groups & friends"
      tryIt={{ href: '/groups', label: 'Open Groups' }}
      intro="Workspaces for the people you spend money with. Couples, households, trip crews — each with its own theme, budget, and shared expense list."
    >
      <h3>Workspace types</h3>
      <FactGrid>
        <FactRow label="Personal">Your default. Just you. No sharing, no splits visible to others.</FactRow>
        <FactRow label="Couple">For two people sharing finances. The dashboard goes rose. Budgets and buckets are shared by default.</FactRow>
        <FactRow label="Home">Family or household budget. Theme goes amber. Designed for multiple long-term members.</FactRow>
        <FactRow label="Trip">Travel groups with a start and end date. Theme goes sky-blue. Settle up at the end of the trip.</FactRow>
        <FactRow label="Other">Custom group for anything else — a side project, a hobby club, a shared subscription pool.</FactRow>
      </FactGrid>

      <h3>Create a group</h3>
      <StepList>
        <Step n={1}>
          Open <strong>Groups → Groups tab → +</strong>.
        </Step>
        <Step n={2}>
          Pick a type. The icon, theme, and default behavior follow from the choice.
        </Step>
        <Step n={3}>
          Name the group. For a trip, add start and end dates.
        </Step>
        <Step n={4}>
          Save. You become the owner; the group appears in your workspace switcher.
        </Step>
      </StepList>

      <h3>Adding people</h3>
      <ul>
        <li><strong>By email</strong> — type your friend’s email; Novira sends a friend request.</li>
        <li><strong>By QR code</strong> — open <strong>Friends → Scan QR</strong>, point at theirs.</li>
        <li><strong>Share your code</strong> — open <strong>Friends → My code</strong> to show or share yours.</li>
      </ul>
      <p>
        Friend requests need to be accepted before the person joins. Once they’re a friend, you can invite them to any group from the group settings.
      </p>

      <h3>Workspace switching</h3>
      <p>
        Tap the workspace pill in the dashboard header to flip between Personal, Couple, Home, and any active group. The whole UI rethemes — color, budget displayed, transactions visible, members eligible for splits.
      </p>

      <Callout type="note" title="Permissions">
        The group <strong>creator</strong> can rename the group, change its type, edit dates, remove members, and delete the group. Other <strong>members</strong> can add expenses, settle debts, and view the shared budget.
      </Callout>

      <Callout type="warning" title="Deleting a group">
        When you delete a group, member relationships are dissolved and shared expenses revert to personal. There’s no undo — Novira asks you to confirm.
      </Callout>
    </GuideSection>
  );
}
