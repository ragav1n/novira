import { HelpCircle } from 'lucide-react';
import { GuideSection } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';

export function TroubleshootingSection() {
  return (
    <GuideSection
      id="troubleshooting"
      icon={HelpCircle}
      eyebrow="Platform"
      title="Troubleshooting"
      intro="The short list of fixes that resolve most things. Try these before assuming something is broken."
    >
      <h3>The app feels slow or shows old data</h3>
      <ul>
        <li>Pull down on the dashboard to force a refresh.</li>
        <li>If you’ve just signed in on a new device, give it a few seconds — it’s downloading your history.</li>
        <li>Still stuck? On a phone, close Novira and open it again. On a computer, press <CodePill>Cmd/Ctrl + Shift + R</CodePill> to force a fresh reload.</li>
      </ul>

      <h3>Push notifications aren’t arriving</h3>
      <ul>
        <li>Make sure you’ve added Novira to your home screen — push notifications need that. (See <a href="#getting-started">Getting started</a>.)</li>
        <li>Open <strong>Settings → Notifications</strong> and confirm the main toggle is on. Your phone or browser should have asked permission the first time you turned it on.</li>
        <li>Check your phone’s system notification settings for Novira. If they’re blocked there, no toggle inside the app can override that.</li>
        <li>Quiet hours might be silencing them — look for the <strong>Quiet hours</strong> row in the same panel.</li>
      </ul>

      <h3>An offline expense isn’t syncing</h3>
      <ul>
        <li>Open <strong>Settings → Data Management → Sync status</strong>. Anything that failed to send lives there with a Try Again button.</li>
        <li>If trying again doesn’t help, the message usually explains why — most often it’s a permissions thing (the workspace was deleted while you were offline). Discard the failed item and add the expense again in a workspace you’re still part of.</li>
        <li>Make sure you’re actually online — Novira trusts what your phone or browser tells it.</li>
      </ul>

      <h3>A currency conversion looks wrong</h3>
      <ul>
        <li>Conversions use the rate from the moment you saved the expense, on purpose — that way old totals don’t shift around when rates change. Editing the expense doesn’t look up a new rate.</li>
        <li>If a brand-new expense looks off, the exchange rates might be temporarily delayed. Wait a minute and try again, or set the converted amount yourself in the edit form.</li>
      </ul>

      <h3>I lost a draft I was typing</h3>
      <p>
        Drafts are saved automatically as you type. If you navigated away or accidentally refreshed, reopen the Add Expense form while the same tab is still open and your draft will be there. If you closed the tab or quit the app, the draft is gone.
      </p>

      <h3>I want to start fresh on this device</h3>
      <p>
        Scroll to the bottom of <strong>Settings</strong> and tap <strong>Reset App</strong>. That clears the local copy on this device and signs you out — your account in the cloud isn’t touched, so signing back in restores everything.
      </p>

      <h3>I want to delete everything, permanently</h3>
      <p>
        At the very bottom of <strong>Settings</strong>, in the danger zone, you’ll find <strong>Delete Account</strong>. After confirming, your account, transactions, buckets, goals, and group memberships are removed. It’s irreversible — export your data first if you want a copy.
      </p>

      <Callout type="note" title="Still stuck?">
        If something here didn’t answer your question, the rest of this guide probably has the detail you need — try the table of contents on the left. From inside Novira, the <strong>?</strong> icon in the dashboard header opens a quick how-to that links back here.
      </Callout>
    </GuideSection>
  );
}
