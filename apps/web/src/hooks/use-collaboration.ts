import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  collaborationApi, 
  PeerMatch, 
  MatchingCriteria, 
  StudyGroup, 
  CreateStudyGroupRequest, 
  UpdateStudyGroupRequest 
} from '@/lib/api-extended';
import { 
  useBaseHook, 
  useCrudOperations,
  useApiCall,
  globalStateRegistry,
  BaseHookState,
  BaseHookActions,
  HookEventEmitterImpl
} from './base';

// Real-time collaboration types
export interface CollaborationMessage {
  id: string;
  groupId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file' | 'screen_share';
}

export interface Participant {
  id: string;
  username: string;
  status: 'online' | 'away' | 'offline';
  joinedAt: Date;
  role: 'member' | 'moderator' | 'owner';
}

export interface CollaborativeSession {
  id: string;
  groupId: string;
  type: 'study' | 'discussion' | 'presentation' | 'code_review';
  participants: Participant[];
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
}

export interface WebSocketMessage {
  type: 'message' | 'participant_joined' | 'participant_left' | 'session_started' | 'session_ended' | 'screen_share' | 'conflict_resolution';
  data: any;
  timestamp: Date;
}

// Enhanced Collaboration Hook Interface
export interface UseCollaborationReturn extends BaseHookState<StudyGroup[]>, BaseHookActions {
  // Data
  peerMatches: PeerMatch[];
  studyGroups: StudyGroup[];
  currentGroup: StudyGroup | null;
  currentSession: CollaborativeSession | null;
  participants: Participant[];
  messages: CollaborationMessage[];
  
  // Real-time state
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date | null;
  
  // Peer matching
  findPeerMatches: (criteria: MatchingCriteria) => Promise<PeerMatch[] | null>;
  clearPeerMatches: () => void;
  
  // Study group management
  createStudyGroup: (data: CreateStudyGroupRequest) => Promise<StudyGroup | null>;
  fetchStudyGroups: () => Promise<StudyGroup[] | null>;
  fetchStudyGroup: (groupId: string) => Promise<StudyGroup | null>;
  updateStudyGroup: (groupId: string, data: UpdateStudyGroupRequest) => Promise<StudyGroup | null>;
  deleteStudyGroup: (groupId: string) => Promise<boolean>;
  joinStudyGroup: (groupId: string) => Promise<boolean>;
  leaveStudyGroup: (groupId: string) => Promise<boolean>;
  
  // Real-time collaboration
  connectToGroup: (groupId: string) => Promise<void>;
  disconnectFromGroup: () => void;
  sendMessage: (message: string) => void;
  startSession: (type: CollaborativeSession['type']) => Promise<CollaborativeSession | null>;
  endSession: () => Promise<void>;
  shareScreen: () => Promise<void>;
  stopScreenShare: () => void;
  
  // Participant management
  inviteParticipant: (groupId: string, userId: string) => Promise<boolean>;
  removeParticipant: (groupId: string, userId: string) => Promise<boolean>;
  updateParticipantRole: (groupId: string, userId: string, role: Participant['role']) => Promise<boolean>;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, resolution: any) => Promise<void>;
  
  // Event subscriptions
  subscribeToMessages: (callback: (message: CollaborationMessage) => void) => () => void;
  subscribeToParticipantChanges: (callback: (participants: Participant[]) => void) => () => void;
  subscribeToSessionChanges: (callback: (session: CollaborativeSession | null) => void) => () => void;
  
  // Computed
  hasPeerMatches: boolean;
  hasStudyGroups: boolean;
  hasCurrentGroup: boolean;
  isInSession: boolean;
  peerMatchCount: number;
  studyGroupCount: number;
  participantCount: number;
  currentGroupId?: string;
  currentSessionId?: string;
}

