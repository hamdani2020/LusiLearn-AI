import {
    ApiClient,
    ApiClientConfig,
    ApiResponse,
    RequestOptions,
    BatchRequest,
    BatchResponse,
    UploadOptions,
    StreamOptions,
    ApiMetrics,
    RequestMetadata,
    RequestContext,
    RequestInterceptor,
    ErrorType,
    UploadProgress
} from './types';
import { EnhancedApiError, ErrorRecoveryManager } from './errors';
import { MetricsCollector, ApiLogger } from './metrics';
import { MultiTierCacheManager, CacheManager } from './cache';

export class EnhancedApiClient implements ApiClient {
    private config: ApiClientConfig;
    private cacheManager: CacheManager;
    private metricsCollector: MetricsCollector;
    private logger: ApiLogger;
    private errorRecoveryManager: ErrorRecoveryManager;
    private interceptors: RequestInterceptor[] = [];
    private authToken: string | null = null;
    private refreshTokenCallback?: () => Promise<string>;

    constructor(config: Partial<ApiClientConfig> = {}) {
        this.config = {
            baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            cacheEnabled: true,
            cacheTTL: 5 * 60 * 1000, // 5 minutes
            enableMetrics: true,
            enableLogging: process.env.NODE_ENV === 'development',
            ...config
        };

        this.cacheManager = new MultiTierCacheManager();
        this.metricsCollector = new MetricsCollector();
        this.logger = new ApiLogger(this.config.enableLogging);
        this.errorRecoveryManager = new ErrorRecoveryManager(this.refreshTokenCallback);

        // Initialize auth token from localStorage
        if (typeof window !== 'undefined') {
            this.authToken = localStorage.getItem('accessToken');
        }
    }

