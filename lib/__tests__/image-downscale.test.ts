import { describe, it, expect } from 'vitest';
import { downscaleImage, blobToBase64 } from '../image-downscale';

describe('blobToBase64', () => {
    it('round-trips ascii', async () => {
        const b = new Blob(['hello receipt'], { type: 'text/plain' });
        expect(Buffer.from(await blobToBase64(b), 'base64').toString()).toBe('hello receipt');
    });

    it('round-trips arbitrary bytes, including a chunk boundary', async () => {
        // 0x8000 is the chunk size, so this crosses it and would catch an
        // off-by-one in the chunking loop.
        const bytes = new Uint8Array(0x8000 + 257);
        for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
        const out = Buffer.from(await blobToBase64(new Blob([bytes])), 'base64');
        expect(out.length).toBe(bytes.length);
        expect(Uint8Array.from(out)).toEqual(bytes);
    });

    it('emits no data-URL prefix', async () => {
        expect(await blobToBase64(new Blob(['x']))).not.toContain(',');
    });
});

describe('downscaleImage', () => {
    it('passes a PDF through untouched', async () => {
        const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
        expect(await downscaleImage(pdf)).toBe(pdf);
    });

    it('passes a typeless blob through untouched', async () => {
        const blob = new Blob(['?']);
        expect(await downscaleImage(blob)).toBe(blob);
    });

    it('returns the original when there is no DOM (SSR)', async () => {
        // The suite runs in the node environment, so this exercises the guard.
        const img = new Blob(['not really a jpeg'], { type: 'image/jpeg' });
        expect(await downscaleImage(img)).toBe(img);
    });
});
