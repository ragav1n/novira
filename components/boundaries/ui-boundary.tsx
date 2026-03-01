'use client';

import React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[200px] bg-secondary/5 rounded-3xl border border-destructive/20 m-4">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
         <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Display Error</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[250px]">
        Something went wrong while rendering this section.
      </p>
      
      {/* Dev only error trace */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-[10px] bg-black/20 p-2 rounded text-left overflow-auto w-full mb-4 text-destructive">
          {(error as Error).message}
        </pre>
      )}

      <Button 
        onClick={resetErrorBoundary}
        variant="outline"
        className="border-primary/20 hover:bg-primary/10 text-primary"
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
    </div>
  );
}

export function UIBoundary({ children, onReset }: { children: React.ReactNode, onReset?: () => void }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}
