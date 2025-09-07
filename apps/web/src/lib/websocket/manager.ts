/**
 * WebSocket Manager for real-time communication
 * Handles connection lifecycle, automatic reconnection, and channel subscriptions
 */

import { 
  WebSocketManager as IWebSocketManager,
  WSOptions, 
  ConnectionState, 
  ConnectionMetrics, 
  WSMessage,
  WSSubscription,
  WSEvent
} from './types';

export class WebSocketManager implements IWebSocketManager {
  private socket: WebSocket | null = null;
  private url: string = '';
  private options: WSOptions = {};
  private connectionState: ConnectionState = 'disconnected';
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metrics: ConnectionMetrics = {
    reconnectAttempts: 0,
    messagesReceived: 0,
    messagesSent: 0
  };

  constructor() {
    // Bind methods to preserve context
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  async connect(url: string, options: WSOptions = {}): Promise<void> {
    this.url = url;
    this.options = {
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...options
    };

    return new Promise((resolve, reject) => {
      try {
        this.connectionState = 'connecting';
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          this.handleOpen();
          resolve();
        };
        
        this.socket.onclose = this.handleClose;
        this.socket.onerror = (event) => {
          this.handleError(new Error('WebSocket connection error'));
          reject(new Error('Failed to connect to WebSocket'));
        };
        this.socket.onmessage = this.handleMessage;

        // Set connection timeout
        setTimeout(() => {
          if (this.connectionState === 'connecting') {
            this.socket?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.connectionState = 'error';
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.clearTimers();
    this.connectionState = 'disconnected';
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.metrics.disconnectedAt = new Date();
    this.options.onDisconnect?.();
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(callback);
    
    // Send subscription message to server
    if (this.isConnected()) {
      this.sendMessage({
        type: 'subscribe',
        channel,
        data: {},
        timestamp: Date.now(),
        id: this.generateMessageId()
      });
    }

    // Return unsubscribe function
    return () => {
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        channelSubscriptions.delete(callback);
        if (channelSubscriptions.size === 0) {
          this.subscriptions.delete(channel);
          
          // Send unsubscribe message to server
          if (this.isConnected()) {
            this.sendMessage({
              type: 'unsubscribe',
              channel,
              data: {},
              timestamp: Date.now(),
              id: this.generateMessageId()
            });
          }
        }
      }
    };
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    
    if (this.isConnected()) {
      this.sendMessage({
        type: 'unsubscribe',
        channel,
        data: {},
        timestamp: Date.now(),
        id: this.generateMessageId()
      });
    }
  }

  send(channel: string, data: any): void {
    if (!this.isConnected()) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }

    const message: WSMessage = {
      type: 'message',
      channel,
      data,
      timestamp: Date.now(),
      id: this.generateMessageId()
    };

    this.sendMessage(message);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private handleOpen(): void {
    this.connectionState = 'connected';
    this.metrics.connectedAt = new Date();
    this.metrics.reconnectAttempts = 0;
    
    this.startHeartbeat();
    this.resubscribeToChannels();
    
    this.options.onConnect?.();
  }

  private handleClose(event: CloseEvent): void {
    this.connectionState = 'disconnected';
    this.metrics.disconnectedAt = new Date();
    this.clearTimers();
    
    this.options.onDisconnect?.();
    
    // Attempt reconnection if enabled and not a clean close
    if (this.options.autoReconnect && event.code !== 1000) {
      this.attemptReconnection();
    }
  }

  private handleError(error: Error): void {
    this.connectionState = 'error';
    this.options.onError?.(error);
    console.error('WebSocket error:', error);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      this.metrics.messagesReceived++;
      
      if (message.type === 'heartbeat') {
        this.handleHeartbeat(message);
        return;
      }
      
      // Route message to appropriate channel subscribers
      const channelSubscriptions = this.subscriptions.get(message.channel);
      if (channelSubscriptions) {
        channelSubscriptions.forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private sendMessage(message: WSMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      this.metrics.messagesSent++;
    }
  }

  private attemptReconnection(): void {
    if (this.metrics.reconnectAttempts >= (this.options.maxReconnectAttempts || 5)) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.connectionState = 'reconnecting';
    this.metrics.reconnectAttempts++;
    
    const delay = this.calculateReconnectDelay();
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        this.options.onReconnect?.(this.metrics.reconnectAttempts);
        await this.connect(this.url, this.options);
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnection();
      }
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const baseDelay = this.options.reconnectInterval || 1000;
    const exponentialDelay = baseDelay * Math.pow(2, this.metrics.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  private startHeartbeat(): void {
    if (!this.options.heartbeatInterval) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage({
          type: 'heartbeat',
          channel: 'system',
          data: { timestamp: Date.now() },
          timestamp: Date.now(),
          id: this.generateMessageId()
        });
      }
    }, this.options.heartbeatInterval);
  }

  private handleHeartbeat(message: WSMessage): void {
    this.metrics.lastHeartbeat = new Date();
    
    // Calculate latency if timestamp is provided
    if (message.data?.timestamp) {
      this.metrics.latency = Date.now() - message.data.timestamp;
    }
  }

  private resubscribeToChannels(): void {
    // Re-subscribe to all channels after reconnection
    for (const channel of this.subscriptions.keys()) {
      this.sendMessage({
        type: 'subscribe',
        channel,
        data: {},
        timestamp: Date.now(),
        id: this.generateMessageId()
      });
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}

export function createWebSocketManager(): WebSocketManager {
  return new WebSocketManager();
}