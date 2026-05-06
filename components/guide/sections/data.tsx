import { Database } from 'lucide-react';
import { GuideSection, Step, StepList, FactGrid, FactRow } from '../guide-section';
import { Callout } from '../callout';

export function DataSection() {
  return (
    <GuideSection
      id="data"
      icon={Database}
      eyebrow="Platform"
      title="Import & export"
      tryIt={{ href: '/settings#data', label: 'Open Data Management' }}
      intro="Bring your data in, take it back out. Novira reads bank statements, and saves your records as spreadsheets, PDFs, or calendar files."
    >
      <h3>Import a bank statement</h3>
      <StepList>
        <Step n={1}>
          Open <strong>Settings → Data Management → Import transactions</strong> (or visit <strong>/import</strong> directly).
        </Step>
        <Step n={2}>
          Drop in a spreadsheet file (CSV) from your bank. Novira recognizes the format from common Indian banks like HDFC and SBI, and works with most other layouts too.
        </Step>
        <Step n={3}>
          Match the columns to what they mean — which one is the date, which is the description, which is the amount (or separate columns for money in and money out). Pick a category column too, if your bank includes one.
        </Step>
        <Step n={4}>
          Look over the preview. Novira guesses categories from each merchant, points out any rows it couldn’t read, and lets you skip them. Hit Import when you’re happy.
        </Step>
      </StepList>

      <Callout type="tip" title="Won’t import the same thing twice">
        If a row in your statement matches something already in Novira (same date, amount, and description), it’s flagged as a likely duplicate so you can skip it. Useful when monthly statements overlap.
      </Callout>

      <h3>Export</h3>
      <FactGrid>
        <FactRow label="Spreadsheet (CSV)">Every transaction in your chosen date range. Opens in Excel, Numbers, Google Sheets, or anywhere else.</FactRow>
        <FactRow label="PDF report">A nicely formatted summary with totals and category charts. Good for accountants, taxes, or just your own records.</FactRow>
        <FactRow label="Calendar (.ics)">All your active recurring bills, goal deadlines, and bucket end dates as calendar events. Open it in Google, Apple, or Outlook calendar.</FactRow>
      </FactGrid>

      <p>
        Export options live under <strong>Settings → Data Management</strong>. CSV and PDF ask for a date range; the calendar export is one tap and gives you a file to open in your calendar app.
      </p>

      <Callout type="note" title="The calendar export covers more than bills">
        Savings goals with a deadline and buckets with an end date come along for the ride too. One import puts your bills, your savings dates, and your project deadlines all in one place.
      </Callout>

      <h3>Deleting your account</h3>
      <p>
        <strong>Settings → Security → Delete account</strong>. After confirming with your password, your account, transactions, buckets, goals, and group memberships are removed. It’s irreversible — export your data first if you want a copy.
      </p>
    </GuideSection>
  );
}
