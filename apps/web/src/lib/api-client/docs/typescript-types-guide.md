# TypeScript Types Guide

This guide provides comprehensive documentation for all TypeScript types used in the API integration system.

## Table of Contents

1. [Core API Types](#core-api-types)
2. [Request/Response Types](#requestresponse-types)
3. [Hook Types](#hook-types)
4. [Error Types](#error-types)
5. [Configuration Types](#configuration-types)
6. [Utility Types](#utility-types)
7. [Validation Types](#validation-types)
8. [Real-time Types](#real-time-types)
9. [Type Guards](#type-guards)
10. [Advanced Usage](#advanced-usage)

## Core API Types

### ApiClient Interface

```typescript
interface ApiClient {
  // Core HTTP methods
  get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>>;
  
  // Advanced features
  batch<T>(requests: BatchRequest[]): Promise<BatchResponse<T>>;
  upload(endpoint: string, file: File, options?: UploadOptions): Promise<ApiResponse<any>>;
  stream(endpoint: string, options?: StreamOptions): ReadableStream;
  
  // Configuration
  setAuthToken(token: string): void;
  clearCache(pattern?: string): void;
  getMetrics(): ApiMetrics;
}
```

### ApiResponse<T>

Generic response wrapper for all API calls:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
    cached: boolean;
    retryCount: number;
    source: 'api' | 'cache' | 'optimistic';
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Usage examples
const users: ApiResponse<User[]> = await apiClient.get<User[]>('/api/v1/users');
const user: ApiResponse<User> = await apiClient.get<User>('/api/v1/users/123');
const created: ApiResponse<User> = await apiClient.post<User>('/api/v1/users', userData);
```

### RequestOptions

Configuration options for individual requests:

```typescript
interface RequestOptions {
  timeout?: number;           // Request timeout in milliseconds
  retries?: number;          // Number of retry attempts
  cache?: boolean;           // Enable/disable caching for this request
  cacheTTL?: number;         // Cache time-to-live in milliseconds
  signal?: AbortSignal;      // Abort signal for cancellation
  headers?: Record<string, string>; // Additional headers
  onProgress?: (progress: number) => void; // Progress callback for uploads
  priority?: 'low' | 'normal' | 'high'; // Request priority
}

// Usage examples
const data = await apiClient.get('/api/v1/data', {
  timeout: 10000,
  cache: true,
  cacheTTL: 5 * 60 * 1000,
  headers: { 'X-Custom-Header': 'value' }
});
```

## Request/Response Types

### Batch Operations

```typescript
interface BatchRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  options?: RequestOptions;
}

interface BatchResponse<T> {
  success: boolean;
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: string;
  }>;
  metadata: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    duration: number;
  };
}

// Usage example
const batchRequests: BatchRequest[] = [
  { id: '1', method: 'GET', endpoint: '/api/v1/users/1' },
  { id: '2', method: 'GET', endpoint: '/api/v1/users/2' },
  { id: '3', method: 'POST', endpoint: '/api/v1/users', data: { name: 'New User' } }
];

const batchResponse: BatchResponse<User> = await apiClient.batch<User>(batchRequests);
```

### Upload Types

```typescript
interface UploadOptions extends RequestOptions {
  onProgress?: (progress: UploadProgress) => void;
  chunkSize?: number;
  resumable?: boolean;
}

interface UploadProgress {
  loaded: number;      // Bytes uploaded
  total: number;       // Total bytes
  percentage: number;  // Percentage complete (0-100)
  speed: number;       // Upload speed in bytes/second
  remainingTime: number; // Estimated remaining time in seconds
}

// Usage example
const uploadResponse = await apiClient.upload('/api/v1/files', file, {
  onProgress: (progress: UploadProgress) => {
    console.log(`Upload: ${progress.percentage}% (${progress.speed} bytes/s)`);
  }
});
```

### Streaming Types

```typescript
interface StreamOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  onData?: (chunk: string) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// Usage example
const stream = apiClient.stream('/api/v1/events', {
  onData: (chunk: string) => {
    const event = JSON.parse(chunk);
    console.log('Received event:', event);
  },
  onEnd: () => console.log('Stream ended'),
  onError: (error: Error) => console.error('Stream error:', error)
});
```

## Hook Types

### Base Hook State

All hooks extend this base state interface:

```typescript
interface BaseHookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  isStale: boolean;
}

interface BaseHookActions {
  clearError: () => void;
  clearData: () => void;
  refresh: () => Promise<void>;
  invalidate: () => void;
}
```

### Hook Options

Configuration options for all hooks:

```typescript
interface HookOptions {
  autoFetch?: boolean;           // Auto-fetch data on mount
  cacheTime?: number;           // Cache duration in milliseconds
  staleTime?: number;           // Time before data is considered stale
  refetchOnWindowFocus?: boolean; // Refetch when window gains focus
  refetchOnReconnect?: boolean;  // Refetch when network reconnects
  onSuccess?: (data: any) => void; // Success callback
  onError?: (error: string) => void; // Error callback
  enabled?: boolean;            // Enable/disable the hook
  retry?: boolean | number;     // Retry failed requests
  retryDelay?: number;         // Delay between retries
}

// Usage example
const { data, loading, error } = useLearningPaths({
  autoFetch: true,
  cacheTime: 10 * 60 * 1000,
  staleTime: 5 * 60 * 1000,
  onSuccess: (paths) => console.log('Loaded paths:', paths.length),
  onError: (error) => console.error('Failed to load paths:', error)
});
```

### Specific Hook Return Types

#### UseLearningPathsReturn

```typescript
interface UseLearningPathsReturn extends BaseHookState<LearningPath[]>, BaseHookActions {
  // Data
  learningPaths: LearningPath[];
  currentPath: LearningPath | null;
  
  // Computed properties
  hasLearningPaths: boolean;
  totalPaths: number;
  completedPaths: number;
  inProgressPaths: number;
  
  // Actions
  fetchLearningPaths: (filters?: LearningPathFilters) => Promise<void>;
  fetchLearningPath: (id: string) => Promise<LearningPath | null>;
  createLearningPath: (data: CreateLearningPathRequest) => Promise<LearningPath | null>;
  updateLearningPath: (id: string, data: UpdateLearningPathRequest) => Promise<LearningPath | null>;
  deleteLearningPath: (id: string) => Promise<boolean>;
  shareLearningPath: (id: string, shareData: ShareRequest) => Promise<boolean>;
  
  // Optimistic updates
  optimisticUpdate: (id: string, data: Partial<LearningPath>) => void;
  rollbackOptimisticUpdate: (id: string) => void;
  
  // Filtering and sorting
  filterPaths: (predicate: (path: LearningPath) => boolean) => LearningPath[];
  sortPaths: (compareFn: (a: LearningPath, b: LearningPath) => number) => LearningPath[];
}

// Usage example
const {
  learningPaths,
  loading,
  error,
  totalPaths,
  createLearningPath,
  optimisticUpdate
}: UseLearningPathsReturn = useLearningPaths();
```

#### UseProgressTrackingReturn

```typescript
interface UseProgressTrackingReturn extends BaseHookState<ProgressData>, BaseHookActions {
  // Data
  progressData: ProgressData | null;
  weeklyProgress: WeeklyProgressData[];
  achievements: Achievement[];
  skillLevels: Record<string, number>;
  
  // Computed
  overallProgress: number;
  currentStreak: number;
  totalTimeSpent: number;
  
  // Actions
  updateProgress: (update: ProgressUpdate) => Promise<void>;
  markMilestoneComplete: (milestoneId: string) => Promise<void>;
  getAnalytics: (timeRange?: TimeRange) => Promise<AnalyticsData>;
  exportProgress: () => Promise<ProgressExport>;
}
```

## Error Types

### Enhanced API Error

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

class EnhancedApiError extends Error {
  type: ErrorType;
  code?: string;
  status?: number;
  details?: any;
  timestamp: Date;
  requestId?: string;
  recoverable: boolean;
  retryAfter?: number;

  constructor(
    message: string,
    type: ErrorType,
    status?: number,
    code?: string,
    details?: any
  );

  // Static factory methods
  static fromResponse(response: Response, requestId?: string): EnhancedApiError;
  static fromNetworkError(error: Error, requestId?: string): EnhancedApiError;
  static fromTimeout(requestId?: string): EnhancedApiError;
  static fromValidation(errors: ValidationError[], requestId?: string): EnhancedApiError;
}

// Usage example
try {
  const data = await apiClient.get('/api/v1/data');
} catch (error) {
  if (error instanceof EnhancedApiError) {
    console.log('Error type:', error.type);
    console.log('Status:', error.status);
    console.log('Recoverable:', error.recoverable);
    
    if (error.type === ErrorType.RATE_LIMIT && error.retryAfter) {
      console.log('Retry after:', error.retryAfter, 'seconds');
    }
  }
}
```

### Error Recovery Types

```typescript
interface ErrorRecoveryStrategy {
  canRecover(error: EnhancedApiError): boolean;
  recover(error: EnhancedApiError, context: RequestContext): Promise<boolean>;
  getRetryDelay(attempt: number): number;
  maxRetries: number;
}

interface RequestContext {
  requestId: string;
  endpoint: string;
  method: string;
  retryCount: number;
  startTime: Date;
  options: RequestOptions;
}
```

## Configuration Types

### API Client Configuration

```typescript
interface ApiClientConfig {
  baseURL: string;              // Base API URL
  timeout: number;              // Default timeout in milliseconds
  retryAttempts: number;        // Default retry attempts
  retryDelay: number;           // Default retry delay in milliseconds
  cacheEnabled: boolean;        // Enable caching globally
  cacheTTL: number;            // Default cache TTL in milliseconds
  enableMetrics: boolean;       // Enable metrics collection
  enableLogging: boolean;       // Enable request/response logging
  maxConcurrentRequests?: number; // Maximum concurrent requests
  requestDeduplication?: boolean; // Enable request deduplication
  batchingEnabled?: boolean;    // Enable request batching
}

// Usage example
const client = createApiClient({
  baseURL: 'https://api.lusilearn.com',
  timeout: 30000,
  retryAttempts: 3,
  cacheEnabled: true,
  enableMetrics: true
});
```

### Cache Configuration

```typescript
interface CacheStrategy {
  type: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  maxSize: number;              // Maximum cache size in bytes
  ttl: number;                 // Default TTL in milliseconds
  evictionPolicy: 'lru' | 'fifo' | 'ttl'; // Eviction policy
  compression?: boolean;        // Enable compression
  encryption?: boolean;         // Enable encryption
}

interface CacheManager {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttl?: number): void;
  invalidate(pattern: string): void;
  clear(): void;
  getStats(): CacheStats;
}
```

## Utility Types

### Pagination Types

```typescript
interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Usage with hooks
const {
  data,
  loading,
  hasNextPage,
  fetchNextPage
} = usePaginatedData<LearningPath>('/api/v1/learning-paths', {
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});
```

### Filter Types

```typescript
interface FilterOptions<T> {
  search?: string;
  filters?: Partial<T>;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  status?: string[];
}

// Usage example
interface LearningPathFilters {
  subject?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  isPublic?: boolean;
  createdBy?: string;
}

const { learningPaths } = useLearningPaths();
const filteredPaths = learningPaths.filter(path => 
  path.subject === 'mathematics' && path.difficulty === 'medium'
);
```

## Validation Types

### Zod Schema Types

```typescript
import { z } from 'zod';

// Schema definitions
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['student', 'educator', 'admin']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const LearningPathSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  subject: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  milestones: z.array(MilestoneSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Infer TypeScript types from schemas
type User = z.infer<typeof UserSchema>;
type LearningPath = z.infer<typeof LearningPathSchema>;
```

### Validation Result Types

```typescript
interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

// Usage example
const validationResult: ValidationResult<User> = validateApiResponse(
  response.data,
  UserSchema
);

if (!validationResult.success) {
  console.error('Validation errors:', validationResult.errors);
}
```

## Real-time Types

### WebSocket Types

```typescript
interface WebSocketManager {
  connect(url: string, options?: WSOptions): Promise<void>;
  disconnect(): void;
  subscribe(channel: string, callback: (data: any) => void): () => void;
  unsubscribe(channel: string): void;
  send(channel: string, data: any): void;
  getConnectionState(): ConnectionState;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WSOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
```

### Real-time Event Types

```typescript
interface RealTimeEvent<T = any> {
  type: string;
  channel: string;
  data: T;
  timestamp: Date;
  id: string;
}

interface CollaborationEvent extends RealTimeEvent {
  type: 'user-joined' | 'user-left' | 'message' | 'screen-share' | 'cursor-move';
  userId: string;
  sessionId: string;
}

interface NotificationEvent extends RealTimeEvent {
  type: 'achievement' | 'reminder' | 'system' | 'social';
  priority: 'low' | 'medium' | 'high';
  read: boolean;
}
```

## Type Guards

### API Response Type Guards

```typescript
function isApiResponse<T>(value: any): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.success === 'boolean'
  );
}

function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
  return response.success && response.data !== undefined;
}

function isErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: false; error: string } {
  return !response.success && typeof response.error === 'string';
}

// Usage example
const response = await apiClient.get<User[]>('/api/v1/users');

if (isSuccessResponse(response)) {
  // TypeScript knows response.data is User[]
  console.log('Users:', response.data);
} else if (isErrorResponse(response)) {
  // TypeScript knows response.error is string
  console.error('Error:', response.error);
}
```

### Error Type Guards

```typescript
function isEnhancedApiError(error: any): error is EnhancedApiError {
  return error instanceof EnhancedApiError;
}

function isNetworkError(error: any): error is EnhancedApiError & { type: ErrorType.NETWORK } {
  return isEnhancedApiError(error) && error.type === ErrorType.NETWORK;
}

function isAuthenticationError(error: any): error is EnhancedApiError & { type: ErrorType.AUTHENTICATION } {
  return isEnhancedApiError(error) && error.type === ErrorType.AUTHENTICATION;
}

// Usage example
try {
  const data = await apiClient.get('/api/v1/protected');
} catch (error) {
  if (isAuthenticationError(error)) {
    // Redirect to login
    window.location.href = '/login';
  } else if (isNetworkError(error)) {
    // Show network error message
    showNetworkErrorToast();
  }
}
```

## Advanced Usage

### Generic Hook Creation

```typescript
function createApiHook<T, TFilters = any>(
  endpoint: string,
  options?: {
    defaultFilters?: TFilters;
    transform?: (data: any) => T;
    validate?: (data: any) => boolean;
  }
) {
  return function useApiData(hookOptions?: HookOptions & { filters?: TFilters }) {
    // Hook implementation
    return {
      data: null as T | null,
      loading: false,
      error: null as string | null,
      // ... other hook properties
    };
  };
}

// Usage example
const useCustomData = createApiHook<CustomData[], CustomFilters>('/api/v1/custom', {
  defaultFilters: { status: 'active' },
  transform: (data) => data.map(item => ({ ...item, processed: true })),
  validate: (data) => Array.isArray(data)
});
```

### Conditional Types

```typescript
type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

type RequestPayload<M extends ApiMethod> = M extends 'GET' | 'DELETE' 
  ? never 
  : any;

type ApiCall<M extends ApiMethod, T> = M extends 'GET' | 'DELETE'
  ? (endpoint: string, options?: RequestOptions) => Promise<ApiResponse<T>>
  : (endpoint: string, data: RequestPayload<M>, options?: RequestOptions) => Promise<ApiResponse<T>>;

// Usage ensures type safety based on HTTP method
const getData: ApiCall<'GET', User[]> = apiClient.get;
const postData: ApiCall<'POST', User> = apiClient.post;
```

### Mapped Types

```typescript
type HookReturnType<T> = {
  readonly [K in keyof T]: T[K];
} & BaseHookState<T> & BaseHookActions;

type OptionalHookOptions<T> = {
  [K in keyof HookOptions]?: HookOptions[K];
} & {
  transform?: (data: any) => T;
  validate?: (data: T) => boolean;
};
```

This comprehensive type guide ensures full type safety throughout your API integration. All types are designed to work together seamlessly and provide excellent IntelliSense support in your IDE.