/**
 * Real-time Collaboration Example Component
 * Demonstrates how to use the real-time communication system
 */

'use client';

import React, { useState } from 'react';
import { useRealTimeCollaboration } from '@/hooks/use-real-time-collaboration';
import { useConnectionState } from '@/hooks/use-connection-state';
import { ConnectionStatus } from '@/components/connection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  MessageCircle, 
  Monitor, 
  MonitorOff,
  Send,
  UserPlus,
  Settings
} from 'lucide-react';

export function RealTimeCollaborationExample() {
  const [sessionId, setSessionId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const {
    session,
    participants,
    messages,
    screenShare,
    isConnected,
    connectionState,
    joinSession,
    leaveSession,
    sendMessage,
    startScreenShare,
    stopScreenShare,
    participantCount,
    messageCount,
    canScreenShare
  } = useRealTimeCollaboration();

  const { status } = useConnectionState();

  const handleJoinSession = async () => {
    if (!sessionId.trim()) return;
    
    try {
      await joinSession(sessionId);
      setIsJoined(true);
    } catch (error) {
      console.error('Failed to join session:', error);
    }
  };

  const handleLeaveSession = () => {
    leaveSession();
    setIsJoined(false);
    setSessionId('');
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    sendMessage(messageText);
    setMessageText('');
  };

  const handleScreenShare = async () => {
    if (screenShare.isSharing) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch (error) {
        console.error('Failed to start screen share:', error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Real-time Collaboration Demo</h1>
        <p className="text-muted-foreground">
          Experience live collaboration with WebSocket-powered real-time features
        </p>
      </div>

      {/* Connection Status */}
      <ConnectionStatus 
        position="inline" 
        showDetails={true}
        className="mb-4"
      />

      {/* Session Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Session Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isJoined ? (
            <div className="flex gap-2">
              <Input
                placeholder="Enter session ID (e.g., study-group-123)"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleJoinSession}
                disabled={!sessionId.trim() || !status.isOnline}
              >
                Join Session
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="secondary">
                  Session: {session?.id || sessionId}
                </Badge>
                <Badge variant={isConnected ? 'default' : 'destructive'}>
                  {connectionState}
                </Badge>
              </div>
              <Button variant="outline" onClick={handleLeaveSession}>
                Leave Session
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isJoined && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Participants Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participantCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div 
                      key={participant.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted"
                    >
                      <div>
                        <div className="font-medium">{participant.username}</div>
                        <div className="text-sm text-muted-foreground">
                          {participant.role}
                        </div>
                      </div>
                      <Badge 
                        variant={participant.isOnline ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {participant.isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                  {participantCount === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No participants yet
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="mt-4 space-y-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  disabled={!isConnected}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Participant
                </Button>
                
                <Button 
                  size="sm" 
                  variant={screenShare.isSharing ? 'destructive' : 'default'}
                  className="w-full"
                  onClick={handleScreenShare}
                  disabled={!canScreenShare && !screenShare.isSharing}
                >
                  {screenShare.isSharing ? (
                    <>
                      <MonitorOff className="h-4 w-4 mr-2" />
                      Stop Sharing
                    </>
                  ) : (
                    <>
                      <Monitor className="h-4 w-4 mr-2" />
                      Share Screen
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Messages Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Messages ({messageCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 mb-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div 
                      key={message.id}
                      className="flex flex-col gap-1 p-3 rounded-lg bg-muted"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {message.senderName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm">{message.content}</div>
                      {message.type !== 'text' && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {message.type}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {messageCount === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!isConnected}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || !isConnected}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Screen Share Display */}
      {screenShare.isSharing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Screen Share
              {screenShare.sharerName && (
                <Badge variant="secondary">
                  Shared by {screenShare.sharerName}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-2" />
                <p>Screen sharing active</p>
                <p className="text-sm">Stream ID: {screenShare.streamId}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Connection</div>
              <div className="text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <div>
              <div className="font-medium">Online Status</div>
              <div className="text-muted-foreground">
                {status.isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
            <div>
              <div className="font-medium">Queue Size</div>
              <div className="text-muted-foreground">
                {status.offlineQueueSize} actions
              </div>
            </div>
            <div>
              <div className="font-medium">Latency</div>
              <div className="text-muted-foreground">
                {status.latency ? `${status.latency}ms` : 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}