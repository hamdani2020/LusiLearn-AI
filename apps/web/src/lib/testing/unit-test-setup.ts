/**
 * Unit test setup configuration
 * Configures mocks and utilities specifically for unit tests
 */

import { startMockServer, stopMockServer, resetMockServer } from './msw-server';
import { MockWebSocket } from './mock-websocket';

// Setup MSW for unit tests
beforeAll(() => {
  startMockServer();
});

afterEach(() => {
  resetMockServer();
});

afterAll(() => {
  stopMockServer();
});

// Mock WebSocket globally for unit tests
beforeAll(() => {
  MockWebSocket.mockGlobalWebSocket();
});

afterAll(() => {
  MockWebSocket.restoreGlobalWebSocket();
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock performance API for performance tests
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    ...performance,
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn().mockReturnValue([]),
    getEntriesByType: jest.fn().mockReturnValue([]),
    now: jest.fn(() => Date.now()),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
  },
});

// Mock crypto API for secure operations
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockImplementation((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
    subtle: {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      generateKey: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn(),
    },
  },
});

// Enhanced console mocking for unit tests
const originalConsole = { ...console };
beforeEach(() => {
  // Suppress console output in unit tests unless explicitly needed
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console after each test
  Object.assign(console, originalConsole);
});

// Mock URL.createObjectURL for file upload tests
global.URL.createObjectURL = jest.fn(() => 'mocked-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader for file handling tests
global.File = jest.fn().mockImplementation((chunks, filename, options) => ({
  name: filename,
  size: chunks.reduce((acc: number, chunk: any) => acc + chunk.length, 0),
  type: options?.type || 'text/plain',
  lastModified: Date.now(),
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  text: jest.fn().mockResolvedValue(chunks.join('')),
  stream: jest.fn(),
  slice: jest.fn(),
}));

global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  readAsArrayBuffer: jest.fn(),
  onload: null,
  onerror: null,
  result: null,
}));

// Mock Blob for binary data tests
global.Blob = jest.fn().mockImplementation((chunks, options) => ({
  size: chunks.reduce((acc: number, chunk: any) => acc + chunk.length, 0),
  type: options?.type || 'text/plain',
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  text: jest.fn().mockResolvedValue(chunks.join('')),
  stream: jest.fn(),
  slice: jest.fn(),
}));

// Mock canvas for chart/visualization tests
HTMLCanvasElement.prototype.getContext = jest.fn().mockImplementation(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
}));

// Mock requestAnimationFrame for animation tests
global.requestAnimationFrame = jest.fn().mockImplementation(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn().mockImplementation(id => clearTimeout(id));

// Mock scrollTo for scroll behavior tests
global.scrollTo = jest.fn();
Element.prototype.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// Setup test utilities
export const setupUnitTest = () => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Reset any global state
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/');
  }
};

// Cleanup after unit tests
export const cleanupUnitTest = () => {
  // Clear any timers
  jest.clearAllTimers();
  
  // Clear any intervals
  jest.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
};

// Auto-setup for each test
beforeEach(setupUnitTest);
afterEach(cleanupUnitTest);