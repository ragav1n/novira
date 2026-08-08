'use client';

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { PageTransition } from '@/components/page-transition';

const SubscriptionsSkeleton = () => (
  <PageSkeleton width="2xl" title="w-40" trailing={false}>
    <div className="space-y-4 mt-4">
      <Skeleton className="h-20 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-3xl" />
      <Skeleton className="h-20 w-full rounded-3xl" />
    </div>
  </PageSkeleton>
);

const SubscriptionsView = dynamic(
  () => import('@/components/subscriptions-view').then((mod) => mod.SubscriptionsView),
  { ssr: false, loading: () => <SubscriptionsSkeleton /> }
);

export default function SubscriptionsPage() {
    return (
        <PageTransition>
            <UIBoundary>
                <SubscriptionsView />
            </UIBoundary>
        </PageTransition>
    );
}
