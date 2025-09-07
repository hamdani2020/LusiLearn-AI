// Tests for useBaseHook
import { renderHook, act } from '@testing-library/react';
import { useBaseHook } from '../use-base-hook';

describe('useBaseHook', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useBaseHook(null));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetch).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('should initialize with provided initial data', () => {
    const initialData = { id: 1, name: 'Test' };
    const { result } = renderHook(() => useBaseHook(initialData));

    expect(result.current.data).toEqual(initialData);
  });

  it('should set data correctly', () => {
    const { result } = renderHook(() => useBaseHook(null));

    const testData = { id: 1, name: 'Test' };
    
    act(() => {
      result.current.setData(testData);
    });

    expect(result.current.data).toEqual(testData);
    expect(result.current.error).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('should set loading state correctly', () => {
    const { result } = renderHook(() => useBaseHook(null));

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should set error state correctly', () => {
    const { result } = renderHook(() => useBaseHook(null));

    const errorMessage = 'Test error';
    
    act(() => {
      result.current.setError(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useBaseHook(null));

    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should clear data', () => {
    const initialData = { id: 1, name: 'Test' };
    const { result } = renderHook(() => useBaseHook(initialData));

    expect(result.current.data).toEqual(initialData);

    act(() => {
      result.current.clearData();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('should handle refresh', async () => {
    const { result } = renderHook(() => useBaseHook(null));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isStale).toBe(true);
  });

  it('should handle invalidate', () => {
    const { result } = renderHook(() => useBaseHook({ id: 1, name: 'Test' }));

    act(() => {
      result.current.invalidate();
    });

    expect(result.current.isStale).toBe(true);
  });

  it('should call success callback when data is set', () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useBaseHook(null, { onSuccess }));

    const testData = { id: 1, name: 'Test' };
    
    act(() => {
      result.current.setData(testData);
    });

    expect(onSuccess).toHaveBeenCalledWith(testData);
  });

  it('should call error callback when error is set', () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useBaseHook(null, { onError }));

    const errorMessage = 'Test error';
    
    act(() => {
      result.current.setError(errorMessage);
    });

    expect(onError).toHaveBeenCalledWith(errorMessage);
  });

  it('should call loading callback when loading state changes', () => {
    const onLoading = jest.fn();
    const { result } = renderHook(() => useBaseHook(null, { onLoading }));

    act(() => {
      result.current.setLoading(true);
    });

    expect(onLoading).toHaveBeenCalledWith(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(onLoading).toHaveBeenCalledWith(false);
  });
});