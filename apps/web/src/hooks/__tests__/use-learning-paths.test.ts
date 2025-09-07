/**
 * Comprehensive unit tests for useLearningPaths hook
 * Tests all functionality including loading, error, and success states
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  renderWithProviders,
  createMockLearningPath,
  createMockApiResponse,
  createMockApiError,
  mockServer,
  addMockHandler,
  simulateNetworkError,
  simulateTimeout,
  TEST_API_ENDPOINTS,
  PERFORMANCE_THRESHOLDS,
  measurePerformance
} from '@/lib/testing';
import { useLearningPaths } from '../use-learning-paths';
import type { LearningPath, CreateLearningPathRequest, UpdateLearningPathRequest } from '@lusilearn/shared-types';

describe('useLearningPaths', () => {
  const mockLearningPath1 = createMockLearningPath({
    id: 'path-1',
    subject: 'Mathematics',
    currentLevel: 'intermediate'
  });

  const mockLearningPath2 = createMockLearningPath({
    id: 'path-2',
    subject: 'Computer Science',
    currentLevel: 'beginner'
  });

  const mockLearningPaths = [mockLearningPath1, mockLearningPath2];

  beforeEach(() => {
    // Reset any custom handlers
    mockServer.resetHandlers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.learningPaths).toEqual([]);
      expect(result.current.currentPath).toBeNull();
      expect(result.current.loading).toBe(true); // Auto-fetch is enabled
      expect(result.current.error).toBeNull();
      expect(result.current.hasLearningPaths).toBe(false);
      expect(result.current.totalPaths).toBe(0);
      expect(result.current.completedPaths).toBe(0);
      expect(result.current.activePaths).toBe(0);
    });

    it('should provide all required methods', () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Check that all methods are defined
      expect(typeof result.current.fetchLearningPaths).toBe('function');
      expect(typeof result.current.fetchLearningPath).toBe('function');
      expect(typeof result.current.createLearningPath).toBe('function');
      expect(typeof result.current.updateLearningPath).toBe('function');
      expect(typeof result.current.deleteLearningPath).toBe('function');
      expect(typeof result.current.shareLearningPath).toBe('function');
      expect(typeof result.current.setCurrentPath).toBe('function');
      expect(typeof result.current.optimisticUpdate).toBe('function');
      expect(typeof result.current.rollbackOptimisticUpdate).toBe('function');
      expect(typeof result.current.confirmOptimisticUpdate).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.clearData).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.invalidate).toBe('function');
    });
  });

  describe('Fetching Learning Paths', () => {
    it('should fetch learning paths successfully', async () => {
      addMockHandler(
        http.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, () => {
          return HttpResponse.json(createMockApiResponse(mockLearningPaths));
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Wait for auto-fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.learningPaths).toEqual(mockLearningPaths);
      expect(result.current.hasLearningPaths).toBe(true);
      expect(result.current.totalPaths).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json(createMockApiError('Server error'))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.learningPaths).toEqual([]);
      expect(result.current.hasLearningPaths).toBe(false);
    });

    it('should handle network errors with retry logic', async () => {
      simulateNetworkError(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST);

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.learningPaths).toEqual([]);
    });

    it('should meet performance requirements for fetching', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.delay(100), // Simulate 100ms response time
            ctx.status(200),
            ctx.json(createMockApiResponse(mockLearningPaths))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const fetchTime = await measurePerformance(async () => {
        await act(async () => {
          await result.current.fetchLearningPaths();
        });
      });

      expect(fetchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
    });
  });

  describe('Individual Learning Path Operations', () => {
    it('should fetch individual learning path successfully', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.GET('path-1'), (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockLearningPath1))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await act(async () => {
        const path = await result.current.fetchLearningPath('path-1');
        expect(path).toEqual(mockLearningPath1);
      });

      expect(result.current.currentPath).toEqual(mockLearningPath1);
    });

    it('should set current path correctly', async () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      act(() => {
        result.current.setCurrentPath(mockLearningPath1);
      });

      expect(result.current.currentPath).toEqual(mockLearningPath1);
      expect(result.current.currentPathId).toBe('path-1');

      act(() => {
        result.current.setCurrentPath(null);
      });

      expect(result.current.currentPath).toBeNull();
      expect(result.current.currentPathId).toBeUndefined();
    });
  });

  describe('CRUD Operations', () => {
    it('should create learning path successfully', async () => {
      const newPath = createMockLearningPath({
        id: 'new-path',
        subject: 'Physics'
      });

      addMockHandler(
        rest.post(TEST_API_ENDPOINTS.LEARNING_PATHS.CREATE, (req, res, ctx) => {
          return res(
            ctx.status(201),
            ctx.json(createMockApiResponse(newPath))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const createData: CreateLearningPathRequest = {
        subject: 'Physics',
        goals: ['Understand mechanics', 'Learn thermodynamics']
      };

      await act(async () => {
        const createdPath = await result.current.createLearningPath(createData);
        expect(createdPath).toEqual(newPath);
      });
    });

    it('should update learning path successfully', async () => {
      const updatedPath = { ...mockLearningPath1, subject: 'Advanced Mathematics' };

      addMockHandler(
        rest.put(TEST_API_ENDPOINTS.LEARNING_PATHS.UPDATE('path-1'), (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(updatedPath))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Set current path first
      act(() => {
        result.current.setCurrentPath(mockLearningPath1);
      });

      const updateData: UpdateLearningPathRequest = {
        subject: 'Advanced Mathematics'
      };

      await act(async () => {
        const updated = await result.current.updateLearningPath('path-1', updateData);
        expect(updated).toEqual(updatedPath);
      });

      // Current path should be updated too
      expect(result.current.currentPath).toEqual(updatedPath);
    });

    it('should delete learning path successfully', async () => {
      addMockHandler(
        rest.delete(TEST_API_ENDPOINTS.LEARNING_PATHS.DELETE('path-1'), (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Set current path first
      act(() => {
        result.current.setCurrentPath(mockLearningPath1);
      });

      await act(async () => {
        const deleted = await result.current.deleteLearningPath('path-1');
        expect(deleted).toBe(true);
      });

      // Current path should be cleared if it was the deleted one
      expect(result.current.currentPath).toBeNull();
    });

    it('should handle CRUD operation errors', async () => {
      addMockHandler(
        rest.post(TEST_API_ENDPOINTS.LEARNING_PATHS.CREATE, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json(createMockApiError('Validation error'))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const createData: CreateLearningPathRequest = {
        subject: '',
        goals: []
      };

      await act(async () => {
        const createdPath = await result.current.createLearningPath(createData);
        expect(createdPath).toBeNull();
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Optimistic Updates', () => {
    it('should apply optimistic updates correctly', async () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Set current path
      act(() => {
        result.current.setCurrentPath(mockLearningPath1);
      });

      // Apply optimistic update
      act(() => {
        result.current.optimisticUpdate('path-1', { subject: 'Updated Subject' });
      });

      expect(result.current.currentPath?.subject).toBe('Updated Subject');
    });

    it('should rollback optimistic updates', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.GET('path-1'), (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockLearningPath1))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      // Set current path
      act(() => {
        result.current.setCurrentPath(mockLearningPath1);
      });

      // Apply optimistic update
      act(() => {
        result.current.optimisticUpdate('path-1', { subject: 'Updated Subject' });
      });

      // Rollback optimistic update
      await act(async () => {
        result.current.rollbackOptimisticUpdate('path-1');
      });

      // Should fetch fresh data and update current path
      await waitFor(() => {
        expect(result.current.currentPath?.subject).toBe(mockLearningPath1.subject);
      });
    });

    it('should confirm optimistic updates', async () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      act(() => {
        result.current.optimisticUpdate('path-1', { subject: 'Updated Subject' });
      });

      act(() => {
        result.current.confirmOptimisticUpdate('path-1');
      });

      // Should not throw any errors
      expect(result.current.getPendingUpdates()).toBeDefined();
    });
  });

  describe('Computed Values', () => {
    it('should calculate completed paths correctly', async () => {
      const completedPath = createMockLearningPath({
        id: 'completed-path',
        milestones: [
          {
            id: 'milestone-1',
            title: 'Complete Module 1',
            description: 'Finish all lessons in module 1',
            targetDate: '2024-06-01',
            completed: true,
            progress: 1.0
          }
        ]
      });

      const incompletePath = createMockLearningPath({
        id: 'incomplete-path',
        milestones: [
          {
            id: 'milestone-2',
            title: 'Complete Module 2',
            description: 'Finish all lessons in module 2',
            targetDate: '2024-07-01',
            completed: false,
            progress: 0.5
          }
        ]
      });

      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse([completedPath, incompletePath]))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.totalPaths).toBe(2);
      expect(result.current.completedPaths).toBe(1);
      expect(result.current.activePaths).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should clear errors correctly', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json(createMockApiError('Server error'))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear data correctly', async () => {
      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockLearningPaths))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      await waitFor(() => {
        expect(result.current.learningPaths.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.clearData();
      });

      expect(result.current.learningPaths).toEqual([]);
    });
  });

  describe('Sharing Functionality', () => {
    it('should share learning path successfully', async () => {
      addMockHandler(
        rest.post('/api/v1/learning-paths/path-1/share', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const shareData = {
        recipientEmail: 'friend@example.com',
        message: 'Check out this learning path!'
      };

      await act(async () => {
        const shared = await result.current.shareLearningPath('path-1', shareData);
        expect(shared).toBe(true);
      });
    });

    it('should handle sharing errors', async () => {
      addMockHandler(
        rest.post('/api/v1/learning-paths/path-1/share', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json(createMockApiError('Invalid recipient'))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const shareData = {
        recipientEmail: 'invalid-email',
        message: 'Check out this learning path!'
      };

      await act(async () => {
        const shared = await result.current.shareLearningPath('path-1', shareData);
        expect(shared).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should meet hook update performance requirements', async () => {
      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const updateTime = await measurePerformance(() => {
        act(() => {
          result.current.setCurrentPath(mockLearningPath1);
        });
      });

      expect(updateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.HOOK_UPDATE_TIME);
    });

    it('should handle large datasets efficiently', async () => {
      const largeLearningPathsArray = Array.from({ length: 100 }, (_, index) =>
        createMockLearningPath({ id: `path-${index}`, subject: `Subject ${index}` })
      );

      addMockHandler(
        rest.get(TEST_API_ENDPOINTS.LEARNING_PATHS.LIST, (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(largeLearningPathsArray))
          );
        })
      );

      const { result } = renderHook(() => useLearningPaths(), {
        wrapper: ({ children }) => renderWithProviders(<div>{children}</div>)
      });

      const renderTime = await measurePerformance(async () => {
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
      });

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_RENDER_TIME * 2); // Allow 2x for large datasets
      expect(result.current.totalPaths).toBe(100);
    });
  });
});