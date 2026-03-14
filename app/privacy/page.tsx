import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPolicy() {
    return (
        <div className="flex-1 w-full bg-transparent text-foreground p-6 sm:p-12 relative">
            <div className="max-w-3xl mx-auto relative z-10">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span>Back</span>
                </Link>

                <div>
                    <h1 className="text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        Privacy Policy
                    </h1>

                    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                        <section>
                            <h2 className="text-lg font-semibold text-foreground mb-2">1. Data Storage & Security</h2>
                            <p>
                                At Novira, we take your data security seriously. Your transaction data, group information, and profile details are securely stored using <strong>Supabase</strong>, which provides enterprise-grade encryption and security measures. We do not sell or share your personal data with third parties.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">2. Local Preferences</h2>
                            <p>
                                To provide a seamless user experience, Novira stores certain preferences—such as your preferred currency, budget alert settings, and interface focus modes—directly in your browser's <strong>Local Storage</strong>. This allows the app to remember your choices across sessions without unnecessary server requests.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">3. Manual Tracking Privacy</h2>
                            <p>
                                Novira is a manual tracking tool. We do not connect to your bank accounts or automatically pull financial data from external institutions. You have full control over the information you enter into the application, and you can delete your data or account at any time through the settings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">4. Information We Collect</h2>
                            <p>
                                We collect only the information necessary to provide our services: your email for authentication, your name for profile personalization, and the financial data you choose to track within the app.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">5. Contact Us</h2>
                            <p>
                                If you have questions about this policy or how we handle your data, please contact us at <a href="mailto:support@novira.app" className="text-primary hover:underline">support@novira.app</a>.
                            </p>
                        </section>
                    </div>

                    <footer className="mt-16 pt-8 border-t border-white/10 text-center text-xs text-muted-foreground">
                        <p>© 2026 Novira. All rights reserved.</p>
                    </footer>
                </div>
            </div>
        </div>
    );
}
