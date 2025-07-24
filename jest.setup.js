// Global test setup
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_DB = 'lusilearn_test';
process.env.POSTGRES_USER = 'test';
process.env.POSTGRES_PASSWORD = 'test';

process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '1';

process.env.OPENAI_API_KEY = 'test-key';
process.env.VECTOR_DB_API_KEY = 'test-key';

// Increase timeout for integration tests
jest.setTimeout(30000);