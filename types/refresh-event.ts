export type RefreshRequestedEvent = CustomEvent<{
    waitUntil: (p: Promise<unknown>) => void;
}>;

declare global {
    interface WindowEventMap {
        'novira-refresh-requested': RefreshRequestedEvent;
    }
}
