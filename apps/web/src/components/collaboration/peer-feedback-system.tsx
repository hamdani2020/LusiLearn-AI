'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Star, ThumbsUp, ThumbsDown, MessageSquare, Award, 
  TrendingUp, Users, BookOpen, Clock, Target, Heart,
  CheckCircle, AlertCircle, Flag, Send
} from 'lucide-react';

interface PeerFeedback {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  sessionId: string;
  sessionTitle: string;
  rating: number; // 1-5 stars
  categories: {
    helpfulness: number;
    communication: number;
    knowledge: number;
    collaboration: number;
    reliability: number;
  };
  comment: string;
  isAnonymous: boolean;
  timestamp: Date;
  tags: string[];
}

interface PeerRating {
  userId: string;
  username: string;
  overallRating: number;
  totalFeedbacks: number;
  categoryAverages: {
    helpfulness: number;
    communication: number;
    knowledge: number;
    collaboration: number;
    reliability: number;
  };
  recentFeedbacks: PeerFeedback[];
  achievements: string[];
  collaborationCount: number;
}

interface FeedbackFormData {
  rating: number;
  categories: {
    helpfulness: number;
    communication: number;
    knowledge: number;
    collaboration: number;
    reliability: number;
  };
  comment: string;
  isAnonymous: boolean;
  tags: string[];
}

interface PeerFeedbackSystemProps {
  currentUserId: string;
  receivedFeedbacks: PeerFeedback[];
  givenFeedbacks: PeerFeedback[];
  peerRatings: PeerRating[];
  onSubmitFeedback: (feedback: FeedbackFormData & { toUserId: string; sessionId: string }) => void;
  onReportFeedback: (feedbackId: string, reason: string) => void;
}

