import { renderHook, act } from '@testing-library/react';
import {
  useInfiniteScroll,
  useVirtualScroll,
  useLazyLoad,
  calculatePagination,
  generatePageNumbers
} from '../infinite-scroll';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});
(global as any).IntersectionObserver = mockIntersectionObserver;

// Mock timers
jest.useFakeTimers();

describe('useInfiniteScroll', () => {
  let mockOnLoadMore: jest.Mock;

  beforeEach(() => {
    mockOnLoadMore = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll(mockOnLoadMore, true, false)
    );

    expect(result.current.state.isNearBottom).toBe(false);
    expect(result.current.state.isVisible).toBe(false);
    expect(result.current.state.scrollPosition).toBe(0);
    expect(result.current.containerRef.current).toBe(null);
    expect(result.current.sentinelRef.current).toBe(null);
  });

  it('should call onLoadMore when sentinel becomes visible', () => {
    let intersectionCallback: (entries: any[]) => void = () => {};
    
    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    });

    renderHook(() =>
      useInfiniteScroll(mockOnLoadMore, true, false, { enabled: true })
    );

    // Simulate intersection
    act(() => {
      intersectionCallback([{ isIntersecting: true }]);
    });

    // Advance timers to trigger debounced call
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe('useVirtualScroll', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));

  it('should calculate total height correctly with fixed item height', () => {
    const { result } = renderHook(() =>
      useVirtualScroll(mockItems, {
        itemHeight: 50,
        containerHeight: 400
      })
    );

    expect(result.current.totalHeight).toBe(5000); // 100 items * 50px
  });

  it('should handle scroll events correctly', () => {
    const { result } = renderHook(() =>
      useVirtualScroll(mockItems, {
        itemHeight: 50,
        containerHeight: 400
      })
    );

    const mockScrollEvent = {
      currentTarget: { scrollTop: 250 }
    } as React.UIEvent<HTMLElement>;

    act(() => {
      result.current.handleScroll(mockScrollEvent);
    });

    expect(result.current.isScrolling).toBe(true);

    // Advance timers to stop scrolling
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current.isScrolling).toBe(false);
  });
});

describe('useLazyLoad', () => {
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useLazyLoad());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.shouldLoad).toBe(false);
  });

  it('should handle load success', () => {
    const { result } = renderHook(() => useLazyLoad());

    act(() => {
      result.current.onLoad();
    });

    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('should handle load error', () => {
    const { result } = renderHook(() => useLazyLoad());

    act(() => {
      result.current.onError();
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.hasLoaded).toBe(false);
  });
});

describe('calculatePagination', () => {
  it('should calculate pagination correctly for first page', () => {
    const result = calculatePagination(1, 10, 100);

    expect(result).toEqual({
      currentPage: 1,
      totalPages: 10,
      pageSize: 10,
      totalItems: 100,
      hasNext: true,
      hasPrev: false,
      startItem: 1,
      endItem: 10
    });
  });

  it('should calculate pagination correctly for middle page', () => {
    const result = calculatePagination(5, 10, 100);

    expect(result).toEqual({
      currentPage: 5,
      totalPages: 10,
      pageSize: 10,
      totalItems: 100,
      hasNext: true,
      hasPrev: true,
      startItem: 41,
      endItem: 50
    });
  });

  it('should calculate pagination correctly for last page', () => {
    const result = calculatePagination(10, 10, 100);

    expect(result).toEqual({
      currentPage: 10,
      totalPages: 10,
      pageSize: 10,
      totalItems: 100,
      hasNext: false,
      hasPrev: true,
      startItem: 91,
      endItem: 100
    });
  });
});

describe('generatePageNumbers', () => {
  it('should return all pages when total pages is less than max visible', () => {
    const result = generatePageNumbers(3, 5, 7);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should show pages from start with ellipsis at end', () => {
    const result = generatePageNumbers(2, 20, 7);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 'ellipsis', 20]);
  });

  it('should show pages from end with ellipsis at start', () => {
    const result = generatePageNumbers(18, 20, 7);
    expect(result).toEqual([1, 'ellipsis', 15, 16, 17, 18, 19, 20]);
  });

  it('should show pages around current with ellipsis on both sides', () => {
    const result = generatePageNumbers(10, 20, 7);
    expect(result).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 20]);
  });
});