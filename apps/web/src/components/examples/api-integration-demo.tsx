'use client';

import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useLearningPaths, 
  useProgressTracking, 
  useAssessments, 
  useCollaboration, 
  useAdaptiveDifficulty, 
  useSafetyModeration, 
  useMonitoring 
} from '@/hooks';

export function ApiIntegrationDemo() {
  // Initialize all hooks
  const learningPaths = useLearningPaths();
  const progress = useProgressTracking();
  const assessments = useAssessments();
  const collaboration = useCollaboration();
  const adaptiveDifficulty = useAdaptiveDifficulty();
  const safety = useSafetyModeration();
  const monitoring = useMonitoring();

  // Load initial data
  useEffect(() => {
    learningPaths.fetchLearningPaths();
    progress.fetchAnalytics('weekly');
    collaboration.fetchStudyGroups();
    monitoring.checkHealth();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">API Integration Demo</h1>
        <p className="text-muted-foreground">
          This component demonstrates the integration of all available API endpoints
        </p>
      </div>

      <Tabs defaultValue="learning-paths" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="learning-paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="adaptive">Adaptive</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        {/* Learning Paths Tab */}
        <TabsContent value="learning-paths" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Paths</CardTitle>
              <CardDescription>
                Manage and track learning paths
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => learningPaths.fetchLearningPaths()}
                  disabled={learningPaths.loading}
                >
                  {learningPaths.loading ? 'Loading...' : 'Refresh Paths'}
                </Button>
                <Button 
                  onClick={() => learningPaths.createLearningPath({
                    subject: 'Mathematics',
                    goals: ['Master calculus', 'Understand linear algebra']
                  })}
                  disabled={learningPaths.loading}
                >
                  Create Path
                </Button>
              </div>
              
              {learningPaths.error && (
                <div className="text-red-500 text-sm">{learningPaths.error}</div>
              )}
              
              <div className="space-y-2">
                <h4 className="font-semibold">Learning Paths ({learningPaths.learningPaths.length})</h4>
                {learningPaths.learningPaths.map(path => (
                  <div key={path.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-medium">{path.subject}</h5>
                        <p className="text-sm text-muted-foreground">
                          {path.objectives.length} objectives
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => learningPaths.deleteLearningPath(path.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress Tracking</CardTitle>
              <CardDescription>
                Monitor learning progress and analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => progress.fetchAnalytics('weekly')}
                  disabled={progress.loading}
                >
                  Weekly Analytics
                </Button>
                <Button 
                  onClick={() => progress.fetchStreaks()}
                  disabled={progress.loading}
                >
                  Get Streaks
                </Button>
              </div>
              
              {progress.error && (
                <div className="text-red-500 text-sm">{progress.error}</div>
              )}
              
              {progress.analytics && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{progress.currentStreak}</div>
                    <div className="text-sm text-muted-foreground">Current Streak</div>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <div className="text-2xl font-bold text-primary">{progress.longestStreak}</div>
                    <div className="text-sm text-muted-foreground">Longest Streak</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assessments Tab */}
        <TabsContent value="assessments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>
                Take assessments and view results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => assessments.fetchQuestions('Mathematics', 10)}
                  disabled={assessments.loading}
                >
                  Get Questions
                </Button>
                <Button 
                  onClick={() => assessments.fetchRecommendations()}
                  disabled={assessments.loading}
                >
                  Get Recommendations
                </Button>
              </div>
              
              {assessments.error && (
                <div className="text-red-500 text-sm">{assessments.error}</div>
              )}
              
              {assessments.hasQuestions && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Questions ({assessments.questionCount})</h4>
                  <div className="text-sm text-muted-foreground">
                    Ready to take assessment
                  </div>
                </div>
              )}
              
              {assessments.hasResult && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold mb-2">Assessment Result</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-primary">{assessments.score}%</div>
                      <div className="text-sm text-muted-foreground">Score</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-primary">{assessments.correctAnswers}/{assessments.totalQuestions}</div>
                      <div className="text-sm text-muted-foreground">Correct</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-primary">{assessments.timeSpent}s</div>
                      <div className="text-sm text-muted-foreground">Time</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collaboration Tab */}
        <TabsContent value="collaboration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collaboration</CardTitle>
              <CardDescription>
                Manage study groups and peer matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => collaboration.fetchStudyGroups()}
                  disabled={collaboration.loading}
                >
                  Refresh Groups
                </Button>
                <Button 
                  onClick={() => collaboration.findPeerMatches({
                    subjects: ['Mathematics', 'Physics'],
                    skillLevel: 'intermediate',
                    availability: ['weekdays', 'evenings']
                  })}
                  disabled={collaboration.loading}
                >
                  Find Peers
                </Button>
              </div>
              
              {collaboration.error && (
                <div className="text-red-500 text-sm">{collaboration.error}</div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Study Groups ({collaboration.studyGroupCount})</h4>
                  {collaboration.studyGroups.map(group => (
                    <div key={group.id} className="p-2 border rounded mb-2">
                      <div className="font-medium">{group.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {group.currentMembers}/{group.maxSize} members
                      </div>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Peer Matches ({collaboration.peerMatchCount})</h4>
                  {collaboration.peerMatches.map(match => (
                    <div key={match.userId} className="p-2 border rounded mb-2">
                      <div className="font-medium">{match.username}</div>
                      <div className="text-sm text-muted-foreground">
                        Match: {match.matchScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adaptive Difficulty Tab */}
        <TabsContent value="adaptive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adaptive Difficulty</CardTitle>
              <CardDescription>
                AI-powered difficulty adjustment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => adaptiveDifficulty.analyzePerformance('Mathematics')}
                  disabled={adaptiveDifficulty.loading}
                >
                  Analyze Performance
                </Button>
                <Button 
                  onClick={() => adaptiveDifficulty.fetchRecommendations()}
                  disabled={adaptiveDifficulty.loading}
                >
                  Get Recommendations
                </Button>
              </div>
              
              {adaptiveDifficulty.error && (
                <div className="text-red-500 text-sm">{adaptiveDifficulty.error}</div>
              )}
              
              {adaptiveDifficulty.hasAnalysis && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold mb-2">Performance Analysis</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Difficulty</div>
                      <div className="text-lg font-bold">{adaptiveDifficulty.currentDifficulty}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Recommended</div>
                      <div className="text-lg font-bold">{adaptiveDifficulty.recommendedDifficulty}</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm text-muted-foreground">Confidence</div>
                    <div className="text-lg font-bold">{adaptiveDifficulty.confidence}%</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety & Moderation</CardTitle>
              <CardDescription>
                Content filtering and safety features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => safety.filterContent({
                    content: 'This is a test message for content filtering',
                    contentType: 'text',
                    userId: 'user123'
                  })}
                  disabled={safety.loading}
                >
                  Test Content Filter
                </Button>
                <Button 
                  onClick={() => safety.fetchModerationStatus()}
                  disabled={safety.loading}
                >
                  Check Status
                </Button>
              </div>
              
              {safety.error && (
                <div className="text-red-500 text-sm">{safety.error}</div>
              )}
              
              {safety.hasFilterResponse && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold mb-2">Content Filter Result</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span>Status:</span>
                    <Badge variant={safety.isContentAppropriate ? 'default' : 'destructive'}>
                      {safety.isContentAppropriate ? 'Appropriate' : 'Inappropriate'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Confidence: {safety.filterConfidence}%
                  </div>
                </div>
              )}
              
              {safety.hasModerationStatus && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold mb-2">User Status</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span>Status:</span>
                    <Badge variant={safety.userStatus === 'clean' ? 'default' : 'destructive'}>
                      {safety.userStatus}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Warnings: {safety.warningCount}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Monitoring</CardTitle>
              <CardDescription>
                System health and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={() => monitoring.checkHealth()}
                  disabled={monitoring.loading}
                >
                  Check Health
                </Button>
                <Button 
                  onClick={() => monitoring.fetchMetrics()}
                  disabled={monitoring.loading}
                >
                  Get Metrics
                </Button>
              </div>
              
              {monitoring.error && (
                <div className="text-red-500 text-sm">{monitoring.error}</div>
              )}
              
              {monitoring.hasHealthStatus && (
                <div className="p-3 border rounded-lg">
                  <h4 className="font-semibold mb-2">System Health</h4>
                  <div className="flex items-center gap-2">
                    <span>Status:</span>
                    <Badge variant={monitoring.isHealthy ? 'default' : 'destructive'}>
                      {monitoring.systemStatus}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 