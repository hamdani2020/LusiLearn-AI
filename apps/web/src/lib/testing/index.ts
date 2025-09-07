/**
 * Testing utilities index
 * Exports all testing utilities and helpers for easy importing
 */

// MSW server utilities
export {
  mockServer,
  startMockServer,
  stopMockServer,
  resetMockServer,
  addMockHandler,
  addMockHandlers,
  mockSuccessResponse,
  mockErrorResponse,
  simulateNetworkError,
  simulateTimeout,
  simulateRateLimit
} from './msw-server';

// Test utilities and helpers
export {
  renderWithProviders,
  createMockUser,
  createMockLearningPath,
  createMockStudyGroup,
  createAuthenticatedUser,
  createUnauthenticatedUser,
  createMockApiResponse,
  createMockApiError,
  createMockWebSocketMessage,
  mockLocalStorage,
  mockSessionStorage,
  mockFetch,
  mockTimers,
  waitFor,
  TestErrorBoundary,
  measurePerformance,
  mockConsole
} from './test-utils';

// WebSocket mocking utilities
export {
  MockWebSocket,
  MockWebSocketServer,
  createMockCollaborationMessage,
  createMockProgressMessage,
  createMockNotificationMessage,
  createWebSocketTestSuite,
  simulateConnectionStates
} from './mock-websocket';

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';