    // Core HTTP methods
    async get<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return this.request<T>('GET', endpoint, undefined, options);
    }

    async post<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return this.request<T>('POST', endpoint, data, options);
    }

    async put<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return this.request<T>('PUT', endpoint, data, options);
    }

    async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return this.request<T>('DELETE', endpoint, undefined, options);
    }

    async patch<T>(endpoint: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
        return this.request<T>('PATCH', endpoint, data, options);
    }

    // Advanced features
    async batch<T>(requests: BatchRequest[]): Promise<BatchResponse<T>> {
        const startTime = Date.now();
        const results: BatchResponse<T>['results'] = [];
        let successfulRequests = 0;
        let failedRequests = 0;

        // Execute requests in parallel with concurrency limit
        const concurrencyLimit = 5;
        const chunks = this.chunkArray(requests, concurrencyLimit);

        for (const chunk of chunks) {
            const promises = chunk.map(async (request) => {
                try {
                    const response = await this.request<T>(
                        request.method,
                        request.endpoint,
                        request.data,
                        request.options
                    );

                    if (response.success) {
                        successfulRequests++;
                    } else {
                        failedRequests++;
                    }

                    return {
                        id: request.id,
                        success: response.success,
                        data: response.data,
                        error: response.error
                    };
                } catch (error) {
                    failedRequests++;
                    return {
                        id: request.id,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults);
        }

        return {
            success: failedRequests === 0,
            results,
            metadata: {
                totalRequests: requests.length,
                successfulRequests,
                failedRequests,
                duration: Date.now() - startTime
            }
        };
    }

    async upload(endpoint: string, file: File, options: UploadOptions = {}): Promise<ApiResponse<any>> {
        const requestId = this.generateRequestId();
        const context: RequestContext = {
            requestId,
            endpoint,
            method: 'POST',
            retryCount: 0,
            startTime: new Date(),
            options
        };

        try {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            return new Promise((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable && options.onProgress) {
                        const progress: UploadProgress = {
                            loaded: event.loaded,
                            total: event.total,
                            percentage: (event.loaded / event.total) * 100,
                            speed: 0, // Will be calculated if needed
                            remainingTime: 0 // Will be calculated if needed
                        };
                        options.onProgress(progress);
                    }
                });

                xhr.addEventListener('load', () => {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve({
                            success: xhr.status >= 200 && xhr.status < 300,
                            data: response.data,
                            message: response.message,
                            error: response.error,
                            metadata: {
                                requestId,
                                timestamp: new Date().toISOString(),
                                duration: Date.now() - context.startTime.getTime(),
                                cached: false,
                                retryCount: context.retryCount,
                                source: 'api'
                            }
                        });
                    } catch (error) {
                        reject(new EnhancedApiError('Invalid response format', ErrorType.UNKNOWN, xhr.status));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(EnhancedApiError.fromNetworkError(new Error('Upload failed'), requestId));
                });

                xhr.addEventListener('timeout', () => {
                    reject(EnhancedApiError.fromTimeout(requestId));
                });

                xhr.open('POST', `${this.config.baseURL}${endpoint}`);

                // Add auth header
                if (this.authToken) {
                    xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
                }

                // Set timeout
                xhr.timeout = options.timeout || this.config.timeout;

                xhr.send(formData);
            });
        } catch (error) {
            throw error instanceof EnhancedApiError
                ? error
                : EnhancedApiError.fromNetworkError(error as Error, requestId);
        }
    }

    stream(endpoint: string, options: StreamOptions = {}): ReadableStream {
        const url = `${this.config.baseURL}${endpoint}`;
        const authToken = this.authToken; // Capture the auth token in closure

        return new ReadableStream({
            async start(controller) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Authorization': options.headers?.Authorization || (authToken ? `Bearer ${authToken}` : ''),
                            ...options.headers
                        },
                        signal: options.signal
                    });

                    if (!response.ok) {
                        throw EnhancedApiError.fromResponse(response);
                    }

                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new EnhancedApiError('No readable stream available', ErrorType.UNKNOWN);
                    }

                    const pump = async (): Promise<void> => {
                        try {
                            const { done, value } = await reader.read();

                            if (done) {
                                controller.close();
                                options.onEnd?.();
                                return;
                            }

                            // Process chunk
                            const chunk = new TextDecoder().decode(value);
                            options.onData?.(chunk);

                            controller.enqueue(value);
                            return pump();
                        } catch (error) {
                            controller.error(error);
                            options.onError?.(error as Error);
                        }
                    };

                    return pump();
                } catch (error) {
                    controller.error(error);
                    options.onError?.(error as Error);
                }
            }
        });
    }

    // Configuration and management
    setAuthToken(token: string): void {
        this.authToken = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', token);
        }
    }

    clearAuthToken(): void {
        this.authToken = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
        }
    }

    addInterceptor(interceptor: RequestInterceptor): () => void {
        this.interceptors.push(interceptor);

        // Return cleanup function
        return () => {
            const index = this.interceptors.indexOf(interceptor);
            if (index > -1) {
                this.interceptors.splice(index, 1);
            }
        };
    }

    clearCache(pattern?: string): void {
        if (pattern) {
            this.cacheManager.invalidate(pattern);
        } else {
            this.cacheManager.clear();
        }
    }

    getMetrics(): ApiMetrics {
        return this.metricsCollector.getMetrics();
    }

    resetMetrics(): void {
        this.metricsCollector.reset();
    }

    // Health and debugging
    async isHealthy(): Promise<boolean> {
        try {
            const response = await this.get('/api/health', { timeout: 5000, cache: false });
            return response.success;
        } catch {
            return false;
        }
    }

    getRequestHistory(limit?: number): RequestMetadata[] {
        return this.metricsCollector.getRequestHistory(limit);
    }

    enableDebugMode(enabled: boolean): void {
        this.logger.setEnabled(enabled);
    }

    // Set refresh token callback
    setRefreshTokenCallback(callback: () => Promise<string>): void {
        this.refreshTokenCallback = callback;
        this.errorRecoveryManager = new ErrorRecoveryManager(callback);
    }

    // Private methods
    private async request<T>(
        method: string,
        endpoint: string,
        data?: any,
        options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
        const requestId = this.generateRequestId();
        const context: RequestContext = {
            requestId,
            endpoint,
            method,
            retryCount: 0,
            startTime: new Date(),
            options
        };

        // Check cache first
        if (method === 'GET' && (options.cache ?? this.config.cacheEnabled)) {
            const cacheKey = this.generateCacheKey(endpoint, data);
            const cachedResponse = this.cacheManager.get<ApiResponse<T>>(cacheKey);

            if (cachedResponse) {
                this.logger.debug(`Cache hit for ${method} ${endpoint}`, { requestId });
                return {
                    ...cachedResponse,
                    metadata: {
                        ...cachedResponse.metadata!,
                        cached: true,
                        source: 'cache'
                    }
                };
            }
        }

        return this.executeRequest<T>(context, data);
    }

    private async executeRequest<T>(
        context: RequestContext,
        data?: any
    ): Promise<ApiResponse<T>> {
        const startTime = Date.now();
        let response: Response;
        let responseData: any;

        try {
            // Build request config
            const config = await this.buildRequestConfig(context, data);

            // Apply request interceptors
            const finalConfig = await this.applyRequestInterceptors(config, context);

            this.logger.logRequest({
                id: context.requestId,
                endpoint: context.endpoint,
                method: context.method,
                timestamp: context.startTime,
                retryCount: context.retryCount,
                cached: false
            });

            // Make the request
            response = await this.fetchWithTimeout(
                `${this.config.baseURL}${context.endpoint}`,
                finalConfig,
                context.options.timeout || this.config.timeout
            );

            // Apply response interceptors
            response = await this.applyResponseInterceptors(response, context);

            // Parse response
            responseData = await response.json();

            const duration = Date.now() - startTime;
            const metadata: RequestMetadata = {
                id: context.requestId,
                endpoint: context.endpoint,
                method: context.method,
                timestamp: context.startTime,
                duration,
                status: response.status,
                retryCount: context.retryCount,
                cached: false,
                size: JSON.stringify(responseData).length
            };

            // Record metrics
            if (this.config.enableMetrics) {
                this.metricsCollector.recordRequest(metadata);
            }

            this.logger.logResponse(metadata);

            if (!response.ok) {
                const error = EnhancedApiError.fromResponse(response, context.requestId);

                // Try error recovery
                if (error.recoverable && await this.errorRecoveryManager.attemptRecovery(error, context)) {
                    context.retryCount++;
                    return this.executeRequest<T>(context, data);
                }

                throw error;
            }

            const apiResponse: ApiResponse<T> = {
                success: true,
                data: responseData.data,
                message: responseData.message,
                metadata: {
                    requestId: context.requestId,
                    timestamp: new Date().toISOString(),
                    duration,
                    cached: false,
                    retryCount: context.retryCount,
                    source: 'api'
                }
            };

            // Cache successful GET requests
            if (context.method === 'GET' && (context.options.cache ?? this.config.cacheEnabled)) {
                const cacheKey = this.generateCacheKey(context.endpoint, data);
                const cacheTTL = context.options.cacheTTL || this.config.cacheTTL;
                this.cacheManager.set(cacheKey, apiResponse, cacheTTL);
            }

            return apiResponse;

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            const metadata: RequestMetadata = {
                id: context.requestId,
                endpoint: context.endpoint,
                method: context.method,
                timestamp: context.startTime,
                duration,
                error: errorMessage,
                retryCount: context.retryCount,
                cached: false
            };

            if (this.config.enableMetrics) {
                this.metricsCollector.recordRequest(metadata);
            }

            this.logger.logResponse(metadata);

            // Apply error interceptors
            const processedError = await this.applyErrorInterceptors(
                error instanceof EnhancedApiError ? error : EnhancedApiError.fromNetworkError(error as Error, context.requestId),
                context
            );

            throw processedError;
        }
    }

    private async buildRequestConfig(context: RequestContext, data?: any): Promise<RequestInit> {
        const config: RequestInit = {
            method: context.method,
            headers: {
                'Content-Type': 'application/json',
                ...context.options.headers
            }
        };

        // Add auth header
        if (this.authToken) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${this.authToken}`
            };
        }

        // Add body for non-GET requests
        if (data && context.method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        // Add abort signal
        if (context.options.signal) {
            config.signal = context.options.signal;
        }

        return config;
    }

    private async applyRequestInterceptors(config: RequestInit, context: RequestContext): Promise<RequestInit> {
        let finalConfig = config;

        for (const interceptor of this.interceptors) {
            if (interceptor.onRequest) {
                finalConfig = await interceptor.onRequest(finalConfig, context);
            }
        }

        return finalConfig;
    }

    private async applyResponseInterceptors(response: Response, context: RequestContext): Promise<Response> {
        let finalResponse = response;

        for (const interceptor of this.interceptors) {
            if (interceptor.onResponse) {
                finalResponse = await interceptor.onResponse(finalResponse, context);
            }
        }

        return finalResponse;
    }

    private async applyErrorInterceptors(error: EnhancedApiError, context: RequestContext): Promise<EnhancedApiError> {
        let finalError = error;

        for (const interceptor of this.interceptors) {
            if (interceptor.onError) {
                finalError = await interceptor.onError(finalError, context);
            }
        }

        return finalError;
    }

    private async fetchWithTimeout(url: string, config: RequestInit, timeout: number): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw EnhancedApiError.fromTimeout();
            }
            throw error;
        }
    }

    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateCacheKey(endpoint: string, data?: any): string {
        const dataHash = data ? btoa(JSON.stringify(data)).substr(0, 8) : '';
        return `${endpoint}${dataHash ? `_${dataHash}` : ''}`;
    }

    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}

// Factory function for creating configured API client instances
export function createApiClient(config: Partial<ApiClientConfig> = {}): EnhancedApiClient {
    return new EnhancedApiClient(config);
}

// Default instance
export const apiClient = createApiClient();