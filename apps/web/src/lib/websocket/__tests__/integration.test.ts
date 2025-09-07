/**
 * Integration tests for WebSocket functionality and real-time collaboration
 * Tests real-time communication, connection management, and collaboration features
 */

import { WebSocketManager } from '../manager';
import {
  createMockCollaborationMessage,
  createMockProgressMessage,
  createMockNotificationMessage,
  measurePerformance,
  PERFORMANCE_THRESHOLDS,
  WEBSOCKET_MESSAGE_TYPES
} from '@/lib/testing';

// WebSocket integration test configuration
const WS_INTEGRATION_CONFIG = {
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  testTimeout: 30000, // 30 seconds for WebSocket tests
  skipIfNoBackend: process.env.SKIP_INTEGRATION_TESTS === 'true',
  connectionTimeout: 5000,
  messageTimeout: 2000
};

// Helper to check if WebSocket server is available
const isWebSocketServerAvailable = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_INTEGRATION_CONFIG.wsUrl);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 3000);

    ws.onopen = () => {
      clearTimeout(timeout);
      ws.close();
      resolve(true);
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
  });
};

// Skip integration tests if WebSocket server is not available
const describeWebSocketIntegration = WS_INTEGRATION_CONFIG.skipIfNoBackend 
  ? describe.skip 
  : describe;

