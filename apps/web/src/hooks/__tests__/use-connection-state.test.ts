/**
 * Connection State Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useConnectionState } from '../use-connection-state';
import { getConnectionStateManager, getWebSocketManager } from '@/lib/websocket';

// Mock WebSocket manager
const mockWsManager = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  send: jest.fn(),
  isConnected: jest.fn(),
  getConnectionState: jest.fn(),
  getMetrics: jest.fn()
};

// Mock connection state manager
const mockConnectionStateManager = {
  subscribe: jest.fn(),
  isOnline: true,
  connectionState: 'connected' as const,
  offlineQueue: [],
  addToOfflineQueue: jest.fn(),
  processOfflineQueue: jest.fn(),
  clearOfflineQueue: jest.fn(),
  getQueueSize: jest.fn(),
  updateConnectionState: jest.fn(),
  destroy: jest.fn()
};

jest.mock('@/lib/websocket', () => ({
  getWebSocketManager: () => mockWsManager,
  getConnectionStateManager: () => mockConnectionStateManager,
  PollingFallback: jest.fn().mockImplementation(() => ({
    name: 'polling',
    isAvailable: () => true,
    send: jest.fn(),
    subscribe: jest.fn()
  })),
  ServerSentEventsFallback: jest.fn().mockImplementation(() => ({
    name: 'sse',
    isAvailable: () => true,
    send: jest.fn(),
    subscribe: jest.fn()
  }))
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

describe('useConnectionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWsManager.isConnected.mockReturnValue(false);
    mockWsManager.getConnectionState.mockReturnValue('disconnected');
    mockWsManager.getMetrics.mockReturnValue({
      reconnectAttempts: 0,
      messagesReceived: 0,
      messagesSent: 0
    });
    mockConnectionStateManager.subscribe.mockReturnValue(() => {});
    mockConnectionStateManager.getQueueSize.mockReturnValue(0);
  });

  describe('Initialization', () => {
    it('should initialize with default status', () => {
      const { result } = renderHook(() => useConnectionState());

      expect(result.current.status.isOnline).toBe(true);
      expect(result.current.status.isConnected).toBe(false);
      expect(result.current.status.connectionState).toBe('disconnected');
      expect(result.current.status.isReconnecting).toBe(false);
      expect(result.current.status.offlineQueueSize).toBe(0);
      expect(result.current.status.reconnectAttempts).toBe(0);
    });

    it('should initialize fallback mechanisms when enabled', () => {
      const { result } = renderHook(() => useConnectionState({
        enableFallbacks: true
      }));

      const activeFallbacks = result.current.getActiveFallbacks();
      expect(activeFallbacks).toHaveLength(2); // polling and SSE
      expect(activeFallbacks.map(f => f.name)).toEqual(['polling', 'sse']);
    });

    it('should not initialize fallbacks when disabled', () => {
      const { result } = renderHook(() => useConnectionState({
        enableFallbacks: false
      }));

      const activeFallbacks = result.current.getActiveFallbacks();
      expect(activeFallbacks).toHaveLength(0);
    });
  });

  describe('Status Updates', () => {
    it('should update status when WebSocket connects', () => {
      mockWsManager.isConnected.mockReturnValue(true);
      mockWsManager.getConnectionState.mockReturnValue('connected');

      const { result, rerender } = renderHook(() => useConnectionState());

      act(() => {
        rerender();
      });

      expect(result.current.status.isConnected).toBe(true);
      expect(result.current.status.connectionState).toBe('connected');
    });

    it('should update status when going offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      mockConnectionStateManager.isOnline = false;

      const { result } = renderHook(() => useConnectionState());

      expect(result.current.status.isOnline).toBe(false);
    });

    it('should update offline queue size', () => {
      mockConnectionStateManager.getQueueSize.mockReturnValue(5);

      const { result, rerender } = renderHook(() => useConnectionState());

      act(() => {
        rerender();
      });

      expect(result.current.status.offlineQueueSize).toBe(5);
    });
  });

  describe('Retry Functionality', () => {
    it('should retry connection', async () => {
      const { result } = renderHook(() => useConnectionState({
        maxRetries: 3
      }));

      await act(async () => {
        await result.current.retry();
      });

      // Verify retry attempt was made
      expect(result.current.status.reconnectAttempts).toBeGreaterThan(0);
    });

    it('should not retry beyond max attempts', async () => {
      const { result } = renderHook(() => useConnectionState({
        maxRetries: 1
      }));

      // First retry
      await act(async () => {
        await result.current.retry();
      });

      // Second retry should be blocked
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await act(async () => {
        await result.current.retry();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Max retry attempts reached');
      consoleSpy.mockRestore();
    });

    it('should auto-retry when enabled', () => {
      jest.useFakeTimers();
      
      const { result } = renderHook(() => useConnectionState({
        autoRetry: true,
        retryInterval: 1000,
        maxRetries: 2
      }));

      // Simulate connection failure
      act(() => {
        result.current.retry();
      });

      // Fast-forward time to trigger auto-retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      jest.useRealTimers();
    });
  });

  describe('Offline Queue Management', () => {
    it('should add actions to offline queue', () => {
      const { result } = renderHook(() => useConnectionState());

      const action = {
        id: 'test-1',
        type: 'send' as const,
        channel: 'test-channel',
        data: { message: 'test' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      act(() => {
        result.current.addToOfflineQueue(action);
      });

      expect(mockConnectionStateManager.addToOfflineQueue).toHaveBeenCalledWith(action);
    });

    it('should clear offline queue', () => {
      const { result } = renderHook(() => useConnectionState());

      act(() => {
        result.current.clearOfflineQueue();
      });

      expect(mockConnectionStateManager.clearOfflineQueue).toHaveBeenCalled();
    });
  });

  describe('Fallback Management', () => {
    it('should enable fallback mechanism', () => {
      const { result } = renderHook(() => useConnectionState());

      const mockFallback = {
        name: 'custom',
        isAvailable: () => true,
        send: jest.fn(),
        subscribe: jest.fn()
      };

      act(() => {
        result.current.enableFallback(mockFallback);
      });

      const activeFallbacks = result.current.getActiveFallbacks();
      expect(activeFallbacks).toContain(mockFallback);
    });

    it('should disable fallback mechanism', () => {
      const { result } = renderHook(() => useConnectionState({
        enableFallbacks: true
      }));

      act(() => {
        result.current.disableFallback('polling');
      });

      const activeFallbacks = result.current.getActiveFallbacks();
      expect(activeFallbacks.find(f => f.name === 'polling')).toBeUndefined();
    });

    it('should not enable unavailable fallback', () => {
      const { result } = renderHook(() => useConnectionState());

      const mockFallback = {
        name: 'unavailable',
        isAvailable: () => false,
        send: jest.fn(),
        subscribe: jest.fn()
      };

      act(() => {
        result.current.enableFallback(mockFallback);
      });

      const activeFallbacks = result.current.getActiveFallbacks();
      expect(activeFallbacks).not.toContain(mockFallback);
    });
  });

  describe('User Feedback', () => {
    it('should provide appropriate status message for offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      mockConnectionStateManager.isOnline = false;

      const { result } = renderHook(() => useConnectionState());

      expect(result.current.getStatusMessage()).toBe(
        'You are offline. Some features may not be available.'
      );
    });

    it('should provide status message for connecting', () => {
      mockWsManager.getConnectionState.mockReturnValue('connecting');

      const { result, rerender } = renderHook(() => useConnectionState());

      act(() => {
        rerender();
      });

      expect(result.current.getStatusMessage()).toBe('Connecting to server...');
    });

    it('should provide status message for connected with latency', () => {
      mockWsManager.isConnected.mockReturnValue(true);
      mockWsManager.getConnectionState.mockReturnValue('connected');
      mockWsManager.getMetrics.mockReturnValue({
        reconnectAttempts: 0,
        messagesReceived: 0,
        messagesSent: 0,
        latency: 50
      });

      const { result, rerender } = renderHook(() => useConnectionState());

      act(() => {
        rerender();
      });

      expect(result.current.getStatusMessage()).toBe('Connected (50ms)');
    });

    it('should provide appropriate status color', () => {
      const { result } = renderHook(() => useConnectionState());

      // Test different states
      expect(result.current.getStatusColor()).toBe('red'); // disconnected

      mockWsManager.isConnected.mockReturnValue(true);
      mockWsManager.getConnectionState.mockReturnValue('connected');

      act(() => {
        result.current.status.connectionState = 'connected';
        result.current.status.isConnected = true;
      });

      expect(result.current.getStatusColor()).toBe('green'); // connected
    });

    it('should determine when to show retry button', () => {
      const { result } = renderHook(() => useConnectionState({
        maxRetries: 3
      }));

      // Should show retry when disconnected and online
      expect(result.current.shouldShowRetryButton()).toBe(true);

      // Should not show when connected
      act(() => {
        result.current.status.isConnected = true;
      });

      expect(result.current.shouldShowRetryButton()).toBe(false);
    });
  });

  describe('Event Subscriptions', () => {
    it('should subscribe to status changes', () => {
      const { result } = renderHook(() => useConnectionState());
      const callback = jest.fn();

      const unsubscribe = result.current.onStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
    });

    it('should subscribe to reconnection events', () => {
      const { result } = renderHook(() => useConnectionState());
      const callback = jest.fn();

      const unsubscribe = result.current.onReconnected(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe to disconnection events', () => {
      const { result } = renderHook(() => useConnectionState());
      const callback = jest.fn();

      const unsubscribe = result.current.onDisconnected(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      jest.useFakeTimers();
      
      const { unmount } = renderHook(() => useConnectionState({
        autoRetry: true,
        retryInterval: 1000
      }));

      unmount();

      // Verify no timers are left running
      expect(jest.getTimerCount()).toBe(0);
      
      jest.useRealTimers();
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useConnectionState());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });
});