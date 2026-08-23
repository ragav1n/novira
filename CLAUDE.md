# Novira — Project Context for Claude

## What is Novira
Personal finance PWA (Next.js 16 + React 19 + TypeScript) with Capacitor for iOS/Android.
Supabase backend (PostgreSQL + Auth + Realtime). Deployed on Vercel at novira-one.vercel.app.

## Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion, Radix UI
- **Backend**: Supabase (PostgreSQL, RLS, Auth, Realtime, RPCs)
- **PWA**: Custom service worker (`public/sw.js`), offline queue via IndexedDB (`idb-keyval`)
- **Native**: Capacitor (not published to app stores yet — ignore native/Capacitor suggestions)
- **Fonts**: Geist (sans), Geist Mono
- **Charts**: Recharts
- **Maps**: Mapbox GL

## Key Architecture
- `proxy.ts` at root = Next.js middleware (handles Supabase auth session + CSP headers)
- `components/providers/` = all React context providers (auth, groups, buckets, preferences)
- `hooks/` = all custom hooks
- `lib/offline-sync-queue.ts` + `lib/sync-manager.ts` = offline mutation queue with exponential backoff
- `types/transaction.ts` = canonical shared types (Transaction, RecurringTemplate, etc.)
- `public/sw.js` = service worker (cache-first for static, stale-while-revalidate for Supabase data)
- `scripts/inject-sw-version.js` = auto-bumps SW cache version on each build

## Important Rules
- **Do not commit anything** — user reviews and commits manually
- Do not suggest Capacitor/native app store features (not published yet)
- Do not add docstrings/comments to code that wasn't changed
- Do not over-engineer — minimum complexity for the task
- Always run `npx tsc --noEmit` before finishing any coding task
- **Always bump `version` in `package.json`** whenever code changes — patch for fixes, minor for features, major for breaking changes. The settings footer reads this value via `import { version } from '@/package.json'` so users see the bump too

## CSP Notes
- CSP is set in `proxy.ts` (the middleware), NOT in `next.config.mjs`
- Uses `'unsafe-inline'` + `'unsafe-eval'` — nonce-based CSP was removed because Next.js
  static pages can't receive runtime nonces, causing hydration scripts to be blocked
- `next.config.mjs` only sets `img-src` and `worker-src` (no `script-src`)

## Service Worker
- Cache name is auto-bumped by `scripts/inject-sw-version.js` on every build
- Uses `skipWaiting()` on install (no waiting for old SW to release)
- Stale-while-revalidate for Supabase data, cache-first for `/_next/static/`

---

## What Has Been Done

### Round 1 — Type Safety & Infrastructure
- Typed `useDashboardStats`: `buckets: any[]` → `Bucket[]`, `focusedBucket` → `Bucket | null`
- Typed `useExpenseSubmission`: extracted `validateExpenseForm`, `buildSplitRecords`, `buildRecurringRecord`; typed `SplitRecord[]`
- Typed `analytics-view`: fixed `paymentChartConfig: any` → `ChartConfig`
- Typed `settings-view`: removed local `RecurringTemplate`, imports from `@/types/transaction`
- Added exponential backoff to offline sync queue (`lib/offline-sync-queue.ts`)
- Cleaned dead imports across multiple files
- Added `console.error` to all silent catch blocks
- Added tests for offline sync queue retry logic (`lib/__tests__/offline-sync-queue.test.ts`)

### Round 2 — State & UX Fixes
- Extracted `useExchangeRates` hook (`hooks/useExchangeRates.ts`) from `UserPreferencesProvider`
- Fixed "View All" modal showing only 5 transactions (was filtering `exclude_from_allowance`)
- Fixed `aria-describedby` console warning globally in `DialogContent`
- Server-side search in `search-view.tsx` (replaced client-side filter with Supabase `.ilike`/`.in`/`.gte`/`.lte`)
- Added `allTransactions` prop to `TransactionListSection` so drawer shows unfiltered list

