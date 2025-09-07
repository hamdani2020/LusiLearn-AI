// Enhanced API Client Types
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  enableMetrics: boolean;
  enableLogging: boolean;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
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

export interface BatchRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: any;
  options?: RequestOptions;
}

export interface BatchResponse<T> {
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

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  chunkIndex?: number;
  totalChunks?: number;
}

export interface UploadOptions extends RequestOptions {
  onProgress?: (progress: UploadProgress) => void;
  chunkSize?: number;
  resumable?: boolean;
}

export interface StreamOptions extends RequestOptions {
  onData?: (chunk: any) => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorsByType: Record<string, number>;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    requestCount: number;
  }>;
  requestsPerMinute: number;
  lastReset: Date;
}

export interface RequestMetadata {
  id: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  duration?: number;
  status?: number;
  error?: string;
  retryCount: number;
  cached: boolean;
  size?: number;
}

export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

export interface ApiError extends Error {
  type: ErrorType;
  message: string;
  code?: string;
  status?: number;
  details?: any;
  timestamp: Date;
  requestId?: string;
  recoverable: boolean;
  retryAfter?: number;
}

export interface RequestContext {
  requestId: string;
  endpoint: string;
  method: string;
  retryCount: number;
  startTime: Date;
  options: RequestOptions;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: ApiError): boolean;
  recover(error: ApiError, context: RequestContext): Promise<boolean>;
  getRetryDelay(attempt: number): number;
  maxRetries: number;
}

export interface RequestInterceptor {
  onRequest?: (config: RequestInit, context: RequestContext) => Promise<RequestInit> | RequestInit;
  onResponse?: (response: Response, context: RequestContext) => Promise<Response> | Response;
  onError?: (error: ApiError, context: RequestContext) => Promise<ApiError> | ApiError;
}

export interface ApiClient {
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
  
  // Configuration and management
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  addInterceptor(interceptor: RequestInterceptor): () => void;
  clearCache(pattern?: string): void;
  getMetrics(): ApiMetrics;
  resetMetrics(): void;
  
  // Health and debugging
  isHealthy(): Promise<boolean>;
  getRequestHistory(limit?: number): RequestMetadata[];
  enableDebugMode(enabled: boolean): void;
}