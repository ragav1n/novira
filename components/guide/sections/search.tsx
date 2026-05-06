import { Search as SearchIcon } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { CodePill } from '../demos/code-pill';
import { SearchPlaygroundDemo } from '../demos/search-playground-demo';

export function SearchSection() {
  return (
    <GuideSection
      id="search"
      icon={SearchIcon}
      eyebrow="Understand"
      title="Search & filters"
      tryIt={{ href: '/search', label: 'Open Search' }}
      intro="Find any transaction in seconds. Search supports plain text, numeric comparisons, and tag filters — and you can save the combinations you use often as presets."
      demo={<SearchPlaygroundDemo />}
    >
      <h3>Search syntax</h3>
      <FactGrid>
        <FactRow label="Plain text">
          <CodePill>starbucks</CodePill> matches descriptions containing “starbucks”.
        </FactRow>
        <FactRow label="Greater than">
          <CodePill>{'>'}100</CodePill> shows only transactions over 100 in your home currency.
        </FactRow>
        <FactRow label="Less / equal">
          <CodePill>{'<='}50</CodePill>, <CodePill>{'='}25</CodePill> work the same way.
        </FactRow>
        <FactRow label="Tags">
          <CodePill>#travel</CodePill> filters to transactions tagged <em>travel</em>. Combine multiple tags with spaces.
        </FactRow>
        <FactRow label="Mix and match">
          <CodePill>uber {'>'}200 #work</CodePill> — Uber rides over ₹200 tagged <em>work</em>.
        </FactRow>
      </FactGrid>

      <h3>Filter panel</h3>
      <ul>
        <li><strong>Date range</strong> — Today, Last 7 days, Last 30 days, Current month, or custom.</li>
        <li><strong>Categories</strong> — multi-select checkboxes.</li>
        <li><strong>Payment methods</strong> — Cash, UPI, Debit, Credit, Bank Transfer.</li>
        <li><strong>Amount range</strong> — slider for min/max.</li>
        <li><strong>Tags</strong> — multi-select from your tag vocabulary.</li>
        <li><strong>Bucket</strong> — narrow to a single trip or project.</li>
      </ul>

      <h3>Sorting and bulk actions</h3>
      <p>
        Sort by date or amount, ascending or descending. Long-press (or tap the checkbox) on a row to enter selection mode — bulk-edit category, tags, or bucket on many transactions at once. Bulk-delete works too, with a confirmation step.
      </p>

      <Callout type="tip" title="Save your favorite searches">
        Once you’ve dialed in a useful filter combo (e.g. <em>Last 30 days, Food category, over ₹500</em>), tap the bookmark icon to save it as a <strong>preset</strong>. Presets show up at the top of the search page for one-tap reload.
      </Callout>
    </GuideSection>
  );
}
