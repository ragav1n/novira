/**
 * Decisions behind the "New version ready" prompt. Pure and separate from the
 * component so they can be tested without a service worker.
 *
 * The rule that matters: `public/sw.js` calls `self.skipWaiting()` inside its
 * `install` handler, so a new worker never parks in `waiting`. Every branch of the
 * updater used to be gated on `registration.waiting`, which meant the prompt rarely
 * appeared — and when it did, "Update now" posted SKIP_WAITING to a `waiting` that
 * was already `null`. The message went nowhere, the dialog closed, and nothing
 * updated.
 */

export type UpdateAction =
    /** A worker is parked in `waiting`: let it take over, then reload. */
    | 'activate-then-reload'
    /** Nothing to activate — the new worker is already live and only this document
     *  is stale, so reload immediately. This is the common case here. */
    | 'reload-now';

export function updateAction(hasWaitingWorker: boolean): UpdateAction {
    return hasWaitingWorker ? 'activate-then-reload' : 'reload-now';
}

export interface OfferInput {
    now: number;
    /** Set by "Later"; the prompt stays quiet until this passes. */
    snoozedUntil: number;
    /** True once a reload is committed — never prompt over one. */
    reloading: boolean;
    /**
     * Whether the page was already under a service worker's control. A first-ever
     * install claims the page and fires `controllerchange` too, and calling that an
     * "update" would greet every new visitor with a restart prompt.
     */
    hadController: boolean;
}

export function shouldOffer({ now, snoozedUntil, reloading, hadController }: OfferInput): boolean {
    if (reloading) return false;
    if (!hadController) return false;
    return now >= snoozedUntil;
}

/**
 * Accepting an update reloads the page, and the reload throws away every ref in
 * the component — including the one recording that we asked for it. So anything
 * that fires on the fresh document (a `controllerchange` from a worker still
 * activating, a second `updatefound`, another client's registration) reads as a
 * brand-new release and re-opens the dialog seconds after the user just accepted
 * one. Both decisions therefore have to survive the reload, which is what these
 * keys are for. Session-scoped on purpose: an update applies to this tab, not to
 * the whole browser profile.
 */
export const UPDATE_APPLIED_KEY = 'novira:pwa-update-applied';
export const SNOOZED_UNTIL_KEY = 'novira:pwa-update-snoozed-until';

/**
 * How long an accepted update keeps the prompt quiet. Long enough to cover the
 * reload and the new worker settling, short enough that a genuinely failed
 * update is re-offered rather than suppressed for the session.
 */
export const POST_UPDATE_QUIET_MS = 5 * 60 * 1000;

/**
 * The snooze in force when the component mounts, rebuilt from what the previous
 * page life wrote down. Takes the later of the two so a "Later" tapped just
 * before an update elsewhere is not shortened by it.
 */
export function initialSnoozedUntil(stored: {
    updateAppliedAt: number | null;
    snoozedUntil: number | null;
}): number {
    const afterUpdate = stored.updateAppliedAt === null ? 0 : stored.updateAppliedAt + POST_UPDATE_QUIET_MS;
    return Math.max(afterUpdate, stored.snoozedUntil ?? 0);
}
