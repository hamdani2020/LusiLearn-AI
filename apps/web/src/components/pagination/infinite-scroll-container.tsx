'use client';

import React, { forwardRef } from 'react';
import { useInfiniteScroll } from '@/lib/pagination/infinite-scroll';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface InfiniteScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
  loadingComponent?: React.ReactNode;
  endMessage?: React.ReactNode;
  errorMessage?: React.ReactNode;
  error?: string | null;
  onRetry?: () => void;
}

export const InfiniteScrollContainer = forwardRef<HTMLDivElement, InfiniteScrollContainerProps>(
  ({
    children,
    onLoadMore,
    hasMore,
    loading,
    threshold = 200,
    rootMargin = '0px',
    enabled = true,
    loadingComponent,
    endMessage,
    errorMessage,
    error,
    onRetry,
    className,
    ...props
  }, ref) => {
    const { containerRef, sentinelRef, state } = useInfiniteScroll(
      onLoadMore,
      hasMore,
      loading,
      {
        threshold,
        rootMargin,
        enabled
      }
    );

    // Combine refs
    const combinedRef = (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const defaultLoadingComponent = (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading more...</span>
      </div>
    );

    const defaultEndMessage = (
      <div className="text-center py-4 text-muted-foreground">
        No more items to load
      </div>
    );

    const defaultErrorMessage = (
      <div className="text-center py-4">
        <div className="text-destructive mb-2">Failed to load more items</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );

    return (
      <div
        ref={combinedRef}
        className={cn('overflow-auto', className)}
        {...props}
      >
        {children}

        {/* Sentinel element for intersection observer */}
        <div
          ref={sentinelRef as React.RefObject<HTMLDivElement>}
          className="h-1"
          aria-hidden="true"
        />

        {/* Loading state */}
        {loading && (loadingComponent || defaultLoadingComponent)}

        {/* Error state */}
        {error && !loading && (errorMessage || defaultErrorMessage)}

        {/* End message */}
        {!hasMore && !loading && !error && (endMessage || defaultEndMessage)}

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground p-2 border-t">
            <div>Scroll Position: {state.scrollPosition}px</div>
            <div>Near Bottom: {state.isNearBottom ? 'Yes' : 'No'}</div>
            <div>Sentinel Visible: {state.isVisible ? 'Yes' : 'No'}</div>
            <div>Container Height: {state.containerHeight}px</div>
            <div>Content Height: {state.contentHeight}px</div>
          </div>
        )}
      </div>
    );
  }
);

InfiniteScrollContainer.displayName = 'InfiniteScrollContainer';

export default InfiniteScrollContainer;