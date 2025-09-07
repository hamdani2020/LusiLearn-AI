// Pagination Components Export
export { InfiniteScrollContainer } from './infinite-scroll-container';
export type { InfiniteScrollContainerProps } from './infinite-scroll-container';

export { VirtualList } from './virtual-list';
export type { VirtualListProps } from './virtual-list';

export { LazyImage } from './lazy-image';
export type { LazyImageProps } from './lazy-image';

export { PaginationControls, SimplePagination } from './pagination-controls';
export type { PaginationControlsProps, SimplePaginationProps } from './pagination-controls';

// Re-export pagination utilities
export {
  useInfiniteScroll,
  useVirtualScroll,
  useLazyLoad,
  calculatePagination,
  generatePageNumbers
} from '@/lib/pagination/infinite-scroll';

export type {
  InfiniteScrollOptions,
  InfiniteScrollState,
  VirtualScrollOptions,
  VirtualScrollItem,
  LazyLoadOptions,
  PaginationInfo
} from '@/lib/pagination/infinite-scroll';