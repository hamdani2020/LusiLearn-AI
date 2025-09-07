/**
 * Connection State Hook
 * Provides connection status tracking, user feedback, and offline queue management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getConnectionStateManager, 
  getWebSocketManager,
  PollingFallback,
  ServerSentEventsFallback,
  FallbackMechanism,
  OfflineAction
} from '@/lib/websocket';
import { ConnectionState } from '@/lib/websocket/types';

export interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  connectionState: ConnectionState;
  isReconnecting: boolean;
  offlineQueueSize: number;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  latency?: number;
}

export interface UseConnectionStateOptions {
  enableFallbacks?: boolean;
  fallbackMechanisms?: FallbackMechanism[];
  showUserFeedback?: boolean;
  autoRetry?: boolean;
  retryInterval?: number;
  maxRetries?: number;
}

export interface UseConnectionStateReturn {
  // Status
  status: ConnectionStatus;
  
  // Actions
  retry: () => Promise<void>;
  clearOfflineQueue: () => void;
  addToOfflineQueue: (action: OfflineAction) => void;
  
  // Fallback management
  enableFallback: (mechanism: FallbackMechanism) => void;
  disableFallback: (mechanismName: string) => void;
  getActiveFallbacks: () => FallbackMechanism[];
  
  // User feedback
  getStatusMessage: () => string;
  getStatusColor: () => 'green' | 'yellow' | 'red' | 'gray';
  shouldShowRetryButton: () => boolean;
  
  // Event subscriptions
  onStatusChange: (callback: (status: ConnectionStatus) => void) => () => void;
  onReconnected: (callback: () => void) => () => void;
  onDisconnected: (callback: () => void) => () => void;
}

export function useConnectionState(
  options: UseConnectionStateOptions = {}
): UseConnectionStateReturn {
  const {
    enableFallbacks = true,
    fallbackMechanisms = [new PollingFallback(), new ServerSentEventsFallback()],
    showUserFeedback = true,
    autoRetry = true,
    retryInterval = 5000,
    maxRetries = 3
  } = options;

  // State
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isConnected: false,
    connectionState: 'disconnected',
    isReconnecting: false,
    offlineQueueSize: 0,
    reconnectAttempts: 0
  });

  // Refs
  const wsManager = getWebSocketManager();
  const connectionStateManager = getConnectionStateManager();
  const activeFallbacks = useRef<FallbackMechanism[]>([]);
  const eventListeners = useRef(new Map<string, Set<Function>>());
  const retryTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Update status from connection state manager
  const updateStatus = useCallback(() => {
    const wsMetrics = wsManager.getMetrics();
    const newStatus: ConnectionStatus = {
      isOnline: connectionStateManager.isOnline,
      isConnected: wsManager.isConnected(),
      connectionState: wsManager.getConnectionState(),
      isReconnecting: wsManager.getConnectionState() === 'reconnecting',
      offlineQueueSize: connectionStateManager.getQueueSize(),
      lastConnected: wsMetrics.connectedAt,
      lastDisconnected: wsMetrics.disconnectedAt,
      reconnectAttempts: wsMetrics.reconnectAttempts,
      latency: wsMetrics.latency
    };

    setStatus(prevStatus => {
      // Emit events for status changes
      if (prevStatus.isConnected !== newStatus.isConnected) {
        if (newStatus.isConnected) {
          emitEvent('reconnected');
          reconnectAttempts.current = 0;
        } else {
          emitEvent('disconnected');
        }
      }

      emitEvent('statusChange', newStatus);
      return newStatus;
    });
  }, [wsManager, connectionStateManager]);

  // Event emitter utility
  const emitEvent = useCallback((eventType: string, data?: any) => {
    const listeners = eventListeners.current.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} callback:`, error);
        }
      });
    }
  }, []);

  // Initialize fallback mechanisms
  const initializeFallbacks = useCallback(() => {
    if (!enableFallbacks) return;

    activeFallbacks.current = fallbackMechanisms.filter(mechanism => 
      mechanism.isAvailable()
    );

    console.log(`Initialized ${activeFallbacks.current.length} fallback mechanisms:`, 
      activeFallbacks.current.map(f => f.name));
  }, [enableFallbacks, fallbackMechanisms]);

  // Retry connection
  const retry = useCallback(async (): Promise<void> => {
    if (reconnectAttempts.current >= maxRetries) {
      console.warn('Max retry attempts reached');
      return;
    }

    try {
      reconnectAttempts.current++;
      setStatus(prev => ({ ...prev, isReconnecting: true }));

      // Try WebSocket connection first
      if (!wsManager.isConnected()) {
        // This would typically reconnect to the last known URL
        // For now, we'll just update the status
        console.log('Attempting to reconnect WebSocket...');
      }

      // If WebSocket fails and fallbacks are enabled, try fallbacks
      if (!wsManager.isConnected() && enableFallbacks) {
        console.log('WebSocket failed, trying fallback mechanisms...');
        
        for (const fallback of activeFallbacks.current) {
          try {
            console.log(`Trying fallback: ${fallback.name}`);
            // Fallback mechanisms would be activated here
            break;
          } catch (error) {
            console.error(`Fallback ${fallback.name} failed:`, error);
          }
        }
      }

      updateStatus();
    } catch (error) {
      console.error('Retry failed:', error);
      setStatus(prev => ({ ...prev, isReconnecting: false }));
      
      // Schedule next retry if auto-retry is enabled
      if (autoRetry && reconnectAttempts.current < maxRetries) {
        retryTimer.current = setTimeout(() => {
          retry();
        }, retryInterval * Math.pow(2, reconnectAttempts.current - 1)); // Exponential backoff
      }
    }
  }, [wsManager, enableFallbacks, autoRetry, retryInterval, maxRetries, updateStatus]);

  // Clear offline queue
  const clearOfflineQueue = useCallback(() => {
    connectionStateManager.clearOfflineQueue();
    updateStatus();
  }, [connectionStateManager, updateStatus]);

  // Add to offline queue
  const addToOfflineQueue = useCallback((action: OfflineAction) => {
    connectionStateManager.addToOfflineQueue(action);
    updateStatus();
  }, [connectionStateManager, updateStatus]);

  // Fallback management
  const enableFallback = useCallback((mechanism: FallbackMechanism) => {
    if (mechanism.isAvailable() && !activeFallbacks.current.includes(mechanism)) {
      activeFallbacks.current.push(mechanism);
      console.log(`Enabled fallback mechanism: ${mechanism.name}`);
    }
  }, []);

  const disableFallback = useCallback((mechanismName: string) => {
    activeFallbacks.current = activeFallbacks.current.filter(
      mechanism => mechanism.name !== mechanismName
    );
    console.log(`Disabled fallback mechanism: ${mechanismName}`);
  }, []);

  const getActiveFallbacks = useCallback(() => {
    return [...activeFallbacks.current];
  }, []);

  // User feedback utilities
  const getStatusMessage = useCallback((): string => {
    if (!status.isOnline) {
      return 'You are offline. Some features may not be available.';
    }

    switch (status.connectionState) {
      case 'connecting':
        return 'Connecting to server...';
      case 'connected':
        return status.latency ? `Connected (${status.latency}ms)` : 'Connected';
      case 'reconnecting':
        return `Reconnecting... (attempt ${status.reconnectAttempts})`;
      case 'disconnected':
        if (status.offlineQueueSize > 0) {
          return `Disconnected. ${status.offlineQueueSize} actions queued.`;
        }
        return 'Disconnected from server';
      case 'error':
        return 'Connection error. Please check your internet connection.';
      default:
        return 'Unknown connection status';
    }
  }, [status]);

  const getStatusColor = useCallback((): 'green' | 'yellow' | 'red' | 'gray' => {
    if (!status.isOnline) return 'gray';

    switch (status.connectionState) {
      case 'connected':
        return 'green';
      case 'connecting':
      case 'reconnecting':
        return 'yellow';
      case 'disconnected':
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  }, [status]);

  const shouldShowRetryButton = useCallback((): boolean => {
    return (
      !status.isConnected && 
      !status.isReconnecting && 
      status.isOnline &&
      reconnectAttempts.current < maxRetries
    );
  }, [status, maxRetries]);

  // Event subscription utilities
  const createEventSubscription = useCallback((eventType: string) => {
    return (callback: Function) => {
      if (!eventListeners.current.has(eventType)) {
        eventListeners.current.set(eventType, new Set());
      }
      eventListeners.current.get(eventType)!.add(callback);

      return () => {
        eventListeners.current.get(eventType)?.delete(callback);
      };
    };
  }, []);

  const onStatusChange = createEventSubscription('statusChange');
  const onReconnected = createEventSubscription('reconnected');
  const onDisconnected = createEventSubscription('disconnected');

  // Initialize and setup listeners
  useEffect(() => {
    initializeFallbacks();
    updateStatus();

    // Subscribe to connection state changes
    const unsubscribeConnectionState = connectionStateManager.subscribe(() => {
      updateStatus();
    });

    // Handle online/offline events
    const handleOnline = () => {
      updateStatus();
      if (autoRetry && !wsManager.isConnected()) {
        retry();
      }
    };

    const handleOffline = () => {
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-retry on initial load if offline
    if (autoRetry && !wsManager.isConnected() && navigator.onLine) {
      const initialRetryTimer = setTimeout(() => {
        retry();
      }, 1000);

      return () => {
        clearTimeout(initialRetryTimer);
        unsubscribeConnectionState();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (retryTimer.current) {
          clearTimeout(retryTimer.current);
        }
      };
    }

    return () => {
      unsubscribeConnectionState();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
  }, [initializeFallbacks, updateStatus, connectionStateManager, autoRetry, wsManager, retry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
      eventListeners.current.clear();
    };
  }, []);

  return {
    // Status
    status,

    // Actions
    retry,
    clearOfflineQueue,
    addToOfflineQueue,

    // Fallback management
    enableFallback,
    disableFallback,
    getActiveFallbacks,

    // User feedback
    getStatusMessage,
    getStatusColor,
    shouldShowRetryButton,

    // Event subscriptions
    onStatusChange,
    onReconnected,
    onDisconnected
  };
}