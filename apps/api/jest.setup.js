// Jest setup file for API tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock Redis if not available in test environment
jest.mock('./src/cache/redis-client', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    multi: jest.fn(() => ({
      zRemRangeByScore: jest.fn().mockReturnThis(),
      zAdd: jest.fn().mockReturnThis(),
      zCard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([null, null, 0, null]),
    })),
    publish: jest.fn(),
    subscribe: jest.fn(),
    info: jest.fn().mockResolvedValue('# Memory\nused_memory_human:1.00M\n'),
    flushAll: jest.fn(),
  };

  return {
    redisClient: {
      getInstance: () => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        getClient: () => mockClient,
        healthCheck: jest.fn().mockResolvedValue(true),
        isReady: jest.fn().mockReturnValue(true),
      }),
    },
  };
});

// Increase timeout for integration tests
jest.setTimeout(30000);