export function useCollaboration(): UseCollaborationReturn {
  // State for different data types
  const [peerMatches, setPeerMatches] = useState<PeerMatch[]>([]);
  const [currentGroup, setCurrentGroup] = useState<StudyGroup | null>(null);
  const [currentSession, setCurrentSession] = useState<CollaborativeSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  // WebSocket connection ref (would be implemented with actual WebSocket)
  const wsRef = useRef<WebSocket | null>(null);
  const eventEmitterRef = useRef(new HookEventEmitterImpl<WebSocketMessage>());

  // CRUD operations for study groups
  const studyGroupsCrud = useCrudOperations<StudyGroup, CreateStudyGroupRequest, UpdateStudyGroupRequest>({
    endpoints: {
      getAll: '/api/v1/collaboration/study-groups',
      getById: '/api/v1/collaboration/study-groups/:id',
      create: '/api/v1/collaboration/study-groups',
      update: '/api/v1/collaboration/study-groups/:id',
      delete: '/api/v1/collaboration/study-groups/:id'
    },
    cacheKey: 'study-groups',
    enableOptimisticUpdates: true,
    autoFetch: true,
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        globalStateRegistry.getState<StudyGroup[]>('study-groups').set(data);
      }
    }
  });

  // API calls for specific operations
  const peerMatchingCall = useApiCall<{ matches: PeerMatch[] }>({
    endpoint: '/api/v1/collaboration/peer-matching',
    method: 'POST',
    autoFetch: false,
    onSuccess: (data) => {
      setPeerMatches(data.matches);
    }
  });

  const joinGroupCall = useApiCall<any>({
    endpoint: '/api/v1/collaboration/study-groups/:id/join',
    method: 'POST',
    autoFetch: false
  });

  const leaveGroupCall = useApiCall<any>({
    endpoint: '/api/v1/collaboration/study-groups/:id/leave',
    method: 'POST',
    autoFetch: false
  });

  // WebSocket connection management
  const connectToGroup = useCallback(async (groupId: string): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');
    
    try {
      // In a real implementation, this would connect to a WebSocket server
      // For now, we'll simulate the connection
      const wsUrl = `ws://localhost:8080/collaboration/${groupId}`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setLastActivity(new Date());
      };
      
      wsRef.current.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(message);
        setLastActivity(new Date());
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      };
      
      wsRef.current.onerror = () => {
        setIsConnected(false);
        setConnectionStatus('error');
      };
      
    } catch (error) {
      setConnectionStatus('error');
      console.error('Failed to connect to collaboration WebSocket:', error);
    }
  }, []);

  const disconnectFromGroup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setCurrentSession(null);
    setParticipants([]);
    setMessages([]);
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'message':
        setMessages(prev => [...prev, message.data as CollaborationMessage]);
        break;
      case 'participant_joined':
        setParticipants(prev => [...prev, message.data as Participant]);
        break;
      case 'participant_left':
        setParticipants(prev => prev.filter(p => p.id !== message.data.id));
        break;
      case 'session_started':
        setCurrentSession(message.data as CollaborativeSession);
        break;
      case 'session_ended':
        setCurrentSession(null);
        break;
      default:
        break;
    }
    
    // Emit event for subscribers
    eventEmitterRef.current.emit({
      type: 'success',
      data: message,
      timestamp: new Date()
    });
  }, []);

  // Peer matching
  const findPeerMatches = useCallback(async (criteria: MatchingCriteria): Promise<PeerMatch[] | null> => {
    const result = await peerMatchingCall.execute(criteria);
    return result?.matches || null;
  }, [peerMatchingCall]);

  const clearPeerMatches = useCallback(() => {
    setPeerMatches([]);
  }, []);

  // Study group management
  const createStudyGroup = useCallback(async (data: CreateStudyGroupRequest): Promise<StudyGroup | null> => {
    return await studyGroupsCrud.create(data);
  }, [studyGroupsCrud]);

  const fetchStudyGroups = useCallback(async (): Promise<StudyGroup[] | null> => {
    return await studyGroupsCrud.fetchAll();
  }, [studyGroupsCrud]);

  const fetchStudyGroup = useCallback(async (groupId: string): Promise<StudyGroup | null> => {
    const result = await studyGroupsCrud.fetchById(groupId);
    if (result) {
      setCurrentGroup(result);
    }
    return result;
  }, [studyGroupsCrud]);

  const updateStudyGroup = useCallback(async (groupId: string, data: UpdateStudyGroupRequest): Promise<StudyGroup | null> => {
    const result = await studyGroupsCrud.update(groupId, data);
    if (result && currentGroup?.id === groupId) {
      setCurrentGroup(result);
    }
    return result;
  }, [studyGroupsCrud, currentGroup]);

  const deleteStudyGroup = useCallback(async (groupId: string): Promise<boolean> => {
    const result = await studyGroupsCrud.delete(groupId);
    if (result && currentGroup?.id === groupId) {
      setCurrentGroup(null);
      disconnectFromGroup();
    }
    return result;
  }, [studyGroupsCrud, currentGroup, disconnectFromGroup]);

  const joinStudyGroup = useCallback(async (groupId: string): Promise<boolean> => {
    const endpoint = joinGroupCall.endpoint?.replace(':id', groupId) || '';
    const result = await joinGroupCall.execute();
    
    if (result) {
      await fetchStudyGroup(groupId);
      await connectToGroup(groupId);
    }
    
    return !!result;
  }, [joinGroupCall, fetchStudyGroup, connectToGroup]);

  const leaveStudyGroup = useCallback(async (groupId: string): Promise<boolean> => {
    const endpoint = leaveGroupCall.endpoint?.replace(':id', groupId) || '';
    const result = await leaveGroupCall.execute();
    
    if (result) {
      if (currentGroup?.id === groupId) {
        setCurrentGroup(null);
      }
      disconnectFromGroup();
    }
    
    return !!result;
  }, [leaveGroupCall, currentGroup, disconnectFromGroup]);

  // Real-time collaboration
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentGroup) {
      const messageData: CollaborationMessage = {
        id: `msg-${Date.now()}`,
        groupId: currentGroup.id,
        userId: 'current-user-id', // Would come from auth context
        username: 'Current User', // Would come from auth context
        message,
        timestamp: new Date(),
        type: 'text'
      };
      
      wsRef.current.send(JSON.stringify({
        type: 'message',
        data: messageData
      }));
      
      // Optimistically add to local messages
      setMessages(prev => [...prev, messageData]);
    }
  }, [currentGroup]);

  const startSession = useCallback(async (type: CollaborativeSession['type']): Promise<CollaborativeSession | null> => {
    if (!currentGroup) return null;
    
    const session: CollaborativeSession = {
      id: `session-${Date.now()}`,
      groupId: currentGroup.id,
      type,
      participants: participants,
      startedAt: new Date(),
      isActive: true
    };
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'session_started',
        data: session
      }));
    }
    
    setCurrentSession(session);
    return session;
  }, [currentGroup, participants]);

  const endSession = useCallback(async (): Promise<void> => {
    if (currentSession && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'session_ended',
        data: { sessionId: currentSession.id }
      }));
    }
    
    setCurrentSession(null);
  }, [currentSession]);

  const shareScreen = useCallback(async (): Promise<void> => {
    // Screen sharing implementation would go here
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'screen_share',
        data: { action: 'start' }
      }));
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'screen_share',
        data: { action: 'stop' }
      }));
    }
  }, []);

  // Participant management
  const inviteParticipant = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
    // Implementation would make API call to invite participant
    return true;
  }, []);

  const removeParticipant = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
    // Implementation would make API call to remove participant
    return true;
  }, []);

  const updateParticipantRole = useCallback(async (groupId: string, userId: string, role: Participant['role']): Promise<boolean> => {
    // Implementation would make API call to update participant role
    return true;
  }, []);

  // Conflict resolution
  const resolveConflict = useCallback(async (conflictId: string, resolution: any): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'conflict_resolution',
        data: { conflictId, resolution }
      }));
    }
  }, []);

  // Event subscriptions
  const subscribeToMessages = useCallback((callback: (message: CollaborationMessage) => void) => {
    return eventEmitterRef.current.on('success', (event) => {
      if (event.data?.type === 'message') {
        callback(event.data.data);
      }
    });
  }, []);

  const subscribeToParticipantChanges = useCallback((callback: (participants: Participant[]) => void) => {
    return eventEmitterRef.current.on('success', (event) => {
      if (event.data?.type === 'participant_joined' || event.data?.type === 'participant_left') {
        callback(participants);
      }
    });
  }, [participants]);

  const subscribeToSessionChanges = useCallback((callback: (session: CollaborativeSession | null) => void) => {
    return eventEmitterRef.current.on('success', (event) => {
      if (event.data?.type === 'session_started' || event.data?.type === 'session_ended') {
        callback(currentSession);
      }
    });
  }, [currentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromGroup();
      eventEmitterRef.current.clear();
    };
  }, [disconnectFromGroup]);

  // Computed values
  const studyGroups = studyGroupsCrud.data || [];
  const hasPeerMatches = peerMatches.length > 0;
  const hasStudyGroups = studyGroups.length > 0;
  const hasCurrentGroup = currentGroup !== null;
  const isInSession = currentSession !== null;
  const peerMatchCount = peerMatches.length;
  const studyGroupCount = studyGroups.length;
  const participantCount = participants.length;

  return {
    // Base state
    data: studyGroups,
    loading: studyGroupsCrud.loading || peerMatchingCall.loading || joinGroupCall.loading || leaveGroupCall.loading,
    error: studyGroupsCrud.error || peerMatchingCall.error || joinGroupCall.error || leaveGroupCall.error,
    lastFetch: null,
    isStale: studyGroupsCrud.isStale,

    // Data
    peerMatches,
    studyGroups,
    currentGroup,
    currentSession,
    participants,
    messages,

    // Real-time state
    isConnected,
    connectionStatus,
    lastActivity,

    // Peer matching
    findPeerMatches,
    clearPeerMatches,

    // Study group management
    createStudyGroup,
    fetchStudyGroups,
    fetchStudyGroup,
    updateStudyGroup,
    deleteStudyGroup,
    joinStudyGroup,
    leaveStudyGroup,
    clearError: studyGroupsCrud.clearError,
    clearData: studyGroupsCrud.clearData,
    refresh: studyGroupsCrud.refresh,
    invalidate: studyGroupsCrud.invalidate,

    // Real-time collaboration
    connectToGroup,
    disconnectFromGroup,
    sendMessage,
    startSession,
    endSession,
    shareScreen,
    stopScreenShare,

    // Participant management
    inviteParticipant,
    removeParticipant,
    updateParticipantRole,

    // Conflict resolution
    resolveConflict,

    // Event subscriptions
    subscribeToMessages,
    subscribeToParticipantChanges,
    subscribeToSessionChanges,

    // Computed
    hasPeerMatches,
    hasStudyGroups,
    hasCurrentGroup,
    isInSession,
    peerMatchCount,
    studyGroupCount,
    participantCount,
    currentGroupId: currentGroup?.id,
    currentSessionId: currentSession?.id
  };
} 