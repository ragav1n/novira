import { Sparkles } from 'lucide-react';
import { GuideSection, Step, StepList } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';

export function GettingStartedSection() {
  return (
    <GuideSection
      id="getting-started"
      icon={Sparkles}
      eyebrow="Start here"
      title="Getting started"
      intro="Three minutes from sign-up to your first transaction. Novira works in any browser and installs as a real app on iPhone, Android, Mac, and Windows."
    >
      <h3>Create an account</h3>
      <StepList>
        <Step n={1}>
          Open <CodePill>novira.one</CodePill> and tap <strong>Sign up</strong>. Use email + password, or one tap with Google.
        </Step>
        <Step n={2}>
          Pick a strong password — Novira shows a live checklist (length, uppercase, number, symbol). Email-only accounts can change this any time from Settings → Security.
        </Step>
        <Step n={3}>
          Confirm your email if asked. You’ll land on the dashboard with a friendly empty state and a “How to use” walkthrough.
        </Step>
      </StepList>

      <Callout type="tip" title="Already have a Google account?">
        Tap <strong>Continue with Google</strong> on the sign-in page — no password to remember, and the same account works across every device.
      </Callout>

      <h3>Install Novira as an app</h3>
      <p>
        Novira lives in your browser, but you can also install it to your home screen with one tap — no app store needed. Once installed, it gets its own icon, works offline, and can send notifications, just like an app you’d download.
      </p>

      <StepList>
        <Step n={1}>
          <strong>iPhone / iPad:</strong> Open Novira in Safari → tap the Share button → <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={2}>
          <strong>Android:</strong> Open in Chrome → tap the three-dot menu → <strong>Install app</strong>. (Novira will also show an install banner after a few seconds.)
        </Step>
        <Step n={3}>
          <strong>Mac / Windows:</strong> Click the install icon in the address bar (Chrome, Edge, Brave) — Novira opens in its own window with no address bar or menu buttons.
        </Step>
      </StepList>

      <Callout type="note" title="Why install?">
        The installed version gives you a real launch icon, keeps your offline changes safer, syncs in the background, and (if you choose) buzzes your phone with budget warnings and bill reminders.
      </Callout>

      <h3>Find your way around</h3>
      <p>
        On phones, the floating tab bar at the bottom is your main navigation — it auto-hides as you scroll down and slides back up when you scroll up. On desktop, the same tabs live in a top pill that collapses into a tidy circle once you start scrolling.
      </p>
      <ul>
        <li><strong>Home</strong> — your dashboard: budget, recent transactions, upcoming bills.</li>
        <li><strong>Add (+)</strong> — log a new expense or income.</li>
        <li><strong>Analytics</strong> — charts, trends, AI insights, what-if simulator.</li>
        <li><strong>Groups</strong> — friends, shared workspaces, settle-ups.</li>
        <li><strong>Subs</strong> — every recurring bill in one list.</li>
        <li><strong>Cash flow</strong> — calendar of upcoming events and bills.</li>
        <li><strong>Goals</strong> — savings goals with deposits and milestones.</li>
        <li><strong>Search</strong> — find any transaction, save filter presets.</li>
        <li><strong>Settings</strong> — profile, notifications, data export, more.</li>
      </ul>

      <Callout type="pro" title="A handy shortcut">
        Each settings panel has its own web address — visit <CodePill>/settings#notifications</CodePill> to land directly on Notifications, or <CodePill>/settings#data</CodePill> to land on Import/Export. Bookmark the ones you visit a lot.
      </Callout>
    </GuideSection>
  );
}
