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
