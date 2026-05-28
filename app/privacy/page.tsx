import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ContentReveal, RevealItem } from '@/components/content-reveal';

export default function PrivacyPolicy() {
    return (
        <div className="flex-1 w-full bg-transparent text-foreground p-6 sm:p-12 relative">
            <ContentReveal className="max-w-3xl mx-auto relative z-10">
                <RevealItem>
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Back</span>
                    </Link>
                </RevealItem>

                <RevealItem>
                    <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        Privacy Policy
                    </h1>
                </RevealItem>

                <RevealItem>
                    <p className="text-xs text-muted-foreground mb-8">Last updated: 28 May 2026</p>
                </RevealItem>

                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                    <RevealItem as="section">
                        <h2 className="text-lg font-semibold text-foreground mb-2">1. Who we are</h2>
                        <p>
                            Novira is a solo-developed personal finance Progressive Web App. It is not a company, not a registered financial institution, and not affiliated with any bank. Questions and requests go to <a href="mailto:ragava22005@gmail.com" className="text-primary hover:underline">ragava22005@gmail.com</a>.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">2. What we collect</h2>
                        <p className="mb-3">Only what's needed to run the features you actually use:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-foreground">Account data</strong> — your email, an optional display name, an optional avatar, and (if you sign in with Google) the OAuth identifier Google returns.</li>
                            <li><strong className="text-foreground">Financial data you enter</strong> — transactions (amount, description, category, payment method, date, notes, currency, tags), accounts and wallets, recurring templates, buckets, savings goals, trips, and your own categorization rules.</li>
                            <li><strong className="text-foreground">Location data</strong> — if you attach a place to a transaction we store its name, address, latitude and longitude. If you grant your browser's geolocation permission, your approximate location is sent to map providers to bias place search toward you.</li>
                            <li><strong className="text-foreground">Receipt images</strong> — if you use receipt scanning, the photo is stored in a private Supabase Storage bucket scoped to your account.</li>
                            <li><strong className="text-foreground">Collaboration data</strong> — friendships, group memberships, and expense splits are visible to the other people you share them with.</li>
                            <li><strong className="text-foreground">Push subscription</strong> — if you enable notifications, your browser's push endpoint and encryption keys.</li>
                            <li><strong className="text-foreground">Edit history</strong> — when you edit or delete a transaction, the previous values are recorded so the change can be audited or undone.</li>
                            <li><strong className="text-foreground">Operational metadata</strong> — anonymous Web Vitals via Vercel Analytics and standard server request logs at Vercel.</li>
                        </ul>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">3. What we don't collect</h2>
                        <p>
                            No bank-account linking or Plaid-style aggregation. No payment card data — Novira is free, with no in-app purchases. No advertising identifiers, no third-party analytics beyond Vercel's Web Vitals, no cross-site tracking, no data sale.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">4. Sub-processors</h2>
                        <p className="mb-3">Novira runs on top of these services. Each receives only what's needed for its function:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-foreground">Supabase</strong> — primary backend (PostgreSQL, Auth, Storage, Realtime). Holds essentially all data described above. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">Vercel</strong> — hosting, scheduled cron jobs, Web Vitals and Speed Insights. Sees request logs and aggregate performance metrics. <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">Anthropic (Claude)</strong> — server-side only. Receives your uploaded receipt image when you scan a receipt, and aggregated transaction summaries when you use Insights chat or generate a monthly or yearly recap. Rate-limited (30 receipt scans, 3 insights chats, 10 recaps per day per account). <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">Google</strong> — Maps and Places APIs for geocoding transaction locations; Google OAuth if you choose &ldquo;Continue with Google&rdquo;, in which case Google receives your sign-in event and basic profile info. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">Mapbox</strong> — alternative map rendering and geocoding. <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">Photon (Komoot)</strong> — open-source fallback geocoder used when other providers fail. <a href="https://www.komoot.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy</a>.</li>
                            <li><strong className="text-foreground">ExchangeRate API</strong> — currency conversion. Only currency codes are sent, no personal data. <a href="https://www.exchangerate-api.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms</a>.</li>
                            <li><strong className="text-foreground">Web Push gateways</strong> — your browser's chosen push service (FCM, Mozilla, or Apple) receives notification payloads only if you enable push notifications.</li>
                        </ul>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">5. Cookies and on-device storage</h2>
                        <p className="mb-3">Novira stores small amounts of data on your device to keep you signed in and to remember your preferences:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-foreground">Cookies</strong> — Supabase session cookies (required for sign-in) and a sidebar state cookie.</li>
                            <li><strong className="text-foreground">Local Storage</strong> — onboarding state, privacy mode toggle, recently used locations, PWA install dismissal, last-seen feature announcement, recent search queries.</li>
                            <li><strong className="text-foreground">Session Storage</strong> — short-lived UI flags (toast triggers, swipe-gesture hint).</li>
                            <li><strong className="text-foreground">IndexedDB</strong> — only the <code>novira-share-target</code> store, used when you share a receipt image to the app from your OS share sheet.</li>
                            <li><strong className="text-foreground">Service Worker cache</strong> — static assets and Supabase responses cached for offline use; cleared automatically on each new app version.</li>
                        </ul>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">6. Permissions we may ask for</h2>
                        <p>
                            Camera (to photograph a receipt), geolocation (to bias place search toward where you are), and notifications (for push alerts). Each is opt-in and requested only when you trigger the feature that needs it. You can revoke any of them in your browser's site settings.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">7. How we use your data</h2>
                        <p>
                            To run the app for you — show your transactions, render charts, sync across your devices, send the notifications you asked for, and answer the AI prompts you trigger. No profiling, no advertising, no resale.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">8. Sharing with other users</h2>
                        <p>
                            If you split an expense, add someone as a friend, or join a group, the relevant transaction or balance data is visible to the other people in that group or split. You decide what to share and with whom.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">9. Retention and deletion</h2>
                        <p>
                            Your data is kept while your account is active. You can delete your account at any time from Settings. Deletion purges your transactions, splits, recurring templates, group memberships, friendships, edit history, profile, profile picture, uploaded receipt images, and the auth row itself.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">10. Your rights</h2>
                        <p className="mb-3">If you're in the EEA, UK, California, or another region with privacy laws, you have rights including:</p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong className="text-foreground">Access</strong> — see what we hold about you. Most of it is already visible in the app; export it from Settings as CSV, PDF, or ICS.</li>
                            <li><strong className="text-foreground">Rectification</strong> — edit any record in-app.</li>
                            <li><strong className="text-foreground">Erasure</strong> — delete your account from Settings (subject to the limitation above), or email us.</li>
                            <li><strong className="text-foreground">Portability</strong> — the export feature provides machine-readable copies.</li>
                            <li><strong className="text-foreground">Restriction and objection</strong> — email us if you'd like processing limited.</li>
                            <li><strong className="text-foreground">Withdraw consent</strong> — turn off any optional permission (notifications, geolocation, camera) in your browser.</li>
                        </ul>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">11. International transfers</h2>
                        <p>
                            Our sub-processors (Supabase, Vercel, Anthropic, Google, Mapbox, etc.) operate in regions that may include the United States and the European Union. Using Novira involves your data being transferred to and processed in those regions.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">12. Security</h2>
                        <p>
                            Data is encrypted in transit (HTTPS, HSTS) and at rest using Supabase defaults. Row-level security isolates each account's data. A strict Content-Security-Policy is enforced. These are reasonable engineering measures, not a guarantee against every possible attack.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">13. Children</h2>
                        <p>
                            Novira is not directed to children under 13 (or under 16 in the EEA and UK). If you're below that age, please don't create an account.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">14. Changes to this policy</h2>
                        <p>
                            Material changes are surfaced in the app via the &ldquo;What's new&rdquo; announcement and reflected in the &ldquo;Last updated&rdquo; date at the top of this page.
                        </p>
                    </RevealItem>

                    <RevealItem as="section">
                        <h2 className="text-xl font-semibold text-foreground mb-3">15. Contact</h2>
                        <p>
                            Email <a href="mailto:ragava22005@gmail.com" className="text-primary hover:underline">ragava22005@gmail.com</a> for any privacy question, data request, or concern.
                        </p>
                    </RevealItem>
                </div>

                <RevealItem as="footer">
                    <div className="mt-16 pt-8 border-t border-white/10 text-center text-xs text-muted-foreground">
                        <p>© 2026 Novira. All rights reserved.</p>
                    </div>
                </RevealItem>
            </ContentReveal>
        </div>
    );
}