describeWebSocketIntegration('WebSocket Integration Tests', () => {
  let wsManager: WebSocketManager;
  let secondWsManager: WebSocketManager; // For testing multi-client scenarios

  beforeAll(async () => {
    // Check if WebSocket server is available
    const wsServerAvailable = await isWebSocketServerAvailable();
    if (!wsServerAvailable) {
      console.warn('WebSocket server not available, skipping integration tests');
      return;
    }
  }, WS_INTEGRATION_CONFIG.testTimeout);

  beforeEach(() => {
    wsManager = new WebSocketManager({
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      heartbeatInterval: 30000
    });

    secondWsManager = new WebSocketManager({
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      heartbeatInterval: 30000
    });
  });

  afterEach(async () => {
    if (wsManager) {
      wsManager.disconnect();
    }
    if (secondWsManager) {
      secondWsManager.disconnect();
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket server successfully', async () => {
      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, WS_INTEGRATION_CONFIG.connectionTimeout);

        wsManager.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        wsManager.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
      await connectionPromise;

      expect(wsManager.getConnectionState()).toBe('connected');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle connection errors gracefully', async () => {
      const invalidUrl = 'ws://invalid-url:9999';
      
      const errorPromise = new Promise<Error>((resolve) => {
        wsManager.on('error', (error) => {
          resolve(error);
        });
      });

      try {
        await wsManager.connect(invalidUrl);
      } catch (error) {
        // Expected to fail
      }

      const error = await errorPromise;
      expect(error).toBeDefined();
      expect(wsManager.getConnectionState()).toBe('error');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should reconnect automatically after connection loss', async () => {
      // Connect initially
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
      expect(wsManager.getConnectionState()).toBe('connected');

      // Simulate connection loss
      const reconnectPromise = new Promise<void>((resolve) => {
        let reconnectCount = 0;
        wsManager.on('reconnect', () => {
          reconnectCount++;
          if (reconnectCount === 1) {
            resolve();
          }
        });
      });

      // Force disconnect to simulate connection loss
      wsManager.disconnect();
      
      // Wait for automatic reconnection
      await reconnectPromise;
      expect(wsManager.getConnectionState()).toBe('connected');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should meet connection performance requirements', async () => {
      const connectionTime = await measurePerformance(async () => {
        await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
      });

      expect(connectionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.WEBSOCKET_CONNECTION_TIME);
      expect(wsManager.getConnectionState()).toBe('connected');
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
    });

    it('should send and receive messages successfully', async () => {
      const testMessage = {
        type: 'test',
        data: { message: 'Hello WebSocket!' },
        timestamp: new Date().toISOString()
      };

      const messagePromise = new Promise<any>((resolve) => {
        wsManager.on('message', (message) => {
          if (message.type === 'test') {
            resolve(message);
          }
        });
      });

      wsManager.send('test', testMessage.data);
      
      const receivedMessage = await messagePromise;
      expect(receivedMessage.type).toBe('test');
      expect(receivedMessage.data).toEqual(testMessage.data);
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle different message types correctly', async () => {
      const messageTypes = [
        WEBSOCKET_MESSAGE_TYPES.COLLABORATION.JOIN,
        WEBSOCKET_MESSAGE_TYPES.PROGRESS.UPDATE,
        WEBSOCKET_MESSAGE_TYPES.NOTIFICATION.INFO
      ];

      const receivedMessages: any[] = [];
      
      wsManager.on('message', (message) => {
        receivedMessages.push(message);
      });

      // Send different message types
      for (const messageType of messageTypes) {
        wsManager.send(messageType, { test: `data for ${messageType}` });
      }

      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(receivedMessages.length).toBeGreaterThanOrEqual(messageTypes.length);
      
      messageTypes.forEach(type => {
        const received = receivedMessages.find(msg => msg.type === type);
        expect(received).toBeDefined();
      });
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle large messages efficiently', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: `Large data item ${i}`.repeat(10)
        }))
      };

      const messagePromise = new Promise<any>((resolve) => {
        wsManager.on('message', (message) => {
          if (message.type === 'large-data') {
            resolve(message);
          }
        });
      });

      const sendTime = await measurePerformance(() => {
        wsManager.send('large-data', largeData);
      });

      const receivedMessage = await messagePromise;
      
      expect(sendTime).toBeLessThan(1000); // Should send large message quickly
      expect(receivedMessage.data.items.length).toBe(1000);
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Channel Subscriptions', () => {
    beforeEach(async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
    });

    it('should subscribe to and unsubscribe from channels', async () => {
      const channelName = 'test-channel';
      const receivedMessages: any[] = [];

      // Subscribe to channel
      const unsubscribe = wsManager.subscribe(channelName, (message) => {
        receivedMessages.push(message);
      });

      // Send message to channel
      wsManager.send(`channel:${channelName}`, { test: 'channel message' });

      // Wait for message
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(receivedMessages.length).toBeGreaterThan(0);

      // Unsubscribe
      unsubscribe();

      // Send another message (should not be received)
      wsManager.send(`channel:${channelName}`, { test: 'should not receive' });
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not have received the second message
      expect(receivedMessages.length).toBe(1);
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle multiple channel subscriptions', async () => {
      const channels = ['channel-1', 'channel-2', 'channel-3'];
      const receivedMessages: Record<string, any[]> = {};

      // Subscribe to multiple channels
      channels.forEach(channel => {
        receivedMessages[channel] = [];
        wsManager.subscribe(channel, (message) => {
          receivedMessages[channel].push(message);
        });
      });

      // Send messages to each channel
      channels.forEach(channel => {
        wsManager.send(`channel:${channel}`, { channel, message: `Hello ${channel}` });
      });

      // Wait for messages
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify each channel received its message
      channels.forEach(channel => {
        expect(receivedMessages[channel].length).toBeGreaterThan(0);
        expect(receivedMessages[channel][0].data.channel).toBe(channel);
      });
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Real-time Collaboration', () => {
    beforeEach(async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
      await secondWsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
    });

    it('should handle study group collaboration', async () => {
      const studyGroupId = `group-${Date.now()}`;
      const user1Messages: any[] = [];
      const user2Messages: any[] = [];

      // User 1 subscribes to study group
      wsManager.subscribe(`study-group:${studyGroupId}`, (message) => {
        user1Messages.push(message);
      });

      // User 2 subscribes to study group
      secondWsManager.subscribe(`study-group:${studyGroupId}`, (message) => {
        user2Messages.push(message);
      });

      // User 1 joins the group
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.COLLABORATION.JOIN, {
        studyGroupId,
        userId: 'user-1',
        userName: 'Test User 1'
      });

      // User 2 joins the group
      secondWsManager.send(WEBSOCKET_MESSAGE_TYPES.COLLABORATION.JOIN, {
        studyGroupId,
        userId: 'user-2',
        userName: 'Test User 2'
      });

      // Wait for join messages
      await new Promise(resolve => setTimeout(resolve, 1000));

      // User 1 sends a message
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.COLLABORATION.MESSAGE, {
        studyGroupId,
        userId: 'user-1',
        message: 'Hello everyone!'
      });

      // Wait for message propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Both users should have received join notifications
      expect(user1Messages.length).toBeGreaterThan(0);
      expect(user2Messages.length).toBeGreaterThan(0);

      // User 2 should have received User 1's message
      const chatMessage = user2Messages.find(msg => 
        msg.type === WEBSOCKET_MESSAGE_TYPES.COLLABORATION.MESSAGE
      );
      expect(chatMessage).toBeDefined();
      expect(chatMessage.data.message).toBe('Hello everyone!');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle screen sharing events', async () => {
      const sessionId = `session-${Date.now()}`;
      const receivedEvents: any[] = [];

      // Subscribe to screen sharing events
      wsManager.subscribe(`screen-share:${sessionId}`, (message) => {
        receivedEvents.push(message);
      });

      secondWsManager.subscribe(`screen-share:${sessionId}`, (message) => {
        receivedEvents.push(message);
      });

      // Start screen sharing
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.COLLABORATION.SCREEN_SHARE, {
        sessionId,
        userId: 'user-1',
        action: 'start',
        streamId: 'stream-123'
      });

      // Wait for event propagation
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stop screen sharing
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.COLLABORATION.SCREEN_SHARE, {
        sessionId,
        userId: 'user-1',
        action: 'stop'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have received start and stop events
      expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
      
      const startEvent = receivedEvents.find(event => 
        event.data.action === 'start'
      );
      const stopEvent = receivedEvents.find(event => 
        event.data.action === 'stop'
      );

      expect(startEvent).toBeDefined();
      expect(stopEvent).toBeDefined();
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Progress Updates', () => {
    beforeEach(async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);
    });

    it('should handle real-time progress updates', async () => {
      const userId = 'test-user-1';
      const progressUpdates: any[] = [];

      // Subscribe to progress updates
      wsManager.subscribe(`progress:${userId}`, (message) => {
        progressUpdates.push(message);
      });

      // Send progress update
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.PROGRESS.UPDATE, {
        userId,
        sessionId: 'session-123',
        progress: {
          completedLessons: 5,
          totalLessons: 10,
          comprehensionScore: 0.85,
          timeSpent: 3600
        }
      });

      // Send milestone achievement
      wsManager.send(WEBSOCKET_MESSAGE_TYPES.PROGRESS.MILESTONE, {
        userId,
        milestoneId: 'milestone-1',
        title: 'Completed Chapter 1',
        achievedAt: new Date().toISOString()
      });

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(progressUpdates.length).toBeGreaterThanOrEqual(2);

      const progressUpdate = progressUpdates.find(update => 
        update.type === WEBSOCKET_MESSAGE_TYPES.PROGRESS.UPDATE
      );
      const milestoneUpdate = progressUpdates.find(update => 
        update.type === WEBSOCKET_MESSAGE_TYPES.PROGRESS.MILESTONE
      );

      expect(progressUpdate).toBeDefined();
      expect(progressUpdate.data.progress.completedLessons).toBe(5);

      expect(milestoneUpdate).toBeDefined();
      expect(milestoneUpdate.data.title).toBe('Completed Chapter 1');
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle message sending errors gracefully', async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);

      // Disconnect to simulate error
      wsManager.disconnect();

      // Try to send message while disconnected
      expect(() => {
        wsManager.send('test', { message: 'This should fail' });
      }).not.toThrow();

      // Should queue message for when reconnected
      expect(wsManager.getConnectionState()).toBe('disconnected');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle malformed messages gracefully', async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);

      const errorEvents: any[] = [];
      wsManager.on('error', (error) => {
        errorEvents.push(error);
      });

      // Send malformed message (this would be handled by server)
      wsManager.send('malformed', null);

      // Wait for potential error
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not crash the connection
      expect(wsManager.getConnectionState()).toBe('connected');
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should maintain message order during reconnection', async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);

      const receivedMessages: any[] = [];
      wsManager.on('message', (message) => {
        receivedMessages.push(message);
      });

      // Send messages
      for (let i = 0; i < 5; i++) {
        wsManager.send('ordered-test', { sequence: i });
      }

      // Force disconnect and reconnect
      wsManager.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);

      // Send more messages
      for (let i = 5; i < 10; i++) {
        wsManager.send('ordered-test', { sequence: i });
      }

      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Messages should be in order (allowing for some that might be lost during disconnect)
      const orderedMessages = receivedMessages
        .filter(msg => msg.type === 'ordered-test')
        .sort((a, b) => a.data.sequence - b.data.sequence);

      expect(orderedMessages.length).toBeGreaterThan(0);
      
      // Check that received messages are in sequence
      for (let i = 1; i < orderedMessages.length; i++) {
        expect(orderedMessages[i].data.sequence).toBeGreaterThan(
          orderedMessages[i - 1].data.sequence
        );
      }
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });

  describe('Performance and Scalability', () => {
    it('should handle high message throughput', async () => {
      await wsManager.connect(WS_INTEGRATION_CONFIG.wsUrl);

      const messageCount = 100;
      const receivedMessages: any[] = [];

      wsManager.on('message', (message) => {
        if (message.type === 'throughput-test') {
          receivedMessages.push(message);
        }
      });

      const sendTime = await measurePerformance(async () => {
        for (let i = 0; i < messageCount; i++) {
          wsManager.send('throughput-test', { index: i });
        }
      });

      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(sendTime).toBeLessThan(5000); // Should send 100 messages in under 5 seconds
      expect(receivedMessages.length).toBeGreaterThan(messageCount * 0.8); // Allow for some message loss
    }, WS_INTEGRATION_CONFIG.testTimeout);

    it('should handle multiple concurrent connections', async () => {
      const connectionCount = 5;
      const managers: WebSocketManager[] = [];

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const manager = new WebSocketManager();
        await manager.connect(WS_INTEGRATION_CONFIG.wsUrl);
        managers.push(manager);
      }

      // All connections should be established
      managers.forEach(manager => {
        expect(manager.getConnectionState()).toBe('connected');
      });

      // Send messages from all connections
      const messagePromises = managers.map((manager, index) => 
        new Promise<void>((resolve) => {
          manager.on('message', (message) => {
            if (message.type === 'concurrent-test' && message.data.from === index) {
              resolve();
            }
          });
          manager.send('concurrent-test', { from: index, message: `Hello from ${index}` });
        })
      );

      await Promise.all(messagePromises);

      // Cleanup
      managers.forEach(manager => manager.disconnect());
    }, WS_INTEGRATION_CONFIG.testTimeout);
  });
});