import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function TermsOfService() {
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
                        Terms of Service
                    </h1>

                    <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                        <section>
                            <h2 className="text-lg font-semibold text-foreground mb-2">1. Nature of Service</h2>
                            <p>
                                Novira is a personal finance tracking tool designed for manual data entry and expense management. By using our services, you acknowledge that Novira is a <strong>tracking utility</strong> and does not provide financial, investment, or legal advice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">2. User Responsibility</h2>
                            <p>
                                Since Novira relies on manual entry or imported data files, you are solely responsible for the accuracy and completeness of the information you provide. Novira is not responsible for any financial decisions made based on the data tracked within the application.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">3. No Financial Advisory</h2>
                            <p>
                                The budget summaries, analytics, and alerts provided by Novira are for informational purposes only. We do not guarantee any specific financial outcomes, and our services should not be used as a substitute for professional financial planning.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">4. Account Security</h2>
                            <p>
                                You are responsible for maintaining the confidentiality of your account credentials. Any data lost through unauthorized access due to weakened security on your end is your responsibility.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-foreground mb-3">5. Termination</h2>
                            <p>
                                We reserve the right to suspend or terminate your account if you violate these terms or engage in activities that threaten the security and integrity of the Novira platform.
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
