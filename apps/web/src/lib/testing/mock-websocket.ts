/**
 * WebSocket mocking utilities for testing real-time features
 * Provides mock WebSocket implementation for testing collaboration features
 */

export interface MockWebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  id: string;
}

export interface MockWebSocketOptions {
  url?: string;
  protocols?: string | string[];
  autoConnect?: boolean;
  connectionDelay?: number;
}

export class MockWebSocket {
  public static CONNECTING = 0;
  public static OPEN = 1;
  public static CLOSING = 2;
  public static CLOSED = 3;

  public url: string;
  public protocols: string | string[] | undefined;
  public readyState: number = MockWebSocket.CONNECTING;
  public bufferedAmount: number = 0;
  public extensions: string = '';
  public protocol: string = '';
  public binaryType: 'blob' | 'arraybuffer' = 'blob';

  // Event handlers
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private messageQueue: MockWebSocketMessage[] = [];
  private connectionDelay: number;
  private isConnected: boolean = false;

  constructor(url: string, protocols?: string | string[], options: MockWebSocketOptions = {}) {
    this.url = url;
    this.protocols = protocols;
    this.connectionDelay = options.connectionDelay || 100;

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  private connect(): void {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.isConnected = true;
      
      if (this.onopen) {
        this.onopen(new Event('open'));
      }

      // Process any queued messages
      this.processMessageQueue();
    }, this.connectionDelay);
  }

  public send(data: string | ArrayBuffer | Blob): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    // Simulate sending data (in real implementation, this would send to server)
    console.log('MockWebSocket sending:', data);
  }

  public close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED || this.readyState === MockWebSocket.CLOSING) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;
    
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.isConnected = false;
      
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
      }
    }, 10);
  }

  // Test utilities
  public simulateMessage(message: MockWebSocketMessage): void {
    if (this.readyState === MockWebSocket.OPEN) {
      this.deliverMessage(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  public simulateError(error?: string): void {
    if (this.onerror) {
      const errorEvent = new Event('error');
      (errorEvent as any).message = error || 'WebSocket error';
      this.onerror(errorEvent);
    }
  }

  public simulateClose(code = 1000, reason = ''): void {
    this.close(code, reason);
  }

  private deliverMessage(message: MockWebSocketMessage): void {
    if (this.onmessage) {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(message),
        origin: this.url,
        lastEventId: message.id,
        source: null,
        ports: []
      });
      this.onmessage(messageEvent);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.deliverMessage(message);
      }
    }
  }

  // Static methods for global WebSocket mocking
  public static mockGlobalWebSocket(): void {
    (global as any).WebSocket = MockWebSocket;
  }

  public static restoreGlobalWebSocket(): void {
    delete (global as any).WebSocket;
  }
}

// WebSocket server mock for testing
export class MockWebSocketServer {
  private connections: MockWebSocket[] = [];
  private messageHandlers: Map<string, (message: any, connection: MockWebSocket) => void> = new Map();

  public addConnection(connection: MockWebSocket): void {
    this.connections.push(connection);
  }

  public removeConnection(connection: MockWebSocket): void {
    const index = this.connections.indexOf(connection);
    if (index > -1) {
      this.connections.splice(index, 1);
    }
  }

  public broadcast(message: MockWebSocketMessage): void {
    this.connections.forEach(connection => {
      connection.simulateMessage(message);
    });
  }

  public sendToConnection(connectionIndex: number, message: MockWebSocketMessage): void {
    const connection = this.connections[connectionIndex];
    if (connection) {
      connection.simulateMessage(message);
    }
  }

  public onMessage(type: string, handler: (message: any, connection: MockWebSocket) => void): void {
    this.messageHandlers.set(type, handler);
  }

  public simulateServerMessage(type: string, data: any): void {
    const message: MockWebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      id: `server-msg-${Date.now()}-${Math.random()}`
    };

    this.broadcast(message);
  }

  public getConnectionCount(): number {
    return this.connections.length;
  }

  public clear(): void {
    this.connections.forEach(connection => connection.close());
    this.connections = [];
    this.messageHandlers.clear();
  }
}

// Helper functions for creating mock messages
export const createMockCollaborationMessage = (type: 'join' | 'leave' | 'message' | 'screen-share', data: any): MockWebSocketMessage => ({
  type: `collaboration:${type}`,
  data,
  timestamp: new Date().toISOString(),
  id: `collab-${Date.now()}-${Math.random()}`
});

export const createMockProgressMessage = (type: 'update' | 'milestone' | 'achievement', data: any): MockWebSocketMessage => ({
  type: `progress:${type}`,
  data,
  timestamp: new Date().toISOString(),
  id: `progress-${Date.now()}-${Math.random()}`
});

export const createMockNotificationMessage = (type: 'info' | 'warning' | 'error', data: any): MockWebSocketMessage => ({
  type: `notification:${type}`,
  data,
  timestamp: new Date().toISOString(),
  id: `notification-${Date.now()}-${Math.random()}`
});

// WebSocket testing utilities
export const createWebSocketTestSuite = () => {
  let mockServer: MockWebSocketServer;
  let originalWebSocket: any;

  const setup = () => {
    mockServer = new MockWebSocketServer();
    originalWebSocket = (global as any).WebSocket;
    MockWebSocket.mockGlobalWebSocket();
  };

  const teardown = () => {
    mockServer?.clear();
    if (originalWebSocket) {
      (global as any).WebSocket = originalWebSocket;
    } else {
      MockWebSocket.restoreGlobalWebSocket();
    }
  };

  const getServer = () => mockServer;

  return {
    setup,
    teardown,
    getServer
  };
};

// Connection state testing helpers
export const simulateConnectionStates = (connection: MockWebSocket) => {
  return {
    connect: () => {
      if (connection.onopen) {
        connection.onopen(new Event('open'));
      }
    },
    disconnect: () => {
      connection.simulateClose();
    },
    error: (message?: string) => {
      connection.simulateError(message);
    },
    reconnect: () => {
      connection.simulateClose();
      setTimeout(() => {
        if (connection.onopen) {
          connection.onopen(new Event('open'));
        }
      }, 100);
    }
  };
};