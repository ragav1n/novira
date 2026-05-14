# <img src="public/Novira.png" width="48" align="center" /> Novira

I built Novira during my major project in Dortmund, Germany, because I was honestly just fed up with Excel.

Trying to track shared expenses and split costs with friends using spreadsheets was a headache. I needed something better, cleaner, and actually usable for us.

So I built Novira.

**Live Website:** [novira-one.vercel.app](https://novira-one.vercel.app/)

## Features

- **Groups & Friends:** Split bills for trips, projects, or just hanging out — with smart settlements that track who owes what.
- **Dashboard:** See where your money is going without the clutter, with a weighted run-rate projection that adapts to your spending trend mid-month.
- **Buckets & Budgets:** Group categories into spending buckets with alerts when you're close to the limit.
- **Goals:** Save toward targets with an ETA forecast based on your contribution pace.
- **Trips & Travel Mode:** Switch into a trip workspace to track expenses for a specific journey separately from your everyday spending.
- **Subscriptions:** Track recurring payments in one place and catch silent price hikes.
- **Recurring Expenses:** Automate scheduled transactions with smart duplicate detection.
- **Analytics:** Pie charts, category breakdowns, and custom date ranges — including a map view that plots where you spent.
- **Monthly Recap:** A clean end-of-month summary of where the money went.
- **Multi-currency:** Mix currencies freely; everything reconciles using live exchange rates with historical accuracy.
- **Bank Integration:** Import statements directly (HDFC & SBI).
- **Exportable Reports:** Clean CSV, Excel, or PDF reports for any date range.
- **Real-time:** Updates instantly for everyone in the group.
- **Offline-First:** Add expenses without internet. IndexedDB-backed background sync with idempotency keys safely retries when you're back online.
- **Installable PWA:** Native-feeling install prompt, swipe-to-edit/delete gestures, push notifications, and automatic cache invalidation on each release.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Framer Motion · Radix UI · Recharts · Mapbox GL · Supabase (Postgres + Auth + Realtime) · Capacitor · deployed on Vercel.
