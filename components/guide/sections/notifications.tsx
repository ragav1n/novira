import { Bell } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';

export function NotificationsSection() {
  return (
    <GuideSection
      id="notifications"
      icon={Bell}
      eyebrow="Platform"
      title="Notifications"
      tryIt={{ href: '/settings#notifications', label: 'Open Notifications' }}
      intro="Useful nudges, never noise. Choose which categories you care about, set quiet hours, and forget about it."
    >
      <h3>Enable push notifications</h3>
      <StepList>
        <Step n={1}>
          Install Novira to your home screen first (see <a href="#getting-started">Getting started</a>). Notifications need the installed version on iPhones; on Android and computers, your browser handles them too.
        </Step>
        <Step n={2}>
          Open <strong>Settings → Notifications</strong> and flip <strong>Push notifications</strong> on.
        </Step>
        <Step n={3}>
          Your phone or browser asks for permission. Allow it, and Novira turns notifications on for this device.
        </Step>
        <Step n={4}>
          Toggle the categories you want. Quiet hours and digest cadence can be set in the same panel.
        </Step>
      </StepList>

      <h3>What Novira can send you</h3>
      <FactGrid>
        <FactRow label="Bill reminders">A heads-up before a recurring bill is due. Choose how much notice you want — off, 1 day, 3 days, or a week.</FactRow>
        <FactRow label="Spending pace">A mid-month nudge if your projection says you’ll blow past the monthly allowance.</FactRow>
        <FactRow label="Bucket deadlines">Reminder when a trip or project bucket’s end date is approaching.</FactRow>
        <FactRow label="Spending digest">A short recap of yesterday or last week — daily, weekly, or off.</FactRow>
        <FactRow label="Quiet hours">A start/end window (default 22:00–07:00) when no notifications fire.</FactRow>
      </FactGrid>

      <Callout type="note" title="Budget alerts live in General, not here">
        The <strong>budget alerts</strong> toggle (warns when you’ve spent more than 80% of your monthly allowance) is a separate setting under <strong>Settings → General</strong>, not the notifications panel.
      </Callout>

      <h3>Quiet hours</h3>
      <p>
        Set the start and end hours when notifications should stay quiet. The default is 22:00 → 07:00. Quiet hours follow your local time, so notifications won’t buzz at 3 a.m. if you travel.
      </p>

      <Callout type="note" title="If you tapped Block by accident">
        Notification permissions live with your phone or browser, not inside Novira. On iPhone: <strong>Settings → Notifications → Novira</strong>. On Android (Chrome): long-press the icon → <strong>App info → Notifications</strong>. On desktop Chrome: click the lock icon in the address bar → <strong>Notifications → Allow</strong>.
      </Callout>
    </GuideSection>
  );
}
