import { Box } from 'lucide-react';
import { GuideSection, Step, StepList } from '../guide-section';
import { Callout } from '../callout';
import { BucketFillDemo } from '../demos/bucket-fill-demo';

export function BucketsSection() {
  return (
    <GuideSection
      id="buckets"
      icon={Box}
      eyebrow="Plan & track"
      title="Buckets"
      tryIt={{ href: '/groups', label: 'Open Buckets' }}
      intro="A bucket is a self-contained spending pool — a trip, an event, a project, a side-business — with its own budget, currency, dates, and category whitelist."
      demo={<BucketFillDemo />}
    >
      <h3>Why buckets?</h3>
      <p>
        Your monthly allowance is great for everyday spending, but some money has its own logic. A trip should have its own budget that doesn’t bleed into your normal spending charts. A wedding venue deposit shouldn’t make April look catastrophic. Buckets give those expenses a home.
      </p>

      <h3>Create a bucket</h3>
      <StepList>
        <Step n={1}>
          From the dashboard tap <strong>+</strong> on the buckets card, or open <strong>Groups → Buckets → New</strong>.
        </Step>
        <Step n={2}>
          Set a name, icon, and color. Pick a type — <strong>trip</strong>, <strong>event</strong>, <strong>project</strong>, or <strong>other</strong> — for the right defaults.
        </Step>
        <Step n={3}>
          Optionally set a budget, a currency, and a date range. Optionally restrict which categories count toward this bucket (e.g. Food + Transport for a trip).
        </Step>
        <Step n={4}>
          Save. Your bucket appears on the dashboard with a focus pill.
        </Step>
      </StepList>

      <h3>Focus mode</h3>
      <p>
        Tap a bucket’s focus pill on the dashboard to filter the entire dashboard view — every chart, every list — to that bucket only. Tap again to release. Great for a “how’s the trip going” quick look.
      </p>

      <Callout type="note" title="Allowed categories">
        If you set <em>allowed categories</em> when creating the bucket, only transactions in those categories count toward its spending. Other categories charged to the bucket still show up in the bucket’s ledger but stay invisible to its budget gauge.
      </Callout>

      <Callout type="tip" title="Bucket alerts">
        When a bucket crosses 80% of its budget, Novira nudges you. When it hits 100%, you get a friendlier-than-usual heads-up so you can decide whether to top up or reel in.
      </Callout>

      <h3>Sharing buckets</h3>
      <p>
        Buckets can be personal or shared with a group. A shared trip bucket lets every group member contribute expenses, and the totals show in every member’s dashboard — including the splits between you. (See <a href="#groups">Groups & friends</a>.)
      </p>
    </GuideSection>
  );
}
