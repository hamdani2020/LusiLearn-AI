// Jest setup for web package
require('jest-environment-jsdom');
require('@testing-library/jest-dom');

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock fetch globally
global.fetch = jest.fn();

// Mock XMLHttpRequest
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  addEventListener: jest.fn(),
  upload: {
    addEventListener: jest.fn()
  },
  timeout: 0,
  status: 200,
  statusText: 'OK',
  responseText: '{"success": true}'
}));

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: ''
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
process.env.NEXT_PUBLIC_AI_SERVICE_URL = 'http://localhost:8001';
process.env.NODE_ENV = 'test';