/**
 * Real-time Collaboration Hook
 * Integrates with WebSocket manager for real-time study group interactions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getWebSocketManager, getConnectionStateManager } from '@/lib/websocket';
import { 
  Participant, 
  Message, 
  CollaborationSession, 
  ScreenShareState, 
  CollaborativeEditingState,
  WSEvent,
  ConnectionState
} from '@/lib/websocket/types';
import { useApiCall } from './base';

export interface UseRealTimeCollaborationOptions {
  sessionId?: string;
  autoConnect?: boolean;
  enableScreenShare?: boolean;
  enableCollaborativeEditing?: boolean;
  maxParticipants?: number;
}

export interface UseRealTimeCollaborationReturn {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isReconnecting: boolean;
  
  // Session data
  session: CollaborationSession | null;
  participants: Participant[];
  messages: Message[];
  
  // Screen sharing
  screenShare: ScreenShareState;
  
  // Collaborative editing
  collaborativeEditing: CollaborativeEditingState | null;
  
  // Actions
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => void;
  sendMessage: (content: string, type?: Message['type']) => void;
  
  // Participant management
  inviteParticipant: (userId: string) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;
  updateParticipantRole: (participantId: string, role: Participant['role']) => Promise<void>;
  
  // Screen sharing
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  
  // Collaborative editing
  startCollaborativeEditing: (documentId: string) => Promise<void>;
  stopCollaborativeEditing: () => void;
  updateDocument: (content: string, cursorPosition: number) => void;
  updateCursor: (position: number) => void;
  updateSelection: (start: number, end: number) => void;
  
  // Event subscriptions
  onParticipantJoined: (callback: (participant: Participant) => void) => () => void;
  onParticipantLeft: (callback: (participantId: string) => void) => () => void;
  onMessageReceived: (callback: (message: Message) => void) => () => void;
  onScreenShareChanged: (callback: (state: ScreenShareState) => void) => () => void;
  onDocumentUpdated: (callback: (state: CollaborativeEditingState) => void) => () => void;
  
  // Computed
  participantCount: number;
  messageCount: number;
  isSessionActive: boolean;
  canScreenShare: boolean;
  canEdit: boolean;
  currentUserId?: string;
}

export function useRealTimeCollaboration(
  options: UseRealTimeCollaborationOptions = {}
): UseRealTimeCollaborationReturn {
  const {
    sessionId: initialSessionId,
    autoConnect = false,
    enableScreenShare = true,
    enableCollaborativeEditing = true,
    maxParticipants = 50
  } = options;

  // State
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [screenShare, setScreenShare] = useState<ScreenShareState>({
    isSharing: false
  });
  const [collaborativeEditing, setCollaborativeEditing] = useState<CollaborativeEditingState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>();

  // WebSocket manager
  const wsManager = getWebSocketManager();
  const connectionStateManager = getConnectionStateManager();
  
  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Event listeners
  const eventListeners = useRef(new Map<string, Set<Function>>());
  const unsubscribeFunctions = useRef<(() => void)[]>([]);

  // API calls for session management
  const joinSessionCall = useApiCall<CollaborationSession>({
    endpoint: '/api/v1/collaboration/sessions/:id/join',
    method: 'POST',
    autoFetch: false
  });

  const leaveSessionCall = useApiCall<void>({
    endpoint: '/api/v1/collaboration/sessions/:id/leave',
    method: 'POST',
    autoFetch: false
  });

  const inviteParticipantCall = useApiCall<void>({
    endpoint: '/api/v1/collaboration/sessions/:id/invite',
    method: 'POST',
    autoFetch: false
  });

  // WebSocket event handlers
  const handleWebSocketEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'user_joined':
        const newParticipant = event.data as Participant;
        setParticipants(prev => {
          if (prev.find(p => p.id === newParticipant.id)) return prev;
          return [...prev, newParticipant];
        });
        emitEvent('participantJoined', newParticipant);
        break;

      case 'user_left':
        const leftParticipantId = event.data.participantId as string;
        setParticipants(prev => prev.filter(p => p.id !== leftParticipantId));
        emitEvent('participantLeft', leftParticipantId);
        break;

      case 'message_sent':
        const newMessage = event.data as Message;
        setMessages(prev => [...prev, newMessage]);
        emitEvent('messageReceived', newMessage);
        break;

      case 'screen_share_started':
        const shareStartData = event.data;
        setScreenShare({
          isSharing: true,
          sharerId: shareStartData.userId,
          sharerName: shareStartData.username,
          streamId: shareStartData.streamId
        });
        emitEvent('screenShareChanged', screenShare);
        break;

      case 'screen_share_stopped':
        setScreenShare({ isSharing: false });
        emitEvent('screenShareChanged', { isSharing: false });
        break;

      case 'document_updated':
        const docUpdate = event.data as CollaborativeEditingState;
        setCollaborativeEditing(docUpdate);
        emitEvent('documentUpdated', docUpdate);
        break;

      case 'cursor_moved':
        if (collaborativeEditing) {
          const { userId, position } = event.data;
          const participant = participants.find(p => p.id === userId);
          if (participant) {
            setCollaborativeEditing(prev => prev ? {
              ...prev,
              cursors: {
                ...prev.cursors,
                [userId]: { position, user: participant }
              }
            } : null);
          }
        }
        break;

      case 'selection_changed':
        if (collaborativeEditing) {
          const { userId, start, end } = event.data;
          const participant = participants.find(p => p.id === userId);
          if (participant) {
            setCollaborativeEditing(prev => prev ? {
              ...prev,
              selections: {
                ...prev.selections,
                [userId]: { start, end, user: participant }
              }
            } : null);
          }
        }
        break;

      case 'error':
        console.error('WebSocket error:', event.data);
        break;
    }
  }, [participants, screenShare, collaborativeEditing]);

  // Event emitter utility
  const emitEvent = useCallback((eventType: string, data: any) => {
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

  // Connection management
  const connectToSession = useCallback(async (sessionId: string) => {
    try {
      setConnectionState('connecting');
      
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'}/collaboration/${sessionId}`;
      
      await wsManager.connect(wsUrl, {
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectInterval: 1000,
        heartbeatInterval: 30000,
        onConnect: () => {
          setConnectionState('connected');
          setIsReconnecting(false);
        },
        onDisconnect: () => {
          setConnectionState('disconnected');
        },
        onError: (error) => {
          setConnectionState('error');
          console.error('WebSocket connection error:', error);
        },
        onReconnect: (attempt) => {
          setIsReconnecting(true);
          console.log(`Reconnection attempt ${attempt}`);
        }
      });

      // Subscribe to collaboration events
      const unsubscribe = wsManager.subscribe('collaboration', handleWebSocketEvent);
      unsubscribeFunctions.current.push(unsubscribe);

    } catch (error) {
      setConnectionState('error');
      console.error('Failed to connect to collaboration session:', error);
      throw error;
    }
  }, [wsManager, handleWebSocketEvent]);

  const disconnectFromSession = useCallback(() => {
    wsManager.disconnect();
    setConnectionState('disconnected');
    setIsReconnecting(false);
    
    // Clear all subscriptions
    unsubscribeFunctions.current.forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = [];
    
    // Clear state
    setSession(null);
    setParticipants([]);
    setMessages([]);
    setScreenShare({ isSharing: false });
    setCollaborativeEditing(null);
  }, [wsManager]);

  // Session management
  const joinSession = useCallback(async (sessionId: string): Promise<void> => {
    try {
      // First, join the session via API
      const sessionData = await joinSessionCall.execute(undefined, { id: sessionId });
      if (sessionData) {
        setSession(sessionData);
        setCurrentUserId(sessionData.participants.find(p => p.role === 'member')?.id);
      }

      // Then connect to WebSocket
      await connectToSession(sessionId);
      
    } catch (error) {
      console.error('Failed to join session:', error);
      throw error;
    }
  }, [joinSessionCall, connectToSession]);

  const leaveSession = useCallback(() => {
    if (session) {
      leaveSessionCall.execute(undefined, { id: session.id });
    }
    disconnectFromSession();
  }, [session, leaveSessionCall, disconnectFromSession]);

  // Messaging
  const sendMessage = useCallback((content: string, type: Message['type'] = 'text') => {
    if (!wsManager.isConnected() || !session || !currentUserId) {
      console.warn('Cannot send message: not connected to session');
      return;
    }

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: currentUserId,
      senderName: participants.find(p => p.id === currentUserId)?.username || 'Unknown',
      content,
      timestamp: new Date(),
      type
    };

    wsManager.send('collaboration', {
      type: 'message_sent',
      data: message,
      sessionId: session.id,
      userId: currentUserId
    });

    // Optimistically add to local messages
    setMessages(prev => [...prev, message]);
  }, [wsManager, session, currentUserId, participants]);

  // Participant management
  const inviteParticipant = useCallback(async (userId: string): Promise<void> => {
    if (!session) throw new Error('No active session');
    
    await inviteParticipantCall.execute({ userId }, { id: session.id });
  }, [session, inviteParticipantCall]);

  const removeParticipant = useCallback(async (participantId: string): Promise<void> => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'user_left',
      data: { participantId },
      sessionId: session.id,
      userId: currentUserId
    });
  }, [wsManager, session, currentUserId]);

  const updateParticipantRole = useCallback(async (participantId: string, role: Participant['role']): Promise<void> => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'participant_role_updated',
      data: { participantId, role },
      sessionId: session.id,
      userId: currentUserId
    });
  }, [wsManager, session, currentUserId]);

  // Screen sharing
  const startScreenShare = useCallback(async (): Promise<void> => {
    if (!enableScreenShare || !wsManager.isConnected() || !session) return;

    try {
      // Request screen share permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const streamId = `stream-${Date.now()}`;
      
      wsManager.send('collaboration', {
        type: 'screen_share_started',
        data: {
          streamId,
          userId: currentUserId,
          username: participants.find(p => p.id === currentUserId)?.username
        },
        sessionId: session.id,
        userId: currentUserId
      });

      setScreenShare({
        isSharing: true,
        sharerId: currentUserId,
        sharerName: participants.find(p => p.id === currentUserId)?.username,
        streamId
      });

      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  }, [enableScreenShare, wsManager, session, currentUserId, participants]);

  const stopScreenShare = useCallback(() => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'screen_share_stopped',
      data: { userId: currentUserId },
      sessionId: session.id,
      userId: currentUserId
    });

    setScreenShare({ isSharing: false });
  }, [wsManager, session, currentUserId]);

  // Collaborative editing
  const startCollaborativeEditing = useCallback(async (documentId: string): Promise<void> => {
    if (!enableCollaborativeEditing || !wsManager.isConnected() || !session) return;

    const editingState: CollaborativeEditingState = {
      documentId,
      cursors: {},
      selections: {},
      lastModified: new Date()
    };

    setCollaborativeEditing(editingState);

    wsManager.send('collaboration', {
      type: 'collaborative_editing_started',
      data: editingState,
      sessionId: session.id,
      userId: currentUserId
    });
  }, [enableCollaborativeEditing, wsManager, session, currentUserId]);

  const stopCollaborativeEditing = useCallback(() => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'collaborative_editing_stopped',
      data: { documentId: collaborativeEditing?.documentId },
      sessionId: session.id,
      userId: currentUserId
    });

    setCollaborativeEditing(null);
  }, [wsManager, session, currentUserId, collaborativeEditing]);

  const updateDocument = useCallback((content: string, cursorPosition: number) => {
    if (!wsManager.isConnected() || !session || !collaborativeEditing) return;

    wsManager.send('collaboration', {
      type: 'document_updated',
      data: {
        ...collaborativeEditing,
        lastModified: new Date()
      },
      sessionId: session.id,
      userId: currentUserId
    });

    updateCursor(cursorPosition);
  }, [wsManager, session, collaborativeEditing, currentUserId]);

  const updateCursor = useCallback((position: number) => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'cursor_moved',
      data: { userId: currentUserId, position },
      sessionId: session.id,
      userId: currentUserId
    });
  }, [wsManager, session, currentUserId]);

  const updateSelection = useCallback((start: number, end: number) => {
    if (!wsManager.isConnected() || !session) return;

    wsManager.send('collaboration', {
      type: 'selection_changed',
      data: { userId: currentUserId, start, end },
      sessionId: session.id,
      userId: currentUserId
    });
  }, [wsManager, session, currentUserId]);

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

  const onParticipantJoined = createEventSubscription('participantJoined');
  const onParticipantLeft = createEventSubscription('participantLeft');
  const onMessageReceived = createEventSubscription('messageReceived');
  const onScreenShareChanged = createEventSubscription('screenShareChanged');
  const onDocumentUpdated = createEventSubscription('documentUpdated');

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && initialSessionId) {
      joinSession(initialSessionId);
    }

    return () => {
      disconnectFromSession();
    };
  }, [autoConnect, initialSessionId, joinSession, disconnectFromSession]);

  // Connection state monitoring
  useEffect(() => {
    const unsubscribe = connectionStateManager.subscribe((state) => {
      if (!state.isOnline && connectionState === 'connected') {
        setConnectionState('disconnected');
      }
    });

    return unsubscribe;
  }, [connectionStateManager, connectionState]);

  // Computed values
  const isConnected = wsManager.isConnected();
  const participantCount = participants.length;
  const messageCount = messages.length;
  const isSessionActive = session?.isActive || false;
  const canScreenShare = enableScreenShare && isConnected && !screenShare.isSharing;
  const canEdit = enableCollaborativeEditing && isConnected && collaborativeEditing !== null;

  return {
    // Connection state
    isConnected,
    connectionState,
    isReconnecting,

    // Session data
    session,
    participants,
    messages,

    // Screen sharing
    screenShare,

    // Collaborative editing
    collaborativeEditing,

    // Actions
    joinSession,
    leaveSession,
    sendMessage,

    // Participant management
    inviteParticipant,
    removeParticipant,
    updateParticipantRole,

    // Screen sharing
    startScreenShare,
    stopScreenShare,

    // Collaborative editing
    startCollaborativeEditing,
    stopCollaborativeEditing,
    updateDocument,
    updateCursor,
    updateSelection,

    // Event subscriptions
    onParticipantJoined,
    onParticipantLeft,
    onMessageReceived,
    onScreenShareChanged,
    onDocumentUpdated,

    // Computed
    participantCount,
    messageCount,
    isSessionActive,
    canScreenShare,
    canEdit,
    currentUserId
  };
}