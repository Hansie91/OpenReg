import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallback';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

export function ErrorBoundary({ children, onReset }: Props) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={onReset}
      onError={(error, info) => {
        // Log to console in development, could send to error tracking in production
        console.error('Error boundary caught:', error, info);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
