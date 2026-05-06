import { BarChart2 } from 'lucide-react';
import { GuideSection, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';
import { WhatIfSliderDemo } from '../demos/what-if-slider-demo';

export function AnalyticsSection() {
  return (
    <GuideSection
      id="analytics"
      icon={BarChart2}
      eyebrow="Understand"
      title="Analytics & insights"
      tryIt={{ href: '/analytics', label: 'Open Analytics' }}
      intro="Charts that actually answer questions: where the money goes, when, with whom — and what would change if you spent less on something."
      demo={<WhatIfSliderDemo />}
    >
      <h3>Pick a date range</h3>
      <p>
        At the top of the Analytics page is a dropdown with the windows <strong>Current Month, Last Month, Last 3 Months, Last 6 Months, Last Year, All Time,</strong> and <strong>Custom Range</strong>. Pick Custom to set your own dates, with one-tap shortcuts for <em>This Week</em>, <em>Last 7 Days</em>, and <em>Year-to-date</em>. Whatever you choose, the whole page updates — every chart, every total, every insight is for that range.
      </p>

      <h3>What’s on the page</h3>
      <FactGrid>
        <FactRow label="Monthly recap">A short narrative of the month’s spending, biggest movers, comparisons.</FactRow>
        <FactRow label="Spending trend">Daily or weekly line chart, current period vs prior.</FactRow>
        <FactRow label="Weekday breakdown">Which days are heavy. Useful for spotting Friday-night patterns.</FactRow>
        <FactRow label="Top merchants">Where you spent the most. Click a merchant to drill in.</FactRow>
        <FactRow label="Largest transactions">The big ones, ranked.</FactRow>
        <FactRow label="Category breakdown">Pie or bar chart of category share — switchable.</FactRow>
        <FactRow label="Payment method">Cash vs cards vs transfers. Useful for cash-back optimization.</FactRow>
        <FactRow label="Tag frequency">A tag cloud of what you’ve been tagging — surfaces themes you might not have noticed.</FactRow>
        <FactRow label="Calendar heatmap">A month grid where darker cells mean heavier spending.</FactRow>
        <FactRow label="Location insights">Where you tend to spend, with a small map.</FactRow>
        <FactRow label="AI insights chat">Ask plain-English questions about your spending.</FactRow>
        <FactRow label="What-if simulator">Drag a slider to see what happens if you cut a category by some percent. Novira shows the monthly and yearly savings, plus how many months sooner you’d hit your goals.</FactRow>
      </FactGrid>

      <h3>Filters</h3>
      <ul>
        <li><strong>Bucket</strong> — analyze just a trip or a project.</li>
        <li><strong>Tags</strong> — multi-select to slice by your own labels (e.g. all <em>#work-trip</em> spending).</li>
      </ul>

      <Callout type="tip" title="The numbers are real">
        The simulator uses your actual spending in the chosen category, applies the cut you’re proposing, and works out how much sooner you’d hit your active goals at that pace. Nothing is rounded up to look better than it is.
      </Callout>

      <Callout type="note" title="AI insights">
        Ask things like “What did I spend on coffee in March?” or “Show me my biggest one-time purchases this year.” Replies are grounded in your actual transactions and stay private to your account.
      </Callout>
    </GuideSection>
  );
}
