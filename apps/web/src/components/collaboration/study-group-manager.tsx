'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudyGroup, GroupParticipant, CollaborationActivity, CollaborationActivityType } from '@lusilearn/shared-types';
import { 
  Users, Settings, Calendar, MessageCircle, Video, FileText, 
  MoreVertical, Crown, Shield, UserPlus, UserMinus, Clock, 
  Play, Pause, CheckCircle, AlertCircle, BookOpen
} from 'lucide-react';

interface StudyGroupManagerProps {
  groups: StudyGroup[];
  currentUserId: string;
  onJoinGroup: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
  onCreateActivity: (groupId: string, activity: Partial<CollaborationActivity>) => void;
  onManageGroup: (groupId: string, action: string, data?: any) => void;
}

export function StudyGroupManager({ 
  groups, 
  currentUserId, 
  onJoinGroup, 
  onLeaveGroup, 
  onCreateActivity, 
  onManageGroup 
}: StudyGroupManagerProps) {
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);

  const myGroups = groups.filter(group => 
    group.participants.some((p: GroupParticipant) => p.userId === currentUserId)
  );

  const availableGroups = groups.filter(group => 
    !group.participants.some((p: GroupParticipant) => p.userId === currentUserId) &&
    group.settings.privacy === 'public' &&
    group.participants.length < group.settings.maxSize
  );

  const getUserRole = (group: StudyGroup): string => {
    const participant = group.participants.find((p: GroupParticipant) => p.userId === currentUserId);
    return participant?.role || 'none';
  };

  const isGroupAdmin = (group: StudyGroup): boolean => {
    return getUserRole(group) === 'admin';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="my-groups" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="my-groups">My Groups ({myGroups.length})</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="my-groups" className="space-y-4">
          {myGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No study groups yet</h3>
                <p className="text-muted-foreground mb-4">
                  Join existing groups or create your own to start collaborating with peers.
                </p>
                <Button onClick={() => setShowCreateActivity(true)}>
                  Create Study Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myGroups.map(group => (
                <StudyGroupCard
                  key={group.id}
                  group={group}
                  userRole={getUserRole(group)}
                  onSelect={() => setSelectedGroup(group)}
                  onLeave={() => onLeaveGroup(group.id)}
                  onManage={(action, data) => onManageGroup(group.id, action, data)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Available Study Groups</h3>
              <p className="text-sm text-muted-foreground">
                Discover and join public study groups in your areas of interest
              </p>
            </div>
            <Input 
              placeholder="Search groups..." 
              className="max-w-xs"
            />
          </div>

          {availableGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No available groups</h3>
                <p className="text-muted-foreground">
                  Be the first to create a study group in your subject area!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableGroups.map(group => (
                <DiscoverGroupCard
                  key={group.id}
                  group={group}
                  onJoin={() => onJoinGroup(group.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Recent Activities</h3>
              <p className="text-sm text-muted-foreground">
                Track your participation in group activities and sessions
              </p>
            </div>
            <Button onClick={() => setShowCreateActivity(true)}>
              Schedule Activity
            </Button>
          </div>

          <div className="space-y-3">
            {myGroups.flatMap(group => 
              group.activities.map((activity: CollaborationActivity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  group={group}
                  currentUserId={currentUserId}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selectedGroup && (
        <GroupDetailsModal
          group={selectedGroup}
          userRole={getUserRole(selectedGroup)}
          onClose={() => setSelectedGroup(null)}
          onCreateActivity={(activity) => {
            onCreateActivity(selectedGroup.id, activity);
            setSelectedGroup(null);
          }}
          onManage={(action, data) => onManageGroup(selectedGroup.id, action, data)}
        />
      )}
    </div>
  );
}

interface StudyGroupCardProps {
  group: StudyGroup;
  userRole: string;
  onSelect: () => void;
  onLeave: () => void;
  onManage: (action: string, data?: any) => void;
}

function StudyGroupCard({ group, userRole, onSelect, onLeave, onManage }: StudyGroupCardProps) {
  const activeMembers = group.participants.filter((p: GroupParticipant) => p.isActive).length;
  const recentActivity = group.activities
    .filter((a: CollaborationActivity) => !a.isCompleted)
    .sort((a: CollaborationActivity, b: CollaborationActivity) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onSelect}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{group.subject}</Badge>
              <Badge variant="outline">{group.topic}</Badge>
              {userRole === 'admin' && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {group.description}
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activeMembers}/{group.settings.maxSize} active
            </span>
            <span className="flex items-center gap-1 capitalize">
              <Shield className="h-3 w-3" />
              {group.settings.moderationLevel}
            </span>
          </div>

          {recentActivity && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Next: {recentActivity.title}</span>
              <span>({formatDate(recentActivity.startTime)})</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button size="sm" className="flex-1">
            <MessageCircle className="h-3 w-3 mr-1" />
            Chat
          </Button>
          <Button size="sm" variant="outline">
            <Video className="h-3 w-3 mr-1" />
            Meet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DiscoverGroupCardProps {
  group: StudyGroup;
  onJoin: () => void;
}

function DiscoverGroupCard({ group, onJoin }: DiscoverGroupCardProps) {
  const activeMembers = group.participants.filter((p: GroupParticipant) => p.isActive).length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">{group.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{group.subject}</Badge>
            <Badge variant="outline">{group.topic}</Badge>
            <Badge variant="outline" className="capitalize">
              {group.settings.privacy}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {group.description}
        </p>

        <div className="flex items-center justify-between text-sm mb-4">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {activeMembers}/{group.settings.maxSize} members
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {formatDate(group.createdAt)}
          </span>
        </div>

        <Button onClick={onJoin} className="w-full">
          <UserPlus className="h-3 w-3 mr-1" />
          Join Group
        </Button>
      </CardContent>
    </Card>
  );
}

interface ActivityCardProps {
  activity: CollaborationActivity;
  group: StudyGroup;
  currentUserId: string;
}

function ActivityCard({ activity, group, currentUserId }: ActivityCardProps) {
  const isParticipant = activity.participants.includes(currentUserId);
  const getActivityIcon = (type: CollaborationActivityType) => {
    switch (type) {
      case CollaborationActivityType.STUDY_SESSION:
        return <BookOpen className="h-4 w-4" />;
      case CollaborationActivityType.DISCUSSION:
        return <MessageCircle className="h-4 w-4" />;
      case CollaborationActivityType.PROJECT:
        return <FileText className="h-4 w-4" />;
      case CollaborationActivityType.PEER_REVIEW:
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getStatusIcon = () => {
    if (activity.isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    const now = new Date();
    const startTime = new Date(activity.startTime);
    const endTime = activity.endTime ? new Date(activity.endTime) : null;
    
    if (now < startTime) {
      return <Clock className="h-4 w-4 text-blue-500" />;
    }
    if (endTime && now > endTime) {
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    }
    return <Play className="h-4 w-4 text-green-500" />;
  };

  return (
    <Card className={`border-l-4 ${isParticipant ? 'border-l-blue-500' : 'border-l-gray-300'}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              {getActivityIcon(activity.type)}
              <h4 className="font-medium">{activity.title}</h4>
              {getStatusIcon()}
            </div>
            
            <p className="text-sm text-muted-foreground">{activity.description}</p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {activity.participants.length} participants
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(activity.startTime)}
              </span>
              <Badge variant="outline" className="text-xs">
                {group.name}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2 ml-4">
            {isParticipant ? (
              <Button size="sm">Join Session</Button>
            ) : (
              <Button size="sm" variant="outline">View Details</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface GroupDetailsModalProps {
  group: StudyGroup;
  userRole: string;
  onClose: () => void;
  onCreateActivity: (activity: Partial<CollaborationActivity>) => void;
  onManage: (action: string, data?: any) => void;
}

function GroupDetailsModal({ group, userRole, onClose, onCreateActivity, onManage }: GroupDetailsModalProps) {
  // This would be implemented as a modal/dialog component
  // For now, returning null as modal implementation would require additional UI components
  return null;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}