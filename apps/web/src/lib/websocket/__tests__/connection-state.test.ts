/**
 * Connection State Manager Tests
 */

import { 
  ConnectionStateManagerImpl, 
  PollingFallback, 
  ServerSentEventsFallback,
  OfflineAction 
} from '../connection-state';

// Mock fetch
global.fetch = jest.fn();

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  constructor(public url: string) {
    // Simulate connection
  }
  
  close(): void {
    // Mock close
  }
}

(global as any).EventSource = MockEventSource;

describe('ConnectionStateManagerImpl', () => {
  let manager: ConnectionStateManagerImpl;

  beforeEach(() => {
    manager = new ConnectionStateManagerImpl();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Online/Offline Detection', () => {
    it('should initialize with current online state', () => {
      expect(manager.isOnline).toBe(navigator.onLine);
    });

    it('should update state when going offline', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));

      expect(manager.isOnline).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it('should update state when going online', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      // Start offline
      manager.isOnline = false;

      // Simulate going online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      window.dispatchEvent(new Event('online'));

      expect(manager.isOnline).toBe(true);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Offline Queue Management', () => {
    it('should add actions to offline queue', () => {
      const action: OfflineAction = {
        id: 'test-1',
        type: 'send',
        channel: 'test-channel',
        data: { message: 'test' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      manager.addToOfflineQueue(action);

      expect(manager.getQueueSize()).toBe(1);
      expect(manager.offlineQueue).toContain(action);
    });

    it('should remove duplicate actions', () => {
      const action1: OfflineAction = {
        id: 'test-1',
        type: 'send',
        channel: 'test-channel',
        data: { message: 'test1' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      const action2: OfflineAction = {
        id: 'test-2',
        type: 'send',
        channel: 'test-channel',
        data: { message: 'test2' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      manager.addToOfflineQueue(action1);
      manager.addToOfflineQueue(action2);

      expect(manager.getQueueSize()).toBe(1);
      expect(manager.offlineQueue[0]).toBe(action2);
    });

    it('should limit queue size', () => {
      // Add more than 100 actions
      for (let i = 0; i < 150; i++) {
        const action: OfflineAction = {
          id: `test-${i}`,
          type: 'send',
          channel: `channel-${i}`,
          data: { message: `test${i}` },
          timestamp: Date.now(),
          retries: 0,
          maxRetries: 3
        };
        manager.addToOfflineQueue(action);
      }

      expect(manager.getQueueSize()).toBe(100);
    });

    it('should clear offline queue', () => {
      const action: OfflineAction = {
        id: 'test-1',
        type: 'send',
        channel: 'test-channel',
        data: { message: 'test' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      manager.addToOfflineQueue(action);
      manager.clearOfflineQueue();

      expect(manager.getQueueSize()).toBe(0);
    });
  });

  describe('Connection State Updates', () => {
    it('should update connection state', () => {
      const listener = jest.fn();
      manager.subscribe(listener);

      manager.updateConnectionState('connected');

      expect(manager.connectionState).toBe('connected');
      expect(listener).toHaveBeenCalled();
    });

    it('should process offline queue when connected and online', async () => {
      const action: OfflineAction = {
        id: 'test-1',
        type: 'send',
        channel: 'test-channel',
        data: { message: 'test' },
        timestamp: Date.now(),
        retries: 0,
        maxRetries: 3
      };

      manager.addToOfflineQueue(action);
      manager.isOnline = true;
      manager.updateConnectionState('connected');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.getQueueSize()).toBe(0);
    });
  });

  describe('Subscription Management', () => {
    it('should add and remove listeners', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.updateConnectionState('connected');
      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      unsubscribe();

      manager.updateConnectionState('disconnected');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      manager.subscribe(errorListener);

      manager.updateConnectionState('connected');

      expect(consoleSpy).toHaveBeenCalledWith('Error in connection state listener:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});

describe('PollingFallback', () => {
  let fallback: PollingFallback;

  beforeEach(() => {
    fallback = new PollingFallback();
    (fetch as jest.Mock).mockClear();
  });

  it('should be available', () => {
    expect(fallback.isAvailable()).toBe(true);
  });

  it('should send messages via HTTP POST', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    await fallback.send('test-channel', { message: 'test' });

    expect(fetch).toHaveBeenCalledWith('/api/realtime/test-channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'test' }),
    });
  });

  it('should handle send errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(fallback.send('test-channel', { message: 'test' }))
      .rejects.toThrow('HTTP 500: Internal Server Error');
  });

  it('should subscribe to channels with polling', () => {
    const callback = jest.fn();
    
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' })
    });

    const unsubscribe = fallback.subscribe('test-channel', callback);

    expect(typeof unsubscribe).toBe('function');
    
    // Clean up
    unsubscribe();
  });

  it('should unsubscribe and stop polling', () => {
    const callback = jest.fn();
    const unsubscribe = fallback.subscribe('test-channel', callback);

    unsubscribe();

    // Verify polling stopped (implementation detail)
    expect((fallback as any).intervals.size).toBe(0);
  });
});

describe('ServerSentEventsFallback', () => {
  let fallback: ServerSentEventsFallback;

  beforeEach(() => {
    fallback = new ServerSentEventsFallback();
    (fetch as jest.Mock).mockClear();
  });

  it('should be available when EventSource exists', () => {
    expect(fallback.isAvailable()).toBe(true);
  });

  it('should not be available when EventSource is undefined', () => {
    const originalEventSource = (global as any).EventSource;
    delete (global as any).EventSource;

    const newFallback = new ServerSentEventsFallback();
    expect(newFallback.isAvailable()).toBe(false);

    (global as any).EventSource = originalEventSource;
  });

  it('should send messages via HTTP POST', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    await fallback.send('test-channel', { message: 'test' });

    expect(fetch).toHaveBeenCalledWith('/api/realtime/test-channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'test' }),
    });
  });

  it('should subscribe using EventSource', () => {
    const callback = jest.fn();
    const unsubscribe = fallback.subscribe('test-channel', callback);

    expect(typeof unsubscribe).toBe('function');
    
    // Verify EventSource was created
    expect((fallback as any).eventSources.has('test-channel')).toBe(true);
    
    // Clean up
    unsubscribe();
  });

  it('should handle EventSource messages', () => {
    const callback = jest.fn();
    fallback.subscribe('test-channel', callback);

    const eventSource = (fallback as any).eventSources.get('test-channel');
    
    // Simulate message
    const messageEvent = {
      data: JSON.stringify({ message: 'test' })
    };
    
    eventSource.onmessage(messageEvent);

    expect(callback).toHaveBeenCalledWith({ message: 'test' });
  });

  it('should handle malformed EventSource messages', () => {
    const callback = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    fallback.subscribe('test-channel', callback);

    const eventSource = (fallback as any).eventSources.get('test-channel');
    
    // Simulate malformed message
    const messageEvent = {
      data: 'invalid json'
    };
    
    eventSource.onmessage(messageEvent);

    expect(callback).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Error parsing SSE data:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should close EventSource on unsubscribe', () => {
    const callback = jest.fn();
    const unsubscribe = fallback.subscribe('test-channel', callback);

    const eventSource = (fallback as any).eventSources.get('test-channel');
    const closeSpy = jest.spyOn(eventSource, 'close');

    unsubscribe();

    expect(closeSpy).toHaveBeenCalled();
    expect((fallback as any).eventSources.has('test-channel')).toBe(false);
  });
});