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
- `public/sw.js` = service worker (cache-first for static, **network-first** for
  PostgREST reads, stale-while-revalidate for Storage and exchange rates)
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
- `/rest/v1/` reads are **network-first** with a 2.5s fallback to cache. They were
  stale-while-revalidate, which is what made the app feel dead: every list query has
  a stable URL, so a realtime event fired, the handler refetched, and the SW replied
  with the pre-change rows while the fresh copy landed in the cache and nowhere else.
  The cache is still written on every 200 so the app renders offline — do not put
  PostgREST back on SWR
- Storage and exchange rates stay stale-while-revalidate; `/_next/static/` stays cache-first

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


### Round 5 — Realtime everywhere (v2.115.0)
- **Root cause of "it didn't update in real time"**: the service worker
  stale-while-revalidated *every* PostgREST GET. Realtime fired, the handler
  refetched, and the SW handed back the pre-change body. Fixed by making
  `/rest/v1/` network-first (see Service Worker above)
- **`hooks/useRealtimeRefetch.ts`** — shared subscribe-and-refetch hook (per-instance
  UUID topic, 150ms coalescing) so a view can watch N tables in one channel
- Subscriptions added where a view fetched but never subscribed: `calendar-view`
  (recurring_templates / savings_goals / scheduled_events), `trips-tab-content` and
  `trip-detail-view`, `group-detail-sheet`, `useMapTransactions`, `useAppBadge`,
  `recurring-detect-card`, and the `spending-trend` / `what-if` analytics cards
- `categorization-rules-section` needed nothing — it is fed by `useCategorizationRules`,
  which already subscribes

### Round 6 — Receipt dates & the update prompt (v2.115.1–2.115.2)
- **Receipt dates landed in 2024.** `SYSTEM_PROMPT` in `app/api/scan-receipt/route.ts`
  told the model "a receipt is never dated in the future" — a rule it cannot apply,
  because it has no clock. An unclear year (small print, a cropped top, 1600px
  downscale) was filled in from its training prior. The prompt is now
  `buildSystemPrompt(today)`, the client sends its **local** date (the server runs in
  UTC, already tomorrow for an evening purchase in the Americas), and the model is told
  to return null rather than guess a year — null falls back to today, which is right
  far more often than a guess.
- **"Update now" prompt kept coming back.** Accepting an update reloads the page, and
  the reload wiped every ref in `PWAUpdater` — including the one recording that we
  asked for it. Anything landing on the fresh document (a `controllerchange`, a second
  `updatefound`, another client) then read as a new release and re-opened the dialog.
  Both decisions now persist in `sessionStorage` (`lib/pwa-update.ts`):
  `initialSnoozedUntil()` rebuilds the snooze on mount, an accepted update buys 5
  minutes of quiet, and "Later" survives a reload instead of dying with the ref.
  Verified in a driven browser — accept, then install a genuinely new worker 20s
  later: no re-prompt.

### Round 7 — The recap's currency (v2.115.3–2.115.4)
- **A rupee total wearing a dollar sign.** The August recap read
  `$126,846.98` above four insights quoting `₹50,308`, `₹63,792`, `₹3,338`. Both
  halves came from the same INR aggregate: the model was handed `currencySymbol: ₹`
  and wrote it, and the card then reformatted the raw number with whatever
  `formatCurrency` currently prefers.
- **Root cause: the client chose the currency.** `POST /api/recap` took
  `currency` from the request body, and `UserPreferencesProvider` starts at a
  hardcoded `'INR'` — `setIsLoading(false)` fires inside `onAuthStateChange`,
  before `loadPreferences` resolves, so there is a window where `userId` is set
  and `currency` is still the default. The modal's effect runs in exactly that
  window. It also beats the cron: `priorMonthKey()` uses the *client's* local
  date, so a device in IST asks for the August recap at 18:30 UTC on Aug 31,
  ~9 hours before `/api/cron/periodic` (03:30 UTC, day 1) fans out — and the
  cron, which reads `profiles.currency`, would have got it right.
  `POST` and the new `GET ?month=` both read `profiles.currency` now; the body
  parameter is gone.
- **A stored recap now carries its own currency.** `RecapShape.currency` is
  written at generation (`recap` is jsonb — no migration), and `RecapBody`
  formats the total with `formatCurrency(total, recap.currency)` rather than the
  live preference, so the headline can never disagree with the prose again.
