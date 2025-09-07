/**
 * Mock Service Worker (MSW) server setup for testing
 * Provides API mocking capabilities for unit and integration tests
 */

import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { RequestHandler } from 'msw';

// Default handlers for common API endpoints
const defaultHandlers: RequestHandler[] = [
  // Authentication endpoints
  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      success: true,
      data: {
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'student'
        }
      }
    });
  }),

  http.post('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      success: true,
      data: {
        token: 'new-mock-jwt-token',
        refreshToken: 'new-mock-refresh-token'
      }
    });
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
  }),

  // Learning paths endpoints
  http.get('/api/v1/learning-paths', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'path-1',
          subject: 'Mathematics',
          currentLevel: 'intermediate',
          objectives: ['Master calculus', 'Understand linear algebra'],
          milestones: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ]
    });
  }),

  http.get('/api/v1/learning-paths/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      success: true,
      data: {
        id,
        subject: 'Mathematics',
        currentLevel: 'intermediate',
        objectives: ['Master calculus', 'Understand linear algebra'],
        milestones: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    });
  }),

  http.post('/api/v1/learning-paths', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'new-path-id',
        subject: 'New Subject',
        currentLevel: 'beginner',
        objectives: [],
        milestones: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }, { status: 201 });
  }),

  // Progress tracking endpoints
  http.get('/api/v1/progress/analytics/weekly', () => {
    return HttpResponse.json({
      success: true,
      data: {
        weeklyProgress: [
          { week: '2024-W01', hoursStudied: 10, completedLessons: 5 },
          { week: '2024-W02', hoursStudied: 12, completedLessons: 7 }
        ]
      }
    });
  }),

  // Collaboration endpoints
  http.get('/api/v1/collaboration/study-groups', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 'group-1',
          name: 'Math Study Group',
          subject: 'Mathematics',
          members: 5,
          maxMembers: 10,
          createdAt: '2024-01-01T00:00:00Z'
        }
      ]
    });
  }),

  // Default error handler for unmatched requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json({
      success: false,
      error: 'Not found',
      message: `No handler found for ${request.method} ${request.url}`
    }, { status: 404 });
  })
];

// Create the mock server
export const mockServer = setupServer(...defaultHandlers);

// Server control utilities
export const startMockServer = () => {
  mockServer.listen({
    onUnhandledRequest: 'warn'
  });
};

export const stopMockServer = () => {
  mockServer.close();
};

export const resetMockServer = () => {
  mockServer.resetHandlers();
};

// Helper functions for adding custom handlers
export const addMockHandler = (handler: RequestHandler) => {
  mockServer.use(handler);
};

export const addMockHandlers = (handlers: RequestHandler[]) => {
  mockServer.use(...handlers);
};

// Common mock response builders
export const mockSuccessResponse = (data: any, status = 200) => {
  return {
    success: true,
    data,
    metadata: {
      requestId: 'mock-request-id',
      timestamp: new Date().toISOString(),
      duration: 100,
      cached: false
    }
  };
};

export const mockErrorResponse = (error: string, status = 400) => {
  return {
    success: false,
    error,
    message: error,
    metadata: {
      requestId: 'mock-request-id',
      timestamp: new Date().toISOString(),
      duration: 50,
      cached: false
    }
  };
};

// Network error simulation
export const simulateNetworkError = (endpoint: string) => {
  mockServer.use(
    http.all(endpoint, () => {
      return HttpResponse.error();
    })
  );
};

// Timeout simulation
export const simulateTimeout = (endpoint: string, delay = 5000) => {
  mockServer.use(
    http.all(endpoint, async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return HttpResponse.json(mockSuccessResponse({}));
    })
  );
};

// Rate limit simulation
export const simulateRateLimit = (endpoint: string) => {
  mockServer.use(
    http.all(endpoint, () => {
      return HttpResponse.json(
        mockErrorResponse('Rate limit exceeded', 429),
        { status: 429 }
      );
    })
  );
};