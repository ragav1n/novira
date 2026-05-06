import { Hand } from 'lucide-react';
import { GuideSection } from '../guide-section';
import { Callout } from '../callout';
import { SwipeRowDemo } from '../demos/swipe-row-demo';

export function GesturesSection() {
  return (
    <GuideSection
      id="gestures"
      icon={Hand}
      eyebrow="Platform"
      title="Gestures"
      tryIt={{ href: '/', label: 'Open Dashboard' }}
      intro="Shortcuts you can feel. None of them are required — every action also has a button — but once you learn them, Novira gets really fast."
      demo={<SwipeRowDemo />}
    >
      <h3>Swipe to edit / delete</h3>
      <p>
        On any transaction row, swipe left. Two action buttons reveal: <strong>Edit</strong> (indigo) and <strong>Delete</strong> (red). Swipe further to “snap open” and tap the action. Swipe back to dismiss.
      </p>
      <p>
        Pending or failed items can’t be swiped — they’re grayed out. You also can’t edit/delete settlement transactions or splits where you weren’t the original creator.
      </p>

      <h3>Pull to refresh</h3>
      <p>
        On the dashboard, pull down from the top. A spinner appears once you’ve pulled far enough; release to fetch the latest. Phones and tablets only — on a computer, just reload the page or tap the small refresh icon.
      </p>

      <h3>Drag to reorder</h3>
      <p>
        In <strong>Settings → Dashboard layout</strong>, drag any panel up or down to change your dashboard order. The change saves per device, so your phone and laptop can show different layouts.
      </p>

      <Callout type="tip" title="Soft taps on iPhone">
        When you’ve installed Novira to your iPhone home screen, you’ll feel a soft tap when switching tabs, swiping a row, or pulling to refresh. To turn it off, change your phone’s system-wide haptic setting.
      </Callout>

      <h3>Workspace pill</h3>
      <p>
        Tap the workspace name in the dashboard header to switch between Personal, Couple, Home, and your active groups. Hold to open the workspace settings menu directly.
      </p>
    </GuideSection>
  );
}