export function PeerFeedbackSystem({
  currentUserId,
  receivedFeedbacks,
  givenFeedbacks,
  peerRatings,
  onSubmitFeedback,
  onReportFeedback
}: PeerFeedbackSystemProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const myRating = peerRatings.find(rating => rating.userId === currentUserId);
  const otherRatings = peerRatings.filter(rating => rating.userId !== currentUserId);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="my-rating" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="my-rating">My Rating</TabsTrigger>
          <TabsTrigger value="received">Received ({receivedFeedbacks.length})</TabsTrigger>
          <TabsTrigger value="given">Given ({givenFeedbacks.length})</TabsTrigger>
          <TabsTrigger value="leaderboard">Peer Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="my-rating" className="space-y-4">
          {myRating ? (
            <MyRatingOverview rating={myRating} />
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No ratings yet</h3>
                <p className="text-muted-foreground">
                  Start collaborating with peers to receive feedback and build your reputation.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Feedback Received</h3>
              <p className="text-sm text-muted-foreground">
                See what your peers think about your collaboration
              </p>
            </div>
            <Button
              onClick={() => setShowFeedbackForm(true)}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Give Feedback
            </Button>
          </div>

          {receivedFeedbacks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No feedback received</h3>
                <p className="text-muted-foreground">
                  Collaborate with peers in study sessions to start receiving feedback.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {receivedFeedbacks.map(feedback => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  showFromUser={true}
                  onReport={(reason) => onReportFeedback(feedback.id, reason)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="given" className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Feedback Given</h3>
            <p className="text-sm text-muted-foreground">
              Track the feedback you've provided to your collaboration partners
            </p>
          </div>

          {givenFeedbacks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <ThumbsUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No feedback given</h3>
                <p className="text-muted-foreground">
                  Help your peers improve by providing constructive feedback after collaborations.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {givenFeedbacks.map(feedback => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  showFromUser={false}
                  onReport={(reason) => onReportFeedback(feedback.id, reason)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Peer Rankings</h3>
            <p className="text-sm text-muted-foreground">
              Top-rated collaboration partners in your learning community
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherRatings
              .sort((a, b) => b.overallRating - a.overallRating)
              .slice(0, 9)
              .map((rating, index) => (
                <PeerRatingCard
                  key={rating.userId}
                  rating={rating}
                  rank={index + 1}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {showFeedbackForm && (
        <FeedbackFormModal
          onClose={() => setShowFeedbackForm(false)}
          onSubmit={(feedback) => {
            if (selectedPeer && selectedSession) {
              onSubmitFeedback({
                ...feedback,
                toUserId: selectedPeer,
                sessionId: selectedSession
              });
              setShowFeedbackForm(false);
            }
          }}
        />
      )}
    </div>
  );
}

interface MyRatingOverviewProps {
  rating: PeerRating;
}

function MyRatingOverview({ rating }: MyRatingOverviewProps) {
  const categories = [
    { key: 'helpfulness', label: 'Helpfulness', icon: Heart },
    { key: 'communication', label: 'Communication', icon: MessageSquare },
    { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { key: 'collaboration', label: 'Collaboration', icon: Users },
    { key: 'reliability', label: 'Reliability', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Your Collaboration Rating
          </CardTitle>
          <CardDescription>
            Based on {rating.totalFeedbacks} feedback{rating.totalFeedbacks !== 1 ? 's' : ''} from peers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {rating.overallRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= rating.overallRating
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex-1 space-y-3">
              {categories.map(category => {
                const IconComponent = category.icon;
                const value = rating.categoryAverages[category.key as keyof typeof rating.categoryAverages];
                return (
                  <div key={category.key} className="flex items-center gap-3">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium w-24">{category.label}</span>
                    <Progress value={value * 20} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-8">
                      {value.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {rating.collaborationCount}
              </div>
              <div className="text-sm text-muted-foreground">Collaborations</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {rating.achievements.length}
              </div>
              <div className="text-sm text-muted-foreground">Achievements</div>
            </div>
          </div>

          {rating.achievements.length > 0 && (
            <div className="mt-4">
              <Label className="text-sm font-medium mb-2 block">Recent Achievements</Label>
              <div className="flex flex-wrap gap-2">
                {rating.achievements.slice(0, 5).map(achievement => (
                  <Badge key={achievement} variant="secondary" className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {achievement}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rating.recentFeedbacks.slice(0, 3).map(feedback => (
              <div key={feedback.id} className="border-l-4 border-l-blue-500 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= feedback.rating
                            ? 'text-yellow-500 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {feedback.isAnonymous ? 'Anonymous' : feedback.fromUsername}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(feedback.timestamp)}
                  </span>
                </div>
                <p className="text-sm">{feedback.comment}</p>
                {feedback.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {feedback.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface FeedbackCardProps {
  feedback: PeerFeedback;
  showFromUser: boolean;
  onReport: (reason: string) => void;
}

function FeedbackCard({ feedback, showFromUser, onReport }: FeedbackCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= feedback.rating
                          ? 'text-yellow-500 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium">
                  {showFromUser
                    ? (feedback.isAnonymous ? 'Anonymous Peer' : feedback.fromUsername)
                    : feedback.toUsername
                  }
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Session: {feedback.sessionTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(feedback.timestamp)}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide' : 'Details'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReport('inappropriate')}
              >
                <Flag className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <p className="text-sm">{feedback.comment}</p>

          {feedback.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {feedback.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {showDetails && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-medium">Category Ratings</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Helpfulness:</span>
                  <span>{feedback.categories.helpfulness}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Communication:</span>
                  <span>{feedback.categories.communication}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Knowledge:</span>
                  <span>{feedback.categories.knowledge}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Collaboration:</span>
                  <span>{feedback.categories.collaboration}/5</span>
                </div>
                <div className="flex justify-between">
                  <span>Reliability:</span>
                  <span>{feedback.categories.reliability}/5</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface PeerRatingCardProps {
  rating: PeerRating;
  rank: number;
}

function PeerRatingCard({ rating, rank }: PeerRatingCardProps) {
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-600';
    if (rank === 2) return 'text-gray-500';
    if (rank === 3) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return '🏆';
    if (rank <= 5) return '🥇';
    return '⭐';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getRankIcon(rank)}</span>
              <div>
                <h4 className="font-medium">{rating.username}</h4>
                <p className={`text-sm font-medium ${getRankColor(rank)}`}>
                  Rank #{rank}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-yellow-600">
                {rating.overallRating.toFixed(1)}
              </div>
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= rating.overallRating
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Collaborations:</span>
              <span>{rating.collaborationCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Feedbacks:</span>
              <span>{rating.totalFeedbacks}</span>
            </div>
          </div>

          {rating.achievements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rating.achievements.slice(0, 2).map(achievement => (
                <Badge key={achievement} variant="secondary" className="text-xs">
                  {achievement}
                </Badge>
              ))}
              {rating.achievements.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{rating.achievements.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface FeedbackFormModalProps {
  onClose: () => void;
  onSubmit: (feedback: FeedbackFormData) => void;
}

function FeedbackFormModal({ onClose, onSubmit }: FeedbackFormModalProps) {
  const [formData, setFormData] = useState<FeedbackFormData>({
    rating: 0,
    categories: {
      helpfulness: 0,
      communication: 0,
      knowledge: 0,
      collaboration: 0,
      reliability: 0
    },
    comment: '',
    isAnonymous: false,
    tags: []
  });

  const handleSubmit = () => {
    if (formData.rating > 0 && formData.comment.trim()) {
      onSubmit(formData);
    }
  };

  const suggestedTags = [
    'Helpful', 'Patient', 'Knowledgeable', 'Encouraging', 'Reliable',
    'Creative', 'Organized', 'Responsive', 'Supportive', 'Insightful'
  ];

  // This would be implemented as a modal/dialog component
  // For now, returning null as modal implementation would require additional UI components
  return null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}