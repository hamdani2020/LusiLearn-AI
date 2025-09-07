/**
 * WebSocket context for providing WebSocket functionality to components
 * Used in testing to provide mock WebSocket implementation
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { WebSocketManager } from './manager';

interface WebSocketContextValue {
  manager: WebSocketManager | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  manager: null
});

interface WebSocketProviderProps {
  children: ReactNode;
  manager?: WebSocketManager;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  manager 
}) => {
  const contextValue: WebSocketContextValue = {
    manager: manager || null
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};