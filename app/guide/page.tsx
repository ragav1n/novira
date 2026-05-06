import type { Metadata } from 'next';
import { GuideLayout } from '@/components/guide/guide-layout';
import { GUIDE_SECTIONS } from '@/components/guide/sections-config';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novira.one';
const GUIDE_URL = `${SITE_URL}/guide`;

export const metadata: Metadata = {
  title: 'User guide',
  description: 'Everything Novira can do — a complete, friendly walkthrough of every feature, with live animated demos.',
  alternates: { canonical: '/guide' },
  openGraph: {
    title: 'Novira User Guide',
    description: 'A complete walkthrough of every feature in Novira, with live animated demos.',
    type: 'article',
    url: GUIDE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Novira User Guide',
    description: 'A complete walkthrough of every feature in Novira, with live animated demos.',
  },
};

/**
 * Structured data for search engines. Two schemas:
 *   - HowTo: lets the guide surface as a step-by-step result on Google.
 *   - FAQPage: lets the troubleshooting Q&A surface as rich result snippets.
 *
 * Both reference the canonical /guide URL with section-anchor fragments so
 * Google can deep-link the right block.
 */
const HOW_TO_LD = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to use Novira',
  description:
    'Sign up, log expenses, split bills, track recurring subscriptions, save toward goals, and more — the complete Novira walkthrough.',
  url: GUIDE_URL,
  totalTime: 'PT15M',
  step: GUIDE_SECTIONS.map((s) => ({
    '@type': 'HowToStep',
    name: s.title,
    text: s.blurb,
    url: `${GUIDE_URL}#${s.id}`,
  })),
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'The app feels slow or shows old data — what should I do?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Pull down on the dashboard to refresh. If you’ve just signed in on a new device, give it a few seconds to download your history. On a computer, press Cmd/Ctrl + Shift + R for a fresh reload.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why aren’t push notifications arriving?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Make sure you’ve added Novira to your home screen — push notifications need that. Then turn the master toggle on under Settings → Notifications, and confirm your phone’s system notification settings allow Novira. Quiet hours might also be silencing them.',
      },
    },
    {
      '@type': 'Question',
      name: 'An offline expense isn’t syncing — how do I fix it?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Open Settings → Data Management → Sync status. Anything that failed to send lives there with a Try Again button. If retrying doesn’t help, the message usually explains why — most often it’s a permissions issue.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I split an expense with friends?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'In the Add Expense form, fill in the amount and details, then toggle Split. Pick the group or friends, choose how to split (evenly, by percentage, by shares, or custom amounts), and save. Each person sees their share appear on their balance.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does Novira detect recurring subscriptions automatically?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Novira watches your last 90 days of spending. When it sees three or more transactions with the same name and similar amounts on a regular rhythm, it suggests tracking them as recurring. Confirm in one tap, dismiss if you don’t want it tracked.',
      },
    },
    {
      '@type': 'Question',
      name: 'How many currencies does Novira support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          '20 currencies — INR, USD, EUR, GBP, CHF, SGD, VND, TWD, JPY, KRW, HKD, MYR, PHP, THB, CAD, AUD, MXN, BRL, IDR, AED. Each transaction can be in any of them with live exchange rates.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Novira work offline?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Yes. Add, edit, and delete transactions in airplane mode or with no signal. Changes are saved on your device and quietly sync the moment you’re back online.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I export my data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Open Settings → Data Management. You can export your transactions as a spreadsheet (CSV) or PDF report, and your bills + goals + bucket dates as a calendar file you can open in Google, Apple, or Outlook calendar.',
      },
    },
  ],
};

export default function GuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <GuideLayout />
    </>
  );
}
