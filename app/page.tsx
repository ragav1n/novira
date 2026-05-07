import { LandingPage } from '@/components/landing-page'
import { createClient } from '@/utils/supabase/server'
import { AuthedHomeClient } from './authed-home-client'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novira.one'

const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Novira',
  description:
    'Track spending, split with friends, and understand your money — a personal-finance PWA that works offline. 20+ currencies, AI receipt scanning, beautiful analytics.',
  url: SITE_URL,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web, iOS, Android',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
}

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }}
        />
        <LandingPage />
      </>
    )
  }

  return <AuthedHomeClient />
}
