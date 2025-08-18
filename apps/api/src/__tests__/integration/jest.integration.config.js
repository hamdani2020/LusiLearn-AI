const path = require('path');

module.exports = {
  displayName: 'api-integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '../../../'),
  roots: ['<rootDir>/src/__tests__/integration'],
  testMatch: ['**/__tests__/integration/**/*.integration.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/__tests__/**',
    '!src/examples/**'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lusilearn/config$': '<rootDir>/../../packages/config/src',
    '^@lusilearn/shared-types$': '<rootDir>/../../packages/shared-types/src'
  },
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/__tests__/integration/setup.ts'
  ],
  testTimeout: 60000, // 60 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially to avoid database conflicts
  forceExit: true,
  detectOpenHandles: true
};