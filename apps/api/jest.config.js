module.exports = {
  displayName: 'api',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lusilearn/config$': '<rootDir>/../../packages/config/src',
    '^@lusilearn/shared-types$': '<rootDir>/../../packages/shared-types/src'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};