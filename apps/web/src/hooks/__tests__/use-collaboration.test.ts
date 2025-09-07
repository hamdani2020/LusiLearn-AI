// Tests for enhanced useCollaboration hook
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCollaboration } from '../use-collaboration';
import { collaborationApi } from '@/lib/api-extended';

// Mock the collaboration API
jest.mock('@/lib/api-extended', () => ({
  collaborationApi: {
    findPeerMatches: jest.fn(),
    createStudyGroup: jest.fn(),
    getStudyGroups: jest.fn(),
    getStudyGroup: jest.fn(),
    updateStudyGroup: jest.fn(),
    deleteStudyGroup: jest.fn(),
    joinStudyGroup: jest.fn(),
    leaveStudyGroup: jest.fn()
  }
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null
}));

const mockCollaborationApi = collaborationApi as jest.Mocked<typeof collaborationApi>;

describe('useCollaboration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useCollaboration());

    expect(result.current.peerMatches).toEqual([]);
    expect(result.current.studyGroups).toEqual([]);
    expect(result.current.currentGroup).toBeNull();
    expect(result.current.currentSession).toBeNull();
    expect(result.current.participants).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should find peer matches successfully', async () => {
    const mockMatches = [
      {
        userId: '1',
        username: 'testuser',
        subjects: ['math'],
        skillLevel: 'intermediate',
        availability: ['morning'],
        matchScore: 0.8
      }
    ];

    mockCollaborationApi.findPeerMatches.mockResolvedValue({
      success: true,
      data: { matches: mockMatches }
    });

    const { result } = renderHook(() => useCollaboration());

    const criteria = {
      subjects: ['math'],
      skillLevel: 'intermediate',
      availability: ['morning']
    };

    act(() => {
      result.current.findPeerMatches(criteria);
    });

    await waitFor(() => {
      expect(result.current.peerMatches).toEqual(mockMatches);
    });

    expect(mockCollaborationApi.findPeerMatches).toHaveBeenCalledWith(criteria);
  });

  it('should create study group successfully', async () => {
    const mockGroup = {
      id: '1',
      name: 'Math Study Group',
      description: 'Group for math learning',
      subject: 'mathematics',
      maxSize: 10,
      currentMembers: 1,
      privacy: 'public' as const,
      moderationLevel: 'moderate' as const,
      createdAt: new Date().toISOString(),
      createdBy: 'user1'
    };

    mockCollaborationApi.createStudyGroup.mockResolvedValue({
      success: true,
      data: mockGroup
    });

    const { result } = renderHook(() => useCollaboration());

    const groupData = {
      name: 'Math Study Group',
      description: 'Group for math learning',
      subject: 'mathematics',
      topic: 'algebra',
      maxSize: 10,
      ageRestrictions: ['13+'],
      moderationLevel: 'moderate' as const,
      privacy: 'public' as const
    };

    let createdGroup;
    act(() => {
      result.current.createStudyGroup(groupData).then(group => {
        createdGroup = group;
      });
    });

    await waitFor(() => {
      expect(createdGroup).toEqual(mockGroup);
    });

    expect(mockCollaborationApi.createStudyGroup).toHaveBeenCalledWith(groupData);
  });

  it('should handle WebSocket connection', async () => {
    const { result } = renderHook(() => useCollaboration());

    act(() => {
      result.current.connectToGroup('group1');
    });

    // Wait for connection status to update
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connecting');
    });

    // Simulate WebSocket connection
    const mockWs = (global.WebSocket as jest.Mock).mock.instances[0];
    act(() => {
      mockWs.onopen();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('should send messages through WebSocket', () => {
    const { result } = renderHook(() => useCollaboration());

    // Set up a current group
    act(() => {
      result.current.fetchStudyGroup('group1');
    });

    // Mock WebSocket connection
    const mockWs = (global.WebSocket as jest.Mock).mock.instances[0];
    act(() => {
      mockWs.onopen();
    });

    act(() => {
      result.current.sendMessage('Hello, group!');
    });

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Hello, group!')
    );
  });

  it('should start and end collaborative sessions', async () => {
    const { result } = renderHook(() => useCollaboration());

    // Set up current group and connection
    act(() => {
      result.current.fetchStudyGroup('group1');
    });

    const mockWs = (global.WebSocket as jest.Mock).mock.instances[0];
    act(() => {
      mockWs.onopen();
    });

    // Start session
    let session;
    act(() => {
      result.current.startSession('study').then(s => {
        session = s;
      });
    });

    await waitFor(() => {
      expect(session).toBeDefined();
      expect(result.current.currentSession).toBeDefined();
      expect(result.current.isInSession).toBe(true);
    });

    // End session
    act(() => {
      result.current.endSession();
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.isInSession).toBe(false);
  });

  it('should handle participant management', async () => {
    const { result } = renderHook(() => useCollaboration());

    // Test invite participant
    let inviteResult;
    act(() => {
      result.current.inviteParticipant('group1', 'user2').then(result => {
        inviteResult = result;
      });
    });

    await waitFor(() => {
      expect(inviteResult).toBe(true);
    });

    // Test remove participant
    let removeResult;
    act(() => {
      result.current.removeParticipant('group1', 'user2').then(result => {
        removeResult = result;
      });
    });

    await waitFor(() => {
      expect(removeResult).toBe(true);
    });

    // Test update participant role
    let roleUpdateResult;
    act(() => {
      result.current.updateParticipantRole('group1', 'user2', 'moderator').then(result => {
        roleUpdateResult = result;
      });
    });

    await waitFor(() => {
      expect(roleUpdateResult).toBe(true);
    });
  });

  it('should subscribe to real-time events', () => {
    const { result } = renderHook(() => useCollaboration());

    const messageCallback = jest.fn();
    const participantCallback = jest.fn();
    const sessionCallback = jest.fn();

    // Subscribe to events
    const unsubscribeMessage = result.current.subscribeToMessages(messageCallback);
    const unsubscribeParticipant = result.current.subscribeToParticipantChanges(participantCallback);
    const unsubscribeSession = result.current.subscribeToSessionChanges(sessionCallback);

    expect(typeof unsubscribeMessage).toBe('function');
    expect(typeof unsubscribeParticipant).toBe('function');
    expect(typeof unsubscribeSession).toBe('function');

    // Test unsubscribe
    unsubscribeMessage();
    unsubscribeParticipant();
    unsubscribeSession();
  });

  it('should clear peer matches', () => {
    const { result } = renderHook(() => useCollaboration());

    // Set some peer matches first
    act(() => {
      result.current.findPeerMatches({
        subjects: ['math'],
        skillLevel: 'intermediate',
        availability: ['morning']
      });
    });

    act(() => {
      result.current.clearPeerMatches();
    });

    expect(result.current.peerMatches).toEqual([]);
  });

  it('should disconnect from group properly', () => {
    const { result } = renderHook(() => useCollaboration());

    // Connect first
    act(() => {
      result.current.connectToGroup('group1');
    });

    const mockWs = (global.WebSocket as jest.Mock).mock.instances[0];
    act(() => {
      mockWs.onopen();
    });

    expect(result.current.isConnected).toBe(true);

    // Disconnect
    act(() => {
      result.current.disconnectFromGroup();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.currentSession).toBeNull();
    expect(result.current.participants).toEqual([]);
    expect(result.current.messages).toEqual([]);
  });
});