import { UploadOptions, ApiResponse, UploadProgress, ErrorType } from './types';
import { EnhancedApiClient } from './client';
import { EnhancedApiError } from './errors';

export interface ChunkedUploadOptions extends UploadOptions {
  chunkSize?: number;
  maxRetries?: number;
  resumable?: boolean;
  metadata?: Record<string, any>;
}



export interface UploadSession {
  id: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: Date;
  expiresAt: Date;
}

export class FileUploadManager {
  private client: EnhancedApiClient;
  private activeSessions = new Map<string, UploadSession>();
  private uploadProgress = new Map<string, UploadProgress>();

  constructor(client: EnhancedApiClient) {
    this.client = client;
  }

  async uploadFile(
    endpoint: string,
    file: File,
    options: ChunkedUploadOptions = {}
  ): Promise<ApiResponse<any>> {
    const {
      chunkSize = 1024 * 1024, // 1MB chunks
      maxRetries = 3,
      resumable = true,
      onProgress,
      metadata = {}
    } = options;

    // For small files, use simple upload
    if (file.size <= chunkSize) {
      return this.simpleUpload(endpoint, file, options);
    }

    // For large files, use chunked upload
    return this.chunkedUpload(endpoint, file, {
      ...options,
      chunkSize,
      maxRetries,
      resumable
    });
  }

