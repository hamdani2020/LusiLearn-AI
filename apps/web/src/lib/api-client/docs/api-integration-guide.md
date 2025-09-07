# API Integration Guide

This guide provides comprehensive documentation for integrating with the LusiLearn AI platform's API using our enhanced API client and hooks system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [API Client](#api-client)
3. [React Hooks](#react-hooks)
4. [Error Handling](#error-handling)
5. [Caching](#caching)
6. [Real-time Features](#real-time-features)
7. [Performance Optimization](#performance-optimization)
8. [Type Safety](#type-safety)
9. [Testing](#testing)
10. [Debugging](#debugging)
11. [Best Practices](#best-practices)

## Quick Start

### Installation

The API client is already included in the project. Import what you need:

```typescript
import { apiClient } from '@/lib/api-client';
import { useLearningPaths } from '@/hooks/use-learning-paths';
```

### Basic Usage

```typescript
// Using the API client directly
const response = await apiClient.get('/api/v1/learning-paths');

// Using React hooks (recommended)
function MyComponent() {
  const { learningPaths, loading, error, fetchLearningPaths } = useLearningPaths();
  
  useEffect(() => {
    fetchLearningPaths();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {learningPaths.map(path => (
        <div key={path.id}>{path.title}</div>
      ))}
    </div>
  );
}
```

## API Client

### Configuration

The API client can be configured with various options:

```typescript
import { createApiClient } from '@/lib/api-client';

const client = createApiClient({
  baseURL: 'https://api.lusilearn.com',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableMetrics: true,
  enableLogging: process.env.NODE_ENV === 'development'
});
```

### HTTP Methods

```typescript
// GET request
const users = await client.get<User[]>('/api/v1/users');

// POST request
const newUser = await client.post<User>('/api/v1/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await client.put<User>('/api/v1/users/123', {
  name: 'Jane Doe'
});

// DELETE request
await client.delete('/api/v1/users/123');

// PATCH request
const patchedUser = await client.patch<User>('/api/v1/users/123', {
  email: 'jane@example.com'
});
```

### Advanced Features

#### Batch Requests

```typescript
const batchRequests = [
  { id: '1', method: 'GET', endpoint: '/api/v1/users/1' },
  { id: '2', method: 'GET', endpoint: '/api/v1/users/2' },
  { id: '3', method: 'POST', endpoint: '/api/v1/users', data: { name: 'New User' } }
];

const batchResponse = await client.batch(batchRequests);
console.log(batchResponse.results);
```

#### File Upload

```typescript
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const response = await client.upload('/api/v1/upload', file, {
    onProgress: (progress) => {
      console.log(`Upload progress: ${progress.percentage}%`);
    }
  });
}
```

#### Streaming

```typescript
const stream = client.stream('/api/v1/events', {
  onData: (chunk) => {
    console.log('Received chunk:', chunk);
  },
  onEnd: () => {
    console.log('Stream ended');
  },
  onError: (error) => {
    console.error('Stream error:', error);
  }
});
```

### Authentication

```typescript
// Set authentication token
client.setAuthToken('your-jwt-token');

// Set refresh token callback
client.setRefreshTokenCallback(async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await response.json();
  return data.accessToken;
});

// Clear authentication
client.clearAuthToken();
```

### Request Interceptors

```typescript
// Add request interceptor
const removeInterceptor = client.addInterceptor({
  onRequest: async (config, context) => {
    // Add custom headers
    config.headers = {
      ...config.headers,
      'X-Request-ID': context.requestId
    };
    return config;
  },
  
  onResponse: async (response, context) => {
    // Log response
    console.log(`Response for ${context.endpoint}:`, response.status);
    return response;
  },
  
  onError: async (error, context) => {
    // Custom error handling
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return error;
  }
});

// Remove interceptor when done
removeInterceptor();
```

## React Hooks

### Available Hooks

#### useLearningPaths

```typescript
import { useLearningPaths } from '@/hooks/use-learning-paths';

function LearningPathsComponent() {
  const {
    // Data
    learningPaths,
    currentPath,
    
    // State
    loading,
    error,
    
    // Computed
    hasLearningPaths,
    totalPaths,
    completedPaths,
    
    // Actions
    fetchLearningPaths,
    fetchLearningPath,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath,
    shareLearningPath,
    
    // Optimistic updates
    optimisticUpdate,
    rollbackOptimisticUpdate,
    
    // Utility
    clearError,
    clearData,
    refresh,
    invalidate
  } = useLearningPaths({
    autoFetch: true,
    cacheTime: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    onSuccess: (data) => console.log('Data loaded:', data),
    onError: (error) => console.error('Error:', error)
  });

  // Create new learning path
  const handleCreate = async () => {
    const newPath = await createLearningPath({
      title: 'New Learning Path',
      subject: 'mathematics',
      objectives: ['Learn algebra', 'Master calculus']
    });
    
    if (newPath) {
      console.log('Created:', newPath);
    }
  };

  // Optimistic update
  const handleOptimisticUpdate = (id: string) => {
    optimisticUpdate(id, { title: 'Updated Title' });
    
    // Later, if the actual update fails
    // rollbackOptimisticUpdate(id);
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      
      <div>Total paths: {totalPaths}</div>
      <div>Completed: {completedPaths}</div>
      
      <button onClick={handleCreate}>Create Path</button>
      <button onClick={refresh}>Refresh</button>
      
      {learningPaths.map(path => (
        <div key={path.id}>
          <h3>{path.title}</h3>
          <button onClick={() => handleOptimisticUpdate(path.id)}>
            Update
          </button>
        </div>
      ))}
    </div>
  );
}
```

#### useProgressTracking

```typescript
import { useProgressTracking } from '@/hooks/use-progress-tracking';

function ProgressComponent() {
  const {
    progressData,
    weeklyProgress,
    achievements,
    loading,
    error,
    updateProgress,
    getAnalytics
  } = useProgressTracking();

  const handleProgressUpdate = async () => {
    await updateProgress({
      learningPathId: 'path-123',
      milestoneId: 'milestone-456',
      completed: true,
      timeSpent: 1800 // 30 minutes in seconds
    });
  };

  return (
    <div>
      <div>Overall Progress: {progressData?.overallProgress}%</div>
      <div>Current Streak: {progressData?.streak} days</div>
      
      <button onClick={handleProgressUpdate}>
        Mark Milestone Complete
      </button>
      
      {achievements.map(achievement => (
        <div key={achievement.id}>
          {achievement.icon} {achievement.name}
        </div>
      ))}
    </div>
  );
}
```

#### useRealTimeCollaboration

```typescript
import { useRealTimeCollaboration } from '@/hooks/use-real-time-collaboration';

function CollaborationComponent() {
  const {
    isConnected,
    participants,
    messages,
    sendMessage,
    joinSession,
    leaveSession,
    shareScreen
  } = useRealTimeCollaboration();

  useEffect(() => {
    joinSession('session-123');
    return () => leaveSession();
  }, []);

  const handleSendMessage = () => {
    sendMessage('Hello everyone!');
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Participants: {participants.length}</div>
      
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <strong>{message.sender}:</strong> {message.content}
          </div>
        ))}
      </div>
      
      <button onClick={handleSendMessage}>Send Message</button>
      <button onClick={shareScreen}>Share Screen</button>
    </div>
  );
}
```

### Custom Hook Options

All hooks support these common options:

```typescript
interface HookOptions {
  autoFetch?: boolean;           // Auto-fetch on mount
  cacheTime?: number;           // Cache duration in ms
  staleTime?: number;           // Stale time in ms
  refetchOnWindowFocus?: boolean; // Refetch on window focus
  refetchOnReconnect?: boolean;  // Refetch on network reconnect
  onSuccess?: (data: any) => void; // Success callback
  onError?: (error: string) => void; // Error callback
}
```

## Error Handling

### Error Types

The system classifies errors into different types:

```typescript
enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}
```

### Error Recovery

Errors are automatically recovered when possible:

```typescript
// Network errors: Automatic retry with exponential backoff
// Authentication errors: Automatic token refresh
// Rate limit errors: Intelligent delay and retry

// Manual error handling
try {
  const data = await apiClient.get('/api/v1/data');
} catch (error) {
  if (error instanceof EnhancedApiError) {
    console.log('Error type:', error.type);
    console.log('Recoverable:', error.recoverable);
    console.log('Retry after:', error.retryAfter);
  }
}
```

### User-Friendly Error Messages

```typescript
// Errors are automatically mapped to user-friendly messages
const { error } = useLearningPaths();

// error will be something like:
// "Unable to connect to the server. Please check your internet connection."
// instead of "NetworkError: fetch failed"
```

## Caching

### Cache Configuration

```typescript
// Global cache configuration
const client = createApiClient({
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000 // 5 minutes
});

// Per-request cache configuration
const data = await client.get('/api/v1/data', {
  cache: true,
  cacheTTL: 10 * 60 * 1000 // 10 minutes
});
```

### Cache Management

```typescript
// Clear specific cache
client.clearCache('/api/v1/users*');

// Clear all cache
client.clearCache();

// Invalidate hook cache
const { invalidate } = useLearningPaths();
invalidate();
```

### Cache Strategies

The system uses multiple cache tiers:

1. **Memory Cache**: Fast, in-memory storage
2. **Local Storage**: Persistent browser storage
3. **Session Storage**: Session-based storage

## Real-time Features

### WebSocket Connection

```typescript
import { useWebSocket } from '@/lib/websocket';

function RealTimeComponent() {
  const { isConnected, subscribe, send } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('notifications', (data) => {
      console.log('Received notification:', data);
    });

    return unsubscribe;
  }, []);

  const sendNotification = () => {
    send('notifications', { message: 'Hello!' });
  };

  return (
    <div>
      <div>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <button onClick={sendNotification}>Send Notification</button>
    </div>
  );
}
```

### Real-time Hooks

```typescript
// Real-time collaboration
const collaboration = useRealTimeCollaboration();

// Real-time notifications
const notifications = useRealTimeNotifications();

// Real-time progress updates
const progress = useRealTimeProgress();
```

## Performance Optimization

### Request Optimization

```typescript
// Request deduplication (automatic)
// Multiple identical requests are deduplicated

// Request batching
const batchedRequests = [
  { id: '1', method: 'GET', endpoint: '/api/v1/users/1' },
  { id: '2', method: 'GET', endpoint: '/api/v1/users/2' }
];
const results = await client.batch(batchedRequests);

// Request prioritization
const urgentData = await client.get('/api/v1/urgent-data', {
  priority: 'high'
});
```

### Performance Monitoring

```typescript
// Get performance metrics
const metrics = client.getMetrics();
console.log('Average response time:', metrics.averageResponseTime);
console.log('Cache hit rate:', metrics.cacheHitRate);

// Get optimization stats
const optimizationStats = client.getOptimizationStats();
console.log('Deduplicated requests:', optimizationStats.deduplicatedRequests);
```

### Pagination and Lazy Loading

```typescript
import { usePaginatedData } from '@/hooks/base/use-paginated-data';

function PaginatedList() {
  const {
    data,
    loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  } = usePaginatedData('/api/v1/learning-paths', {
    pageSize: 20
  });

  return (
    <div>
      {data.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={fetchNextPage}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

## Type Safety

### TypeScript Integration

All API functions are fully typed:

```typescript
// Type-safe API calls
const users: ApiResponse<User[]> = await client.get<User[]>('/api/v1/users');

// Type-safe hook usage
const { learningPaths }: { learningPaths: LearningPath[] } = useLearningPaths();

// Type-safe request payloads
const newUser = await client.post<User>('/api/v1/users', {
  name: 'John Doe', // TypeScript will validate this matches CreateUserRequest
  email: 'john@example.com'
});
```

### Runtime Validation

```typescript
import { validateApiResponse } from '@/lib/validation';

// Runtime validation with Zod schemas
const response = await client.get('/api/v1/users');
const validationResult = validateApiResponse(response.data, UserArraySchema);

if (!validationResult.success) {
  console.error('Validation errors:', validationResult.errors);
}
```

### Type Guards

```typescript
import { isApiError, isNetworkError } from '@/lib/validation/type-guards';

try {
  const data = await client.get('/api/v1/data');
} catch (error) {
  if (isApiError(error)) {
    console.log('API error:', error.message);
  } else if (isNetworkError(error)) {
    console.log('Network error:', error.message);
  }
}
```

## Testing

### Unit Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useLearningPaths } from '@/hooks/use-learning-paths';

test('should fetch learning paths', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useLearningPaths());

  act(() => {
    result.current.fetchLearningPaths();
  });

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.learningPaths).toHaveLength(5);
});
```

### Integration Testing

```typescript
import { apiTester } from '@/lib/api-client/dev-utils';

test('learning paths API integration', async () => {
  const result = await apiTester.quickTest('/api/v1/learning-paths', 'GET');
  
  expect(result.status).toBe('success');
  expect(result.response?.status).toBe(200);
});
```

### Mock Data Generation

```typescript
import { mockDataGenerator } from '@/lib/api-client/dev-utils';

test('component with mock data', () => {
  const mockPaths = mockDataGenerator.generateLearningPaths(5);
  
  render(<LearningPathsList paths={mockPaths} />);
  
  expect(screen.getAllByTestId('learning-path-item')).toHaveLength(5);
});
```

## Debugging

### Development Tools

In development mode, debugging tools are automatically available:

```typescript
// Access via browser console
window.apiDebug.summary(); // Get debug summary
window.apiDebug.export();  // Export all debug data
window.apiDebug.clear();   // Clear all debug data

// Individual tools
window.__API_INSPECTOR__     // Request inspector
window.__PERFORMANCE_PROFILER__ // Performance profiler
window.__REQUEST_LOGGER__    // Request logger
```

### Debug Panel

Add the debug panel to your app in development:

```typescript
import { ApiDebugPanel } from '@/components/dev/api-debug-panel';

function App() {
  return (
    <div>
      {/* Your app content */}
      
      {process.env.NODE_ENV === 'development' && <ApiDebugPanel />}
    </div>
  );
}
```

### Logging Configuration

```typescript
// Enable detailed logging
client.enableDebugMode(true);

// Configure log levels
requestLogger.updateConfig({
  logLevel: 'debug',
  enableConsoleOutput: true,
  enablePayloadLogging: true
});
```

## Best Practices

### 1. Use Hooks for React Components

```typescript
// ✅ Good: Use hooks in React components
function MyComponent() {
  const { data, loading, error } = useLearningPaths();
  // ...
}

// ❌ Bad: Use API client directly in components
function MyComponent() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    apiClient.get('/api/v1/learning-paths').then(setData);
  }, []);
  // ...
}
```

### 2. Handle Loading and Error States

```typescript
// ✅ Good: Handle all states
function MyComponent() {
  const { data, loading, error } = useLearningPaths();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <DataDisplay data={data} />;
}
```

### 3. Use Optimistic Updates

```typescript
// ✅ Good: Optimistic updates for better UX
const { optimisticUpdate, updateLearningPath } = useLearningPaths();

const handleUpdate = async (id: string, updates: Partial<LearningPath>) => {
  // Update UI immediately
  optimisticUpdate(id, updates);
  
  try {
    // Send actual update
    await updateLearningPath(id, updates);
  } catch (error) {
    // Rollback on error
    rollbackOptimisticUpdate(id);
  }
};
```

### 4. Configure Caching Appropriately

```typescript
// ✅ Good: Configure cache based on data volatility
const { data } = useLearningPaths({
  cacheTime: 10 * 60 * 1000,  // Cache for 10 minutes
  staleTime: 5 * 60 * 1000    // Consider stale after 5 minutes
});

// For frequently changing data
const { data } = useRealTimeNotifications({
  cacheTime: 30 * 1000,       // Cache for 30 seconds
  staleTime: 10 * 1000        // Consider stale after 10 seconds
});
```

### 5. Handle Authentication Properly

```typescript
// ✅ Good: Set up token refresh
client.setRefreshTokenCallback(async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });
  
  if (!response.ok) {
    // Redirect to login
    window.location.href = '/login';
    throw new Error('Token refresh failed');
  }
  
  const data = await response.json();
  return data.accessToken;
});
```

### 6. Use TypeScript Strictly

```typescript
// ✅ Good: Full type safety
interface CreateLearningPathRequest {
  title: string;
  subject: string;
  objectives: string[];
}

const createPath = async (data: CreateLearningPathRequest): Promise<LearningPath | null> => {
  return createLearningPath(data);
};

// ❌ Bad: Using any
const createPath = async (data: any): Promise<any> => {
  return createLearningPath(data);
};
```

### 7. Test Your Integrations

```typescript
// ✅ Good: Test both success and error cases
describe('useLearningPaths', () => {
  it('should handle successful data fetch', async () => {
    // Test success case
  });
  
  it('should handle network errors', async () => {
    // Test error case
  });
  
  it('should handle empty responses', async () => {
    // Test edge case
  });
});
```

### 8. Monitor Performance

```typescript
// ✅ Good: Monitor and optimize
useEffect(() => {
  const metrics = client.getMetrics();
  
  if (metrics.averageResponseTime > 2000) {
    console.warn('Slow API responses detected');
  }
  
  if (metrics.cacheHitRate < 0.5) {
    console.warn('Low cache hit rate');
  }
}, []);
```

This guide covers the essential aspects of API integration with the LusiLearn platform. For more specific examples and advanced use cases, refer to the individual component documentation and the interactive examples in the debug panel.