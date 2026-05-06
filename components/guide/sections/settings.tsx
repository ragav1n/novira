import { Settings } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';

export function SettingsSection() {
  return (
    <GuideSection
      id="settings"
      icon={Settings}
      eyebrow="Platform"
      title="Settings reference"
      intro="Every section, every toggle. Each panel has its own web address so you can jump straight to the one you want."
    >
      <h3>Profile</h3>
      <FactGrid>
        <FactRow label="Avatar">Tap the pencil to upload (max 10MB). Used in the dashboard header and shared workspace member lists.</FactRow>
        <FactRow label="Name">How you appear to friends and group members.</FactRow>
        <FactRow label="Monthly allowance">Your top-line discretionary budget — drives the “Available this month” gauge.</FactRow>
      </FactGrid>

      <h3>Sections (each has its own link)</h3>
      <FactGrid>
        <FactRow label={<>General <CodePill>#general</CodePill></>}>
          Two switches: <strong>Budget alerts</strong> (warns when you’ve spent more than 80% of your monthly allowance) and <strong>Privacy mode</strong> (blurs every amount until you tap the eye icon).
        </FactRow>
        <FactRow label={<>Security &amp; Privacy <CodePill>#security</CodePill></>}>
          Your email, change password, Google sign-in status.
        </FactRow>
        <FactRow label={<>Recurring Expenses <CodePill>#recurring</CodePill></>}>
          List of every active recurring expense, income, and bill. Tap the trash icon to stop a series. (To pause or pin instead of stop, use the <strong>Subscriptions</strong> view from the nav.)
        </FactRow>
        <FactRow label={<>Data Management <CodePill>#data</CodePill></>}>
          Import a bank statement, export your transactions as a spreadsheet or PDF, export your bills to a calendar file, and check sync status.
        </FactRow>
        <FactRow label={<>Notifications <CodePill>#notifications</CodePill></>}>
          Push opt-in, per-category toggles, digest cadence, quiet hours, bill reminder lead.
        </FactRow>
        <FactRow label={<>Currency &amp; Locale <CodePill>#locale</CodePill></>}>
          Currency, date format, week-start day.
        </FactRow>
        <FactRow label={<>Quick-add defaults <CodePill>#quick-add</CodePill></>}>
          Pre-select category, payment method, and bucket for every new expense.
        </FactRow>
        <FactRow label={<>Dashboard layout <CodePill>#dashboard-layout</CodePill></>}>
          Drag to reorder panels, hide what you don’t use, reset to defaults.
        </FactRow>
      </FactGrid>

      <Callout type="pro" title="Bookmark the panels you visit a lot">
        Visit <CodePill>/settings#data</CodePill> in your browser and the Data panel is already open. Save the link in your bookmarks or paste it into your own notes.
      </Callout>

      <h3>Below the panels</h3>
      <FactGrid>
        <FactRow label="User Guide">Opens this guide in a new tab.</FactRow>
        <FactRow label="Reset App">Clears your local copy and signs you out on this device. Your account in the cloud stays intact — sign back in to resync.</FactRow>
        <FactRow label="Delete Account">Permanently removes your account and everything in it. There’s no undo, so export your data first if you want a copy.</FactRow>
        <FactRow label="Log out">Signs you out on this device.</FactRow>
      </FactGrid>

      <h3>App version</h3>
      <p>
        The bottom of the Settings page shows which version of Novira you’re on. When a new version is ready, a small banner asks if you want to refresh. Installed copies update themselves quietly in the background.
      </p>
    </GuideSection>
  );
}
