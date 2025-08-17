'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, Send, Paperclip, Smile, MoreVertical, 
  Users, Video, Phone, Share2, Flag, Mic, MicOff,
  Camera, CameraOff, Monitor, Settings, Volume2, VolumeX
} from 'lucide-react';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'system' | 'code';
  attachments?: FileAttachment[];
  reactions?: MessageReaction[];
  isEdited?: boolean;
}

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

interface ChatParticipant {
  id: string;
  username: string;
  isOnline: boolean;
  role: 'admin' | 'moderator' | 'member';
  isTyping: boolean;
  isMuted: boolean;
  hasVideo: boolean;
}

interface CollaborationChatProps {
  groupId: string;
  currentUserId: string;
  messages: ChatMessage[];
  participants: ChatParticipant[];
  onSendMessage: (content: string, type?: string) => void;
  onFileUpload: (file: File) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onStartVideoCall: () => void;
  onStartScreenShare: () => void;
  onReportMessage: (messageId: string, reason: string) => void;
}

export function CollaborationChat({
  groupId,
  currentUserId,
  messages,
  participants,
  onSendMessage,
  onFileUpload,
  onReaction,
  onStartVideoCall,
  onStartScreenShare,
  onReportMessage
}: CollaborationChatProps) {
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const onlineParticipants = participants.filter(p => p.isOnline);
  const typingUsers = participants.filter(p => p.isTyping && p.id !== currentUserId);

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🤔'];

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <CardTitle className="text-lg">Group Chat</CardTitle>
              <Badge variant="secondary">{onlineParticipants.length} online</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onStartVideoCall}
                className="flex items-center gap-1"
              >
                <Video className="h-3 w-3" />
                Video Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onStartScreenShare}
                className="flex items-center gap-1"
              >
                <Monitor className="h-3 w-3" />
                Share Screen
              </Button>
              <Button size="sm" variant="ghost">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <Tabs defaultValue="chat" className="flex-1 flex flex-col">
          <TabsList className="mx-4">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="participants">Participants ({participants.length})</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
            <CardContent className="flex-1 flex flex-col p-4">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-96">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.userId === currentUserId}
                    onReaction={(emoji) => onReaction(message.id, emoji)}
                    onReport={(reason) => onReportMessage(message.id, reason)}
                  />
                ))}
                {typingUsers.length > 0 && (
                  <div className="text-sm text-muted-foreground italic">
                    {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Video Call Controls */}
              {isVideoCallActive && (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm">Video call active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isMuted ? "destructive" : "secondary"}
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant={hasVideo ? "secondary" : "outline"}
                        onClick={() => setHasVideo(!hasVideo)}
                      >
                        {hasVideo ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setIsVideoCallActive(false)}
                      >
                        End Call
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        setIsTyping(e.target.value.length > 0);
                      }}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      >
                        <Smile className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>

                {/* Emoji Picker */}
                {showEmojiPicker && (
                  <div className="bg-white border rounded-lg p-2 shadow-lg">
                    <div className="flex flex-wrap gap-1">
                      {commonEmojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setMessageInput(prev => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              />
            </CardContent>
          </TabsContent>

          <TabsContent value="participants" className="flex-1">
            <CardContent className="p-4">
              <div className="space-y-3">
                {participants.map(participant => (
                  <ParticipantItem
                    key={participant.id}
                    participant={participant}
                    isCurrentUser={participant.id === currentUserId}
                  />
                ))}
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="files" className="flex-1">
            <CardContent className="p-4">
              <div className="text-center py-8">
                <Paperclip className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Shared Files</h3>
                <p className="text-muted-foreground">
                  Files shared in this group will appear here
                </p>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReaction: (emoji: string) => void;
  onReport: (reason: string) => void;
}

function MessageBubble({ message, isOwn, onReaction, onReport }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
          isOwn
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {!isOwn && (
          <div className="text-xs font-medium mb-1 opacity-70">
            {message.username}
          </div>
        )}
        
        <div className="text-sm">
          {message.type === 'code' ? (
            <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
              <code>{message.content}</code>
            </pre>
          ) : (
            <p>{message.content}</p>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map(attachment => (
              <div key={attachment.id} className="flex items-center gap-2 text-xs">
                <Paperclip className="h-3 w-3" />
                <span>{attachment.name}</span>
                <span className="opacity-70">({formatFileSize(attachment.size)})</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-1">
          <div className="text-xs opacity-70">
            {formatTime(message.timestamp)}
            {message.isEdited && <span className="ml-1">(edited)</span>}
          </div>
          
          {showActions && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReaction('👍')}
                className="h-5 w-5 p-0"
              >
                👍
              </Button>
              {!isOwn && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReport('inappropriate')}
                  className="h-5 w-5 p-0"
                >
                  <Flag className="h-2 w-2" />
                </Button>
              )}
            </div>
          )}
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                onClick={() => onReaction(reaction.emoji)}
                className="flex items-center gap-1 bg-white bg-opacity-20 rounded-full px-2 py-1 text-xs"
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ParticipantItemProps {
  participant: ChatParticipant;
  isCurrentUser: boolean;
}

function ParticipantItem({ participant, isCurrentUser }: ParticipantItemProps) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'moderator': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {participant.username.charAt(0).toUpperCase()}
          </div>
          {participant.isOnline && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>
        
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {participant.username}
              {isCurrentUser && <span className="text-muted-foreground">(You)</span>}
            </span>
            <Badge variant="outline" className={`text-xs ${getRoleColor(participant.role)}`}>
              {participant.role}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {participant.isTyping && <span>Typing...</span>}
            {participant.isMuted && <VolumeX className="h-3 w-3" />}
            {participant.hasVideo && <Camera className="h-3 w-3" />}
          </div>
        </div>
      </div>
      
      {!isCurrentUser && (
        <Button size="sm" variant="ghost">
          <MoreVertical className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}