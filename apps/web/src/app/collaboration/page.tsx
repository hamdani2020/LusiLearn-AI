'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PeerMatchingInterface,
  PeerDiscovery,
  StudyGroupCreator,
  StudyGroupManager,
  CollaborationChat,
  PeerFeedbackSystem
} from '@/components/collaboration';
import { 
  Users, Search, Plus, MessageCircle, Star, 
  BookOpen, Target, Clock, TrendingUp 
} from 'lucide-react';

// Mock data - in real app, this would come from API calls
const mockData = {
  matches: [],
  peers: [],
  groups: [],
  messages: [],
  participants: [],
  receivedFeedbacks: [],
  givenFeedbacks: [],
  peerRatings: []
};

export default function CollaborationPage() {
  const [activeTab, setActiveTab] = useState('discover');
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Mock handlers - in real app, these would make API calls
  const handleMatchRequest = (criteria: any) => {
    console.log('Finding matches with criteria:', criteria);
  };

  const handlePeerSearch = (query: string, filters: any) => {
    console.log('Searching peers:', query, filters);
  };

  const handleCreateGroup = (groupData: any) => {
    console.log('Creating group:', groupData);
    setShowGroupCreator(false);
  };

  const handleJoinGroup = (groupId: string) => {
    console.log('Joining group:', groupId);
  };

  const handleLeaveGroup = (groupId: string) => {
    console.log('Leaving group:', groupId);
  };

  const handleCreateActivity = (groupId: string, activity: any) => {
    console.log('Creating activity for group:', groupId, activity);
  };

  const handleManageGroup = (groupId: string, action: string, data?: any) => {
    console.log('Managing group:', groupId, action, data);
  };

  const handleSendMessage = (content: string, type?: string) => {
    console.log('Sending message:', content, type);
  };

  const handleFileUpload = (file: File) => {
    console.log('Uploading file:', file.name);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    console.log('Adding reaction:', messageId, emoji);
  };

  const handleStartVideoCall = () => {
    console.log('Starting video call');
  };

  const handleStartScreenShare = () => {
    console.log('Starting screen share');
  };

  const handleReportMessage = (messageId: string, reason: string) => {
    console.log('Reporting message:', messageId, reason);
  };

  const handleSubmitFeedback = (feedback: any) => {
    console.log('Submitting feedback:', feedback);
  };

  const handleReportFeedback = (feedbackId: string, reason: string) => {
    console.log('Reporting feedback:', feedbackId, reason);
  };

  if (showGroupCreator) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setShowGroupCreator(false)}
            className="mb-4"
          >
            ← Back to Collaboration
          </Button>
        </div>
        <StudyGroupCreator
          onCreateGroup={handleCreateGroup}
          isCreating={false}
        />
      </div>
    );
  }

  if (selectedGroupId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => setSelectedGroupId(null)}
            className="mb-4"
          >
            ← Back to Groups
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CollaborationChat
              groupId={selectedGroupId}
              currentUserId="current-user-id"
              messages={mockData.messages}
              participants={mockData.participants}
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
              onReaction={handleReaction}
              onStartVideoCall={handleStartVideoCall}
              onStartScreenShare={handleStartScreenShare}
              onReportMessage={handleReportMessage}
            />
          </div>
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Group Info</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Group details and member information would be displayed here.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Collaboration Hub</h1>
        <p className="text-muted-foreground">
          Connect with peers, join study groups, and collaborate on your learning journey
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Study Groups</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Active Chats</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">0.0</div>
                <div className="text-xs text-muted-foreground">Peer Rating</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Collaborations</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="discover">Discover Peers</TabsTrigger>
          <TabsTrigger value="matching">Find Matches</TabsTrigger>
          <TabsTrigger value="groups">Study Groups</TabsTrigger>
          <TabsTrigger value="feedback">Peer Feedback</TabsTrigger>
          <TabsTrigger value="chat">Active Chats</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-6">
          <PeerDiscovery
            onSearch={handlePeerSearch}
            peers={mockData.peers}
            isLoading={false}
          />
        </TabsContent>

        <TabsContent value="matching" className="mt-6">
          <PeerMatchingInterface
            onMatchRequest={handleMatchRequest}
            matches={mockData.matches}
            isLoading={false}
          />
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Study Groups</h2>
                <p className="text-muted-foreground">
                  Manage your study groups and discover new ones
                </p>
              </div>
              <Button 
                onClick={() => setShowGroupCreator(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </div>
            
            <StudyGroupManager
              groups={mockData.groups}
              currentUserId="current-user-id"
              onJoinGroup={handleJoinGroup}
              onLeaveGroup={handleLeaveGroup}
              onCreateActivity={handleCreateActivity}
              onManageGroup={handleManageGroup}
            />
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <PeerFeedbackSystem
            currentUserId="current-user-id"
            receivedFeedbacks={mockData.receivedFeedbacks}
            givenFeedbacks={mockData.givenFeedbacks}
            peerRatings={mockData.peerRatings}
            onSubmitFeedback={handleSubmitFeedback}
            onReportFeedback={handleReportFeedback}
          />
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Active Conversations
              </CardTitle>
              <CardDescription>
                Your ongoing chats and collaboration sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No active chats</h3>
                <p className="text-muted-foreground mb-4">
                  Join a study group or start a collaboration to begin chatting with peers.
                </p>
                <Button onClick={() => setActiveTab('groups')}>
                  Browse Study Groups
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}