# API Integration Guide

This document provides a comprehensive guide to all the API endpoints that have been integrated into the LusiLearn AI frontend application.

## 🚀 Overview

The frontend now includes complete integration with all available backend API endpoints, organized into logical modules with React hooks for easy consumption.

## 📚 Available API Modules

### 1. Learning Paths (`/api/v1/learning-paths/*`)
**Hook:** `useLearningPaths()`

**Endpoints:**
- `POST /` - Create learning path
- `GET /` - Get user's learning paths
- `GET /:pathId` - Get specific learning path
- `PUT /:pathId` - Update learning path
- `DELETE /:pathId` - Delete learning path
- `POST /:pathId/progress` - Update progress
- `POST /:pathId/share` - Share learning path

**Usage:**
```tsx
import { useLearningPaths } from '@/hooks';

function MyComponent() {
  const {
    learningPaths,
    loading,
    error,
    fetchLearningPaths,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath
  } = useLearningPaths();

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  const handleCreate = async () => {
    await createLearningPath({
      subject: 'Mathematics',
      goals: ['Master calculus', 'Understand linear algebra']
    });
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {learningPaths.map(path => (
        <div key={path.id}>{path.subject}</div>
      ))}
    </div>
  );
}
```

### 2. Progress Tracking (`/api/v1/progress/*`)
**Hook:** `useProgressTracking()`

**Endpoints:**
- `POST /update` - Update progress
- `GET /analytics/:timeframe` - Get learning analytics
- `GET /visualization/:pathId` - Get progress visualization
- `GET /session/:sessionId` - Get session details
- `GET /streaks` - Get learning streaks
- `GET /goals` - Get learning goals

**Usage:**
```tsx
import { useProgressTracking } from '@/hooks';

function ProgressComponent() {
  const {
    analytics,
    loading,
    error,
    fetchAnalytics,
    updateProgress
  } = useProgressTracking();

  const handleProgressUpdate = async () => {
    await updateProgress({
      sessionId: 'session123',
      comprehensionScore: 85,
      timeSpent: 1800,
      strugglingConcepts: ['derivatives'],
      masteredConcepts: ['limits']
    });
  };

  return (
    <div>
      <button onClick={() => fetchAnalytics('weekly')}>
        Get Weekly Analytics
      </button>
      {analytics && (
        <div>
          <p>Current Streak: {analytics.currentStreak}</p>
          <p>Total Time: {analytics.totalTimeSpent}s</p>
        </div>
      )}
    </div>
  );
}
```

### 3. Assessments (`/api/v1/assessments/*`)
**Hook:** `useAssessments()`

**Endpoints:**
- `GET /questions` - Get assessment questions
- `POST /submit` - Submit assessment
- `GET /results/:assessmentId` - Get assessment results
- `POST /skill-gap-analysis` - Analyze skill gaps
- `GET /recommendations` - Get learning recommendations

**Usage:**
```tsx
import { useAssessments } from '@/hooks';

function AssessmentComponent() {
  const {
    questions,
    currentResult,
    loading,
    error,
    fetchQuestions,
    submitAssessment
  } = useAssessments();

  const handleStartAssessment = async () => {
    await fetchQuestions('Mathematics', 20);
  };

  const handleSubmit = async () => {
    await submitAssessment({
      subject: 'Mathematics',
      responses: [
        {
          questionId: 'q1',
          selectedAnswer: 'A',
          timeSpent: 30
        }
      ]
    });
  };

  return (
    <div>
      {questions.length > 0 && (
        <div>
          <h3>Assessment Questions ({questions.length})</h3>
          <button onClick={handleSubmit}>Submit Assessment</button>
        </div>
      )}
      {currentResult && (
        <div>
          <h3>Result: {currentResult.score}%</h3>
          <p>Correct: {currentResult.correctAnswers}/{currentResult.totalQuestions}</p>
        </div>
      )}
    </div>
  );
}
```

### 4. Collaboration (`/api/v1/collaboration/*`)
**Hook:** `useCollaboration()`

