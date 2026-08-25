import { describe, it, expect } from 'vitest';
import { updateAction, shouldOffer, initialSnoozedUntil, POST_UPDATE_QUIET_MS } from '../pwa-update';

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

describe('initialSnoozedUntil', () => {
    /**
     * The bug this pins down: "Update now" reloads the page, which wipes every ref
     * in the component. A controllerchange or a second updatefound landing on the
     * fresh document then looked like a new release and reopened the dialog within
     * seconds of the user accepting one — the prompt that would not go away.
     */
    it('keeps the prompt quiet for a while after an accepted update', () => {
        const at = 1_000_000;
        expect(initialSnoozedUntil({ updateAppliedAt: at, snoozedUntil: null }))
            .toBe(at + POST_UPDATE_QUIET_MS);
    });

    it('carries a "Later" across a reload', () => {
        expect(initialSnoozedUntil({ updateAppliedAt: null, snoozedUntil: 5_000 })).toBe(5_000);
    });

    it('takes the later of the two so neither shortens the other', () => {
        const at = 1_000_000;
        expect(initialSnoozedUntil({ updateAppliedAt: at, snoozedUntil: at + POST_UPDATE_QUIET_MS + 1 }))
            .toBe(at + POST_UPDATE_QUIET_MS + 1);
    });

    it('offers immediately when nothing was stored', () => {
        expect(initialSnoozedUntil({ updateAppliedAt: null, snoozedUntil: null })).toBe(0);
    });

    it('lapses, so an update that failed to apply is re-offered rather than buried', () => {
        const at = 1_000_000;
        const until = initialSnoozedUntil({ updateAppliedAt: at, snoozedUntil: null });
        expect(shouldOffer({ now: until, snoozedUntil: until, reloading: false, hadController: true })).toBe(true);
    });
});
