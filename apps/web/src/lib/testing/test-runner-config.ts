/**
 * Test runner configuration for comprehensive testing infrastructure
 * Configures test environments, coverage, and reporting
 */

import type { Config } from 'jest';

// Base Jest configuration
export const baseJestConfig: Config = {
  displayName: 'Frontend API Integration Tests',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/*.test.{ts,tsx}'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/lib/testing/**', // Exclude testing utilities from coverage
    '!src/**/__tests__/**'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testTimeout: 10000, // 10 seconds default timeout
  maxWorkers: '50%', // Use half of available CPU cores
  verbose: true
};

// Unit test specific configuration
export const unitTestConfig: Config = {
  ...baseJestConfig,
  displayName: 'Unit Tests',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
    '!<rootDir>/src/**/__tests__/**/*.integration.test.{ts,tsx}'
  ],
  testTimeout: 5000, // Shorter timeout for unit tests
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/lib/testing/unit-test-setup.ts'
  ]
};

// Integration test specific configuration
export const integrationTestConfig: Config = {
  ...baseJestConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.integration.test.{ts,tsx}'
  ],
  testTimeout: 30000, // Longer timeout for integration tests
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/lib/testing/integration-test-setup.ts'
  ],
  maxWorkers: 1, // Run integration tests sequentially
  globalSetup: '<rootDir>/src/lib/testing/global-setup.ts',
  globalTeardown: '<rootDir>/src/lib/testing/global-teardown.ts'
};

// Performance test configuration
export const performanceTestConfig: Config = {
  ...baseJestConfig,
  displayName: 'Performance Tests',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.performance.test.{ts,tsx}'
  ],
  testTimeout: 60000, // 1 minute for performance tests
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/lib/testing/performance-test-setup.ts'
  ],
  maxWorkers: 1, // Run performance tests sequentially
  reporters: [
    'default',
    ['<rootDir>/src/lib/testing/performance-reporter.js', {}]
  ]
};

// Test environment configurations
export const testEnvironments = {
  development: {
    apiBaseUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001',
    skipIntegrationTests: false,
    enableMockServer: true,
    logLevel: 'debug'
  },
  ci: {
    apiBaseUrl: 'http://api:3001',
    wsUrl: 'ws://api:3001',
    skipIntegrationTests: false,
    enableMockServer: false,
    logLevel: 'error'
  },
  production: {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
    skipIntegrationTests: true,
    enableMockServer: false,
    logLevel: 'error'
  }
};

// Test suite configurations
export const testSuites = {
  unit: {
    config: unitTestConfig,
    description: 'Fast unit tests for individual components and functions',
    runInParallel: true,
    requiredCoverage: 90
  },
  integration: {
    config: integrationTestConfig,
    description: 'Integration tests with real API endpoints',
    runInParallel: false,
    requiredCoverage: 80
  },
  performance: {
    config: performanceTestConfig,
    description: 'Performance and load testing',
    runInParallel: false,
    requiredCoverage: 70
  },
  e2e: {
    description: 'End-to-end tests with Playwright',
    command: 'npx playwright test',
    runInParallel: true,
    requiredCoverage: 60
  }
};

// Coverage reporting configuration
export const coverageConfig = {
  reporters: [
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  outputDir: 'coverage',
  thresholds: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    perFile: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  excludePatterns: [
    'src/lib/testing/**',
    'src/**/__tests__/**',
    'src/**/*.test.{ts,tsx}',
    'src/**/*.stories.{ts,tsx}',
    'src/**/*.d.ts'
  ]
};

// Test execution strategies
export const executionStrategies = {
  // Fast feedback during development
  watch: {
    suites: ['unit'],
    watchMode: true,
    coverage: false,
    parallel: true
  },
  
  // Pre-commit validation
  preCommit: {
    suites: ['unit', 'integration'],
    watchMode: false,
    coverage: true,
    parallel: true,
    failFast: true
  },
  
  // Full test suite for CI/CD
  ci: {
    suites: ['unit', 'integration', 'performance', 'e2e'],
    watchMode: false,
    coverage: true,
    parallel: false, // Sequential for stability in CI
    failFast: false,
    retries: 2
  },
  
  // Performance-focused testing
  performance: {
    suites: ['performance'],
    watchMode: false,
    coverage: false,
    parallel: false,
    generateReports: true
  }
};

// Test data management
export const testDataConfig = {
  // Mock data generation
  mockData: {
    users: 100,
    learningPaths: 50,
    studyGroups: 20,
    progressRecords: 200
  },
  
  // Test database configuration
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433'),
    database: process.env.TEST_DB_NAME || 'lusilearn_test',
    username: process.env.TEST_DB_USER || 'test_user',
    password: process.env.TEST_DB_PASSWORD || 'test_password'
  },
  
  // Data cleanup strategies
  cleanup: {
    afterEach: true,
    afterAll: true,
    preserveOnFailure: true
  }
};

// Reporting configuration
export const reportingConfig = {
  // Test results reporting
  results: {
    formats: ['json', 'html', 'junit'],
    outputDir: 'test-results',
    includeConsoleOutput: true,
    includeScreenshots: true
  },
  
  // Performance metrics reporting
  performance: {
    formats: ['json', 'html'],
    outputDir: 'performance-results',
    includeCharts: true,
    compareBaseline: true
  },
  
  // Coverage reporting
  coverage: {
    formats: ['html', 'lcov', 'text'],
    outputDir: 'coverage',
    includeUncoveredFiles: true,
    generateBadges: true
  }
};

// Export default configuration based on environment
export const getTestConfig = (environment: string = 'development') => {
  const env = testEnvironments[environment as keyof typeof testEnvironments] || testEnvironments.development;
  
  return {
    environment: env,
    suites: testSuites,
    coverage: coverageConfig,
    execution: executionStrategies,
    testData: testDataConfig,
    reporting: reportingConfig
  };
};

export default getTestConfig();