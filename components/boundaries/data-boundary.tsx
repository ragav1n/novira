'use client';

import React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Database, RefreshCcw } from 'lucide-react';

function DataErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[200px] bg-secondary/5 rounded-3xl border border-orange-500/20 m-4">
      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
         <Database className="w-6 h-6 text-orange-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Data Loading Error</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
        We encountered an issue processing this data from our servers.
      </p>
      
      {/* Dev only error trace */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-[10px] bg-black/20 p-2 rounded text-left overflow-auto w-full mb-4 text-orange-400">
          {(error as Error).message}
        </pre>
      )}

      <Button 
        onClick={resetErrorBoundary}
        variant="outline"
        className="border-orange-500/20 hover:bg-orange-500/10 text-orange-500"
      >
        <RefreshCcw className="w-4 h-4 mr-2" />
        Reload Data
      </Button>
    </div>
  );
}

export function DataBoundary({ children, onReset }: { children: React.ReactNode, onReset?: () => void }) {
  return (
    <ErrorBoundary FallbackComponent={DataErrorFallback} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}
