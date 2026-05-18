// Thin wrapper around the Web Speech API. Browsers expose this as either
// `SpeechRecognition` or the vendor-prefixed `webkitSpeechRecognition` — we
// probe for both. The wrapper exits silently when unsupported so callers can
// gate the UI on `isSpeechSupported()`.

type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
    return getCtor() !== null;
}

export interface DictationHandle {
    stop: () => void;
}

export interface DictationOptions {
    lang?: string;
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
}

// Pre-prompt for mic access via getUserMedia before starting recognition.
// SpeechRecognition.start() returns `not-allowed` silently when permission is
// already denied (or never granted at the OS level), with no chance to retry.
// Routing through getUserMedia surfaces the real browser prompt the first time
// and gives us a typed DOMException we can branch on afterwards.
async function ensureMicPermission(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately release — recognition opens its own audio path.
    stream.getTracks().forEach(t => t.stop());
}

export async function startDictation(opts: DictationOptions): Promise<DictationHandle | null> {
    const Ctor = getCtor();
    if (!Ctor) return null;

    try {
        await ensureMicPermission();
    } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
            opts.onError?.('not-allowed');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            opts.onError?.('no-microphone');
        } else {
            opts.onError?.('mic-unavailable');
        }
        return null;
    }

    const rec = new Ctor();
    rec.lang = opts.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const alt = event.results[i]?.[0];
            const t = alt?.transcript || '';
            if ((event.results[i] as unknown as { isFinal?: boolean }).isFinal) {
                finalText += t;
            } else {
                interim += t;
            }
        }
        if (finalText) opts.onResult(finalText.trim(), true);
        else if (interim) opts.onResult(interim.trim(), false);
    };
    rec.onerror = (event) => {
        opts.onError?.(event.error || 'unknown');
    };
    rec.onend = () => {
        opts.onEnd?.();
    };

    try {
        rec.start();
    } catch (err) {
        opts.onError?.(err instanceof Error ? err.message : 'failed-to-start');
        return null;
    }
    return { stop: () => rec.stop() };
}