**Endpoints:**
- `POST /peer-matching` - Find peer matches
- `POST /study-groups` - Create study group
- `GET /study-groups` - Get all study groups
- `GET /study-groups/:groupId` - Get specific study group
- `PUT /study-groups/:groupId` - Update study group
- `DELETE /study-groups/:groupId` - Delete study group
- `POST /study-groups/:groupId/join` - Join study group
- `POST /study-groups/:groupId/leave` - Leave study group

**Usage:**
```tsx
import { useCollaboration } from '@/hooks';

function CollaborationComponent() {
  const {
    peerMatches,
    studyGroups,
    loading,
    error,
    findPeerMatches,
    createStudyGroup,
    fetchStudyGroups
  } = useCollaboration();

  const handleFindPeers = async () => {
    await findPeerMatches({
      subjects: ['Mathematics', 'Physics'],
      skillLevel: 'intermediate',
      availability: ['weekdays', 'evenings']
    });
  };

  const handleCreateGroup = async () => {
    await createStudyGroup({
      name: 'Math Study Squad',
      description: 'Advanced mathematics study group',
      subject: 'Mathematics',
      topic: 'Calculus',
      maxSize: 6,
      ageRestrictions: [],
      moderationLevel: 'moderate',
      privacy: 'public'
    });
  };

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={handleFindPeers}>Find Peers</button>
        <button onClick={handleCreateGroup}>Create Group</button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3>Peer Matches ({peerMatches.length})</h3>
          {peerMatches.map(match => (
            <div key={match.userId}>
              {match.username} - {match.matchScore}% match
            </div>
          ))}
        </div>
        
        <div>
          <h3>Study Groups ({studyGroups.length})</h3>
          {studyGroups.map(group => (
            <div key={group.id}>
              {group.name} - {group.currentMembers}/{group.maxSize} members
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 5. Adaptive Difficulty (`/api/v1/adaptive-difficulty/*`)
**Hook:** `useAdaptiveDifficulty()`

**Endpoints:**
- `POST /analyze` - Analyze user performance
- `GET /recommendations` - Get difficulty recommendations
- `PUT /adjust` - Adjust difficulty settings

**Usage:**
```tsx
import { useAdaptiveDifficulty } from '@/hooks';

function AdaptiveDifficultyComponent() {
  const {
    analysis,
    recommendations,
    loading,
    error,
    analyzePerformance,
    fetchRecommendations
  } = useAdaptiveDifficulty();

  const handleAnalyze = async () => {
    await analyzePerformance('Mathematics');
  };

  return (
    <div>
      <button onClick={handleAnalyze}>Analyze Performance</button>
      
      {analysis && (
        <div>
          <h3>Performance Analysis</h3>
          <p>Current Difficulty: {analysis.currentDifficulty}</p>
          <p>Recommended: {analysis.recommendedDifficulty}</p>
          <p>Confidence: {analysis.confidence}%</p>
        </div>
      )}
      
      {recommendations.length > 0 && (
        <div>
          <h3>Recommendations ({recommendations.length})</h3>
          {recommendations.map(rec => (
            <div key={rec.subject}>
              {rec.subject}: Level {rec.recommendedLevel}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6. Safety & Moderation (`/api/v1/safety/*`)
**Hook:** `useSafetyModeration()`

**Endpoints:**
- `POST /content-filter` - Filter content
- `POST /report` - Report inappropriate content
- `GET /moderation-status` - Get moderation status

**Usage:**
```tsx
import { useSafetyModeration } from '@/hooks';

function SafetyComponent() {
  const {
    filterResponse,
    moderationStatus,
    loading,
    error,
    filterContent,
    reportContent,
    fetchModerationStatus
  } = useSafetyModeration();

  const handleFilterContent = async () => {
    await filterContent({
      content: 'This is a test message',
      contentType: 'text',
      userId: 'user123'
    });
  };

  return (
    <div>
      <button onClick={handleFilterContent}>Test Content Filter</button>
      
      {filterResponse && (
        <div>
          <h3>Content Filter Result</h3>
          <p>Appropriate: {filterResponse.isAppropriate ? 'Yes' : 'No'}</p>
          <p>Confidence: {filterResponse.confidence}%</p>
        </div>
      )}
      
      {moderationStatus && (
        <div>
          <h3>User Status</h3>
          <p>Status: {moderationStatus.status}</p>
          <p>Warnings: {moderationStatus.warnings}</p>
        </div>
      )}
    </div>
  );
}
```

### 7. Monitoring (`/api/v1/monitoring/*`)
**Hook:** `useMonitoring()`

**Endpoints:**
- `GET /health` - Health check
- `GET /metrics` - Get metrics
- `GET /logs` - Get logs

**Usage:**
```tsx
import { useMonitoring } from '@/hooks';

function MonitoringComponent() {
  const {
    healthStatus,
    metrics,
    logs,
    loading,
    error,
    checkHealth,
    fetchMetrics
  } = useMonitoring();

  const handleHealthCheck = async () => {
    await checkHealth();
  };

  return (
    <div>
      <button onClick={handleHealthCheck}>Check System Health</button>
      
      {healthStatus && (
        <div>
          <h3>System Health</h3>
          <p>Status: {healthStatus.status}</p>
        </div>
      )}
    </div>
  );
}
```

## 🔧 Installation & Setup

### 1. Import Hooks
```tsx
// Import individual hooks
import { useLearningPaths } from '@/hooks/use-learning-paths';
import { useProgressTracking } from '@/hooks/use-progress-tracking';

// Or import all hooks
import { 
  useLearningPaths, 
  useProgressTracking, 
  useAssessments,
  useCollaboration,
  useAdaptiveDifficulty,
  useSafetyModeration,
  useMonitoring
} from '@/hooks';
```

### 2. Use in Components
```tsx
function MyComponent() {
  const learningPaths = useLearningPaths();
  const progress = useProgressTracking();
  
  // Use the hooks...
}
```

## 📱 Demo Component

A comprehensive demo component is available at `components/examples/api-integration-demo.tsx` that demonstrates all the API integrations in action.

To use it:
```tsx
import { ApiIntegrationDemo } from '@/components/examples/api-integration-demo';

function DemoPage() {
  return <ApiIntegrationDemo />;
}
```

## 🚨 Error Handling

All hooks include comprehensive error handling:

```tsx
const {
  error,
  clearError,
  loading
} = useLearningPaths();

// Display errors
{error && (
  <div className="text-red-500">
    {error}
    <button onClick={clearError}>Dismiss</button>
  </div>
)}

// Show loading states
{loading && <p>Loading...</p>}
```

## 🔄 State Management

Each hook manages its own state and provides:

- **Data state** (e.g., `learningPaths`, `analytics`)
- **Loading state** (`loading`)
- **Error state** (`error`)
- **Action functions** (e.g., `fetchLearningPaths`, `createLearningPath`)
- **Utility functions** (e.g., `clearError`, `clearData`)

## 🎯 Best Practices

1. **Always check loading states** before rendering data
2. **Handle errors gracefully** with user-friendly messages
3. **Use useEffect** to load initial data when components mount
4. **Clear errors** when appropriate (e.g., after successful operations)
5. **Implement proper cleanup** in useEffect cleanup functions
6. **Use TypeScript** for better type safety and IntelliSense

## 🔗 API Base URL

The API base URL is configured in `lib/api.ts` and defaults to `http://localhost:4000` for development. Make sure your backend is running on the correct port.

## 📚 Additional Resources

- **Backend API Documentation**: Check the backend routes for detailed endpoint specifications
- **TypeScript Types**: All types are defined in `lib/api-extended.ts`
- **Error Handling**: Custom error classes in `lib/api.ts`
- **Authentication**: JWT-based auth with automatic token refresh

## 🆘 Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure backend CORS is configured correctly
2. **401 Unauthorized**: Check JWT token validity and refresh logic
3. **Network Errors**: Verify API base URL and backend availability
4. **Type Errors**: Ensure all required fields are provided in request objects

### Debug Mode:

Enable debug logging by checking the browser console for detailed error messages and API request/response logs. 