- **Changing base currency invalidates a recap.** Its totals are in the old
  currency and the model wrote the old symbol into every sentence, so it is
  rebuilt, not relabelled: `GET ?month=` returns `currencyStale`, and both the
  modal and the analytics card POST when they see it. The server-side cache
  check treats a currency mismatch as a miss. Legacy recaps have no stamp, so
  they read as stale and regenerate once each.
- **The prompt's examples were all in ₹.** `SHARED_RULES` and the monthly
  takeaway example hardcoded `₹13,202` / `₹2,500` while telling the model to use
  the payload's `currencySymbol` — an invitation for Haiku to copy the symbol
  next to the worked number instead. Both prompts are now
  `monthPrompt(sym)` / `yearPrompt(sym)`.
- **The silent 1:1 conversion is now logged.** In `aggregate`, a row with no
  live rate and no usable stored ratio was added at face value, which turns a
  ₹126,846 month into a $126,846 one with nothing in the logs. Counted per run
  and reported via `console.error` (usually a missing `EXCHANGERATE_API_KEY`).
  Numbers unchanged — only the visibility.
- **The insights chat had the same defect** and is fixed the same way
  (v2.115.4). `POST /api/insights/chat` required `baseCurrency` in the body and
  converted the whole snapshot into it; the model then wrote that currency's
  symbol into a streamed answer. Narrower window than the recap's — the user has
  to type a question first — but the same wrong answer when it hits. The route
  reads the profile now, `baseCurrency` is gone from the body and from
  `InsightsChatCard`'s props, and `buildInsightsSnapshot` counts and logs its own
  unconverted rows.
- `profileCurrency(supabase, userId)` lives in `lib/server/currency.ts` — the one
  place any server code should get a base currency from. Do not add another route
  that takes one from a request body.

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
- `202608230100_realtime_trips_accounts_rules.sql` — **REALTIME.** `trips` was never in
  the `supabase_realtime` publication (its provider had subscribed since the feature
  shipped and never received one event — `.subscribe()` reports SUBSCRIBED either way,
  so a dead subscription looks identical to a live one). `accounts` and
  `categorization_rules` were published via the dashboard toggle, which does not touch
  replica identity, so DELETEs carried only the primary key and Realtime could not
  evaluate the `user_id=eq.<id>` filter — deletes stayed on screen on other devices
  until a reload. Adds `trips` to the publication and sets REPLICA IDENTITY FULL on all
  three. **Applied 2026-08-23, verified by the user in the SQL editor** — all four tables
  published, the three named above at REPLICA IDENTITY FULL. Not verifiable from the
  agent environment (neither `pg_publication_tables` nor `relreplident` is exposed
  through PostgREST), so re-check it there with:
  ```sql
  select c.relname,
         (p.tablename is not null) as in_publication,
         case c.relreplident when 'f' then 'FULL' when 'd' then 'default'
              when 'n' then 'nothing' when 'i' then 'index' end as replica_identity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_publication_tables p
    on p.schemaname = 'public' and p.tablename = c.relname
   and p.pubname = 'supabase_realtime'
  where n.nspname = 'public'
    and c.relname in ('trips','accounts','categorization_rules','transactions')
  order by c.relname;
  ```
- `202608240200_realtime_complete.sql` — **REALTIME, third pass.** Enumerates every
  table the client subscribes to and asserts publication membership plus replica
  identity for all of them, so the next feature can be checked against one list.
  `scheduled_events` had never been published at all (202605061200 created the table
  and stopped), so the calendar's one-off events had no live path; `savings_deposits`,
  `groups`, `group_members` and `friendships` were published but left at the default
  replica identity, which drops filtered/RLS-gated DELETEs. `profiles` and
  `workspace_budgets` are deliberately left at the default — both key on their primary
  key, so the default old record is already enough. **Not yet applied.**
- `202608220200_restore_rls_helper_execute.sql` — fixes a regression from the above:
  `get_transaction_user_id`, `is_group_member` and `is_group_creator` are called
  from inside RLS policies, which are evaluated as the *querying* role, so revoking
  anon's EXECUTE turned an empty read into a hard 401. Apply this one too.
