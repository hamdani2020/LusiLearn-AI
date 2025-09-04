/**
 * WebSocket types and interfaces for real-time communication
 */

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export interface WSOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
}

export interface WSMessage<T = any> {
  type: string;
  channel: string;
  data: T;
  timestamp: number;
  id: string;
}

export interface WSSubscription {
  channel: string;
  callback: (data: any) => void;
  unsubscribe: () => void;
}

export interface ConnectionMetrics {
  connectedAt?: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  messagesReceived: number;
  messagesSent: number;
  lastHeartbeat?: Date;
  latency?: number;
}

export interface WebSocketManager {
  connect(url: string, options?: WSOptions): Promise<void>;
  disconnect(): void;
  subscribe(channel: string, callback: (data: any) => void): () => void;
  unsubscribe(channel: string): void;
  send(channel: string, data: any): void;
  getConnectionState(): ConnectionState;
  getMetrics(): ConnectionMetrics;
  isConnected(): boolean;
}

// Real-time collaboration types
export interface Participant {
  id: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  role: 'member' | 'moderator' | 'admin';
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file' | 'code';
  metadata?: {
    fileName?: string;
    fileSize?: number;
    language?: string;
  };
}

export interface CollaborationSession {
  id: string;
  name: string;
  type: 'study_group' | 'tutoring' | 'project' | 'discussion';
  participants: Participant[];
  createdAt: Date;
  isActive: boolean;
  maxParticipants?: number;
}

export interface ScreenShareState {
  isSharing: boolean;
  sharerId?: string;
  sharerName?: string;
  streamId?: string;
}

export interface CollaborativeEditingState {
  documentId: string;
  cursors: Record<string, { position: number; user: Participant }>;
  selections: Record<string, { start: number; end: number; user: Participant }>;
  lastModified: Date;
}

// WebSocket event types
export type WSEventType = 
  | 'user_joined'
  | 'user_left'
  | 'message_sent'
  | 'screen_share_started'
  | 'screen_share_stopped'
  | 'document_updated'
  | 'cursor_moved'
  | 'selection_changed'
  | 'typing_started'
  | 'typing_stopped'
  | 'heartbeat'
  | 'error';

export interface WSEvent<T = any> {
  type: WSEventType;
  data: T;
  sessionId?: string;
  userId?: string;
  timestamp: number;
}