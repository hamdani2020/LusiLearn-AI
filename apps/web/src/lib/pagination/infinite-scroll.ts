import { useEffect, useRef, useCallback, useState } from 'react';

// Infinite scroll configuration
export interface InfiniteScrollOptions {
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  rootMargin?: string; // Intersection observer root margin
  enabled?: boolean; // Whether infinite scroll is enabled
  debounceMs?: number; // Debounce time for scroll events
  initialLoad?: boolean; // Whether to load initial data
}

export interface InfiniteScrollState {
  isNearBottom: boolean;
  isVisible: boolean;
  scrollPosition: number;
  containerHeight: number;
  contentHeight: number;
}

// Hook for infinite scroll functionality
export function useInfiniteScroll<TContainer extends HTMLElement = HTMLElement, TSentinel extends HTMLElement = HTMLDivElement>(
  onLoadMore: () => void,
  hasMore: boolean,
  loading: boolean,
  options: InfiniteScrollOptions = {}
) {
  const {
    threshold = 200,
    rootMargin = '0px',
    enabled = true,
    debounceMs = 100,
    initialLoad = true
  } = options;

  const [state, setState] = useState<InfiniteScrollState>({
    isNearBottom: false,
    isVisible: false,
    scrollPosition: 0,
    containerHeight: 0,
    contentHeight: 0
  });

  const containerRef = useRef<TContainer | null>(null);
  const sentinelRef = useRef<TSentinel | null>(null);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update refs
  useEffect(() => {
    loadingRef.current = loading;
    hasMoreRef.current = hasMore;
  }, [loading, hasMore]);

  // Debounced load more function
  const debouncedLoadMore = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (!loadingRef.current && hasMoreRef.current && enabled) {
        onLoadMore();
      }
    }, debounceMs);
  }, [onLoadMore, enabled, debounceMs]);

  // Intersection observer for sentinel element
  useEffect(() => {
    if (!sentinelRef.current || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setState(prev => ({ ...prev, isVisible: true }));
          debouncedLoadMore();
        } else {
          setState(prev => ({ ...prev, isVisible: false }));
        }
      },
      {
        rootMargin,
        threshold: 0.1
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [enabled, rootMargin, debouncedLoadMore]);

  // Scroll event listener for additional state tracking
  useEffect(() => {
    if (!containerRef.current || !enabled) return;

    const container = containerRef.current;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setState(prev => ({
        ...prev,
        scrollPosition: scrollTop,
        containerHeight: clientHeight,
        contentHeight: scrollHeight,
        isNearBottom: distanceFromBottom <= threshold
      }));

      // Trigger load more if near bottom
      if (distanceFromBottom <= threshold && !loading && hasMore) {
        debouncedLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, threshold, loading, hasMore, debouncedLoadMore]);

  // Initial load
  useEffect(() => {
    if (initialLoad && enabled && hasMore && !loading) {
      onLoadMore();
    }
  }, [initialLoad, enabled, hasMore, loading, onLoadMore]);

  return {
    containerRef,
    sentinelRef,
    state,
    loadMore: debouncedLoadMore
  };
}

// Virtual scrolling for large lists
export interface VirtualScrollOptions {
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number; // Number of items to render outside visible area
  scrollingDelay?: number; // Delay before considering scrolling stopped
}

export interface VirtualScrollItem {
  index: number;
  start: number;
  end: number;
  height: number;
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
) {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    scrollingDelay = 150
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getItemHeight = useCallback((index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
  }, [itemHeight]);

  // Calculate total height
  const totalHeight = items.reduce((acc, _, index) => {
    return acc + getItemHeight(index);
  }, 0);

  // Calculate visible range
  const getVisibleRange = useCallback(() => {
    let startIndex = 0;
    let endIndex = 0;
    let accumulatedHeight = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      if (accumulatedHeight + height > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      accumulatedHeight += height;
    }

    // Find end index
    accumulatedHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const height = getItemHeight(i);
      accumulatedHeight += height;
      if (accumulatedHeight > scrollTop + containerHeight) {
        endIndex = Math.min(items.length - 1, i + overscan);
        break;
      }
    }

    return { startIndex, endIndex };
  }, [items.length, scrollTop, containerHeight, overscan, getItemHeight]);

  const { startIndex, endIndex } = getVisibleRange();

  // Calculate visible items with positions
  const visibleItems: VirtualScrollItem[] = [];
  let accumulatedHeight = 0;

  for (let i = 0; i < items.length; i++) {
    const height = getItemHeight(i);
    
    if (i >= startIndex && i <= endIndex) {
      visibleItems.push({
        index: i,
        start: accumulatedHeight,
        end: accumulatedHeight + height,
        height
      });
    }
    
    accumulatedHeight += height;
  }

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }

    // Set scrolling to false after delay
    scrollingTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, scrollingDelay);
  }, [scrollingDelay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, []);

  return {
    totalHeight,
    visibleItems,
    startIndex,
    endIndex,
    isScrolling,
    handleScroll,
    scrollToIndex: (index: number) => {
      let targetScrollTop = 0;
      for (let i = 0; i < index; i++) {
        targetScrollTop += getItemHeight(i);
      }
      setScrollTop(targetScrollTop);
      return targetScrollTop;
    }
  };
}

// Lazy loading for images and content
export interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
  placeholder?: string | React.ReactNode;
  errorFallback?: string | React.ReactNode;
}

export function useLazyLoad<T extends HTMLElement = HTMLDivElement>(options: LazyLoadOptions = {}) {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    triggerOnce = true
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const elementRef = useRef<T | null>(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(entry.target);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    observer.observe(elementRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, triggerOnce]);

  const onLoad = useCallback(() => {
    setHasLoaded(true);
    setHasError(false);
  }, []);

  const onError = useCallback(() => {
    setHasError(true);
    setHasLoaded(false);
  }, []);

  return {
    elementRef,
    isVisible,
    hasLoaded,
    hasError,
    onLoad,
    onError,
    shouldLoad: isVisible || hasLoaded
  };
}

// Pagination utilities
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
  startItem: number;
  endItem: number;
}

export function calculatePagination(
  currentPage: number,
  pageSize: number,
  totalItems: number
): PaginationInfo {
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    hasNext,
    hasPrev,
    startItem,
    endItem
  };
}

export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const halfVisible = Math.floor(maxVisible / 2);

  // Always show first page
  pages.push(1);

  if (currentPage <= halfVisible + 1) {
    // Show pages from start
    for (let i = 2; i <= Math.min(maxVisible - 1, totalPages - 1); i++) {
      pages.push(i);
    }
    if (totalPages > maxVisible - 1) {
      pages.push('ellipsis');
    }
  } else if (currentPage >= totalPages - halfVisible) {
    // Show pages from end
    if (totalPages > maxVisible - 1) {
      pages.push('ellipsis');
    }
    for (let i = Math.max(2, totalPages - maxVisible + 2); i <= totalPages - 1; i++) {
      pages.push(i);
    }
  } else {
    // Show pages around current
    pages.push('ellipsis');
    for (let i = currentPage - halfVisible + 1; i <= currentPage + halfVisible - 1; i++) {
      pages.push(i);
    }
    pages.push('ellipsis');
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}