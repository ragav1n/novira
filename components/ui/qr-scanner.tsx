import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Loader2, CameraOff } from 'lucide-react';
import { setZXingModuleOverrides } from 'barcode-detector';
import { useState } from 'react';

// Set WASM overrides before component loads
if (typeof window !== 'undefined') {
    setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) => {
            if (path.endsWith('.wasm')) {
                return `/wasm/${path}`;
            }
            return prefix + path;
        }
    });
}

const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )
});

interface QrScannerProps {
    onScan: (result: string) => void;
    onError?: (error: unknown) => void;
    className?: string;
}

export function QrScanner({ onScan, onError, className }: QrScannerProps) {
    const [cameraError, setCameraError] = useState<string | null>(null);

    const handleError = (err: unknown) => {
        console.error("QR Scan Error:", err);

        // Handle NotSupportedError and other camera failures gracefully
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isNotSupported = errorMessage.includes('NotSupported') ||
            errorMessage.includes('not supported') ||
            errorMessage.includes('getUserMedia') ||
            errorMessage.includes('NotAllowedError') ||
            errorMessage.includes('NotFoundError');

        if (isNotSupported) {
            setCameraError(
                errorMessage.includes('NotAllowed')
                    ? 'Camera access denied. Please allow camera permissions.'
                    : 'Camera not available on this device.'
            );
        }

        if (onError) onError(err);
    };

    if (cameraError) {
        return (
            <div className={cn("relative w-full aspect-square overflow-hidden rounded-xl bg-black/90 flex flex-col items-center justify-center gap-4 p-6", className)}>
                <CameraOff className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">{cameraError}</p>
                <p className="text-xs text-muted-foreground/60 text-center">
                    Try using a device with a camera, or ask your friend to share their code manually.
                </p>
            </div>
        );
    }

    return (
        <div className={cn("relative w-full aspect-square overflow-hidden rounded-xl bg-black", className)}>
            <Scanner
                onScan={(result: { rawValue: string }[]) => {
                    if (result && result.length > 0) {
                        onScan(result[0].rawValue);
                    }
                }}
                onError={handleError}
                constraints={{
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 640 },
                }}
                styles={{
                    container: {
                        width: '100%',
                        height: '100%',
                        borderRadius: '0.75rem',
                    },
                    video: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }
                }}
                components={{
                    onOff: true,
                    torch: true,
                    finder: false
                }}
                allowMultiple={false}
                scanDelay={500}
            />

            {/* Overlay guide */}
            <div className="absolute inset-0 border-2 border-white/20 rounded-xl pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary rounded-lg box-border">
                </div>
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/70 pointer-events-none">
                Point camera at a friend's code
            </div>
        </div>
    );
}

