import { Plus } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';
import { ExpressionAmountDemo } from '../demos/expression-amount-demo';
import { SmartSuggestionsDemo } from '../demos/smart-suggestions-demo';

export function AddingTransactionsSection() {
  return (
    <GuideSection
      id="adding-transactions"
      icon={Plus}
      eyebrow="Money in & out"
      title="Adding transactions"
      tryIt={{ href: '/add', label: 'Open Add Expense' }}
      intro="The most common thing you’ll do in Novira. The form is short, smart about defaults, and forgiving if you make a typo."
      demo={
        <div className="grid gap-6 md:grid-cols-2">
          <ExpressionAmountDemo />
          <SmartSuggestionsDemo />
        </div>
      }
    >
      <h3>The fast path</h3>
      <StepList>
        <Step n={1}>
          Tap <strong>+</strong> in the bottom bar (or <strong>Add</strong> in the desktop nav).
        </Step>
        <Step n={2}>
          Type the amount. You can type a math expression — <CodePill>12.5 + 3.20</CodePill> resolves to <CodePill variant="success">15.70</CodePill> on submit.
        </Step>
        <Step n={3}>
          Type a description (the “where”). Novira surfaces matching past transactions as one-tap chips that fill in your usual category, payment method, location, and bucket.
        </Step>
        <Step n={4}>
          Tap <strong>Save</strong>. Done. The form clears and you’re back where you came from.
        </Step>
      </StepList>

      <h3>Every field, in detail</h3>
      <FactGrid>
        <FactRow label="Amount">
          Numbers and basic math. Currency picker next to the field changes which currency this transaction was in.
        </FactRow>
        <FactRow label="Currency">
          Defaults to your home currency. Pick from any of the 20 supported currencies for that single expense. The exchange rate at submission time is locked into the record so historical totals stay accurate.
        </FactRow>
        <FactRow label="Description">
          What it was, in your own words. Past descriptions appear as suggestion chips — tap one to apply its full set of defaults.
        </FactRow>
        <FactRow label="Category">
          Food, Transport, Shopping, Entertainment, etc. Auto-suggested from your description.
        </FactRow>
        <FactRow label="Payment method">
          Cash, UPI, Debit, Credit, Bank Transfer. Defaults to your last-used method (or whatever you set in Settings → Quick-add defaults).
        </FactRow>
        <FactRow label="Date & time">
          Defaults to “now”. Tap to change. Useful for backfilling receipts you didn’t log on the day.
        </FactRow>
        <FactRow label="Bucket">
          Optional. Tags this expense to a trip, project, or other mission so it shows up in that bucket’s totals.
        </FactRow>
        <FactRow label="Notes">
          Free-text private notes — appear as a popover on the transaction row.
        </FactRow>
        <FactRow label="Tags">
          Up to 12 tags per transaction. Autocompletes from your history. Used for cross-cutting filters in Search and Analytics.
        </FactRow>
        <FactRow label="Location">
          Tap to attach a place. Novira remembers where you usually spend on what — it’ll suggest the right place by description and category.
        </FactRow>
        <FactRow label="Exclude from allowance">
          Check this for transactions that shouldn’t count against your monthly budget — rent, transfers, savings deposits, big one-offs.
        </FactRow>
        <FactRow label="Split">
          Toggle on to share with friends or a group. Pick people, set shares, save once. (See the Splits section.)
        </FactRow>
        <FactRow label="Recurring">
          Turn on to schedule this expense to repeat — Novira will add it for you on the rhythm you choose.
        </FactRow>
        <FactRow label="Receipt scan">
          Camera icon at the top — point at a paper receipt or upload an image. Claude’s vision model reads it and pre-fills amount, merchant, date, time, category, currency, and location.
        </FactRow>
      </FactGrid>

      <Callout type="tip" title="Drafts survive accidents">
        If you start typing and navigate away, your draft stays put as long as this tab is open — accidental swipes and refreshed pages won’t lose your work. (Closing the tab clears it.)
      </Callout>

      <Callout type="pro" title="Pre-fill the form with a link">
        Web addresses like <CodePill>/add?recurring=1&date=2026-05-15</CodePill> open the Add form with those choices already made. Handy from the calendar, your own bookmarks, or automations.
      </Callout>

      <h3>Editing and deleting</h3>
      <p>
        On any transaction row: <strong>swipe left</strong> to reveal Edit and Delete, or tap the row to open the details sheet. Splits, settlement transactions, and items added by other group members can’t be edited from your side — only by the original creator.
      </p>
    </GuideSection>
  );
}
