import { describe, it, expect } from 'vitest';
import { updateAction, shouldOffer } from '../pwa-update';

describe('updateAction', () => {
    /**
     * The bug this pins down: sw.js calls skipWaiting() during install, so
     * `registration.waiting` is null by the time the user can click. The old code
     * did `registration.waiting?.postMessage({type:'SKIP_WAITING'})` and nothing
     * else — a no-op that closed the dialog and left the page on the old bundle.
     */
    it('reloads immediately when there is no worker to activate', () => {
        expect(updateAction(false)).toBe('reload-now');
    });

    it('lets a parked worker take over first so the reload is served by it', () => {
        expect(updateAction(true)).toBe('activate-then-reload');
    });
});

describe('shouldOffer', () => {
    const base = { now: 1_000_000, snoozedUntil: 0, reloading: false, hadController: true };

    it('offers when a new worker takes over an already-controlled page', () => {
        expect(shouldOffer(base)).toBe(true);
    });

    it('stays quiet on a first-ever install', () => {
        // The initial claim fires controllerchange too; treating that as an update
        // would show a restart prompt to every new visitor.
        expect(shouldOffer({ ...base, hadController: false })).toBe(false);
    });

    it('respects the snooze from "Later" and re-offers once it lapses', () => {
        expect(shouldOffer({ ...base, snoozedUntil: base.now + 1 })).toBe(false);
        expect(shouldOffer({ ...base, snoozedUntil: base.now })).toBe(true);
    });

    it('never prompts over a committed reload', () => {
        expect(shouldOffer({ ...base, reloading: true })).toBe(false);
    });
});
