/**
 * Connection Status Component
 * Provides visual feedback about connection state to users
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useConnectionState } from '@/hooks/use-connection-state';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  X
} from 'lucide-react';

export interface ConnectionStatusProps {
  showDetails?: boolean;
  showRetryButton?: boolean;
  showOfflineQueue?: boolean;
  className?: string;
  compact?: boolean;
  position?: 'top' | 'bottom' | 'inline';
}

export function ConnectionStatus({
  showDetails = false,
  showRetryButton = true,
  showOfflineQueue = true,
  className = '',
  compact = false,
  position = 'top'
}: ConnectionStatusProps) {
  const {
    status,
    retry,
    clearOfflineQueue,
    getStatusMessage,
    getStatusColor,
    shouldShowRetryButton
  } = useConnectionState();

  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show/hide based on connection status
  useEffect(() => {
    const shouldShow = !status.isConnected || !status.isOnline || status.offlineQueueSize > 0;
    setIsVisible(shouldShow && !isDismissed);
  }, [status, isDismissed]);

  // Auto-dismiss when connected
  useEffect(() => {
    if (status.isConnected && status.isOnline && status.offlineQueueSize === 0) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 3000); // Auto-dismiss after 3 seconds when everything is good

      return () => clearTimeout(timer);
    }
  }, [status]);

  // Reset dismissed state when connection issues occur
  useEffect(() => {
    if (!status.isConnected || !status.isOnline) {
      setIsDismissed(false);
    }
  }, [status.isConnected, status.isOnline]);

  const getIcon = () => {
    if (!status.isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }

    switch (status.connectionState) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />;
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'disconnected':
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Wifi className="h-4 w-4" />;
    }
  };

  const getAlertVariant = () => {
    const color = getStatusColor();
    switch (color) {
      case 'green':
        return 'default';
      case 'yellow':
        return 'default';
      case 'red':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const handleRetry = async () => {
    try {
      await retry();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleClearQueue = () => {
    clearOfflineQueue();
  };

  if (!isVisible) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant={getAlertVariant() === 'destructive' ? 'destructive' : 'secondary'}>
          <div className="flex items-center gap-1">
            {getIcon()}
            <span className="text-xs">{getStatusMessage()}</span>
          </div>
        </Badge>
        {shouldShowRetryButton() && showRetryButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={status.isReconnecting}
          >
            <RefreshCw className={`h-3 w-3 ${status.isReconnecting ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  const positionClasses = {
    top: 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    bottom: 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
    inline: 'relative'
  };

  return (
    <div className={`${positionClasses[position]} ${className}`}>
      <Alert variant={getAlertVariant()} className="max-w-md">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {getIcon()}
            <div className="flex-1">
              <AlertDescription>
                {getStatusMessage()}
              </AlertDescription>

              {showDetails && (
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <div>Status: {status.connectionState}</div>
                  {status.latency && (
                    <div>Latency: {status.latency}ms</div>
                  )}
                  {status.reconnectAttempts > 0 && (
                    <div>Reconnect attempts: {status.reconnectAttempts}</div>
                  )}
                  {status.lastConnected && (
                    <div>Last connected: {status.lastConnected.toLocaleTimeString()}</div>
                  )}
                </div>
              )}

              {showOfflineQueue && status.offlineQueueSize > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {status.offlineQueueSize} queued
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearQueue}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                {shouldShowRetryButton() && showRetryButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={status.isReconnecting}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${status.isReconnecting ? 'animate-spin' : ''}`} />
                    {status.isReconnecting ? 'Retrying...' : 'Retry'}
                  </Button>
                )}

                {status.isConnected && status.isOnline && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}

// Hook for programmatic connection status notifications
export function useConnectionStatusNotifications() {
  const { status, onReconnected, onDisconnected } = useConnectionState();

  useEffect(() => {
    const unsubscribeReconnected = onReconnected(() => {
      // You could integrate with a toast notification system here
      console.log('Connection restored');
    });

    const unsubscribeDisconnected = onDisconnected(() => {
      console.log('Connection lost');
    });

    return () => {
      unsubscribeReconnected();
      unsubscribeDisconnected();
    };
  }, [onReconnected, onDisconnected]);

  return status;
}

// Provider component for connection status
export function ConnectionStatusProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ConnectionStatus position="top" showDetails={false} />
    </>
  );
}