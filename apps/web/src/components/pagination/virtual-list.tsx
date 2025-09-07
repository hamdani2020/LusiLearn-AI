'use client';

import React, { forwardRef, useMemo } from 'react';
import { useVirtualScroll } from '@/lib/pagination/infinite-scroll';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onScroll'> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  renderItem: (item: T, index: number, isScrolling: boolean) => React.ReactNode;
  overscan?: number;
  scrollingDelay?: number;
  getItemKey?: (item: T, index: number) => string | number;
  onScroll?: (scrollTop: number) => void;
  initialScrollIndex?: number;
}

export const VirtualList = forwardRef<HTMLDivElement, VirtualListProps<any>>(
  ({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 5,
    scrollingDelay = 150,
    getItemKey,
    onScroll,
    initialScrollIndex,
    className,
    style,
    ...props
  }, ref) => {
    const {
      totalHeight,
      visibleItems,
      startIndex,
      endIndex,
      isScrolling,
      handleScroll,
      scrollToIndex
    } = useVirtualScroll(items, {
      itemHeight,
      containerHeight,
      overscan,
      scrollingDelay
    });

    // Scroll to initial index on mount
    React.useEffect(() => {
      if (initialScrollIndex !== undefined && initialScrollIndex >= 0) {
        const scrollTop = scrollToIndex(initialScrollIndex);
        if (ref && 'current' in ref && ref.current) {
          ref.current.scrollTop = scrollTop;
        }
      }
    }, [initialScrollIndex, scrollToIndex, ref]);

    // Handle scroll events
    const handleScrollEvent = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
      handleScroll(event);
      onScroll?.(event.currentTarget.scrollTop);
    }, [handleScroll, onScroll]);

    // Generate default key function
    const defaultGetItemKey = React.useCallback((item: any, index: number) => {
      return item?.id ?? item?.key ?? index;
    }, []);

    const keyFunction = getItemKey || defaultGetItemKey;

    // Memoize visible items to prevent unnecessary re-renders
    const renderedItems = useMemo(() => {
      return visibleItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        const key = keyFunction(item, virtualItem.index);

        return (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              left: 0,
              right: 0,
              height: virtualItem.height,
            }}
          >
            {renderItem(item, virtualItem.index, isScrolling)}
          </div>
        );
      });
    }, [visibleItems, items, keyFunction, renderItem, isScrolling]);

    return (
      <div
        ref={ref}
        className={cn('overflow-auto', className)}
        style={{
          height: containerHeight,
          ...style
        }}
        onScroll={handleScrollEvent}
        {...props}
      >
        <div
          style={{
            height: totalHeight,
            position: 'relative',
          }}
        >
          {renderedItems}
        </div>

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed top-4 right-4 bg-background border rounded p-2 text-xs text-muted-foreground shadow-lg">
            <div>Total Items: {items.length}</div>
            <div>Visible Range: {startIndex} - {endIndex}</div>
            <div>Rendered Items: {visibleItems.length}</div>
            <div>Total Height: {totalHeight}px</div>
            <div>Is Scrolling: {isScrolling ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>
    );
  }
);

VirtualList.displayName = 'VirtualList';

export default VirtualList;