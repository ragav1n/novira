'use client';

import React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

function ErrorFallback({ error: unknownError, resetErrorBoundary }: FallbackProps) {
  const error = unknownError as Error;
  const isChunkError = 
    error.name === 'ChunkLoadError' || 
    error.message?.includes('Loading chunk') || 
    error.message?.includes('Failed to fetch');

  const handleAction = () => {
    if (isChunkError) {
      window.location.reload();
    } else {
      resetErrorBoundary();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px] bg-secondary/5 rounded-[2rem] border border-destructive/10 m-4 backdrop-blur-sm">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6 animate-pulse">
         <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-xl font-bold mb-3">
        {isChunkError ? 'Update Available' : 'Display Error'}
      </h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-[280px] leading-relaxed">
        {isChunkError 
          ? "A new version of Novira is available. Please reload to continue using the latest features."
          : "Something went wrong while rendering this section. Our team has been notified."}
      </p>
      
      {/* Dev only error trace */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-[10px] bg-black/40 p-3 rounded-xl text-left overflow-auto w-full mb-6 text-destructive/80 font-mono">
          {error.name}: {error.message}
        </pre>
      )}

      <Button 
        onClick={handleAction}
        variant="outline"
        className="h-12 px-8 rounded-2xl border-primary/20 hover:bg-primary/10 text-primary font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/5"
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        {isChunkError ? 'Reload Application' : 'Try Again'}
      </Button>
    </div>
  );
}

export function UIBoundary({ children, onReset }: { children: React.ReactNode, onReset?: () => void }) {
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback} 
      onReset={onReset}
      onError={(error) => {
        // Here we could log to Sentry or similar service
        console.error('UI Boundary caught error:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
