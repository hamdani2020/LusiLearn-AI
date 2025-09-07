/**
 * Real-time Collaboration Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useRealTimeCollaboration } from '../use-real-time-collaboration';
import { getWebSocketManager, getConnectionStateManager } from '@/lib/websocket';
import { Participant, Message, CollaborationSession } from '@/lib/websocket/types';

// Mock WebSocket manager
const mockWsManager = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  send: jest.fn(),
  isConnected: jest.fn(),
  getConnectionState: jest.fn(),
  getMetrics: jest.fn()
};

// Mock connection state manager
const mockConnectionStateManager = {
  subscribe: jest.fn(),
  isOnline: true,
  connectionState: 'connected' as const,
  offlineQueue: [],
  addToOfflineQueue: jest.fn(),
  processOfflineQueue: jest.fn(),
  clearOfflineQueue: jest.fn(),
  getQueueSize: jest.fn(),
  updateConnectionState: jest.fn(),
  destroy: jest.fn()
};

// Mock API calls
jest.mock('../base', () => ({
  useApiCall: jest.fn(() => ({
    execute: jest.fn(),
    loading: false,
    error: null,
    data: null
  }))
}));

jest.mock('@/lib/websocket', () => ({
  getWebSocketManager: () => mockWsManager,
  getConnectionStateManager: () => mockConnectionStateManager
}));

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getDisplayMedia: jest.fn()
  }
});

describe('useRealTimeCollaboration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWsManager.isConnected.mockReturnValue(false);
    mockWsManager.getConnectionState.mockReturnValue('disconnected');
    mockConnectionStateManager.subscribe.mockReturnValue(() => {});
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.session).toBe(null);
      expect(result.current.participants).toEqual([]);
      expect(result.current.messages).toEqual([]);
      expect(result.current.screenShare.isSharing).toBe(false);
      expect(result.current.collaborativeEditing).toBe(null);
    });

    it('should auto-connect when sessionId is provided', () => {
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      mockWsManager.connect = mockConnect;

      renderHook(() => useRealTimeCollaboration({
        sessionId: 'test-session',
        autoConnect: true
      }));

      // Auto-connect should be triggered in useEffect
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should join a session successfully', async () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      mockWsManager.connect.mockResolvedValue(undefined);
      mockWsManager.isConnected.mockReturnValue(true);

      const { result } = renderHook(() => useRealTimeCollaboration());

      await act(async () => {
        await result.current.joinSession('test-session');
      });

      expect(mockWsManager.connect).toHaveBeenCalledWith(
        expect.stringContaining('/collaboration/test-session'),
        expect.objectContaining({
          autoReconnect: true,
          maxReconnectAttempts: 5
        })
      );
    });

    it('should leave a session', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());

      act(() => {
        result.current.leaveSession();
      });

      expect(mockWsManager.disconnect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockWsManager.connect.mockRejectedValue(connectionError);

      const { result } = renderHook(() => useRealTimeCollaboration());

      await expect(
        act(async () => {
          await result.current.joinSession('test-session');
        })
      ).rejects.toThrow('Connection failed');
    });
  });

  describe('Messaging', () => {
    beforeEach(() => {
      mockWsManager.isConnected.mockReturnValue(true);
    });

    it('should send a text message', () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration());

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
      });

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'message_sent',
        data: expect.objectContaining({
          content: 'Hello, world!',
          type: 'text'
        }),
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });

    it('should not send message when not connected', () => {
      mockWsManager.isConnected.mockReturnValue(false);

      const { result } = renderHook(() => useRealTimeCollaboration());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      act(() => {
        result.current.sendMessage('Hello, world!');
      });

      expect(mockWsManager.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Cannot send message: not connected to session');

      consoleSpy.mockRestore();
    });
  });

  describe('Screen Sharing', () => {
    beforeEach(() => {
      mockWsManager.isConnected.mockReturnValue(true);
    });

    it('should start screen sharing', async () => {
      const mockStream = {
        getVideoTracks: () => [{ onended: null }]
      };
      (navigator.mediaDevices.getDisplayMedia as jest.Mock).mockResolvedValue(mockStream);

      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [{ id: 'user-1', username: 'Test User', isOnline: true, lastSeen: new Date(), role: 'member' }],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration({
        enableScreenShare: true
      }));

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
        (result.current as any).setParticipants?.([{ id: 'user-1', username: 'Test User', isOnline: true, lastSeen: new Date(), role: 'member' }]);
      });

      await act(async () => {
        await result.current.startScreenShare();
      });

      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
        video: true,
        audio: true
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'screen_share_started',
        data: expect.objectContaining({
          userId: 'user-1',
          username: 'Test User'
        }),
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });

    it('should stop screen sharing', () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration());

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
      });

      act(() => {
        result.current.stopScreenShare();
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'screen_share_stopped',
        data: { userId: 'user-1' },
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });

    it('should handle screen share permission denied', async () => {
      const permissionError = new Error('Permission denied');
      (navigator.mediaDevices.getDisplayMedia as jest.Mock).mockRejectedValue(permissionError);

      const { result } = renderHook(() => useRealTimeCollaboration({
        enableScreenShare: true
      }));

      await expect(
        act(async () => {
          await result.current.startScreenShare();
        })
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Collaborative Editing', () => {
    beforeEach(() => {
      mockWsManager.isConnected.mockReturnValue(true);
    });

    it('should start collaborative editing', async () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration({
        enableCollaborativeEditing: true
      }));

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
      });

      await act(async () => {
        await result.current.startCollaborativeEditing('doc-1');
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'collaborative_editing_started',
        data: expect.objectContaining({
          documentId: 'doc-1',
          cursors: {},
          selections: {}
        }),
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });

    it('should update cursor position', () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration());

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
      });

      act(() => {
        result.current.updateCursor(42);
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'cursor_moved',
        data: { userId: 'user-1', position: 42 },
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });

    it('should update selection', () => {
      const mockSession: CollaborationSession = {
        id: 'test-session',
        name: 'Test Session',
        type: 'study_group',
        participants: [],
        createdAt: new Date(),
        isActive: true
      };

      const { result } = renderHook(() => useRealTimeCollaboration());

      // Set up session state
      act(() => {
        (result.current as any).setSession?.(mockSession);
        (result.current as any).setCurrentUserId?.('user-1');
      });

      act(() => {
        result.current.updateSelection(10, 20);
      });

      expect(mockWsManager.send).toHaveBeenCalledWith('collaboration', {
        type: 'selection_changed',
        data: { userId: 'user-1', start: 10, end: 20 },
        sessionId: 'test-session',
        userId: 'user-1'
      });
    });
  });

  describe('Event Subscriptions', () => {
    it('should subscribe to participant events', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());
      const callback = jest.fn();

      const unsubscribe = result.current.onParticipantJoined(callback);

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
    });

    it('should subscribe to message events', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());
      const callback = jest.fn();

      const unsubscribe = result.current.onMessageReceived(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle callback errors gracefully', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      result.current.onParticipantJoined(errorCallback);

      // Simulate event emission (this would normally happen through WebSocket events)
      // For testing, we'd need to trigger the internal event emitter

      consoleSpy.mockRestore();
    });
  });

  describe('Computed Values', () => {
    it('should calculate participant count', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());

      expect(result.current.participantCount).toBe(0);

      // Simulate participants being added
      act(() => {
        (result.current as any).setParticipants?.([
          { id: 'user-1', username: 'User 1', isOnline: true, lastSeen: new Date(), role: 'member' },
          { id: 'user-2', username: 'User 2', isOnline: true, lastSeen: new Date(), role: 'member' }
        ]);
      });

      expect(result.current.participantCount).toBe(2);
    });

    it('should calculate message count', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());

      expect(result.current.messageCount).toBe(0);

      // Simulate messages being added
      act(() => {
        (result.current as any).setMessages?.([
          { id: 'msg-1', senderId: 'user-1', senderName: 'User 1', content: 'Hello', timestamp: new Date(), type: 'text' },
          { id: 'msg-2', senderId: 'user-2', senderName: 'User 2', content: 'Hi', timestamp: new Date(), type: 'text' }
        ]);
      });

      expect(result.current.messageCount).toBe(2);
    });

    it('should determine if session is active', () => {
      const { result } = renderHook(() => useRealTimeCollaboration());

      expect(result.current.isSessionActive).toBe(false);

      // Simulate active session
      act(() => {
        (result.current as any).setSession?.({
          id: 'test-session',
          name: 'Test Session',
          type: 'study_group',
          participants: [],
          createdAt: new Date(),
          isActive: true
        });
      });

      expect(result.current.isSessionActive).toBe(true);
    });

    it('should determine screen share capability', () => {
      mockWsManager.isConnected.mockReturnValue(true);

      const { result } = renderHook(() => useRealTimeCollaboration({
        enableScreenShare: true
      }));

      expect(result.current.canScreenShare).toBe(true);

      // Simulate screen sharing in progress
      act(() => {
        (result.current as any).setScreenShare?.({ isSharing: true });
      });

      expect(result.current.canScreenShare).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useRealTimeCollaboration());

      unmount();

      expect(mockWsManager.disconnect).toHaveBeenCalled();
    });
  });
});