/**
 * Connection state management utilities
 * Handles offline/online detection and queue management for offline actions
 */

import { ConnectionState } from './types';

export interface OfflineAction {
  id: string;
  type: 'send' | 'subscribe' | 'unsubscribe';
  channel: string;
  data?: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface ConnectionStateManager {
  isOnline: boolean;
  connectionState: ConnectionState;
  offlineQueue: OfflineAction[];
  addToOfflineQueue(action: OfflineAction): void;
  processOfflineQueue(): Promise<void>;
  clearOfflineQueue(): void;
  getQueueSize(): number;
}

export class ConnectionStateManagerImpl implements ConnectionStateManager {
  public isOnline: boolean = navigator.onLine;
  public connectionState: ConnectionState = 'disconnected';
  public offlineQueue: OfflineAction[] = [];
  
  private listeners = new Set<(state: ConnectionStateManager) => void>();
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor() {
    this.onlineHandler = () => {
      this.isOnline = true;
      this.notifyListeners();
      this.processOfflineQueue();
    };
    
    this.offlineHandler = () => {
      this.isOnline = false;
      this.notifyListeners();
    };

    // Listen for online/offline events
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    
    // Additional connectivity checks
    this.startConnectivityMonitoring();
  }

  addToOfflineQueue(action: OfflineAction): void {
    // Remove duplicate actions for the same channel
    this.offlineQueue = this.offlineQueue.filter(
      existing => !(existing.type === action.type && existing.channel === action.channel)
    );
    
    this.offlineQueue.push(action);
    
    // Limit queue size to prevent memory issues
    if (this.offlineQueue.length > 100) {
      this.offlineQueue = this.offlineQueue.slice(-100);
    }
    
    this.notifyListeners();
  }

  async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.connectionState !== 'connected') {
      return;
    }

    const actionsToProcess = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const action of actionsToProcess) {
      try {
        await this.executeOfflineAction(action);
      } catch (error) {
        console.error('Failed to execute offline action:', error);
        
        // Retry if not exceeded max retries
        if (action.retries < action.maxRetries) {
          action.retries++;
          this.offlineQueue.push(action);
        }
      }
    }
    
    this.notifyListeners();
  }

  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.notifyListeners();
  }

  getQueueSize(): number {
    return this.offlineQueue.length;
  }

  updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.notifyListeners();
    
    if (state === 'connected' && this.isOnline) {
      this.processOfflineQueue();
    }
  }

  subscribe(listener: (state: ConnectionStateManager) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.listeners.clear();
  }

  private async executeOfflineAction(action: OfflineAction): Promise<void> {
    // This would be implemented by the WebSocket manager
    // For now, we'll just simulate the action
    return new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this);
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
  }

  private startConnectivityMonitoring(): void {
    // Additional connectivity check using fetch
    setInterval(async () => {
      if (this.isOnline) {
        try {
          const response = await fetch('/api/health', {
            method: 'HEAD',
            cache: 'no-cache'
          });
          
          if (!response.ok) {
            this.isOnline = false;
            this.notifyListeners();
          }
        } catch {
          this.isOnline = false;
          this.notifyListeners();
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

// Fallback mechanisms when WebSocket connection fails
export interface FallbackMechanism {
  name: string;
  isAvailable(): boolean;
  send(channel: string, data: any): Promise<void>;
  subscribe(channel: string, callback: (data: any) => void): () => void;
}

export class PollingFallback implements FallbackMechanism {
  name = 'polling';
  private intervals = new Map<string, NodeJS.Timeout>();
  private subscriptions = new Map<string, Set<(data: any) => void>>();

  isAvailable(): boolean {
    return true; // Polling is always available
  }

  async send(channel: string, data: any): Promise<void> {
    try {
      const response = await fetch(`/api/realtime/${channel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Polling fallback send failed:', error);
      throw error;
    }
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.startPolling(channel);
    }
    
    this.subscriptions.get(channel)!.add(callback);
    
    return () => {
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        channelSubscriptions.delete(callback);
        if (channelSubscriptions.size === 0) {
          this.stopPolling(channel);
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  private startPolling(channel: string): void {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/realtime/${channel}`, {
          method: 'GET',
          cache: 'no-cache',
        });
        
        if (response.ok) {
          const data = await response.json();
          const callbacks = this.subscriptions.get(channel);
          if (callbacks && data) {
            callbacks.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error('Error in polling callback:', error);
              }
            });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
    
    this.intervals.set(channel, interval);
  }

  private stopPolling(channel: string): void {
    const interval = this.intervals.get(channel);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(channel);
    }
  }
}

export class ServerSentEventsFallback implements FallbackMechanism {
  name = 'sse';
  private eventSources = new Map<string, EventSource>();
  private subscriptions = new Map<string, Set<(data: any) => void>>();

  isAvailable(): boolean {
    return typeof EventSource !== 'undefined';
  }

  async send(channel: string, data: any): Promise<void> {
    // SSE is unidirectional, so we use regular HTTP POST for sending
    try {
      const response = await fetch(`/api/realtime/${channel}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('SSE fallback send failed:', error);
      throw error;
    }
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.createEventSource(channel);
    }
    
    this.subscriptions.get(channel)!.add(callback);
    
    return () => {
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        channelSubscriptions.delete(callback);
        if (channelSubscriptions.size === 0) {
          this.closeEventSource(channel);
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  private createEventSource(channel: string): void {
    const eventSource = new EventSource(`/api/realtime/${channel}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const callbacks = this.subscriptions.get(channel);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('Error in SSE callback:', error);
            }
          });
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };
    
    this.eventSources.set(channel, eventSource);
  }

  private closeEventSource(channel: string): void {
    const eventSource = this.eventSources.get(channel);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(channel);
    }
  }
}

// Singleton instance
let connectionStateManager: ConnectionStateManagerImpl | null = null;

export function getConnectionStateManager(): ConnectionStateManagerImpl {
  if (!connectionStateManager) {
    connectionStateManager = new ConnectionStateManagerImpl();
  }
  return connectionStateManager;
}