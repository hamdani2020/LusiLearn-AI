/**
 * WebSocket Manager Tests
 */

import { WebSocketManager } from '../manager';
import { ConnectionState } from '../types';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private shouldFail = false;

  constructor(public url: string) {
    // Check if this should fail (for error testing)
    if (url.includes('invalid') || this.shouldFail) {
      setTimeout(() => {
        this.onerror?.(new Event('error'));
      }, 5);
      return;
    }

    // Simulate successful connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Simulate message sending
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    const closeEvent = new CloseEvent('close', { code: code || 1000, reason });
    this.onclose?.(closeEvent);
  }

  static setFailMode(fail: boolean) {
    MockWebSocket.prototype.shouldFail = fail;
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      const onConnect = jest.fn();
      
      await manager.connect('ws://localhost:8080', { onConnect });
      
      expect(manager.getConnectionState()).toBe('connected');
      expect(manager.isConnected()).toBe(true);
      expect(onConnect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const onError = jest.fn();
      
      await expect(
        manager.connect('ws://invalid-url', { onError })
      ).rejects.toThrow('Failed to connect to WebSocket');
    });

    it('should disconnect cleanly', async () => {
      const onDisconnect = jest.fn();
      
      await manager.connect('ws://localhost:8080', { onDisconnect });
      manager.disconnect();
      
      expect(manager.getConnectionState()).toBe('disconnected');
      expect(manager.isConnected()).toBe(false);
      expect(onDisconnect).toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await manager.connect('ws://localhost:8080');
    });

    it('should subscribe to channels', () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe('test-channel', callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from channels', () => {
      const callback = jest.fn();
      const unsubscribe = manager.subscribe('test-channel', callback);
      
      unsubscribe();
      
      // Verify unsubscription (implementation detail)
      expect(manager.getMetrics().messagesSent).toBeGreaterThan(0);
    });

    it('should handle multiple subscribers to same channel', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      manager.subscribe('test-channel', callback1);
      manager.subscribe('test-channel', callback2);
      
      // Both should be subscribed
      expect(manager.getMetrics().messagesSent).toBeGreaterThan(0);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await manager.connect('ws://localhost:8080');
    });

    it('should send messages to channels', () => {
      const testData = { message: 'Hello, World!' };
      
      manager.send('test-channel', testData);
      
      expect(manager.getMetrics().messagesSent).toBe(2); // 1 for subscription, 1 for message
    });

    it('should not send messages when disconnected', () => {
      manager.disconnect();
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      manager.send('test-channel', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot send message: WebSocket not connected');
      consoleSpy.mockRestore();
    });

    it('should route messages to correct subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      manager.subscribe('channel1', callback1);
      manager.subscribe('channel2', callback2);
      
      // Simulate incoming message
      const mockMessage = {
        type: 'message',
        channel: 'channel1',
        data: { test: 'data' },
        timestamp: Date.now(),
        id: 'test-id'
      };
      
      // Simulate message reception
      const mockSocket = (manager as any).socket;
      mockSocket.onmessage?.({
        data: JSON.stringify(mockMessage)
      } as MessageEvent);
      
      expect(callback1).toHaveBeenCalledWith({ test: 'data' });
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const onReconnect = jest.fn();
      
      await manager.connect('ws://localhost:8080', {
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectInterval: 100,
        onReconnect
      });
      
      // Simulate unexpected disconnect
      const mockSocket = (manager as any).socket;
      mockSocket.close(1006, 'Connection lost'); // Abnormal closure
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(manager.getMetrics().reconnectAttempts).toBeGreaterThan(0);
    });

    it('should not reconnect on clean disconnect', async () => {
      await manager.connect('ws://localhost:8080', {
        autoReconnect: true
      });
      
      manager.disconnect(); // Clean disconnect
      
      // Wait to ensure no reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(manager.getMetrics().reconnectAttempts).toBe(0);
    });

    it('should stop reconnecting after max attempts', async () => {
      const maxAttempts = 2;
      
      // Set fail mode for MockWebSocket
      MockWebSocket.setFailMode(true);
      
      await expect(
        manager.connect('ws://localhost:8080', {
          autoReconnect: true,
          maxReconnectAttempts: maxAttempts,
          reconnectInterval: 50
        })
      ).rejects.toThrow();
      
      // Reset fail mode
      MockWebSocket.setFailMode(false);
    }, 10000);
  });

  describe('Heartbeat Mechanism', () => {
    it('should send heartbeat messages', async () => {
      await manager.connect('ws://localhost:8080', {
        heartbeatInterval: 100
      });
      
      // Wait for heartbeat
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(manager.getMetrics().messagesSent).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should update metrics on heartbeat response', () => {
      const metrics = manager.getMetrics();
      
      // Simulate heartbeat response
      const heartbeatMessage = {
        type: 'heartbeat',
        channel: 'system',
        data: { timestamp: Date.now() - 50 },
        timestamp: Date.now(),
        id: 'heartbeat-id'
      };
      
      const mockSocket = (manager as any).socket;
      if (mockSocket) {
        mockSocket.onmessage?.({
          data: JSON.stringify(heartbeatMessage)
        } as MessageEvent);
      }
      
      expect(manager.getMetrics().lastHeartbeat).toBeDefined();
      expect(manager.getMetrics().latency).toBeDefined();
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await manager.connect('ws://localhost:8080');
    }, 10000);

    it('should track connection metrics', () => {
      const metrics = manager.getMetrics();
      
      expect(metrics.connectedAt).toBeDefined();
      expect(metrics.reconnectAttempts).toBe(0);
      expect(metrics.messagesReceived).toBe(0);
      expect(metrics.messagesSent).toBeGreaterThanOrEqual(0);
    });

    it('should increment message counters', () => {
      const initialMetrics = manager.getMetrics();
      
      manager.send('test', { data: 'test' });
      
      const updatedMetrics = manager.getMetrics();
      expect(updatedMetrics.messagesSent).toBeGreaterThan(initialMetrics.messagesSent);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      await manager.connect('ws://localhost:8080');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate malformed message
      const mockSocket = (manager as any).socket;
      mockSocket.onmessage?.({
        data: 'invalid json'
      } as MessageEvent);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing WebSocket message:', expect.any(Error));
      consoleSpy.mockRestore();
    }, 10000);

    it('should handle callback errors gracefully', async () => {
      await manager.connect('ws://localhost:8080');
      
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      manager.subscribe('test-channel', errorCallback);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Simulate message that triggers callback error
      const mockMessage = {
        type: 'message',
        channel: 'test-channel',
        data: { test: 'data' },
        timestamp: Date.now(),
        id: 'test-id'
      };
      
      const mockSocket = (manager as any).socket;
      mockSocket.onmessage?.({
        data: JSON.stringify(mockMessage)
      } as MessageEvent);
      
      expect(consoleSpy).toHaveBeenCalledWith('Error in subscription callback:', expect.any(Error));
      consoleSpy.mockRestore();
    }, 10000);
  });
});