### Round 3 — Theming & Type Safety
- Extracted `useWorkspaceTheme` hook (`hooks/useWorkspaceTheme.ts`) — replaces ~200 lines of duplicated `useMemo` themeConfig blocks across 4 views (analytics, search, subscriptions, goals, workspace-theme-provider)
- Added `RecurringTemplate` to shared `types/transaction.ts`
- Fixed `new Date(tx.date)` timezone bug → `parseISO(tx.date.slice(0, 10))` in `transaction-row.tsx`, `analytics-view.tsx`, `export-utils.ts`, `expense-map-view.tsx`
- Added `onError` callback prop to `ErrorBoundary`
- Replaced `React.cloneElement<any>` with typed `CategoryIcon` component in `transaction-row.tsx`
- Removed remaining `(g: any)` casts in `goals-view.tsx`

### Bug Fixes — Loading Screen & CSP
- Added 5-second `isLoading` timeout fallback in `UserPreferencesProvider` (guards against `onAuthStateChange` never firing)
- Bumped SW cache version to bust stale cached bundles
- Removed conflicting `script-src` from `next.config.mjs` CSP (was conflicting with Vercel's nonce-based CSP)
- Fixed `proxy.ts` CSP: replaced nonce-based `script-src` with `'unsafe-inline'` + `'unsafe-eval'` (nonce couldn't be forwarded through `updateSession`'s internal `NextResponse.next`)
- Added `https://v6.exchangerate-api.com` to `connect-src` in `proxy.ts`
- Fixed `/signin` page: restored `Suspense` wrapper required by `useSearchParams` in `sign-in-card`

### Bug Fixes — Data & Validation
- `BucketsProvider`: normalize `tx.currency` to uppercase before comparison (case-sensitivity bug)
- `useExpenseSubmission`: add `isNaN` guard so non-numeric amounts fail validation
- `useDashboardData`: add `mutatingRef` lock to prevent double-tap race conditions on optimistic delete/update
- `useExpenseForm`: escape `%` and `_` wildcards in description before `.ilike()` query
- `analytics-view.tsx`: use `parseISO` instead of `new Date()` for day-level chart grouping

### Round 4 — PWA & Functionality Improvements
- **`public/robots.txt`** — `Disallow: /` prevents all search engine indexing
- **HSTS header** — `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` added to `proxy.ts`
- **Transaction pagination** — `useDashboardData` now loads 100 at a time; `hasMore`/`loadMore`/`loadingMore` exposed; "Load more" button in `components/transaction-list.tsx`; pagination resets on workspace change
  (note: there has never been a `VirtualizedTransactionList` — no list virtualization is
  installed anywhere, and the list grows unbounded via "Load more" rather than windowing)
- **Web Background Sync** — service worker `sync` event notifies clients to run `attemptSync()`; `lib/sync-manager.ts` registers `novira-sync-queue` tag when items are enqueued or device comes online
- **PWA Install Prompt** — `components/pwa-install-prompt.tsx` listens for `beforeinstallprompt`, shows banner after 3s, dismisses via `sessionStorage`; added to `app/layout.tsx`
- **Swipe to delete/edit** — `components/transaction-row.tsx` now wraps each row in a container that reveals Edit/Delete buttons on swipe-left (Framer Motion drag with 72px threshold); only enabled when `canEdit`
- **Custom date range in analytics** — `'CUSTOM'` option added to `DateRange` type; `customStart`/`customEnd` date inputs appear when selected; `fetchData` uses `startOfDay`/`endOfDay` for the custom range
- **Web Push Notifications infrastructure** — full pipeline: `hooks/usePushNotifications.ts` (subscribe/unsubscribe with VAPID), `app/api/push/subscribe/route.ts` (save to `push_subscriptions` table), `app/api/push/send/route.ts` (send via `web-push`), SW push handler + notificationclick handler; `web-push` added to `package.json`; **requires setup**: run `npx web-push generate-vapid-keys` and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET` env vars; create `push_subscriptions` table in Supabase
- **Accessibility** — skip link added to `app/layout.tsx` (`href="#main-content"`, screen-reader only, visible on focus); `id="main-content"` added to `<main>` in `mobile-layout.tsx`; `aria-required`/`required` on amount and description fields; `aria-label` on back button and history button; `aria-hidden` on decorative icons in `transaction-row.tsx`
- **`useDashboardStats` weighted run-rate** — projection now uses 60% last-7-day daily rate + 40% month-to-date daily rate instead of simple daily average; adapts to spending trend changes mid-month
- **BucketsProvider deduplication** — extracted `computeBucketSpending()` helper shared by both `fetchBuckets` and `fetchSpendingOnly`; eliminated ~35 lines of duplicated logic

---

## Pending Suggestions (Not Yet Implemented)

These require backend/infrastructure setup and cannot be implemented as pure frontend code:

- **Biometric auth** — WebAuthn/Passkeys; requires storing credential IDs in Supabase and a separate auth flow

Already shipped, despite once being listed here:

- **Receipt photo attach** — shipped in `f2f54764`. The `receipts` bucket, its
  owner-folder RLS policies and `transactions.receipt_path` all exist
  (`202605131400_receipts.sql`). There is no way to attach a receipt to an
  *existing* transaction — attach happens only at creation.
- **Recurring income tracking** — `is_income` exists on both `transactions` and
  `recurring_templates`, and the form has an Income toggle.

## Migrations (manual application — no DDL access from the agent environment)

Committed as files and run by hand in the Supabase SQL editor:

- `202608210100_atomic_rpc_account_and_income.sql` — `create_transaction_atomic`
  never persisted `account_id` or `is_income` (it predates both columns), so the
  account selector was inert and recurring income saved as an expense.
- ~~`202608210100_atomic_rpc_account_and_income.sql`~~ — applied 2026-08-21,
  verified behaviourally.
- ~~`202608210200_recurring_processor_restore.sql`~~ — applied 2026-08-21 (verify
  with the `pg_proc` query if in doubt).
- `202608220100_secure_definer_rpcs.sql` — **SECURITY.** `IF x <> auth.uid()` fails
  open for an unauthenticated caller (NULL comparison), and Postgres grants EXECUTE
  to PUBLIC on function creation. With only the public anon key, execution reached
  the INSERT in `create_transaction_atomic`, `get_profile_by_email` returned a user
  UUID for any email, and `prepare_delete_account(uuid)` had no authorisation check
  at all. Revokes EXECUTE from anon/PUBLIC across every SECURITY DEFINER function.
  **Applied 2026-08-22, verified** (all three now return 42501).
- `202608240100_atomic_rpc_error_code.sql` — **DIAGNOSABILITY.** `create_transaction_atomic`
  swallows every SQL exception into `{success:false, error: SQLERRM}` at HTTP 200, so a
  constraint violation was indistinguishable from a dropped connection: the offline queue
  called it transient, retried 5×, then replaced the reason with 'Max retries exceeded'.
  Adds `'code', SQLSTATE` to the catch-all and `'code', '42501'` to the unauthorised
  early return. Function body copied forward verbatim; only those two RETURNs changed.
  The client falls back to a synthetic `RPC_REJECTED` when the field is absent, so this
  is an improvement rather than a prerequisite. **Applied 2026-08-23, verified** — the
  unauthorised branch now answers `{"code":"42501",...}`, which only the new definition
  returns (probe it with the service-role key: `auth.uid()` is NULL there, so the guard
  returns before any INSERT).
- `202608220200_restore_rls_helper_execute.sql` — fixes a regression from the above:
  `get_transaction_user_id`, `is_group_member` and `is_group_creator` are called
  from inside RLS policies, which are evaluated as the *querying* role, so revoking
  anon's EXECUTE turned an empty read into a hard 401. Apply this one too.
