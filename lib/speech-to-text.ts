// Thin wrapper around the Web Speech API. Browsers expose this as either
// `SpeechRecognition` or the vendor-prefixed `webkitSpeechRecognition` — we
// probe for both. The wrapper exits silently when unsupported so callers can
// gate the UI on `isSpeechSupported()`.

// Flip to true to log the recognition lifecycle to the console — useful if
// dictation ever stalls and you need to see which event it stops at.
const DEBUG = false;
function log(...args: unknown[]) {
    if (DEBUG) console.info('[dictation]', ...args);
}

type SpeechRecognitionLike = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
    onerror: ((event: { error: string; message?: string }) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
    onaudiostart: (() => void) | null;
    onaudioend: (() => void) | null;
    onsoundstart: (() => void) | null;
    onsoundend: (() => void) | null;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    onnomatch: (() => void) | null;
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
    abort: () => void;
}

export interface DictationOptions {
    lang?: string;
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
    onStart?: () => void;
}

// Starts dictation. SpeechRecognition.start() opens its own audio path and, in
// Chrome, surfaces the microphone-permission prompt itself — we deliberately do
// NOT pre-flight getUserMedia, because grabbing and releasing the mic right
// before recognition starts can leave the device in a state where recognition
// captures no audio. Permission errors arrive through `onerror` instead.
export function startDictation(opts: DictationOptions): DictationHandle | null {
    const Ctor = getCtor();
    if (!Ctor) {
        log('SpeechRecognition not supported in this browser');
        return null;
    }

    const rec = new Ctor();
    rec.lang = opts.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Continuous so a natural pause mid-sentence doesn't end recognition — the
    // caller stops it explicitly when the user is done dictating.
    rec.continuous = true;
    log('configured', { lang: rec.lang, continuous: rec.continuous, interimResults: rec.interimResults });

    rec.onstart = () => { log('onstart — recognition session started'); opts.onStart?.(); };
    rec.onaudiostart = () => log('onaudiostart — capturing audio from the microphone');
    rec.onsoundstart = () => log('onsoundstart — some sound detected');
    rec.onspeechstart = () => log('onspeechstart — speech detected');
    rec.onspeechend = () => log('onspeechend — speech stopped');
    rec.onsoundend = () => log('onsoundend — sound stopped');
    rec.onaudioend = () => log('onaudioend — stopped capturing audio');
    rec.onnomatch = () => log('onnomatch — speech detected but not recognised');

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
        log('onresult', { final: finalText, interim });
        if (finalText) opts.onResult(finalText.trim(), true);
        else if (interim) opts.onResult(interim.trim(), false);
    };
    rec.onerror = (event) => {
        log('onerror', event.error, event.message || '');
        opts.onError?.(event.error || 'unknown');
    };
    rec.onend = () => {
        log('onend — recognition session ended');
        opts.onEnd?.();
    };

    try {
        rec.start();
        log('start() called — waiting for onstart…');
    } catch (err) {
        log('start() threw', err);
        opts.onError?.(err instanceof Error ? err.message : 'failed-to-start');
        return null;
    }
    return {
        stop: () => { log('stop() called'); try { rec.stop(); } catch { /* already stopped */ } },
        abort: () => { log('abort() called'); try { rec.abort(); } catch { /* already stopped */ } },
    };
}
