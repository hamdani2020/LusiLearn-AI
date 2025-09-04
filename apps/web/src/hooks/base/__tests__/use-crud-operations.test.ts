// Tests for useCrudOperations hook
import { renderHook, act } from '@testing-library/react';
import { useCrudOperations } from '../use-crud-operations';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

interface CreateTestItem {
  name: string;
  value: number;
}

interface UpdateTestItem {
  name?: string;
  value?: number;
}

describe('useCrudOperations', () => {
  const mockEndpoints = {
    getAll: '/api/test',
    getById: '/api/test/:id',
    create: '/api/test',
    update: '/api/test/:id',
    delete: '/api/test/:id'
  };

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.itemCount).toBe(0);
  });

  it('should provide all required CRUD methods', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    expect(typeof result.current.fetchAll).toBe('function');
    expect(typeof result.current.fetchById).toBe('function');
    expect(typeof result.current.create).toBe('function');
    expect(typeof result.current.update).toBe('function');
    expect(typeof result.current.delete).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should provide optimistic update methods', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        enableOptimisticUpdates: true,
        autoFetch: false
      })
    );

    expect(typeof result.current.applyOptimisticUpdate).toBe('function');
    expect(typeof result.current.rollbackOptimisticUpdate).toBe('function');
    expect(typeof result.current.confirmOptimisticUpdate).toBe('function');
    expect(typeof result.current.getPendingUpdates).toBe('function');
  });

  it('should provide utility methods', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    expect(typeof result.current.setData).toBe('function');
    expect(typeof result.current.setLoading).toBe('function');
    expect(typeof result.current.setError).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
    expect(typeof result.current.clearData).toBe('function');
    expect(typeof result.current.invalidate).toBe('function');
  });

  it('should provide individual call states', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    expect(result.current.states).toBeDefined();
    expect(result.current.states.getAll).toBeDefined();
    expect(result.current.states.getById).toBeDefined();
    expect(result.current.states.create).toBeDefined();
    expect(result.current.states.update).toBeDefined();
    expect(result.current.states.delete).toBeDefined();
  });

  it('should handle data updates correctly', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    const testData: TestItem[] = [
      { id: '1', name: 'Test 1', value: 10 },
      { id: '2', name: 'Test 2', value: 20 }
    ];

    act(() => {
      result.current.setData(testData);
    });

    expect(result.current.data).toEqual(testData);
    expect(result.current.hasData).toBe(true);
    expect(result.current.itemCount).toBe(2);
  });

  it('should handle loading state correctly', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should handle error state correctly', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    const errorMessage = 'Test error';

    act(() => {
      result.current.setError(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should clear data correctly', () => {
    const { result } = renderHook(() =>
      useCrudOperations<TestItem, CreateTestItem, UpdateTestItem>({
        endpoints: mockEndpoints,
        autoFetch: false
      })
    );

    const testData: TestItem[] = [
      { id: '1', name: 'Test 1', value: 10 }
    ];

    act(() => {
      result.current.setData(testData);
    });

    expect(result.current.hasData).toBe(true);

    act(() => {
      result.current.clearData();
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.hasData).toBe(false);
    expect(result.current.itemCount).toBe(0);
  });
});