  async uploadMultipleFiles(
    endpoint: string,
    files: File[],
    options: ChunkedUploadOptions = {}
  ): Promise<ApiResponse<any[]>> {
    const results: any[] = [];
    const errors: string[] = [];
    let totalProgress = 0;

    const fileProgresses = new Map<string, number>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `file_${i}_${file.name}`;

      try {
        const result = await this.uploadFile(endpoint, file, {
          ...options,
          onProgress: (progress) => {
            fileProgresses.set(fileId, progress.percentage);
            
            // Calculate overall progress
            const totalPercentage = Array.from(fileProgresses.values())
              .reduce((sum, p) => sum + p, 0) / files.length;
            
            options.onProgress?.({
              ...progress,
              percentage: totalPercentage,
              loaded: Math.round((totalPercentage / 100) * files.reduce((sum, f) => sum + f.size, 0)),
              total: files.reduce((sum, f) => sum + f.size, 0)
            });
          }
        });

        if (result.success) {
          results.push(result.data);
        } else {
          errors.push(`${file.name}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      metadata: {
        requestId: `multi_upload_${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: 0,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    };
  }

  private async simpleUpload(
    endpoint: string,
    file: File,
    options: ChunkedUploadOptions
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata
    if (options.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastLoaded = 0;
      let lastTime = startTime;

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          const loadedDiff = event.loaded - lastLoaded;
          
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
          const remainingBytes = event.total - event.loaded;
          const remainingTime = speed > 0 ? remainingBytes / speed : 0;

          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: (event.loaded / event.total) * 100,
            speed,
            remainingTime
          };

          options.onProgress?.(progress);
          
          lastLoaded = event.loaded;
          lastTime = now;
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
              requestId: `upload_${Date.now()}`,
              timestamp: new Date().toISOString(),
              duration: Date.now() - startTime,
              cached: false,
              retryCount: 0,
              source: 'api'
            }
          });
        } catch (error) {
          reject(new EnhancedApiError('Invalid response format', ErrorType.UNKNOWN, xhr.status));
        }
      });

      xhr.addEventListener('error', () => {
        reject(EnhancedApiError.fromNetworkError(new Error('Upload failed')));
      });

      xhr.addEventListener('timeout', () => {
        reject(EnhancedApiError.fromTimeout());
      });

      xhr.open('POST', `${this.client['config'].baseURL}${endpoint}`);
      
      // Add auth header
      const authToken = this.client['authToken'];
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      // Set timeout
      xhr.timeout = options.timeout || 30000;

      xhr.send(formData);
    });
  }

  private async chunkedUpload(
    endpoint: string,
    file: File,
    options: ChunkedUploadOptions
  ): Promise<ApiResponse<any>> {
    const { chunkSize = 1024 * 1024, maxRetries = 3, resumable = true } = options;
    
    const totalChunks = Math.ceil(file.size / chunkSize);
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create upload session
    const session: UploadSession = {
      id: sessionId,
      fileName: file.name,
      fileSize: file.size,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.activeSessions.set(sessionId, session);

    try {
      // Initialize upload session on server
      await this.initializeUploadSession(endpoint, session, options.metadata);

      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (session.uploadedChunks.includes(chunkIndex)) {
          continue; // Skip already uploaded chunks (for resumable uploads)
        }

        let retries = 0;
        let chunkUploaded = false;

        while (!chunkUploaded && retries < maxRetries) {
          try {
            await this.uploadChunk(endpoint, file, chunkIndex, session, options);
            session.uploadedChunks.push(chunkIndex);
            chunkUploaded = true;

            // Update progress
            const progress: UploadProgress = {
              loaded: session.uploadedChunks.length * chunkSize,
              total: file.size,
              percentage: (session.uploadedChunks.length / totalChunks) * 100,
              speed: 0, // Will be calculated by individual chunk uploads
              remainingTime: 0,
              chunkIndex,
              totalChunks
            };

            options.onProgress?.(progress);

          } catch (error) {
            retries++;
            if (retries >= maxRetries) {
              throw error;
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          }
        }
      }

      // Finalize upload
      const result = await this.finalizeUpload(endpoint, session);
      
      // Cleanup
      this.activeSessions.delete(sessionId);
      this.uploadProgress.delete(sessionId);

      return result;

    } catch (error) {
      // Cleanup on error
      this.activeSessions.delete(sessionId);
      this.uploadProgress.delete(sessionId);
      throw error;
    }
  }

  private async initializeUploadSession(
    endpoint: string,
    session: UploadSession,
    metadata?: Record<string, any>
  ): Promise<void> {
    const response = await this.client.post(`${endpoint}/init`, {
      sessionId: session.id,
      fileName: session.fileName,
      fileSize: session.fileSize,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      metadata
    });

    if (!response.success) {
      throw new EnhancedApiError(`Failed to initialize upload session: ${response.error}`);
    }
  }

  private async uploadChunk(
    endpoint: string,
    file: File,
    chunkIndex: number,
    session: UploadSession,
    options: ChunkedUploadOptions
  ): Promise<void> {
    const start = chunkIndex * session.chunkSize;
    const end = Math.min(start + session.chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('sessionId', session.id);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', session.totalChunks.toString());

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const chunkProgress = (event.loaded / event.total) * 100;
          const overallLoaded = (session.uploadedChunks.length * session.chunkSize) + event.loaded;
          const overallProgress = (overallLoaded / file.size) * 100;

          const progress: UploadProgress = {
            loaded: overallLoaded,
            total: file.size,
            percentage: overallProgress,
            speed: event.loaded / ((Date.now() - startTime) / 1000),
            remainingTime: 0,
            chunkIndex,
            totalChunks: session.totalChunks
          };

          options.onProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new EnhancedApiError(`Chunk upload failed: ${xhr.statusText}`, ErrorType.UNKNOWN, xhr.status));
        }
      });

      xhr.addEventListener('error', () => {
        reject(EnhancedApiError.fromNetworkError(new Error('Chunk upload failed')));
      });

      xhr.addEventListener('timeout', () => {
        reject(EnhancedApiError.fromTimeout());
      });

      xhr.open('POST', `${this.client['config'].baseURL}${endpoint}/chunk`);
      
      // Add auth header
      const authToken = this.client['authToken'];
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      xhr.timeout = options.timeout || 30000;
      xhr.send(formData);
    });
  }

  private async finalizeUpload(endpoint: string, session: UploadSession): Promise<ApiResponse<any>> {
    const response = await this.client.post(`${endpoint}/finalize`, {
      sessionId: session.id
    });

    if (!response.success) {
      throw new EnhancedApiError(`Failed to finalize upload: ${response.error}`);
    }

    return response;
  }

  // Resume interrupted upload
  async resumeUpload(
    endpoint: string,
    sessionId: string,
    file: File,
    options: ChunkedUploadOptions = {}
  ): Promise<ApiResponse<any>> {
    // Get upload status from server
    const statusResponse = await this.client.get(`${endpoint}/status/${sessionId}`);
    
    if (!statusResponse.success || !statusResponse.data) {
      throw new EnhancedApiError('Upload session not found or expired');
    }

    const serverSession = statusResponse.data as {
      chunkSize: number;
      totalChunks: number;
      uploadedChunks: number[];
      createdAt: string;
      expiresAt: string;
    };
    
    // Reconstruct session
    const session: UploadSession = {
      id: sessionId,
      fileName: file.name,
      fileSize: file.size,
      chunkSize: serverSession.chunkSize,
      totalChunks: serverSession.totalChunks,
      uploadedChunks: serverSession.uploadedChunks || [],
      createdAt: new Date(serverSession.createdAt),
      expiresAt: new Date(serverSession.expiresAt)
    };

    this.activeSessions.set(sessionId, session);

    // Continue with chunked upload
    return this.chunkedUpload(endpoint, file, options);
  }

  // Cancel active upload
  cancelUpload(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.uploadProgress.delete(sessionId);
  }

  // Get active upload sessions
  getActiveSessions(): UploadSession[] {
    return Array.from(this.activeSessions.values());
  }

  // Get upload progress
  getUploadProgress(sessionId: string): UploadProgress | null {
    return this.uploadProgress.get(sessionId) || null;
  }
}