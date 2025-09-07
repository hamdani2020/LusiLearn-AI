export { MockDataGenerator, mockDataGenerator } from './mock-data-generator';
export type { 
  MockDataGeneratorConfig, 
  MockScenario 
} from './mock-data-generator';

export { ApiTester, apiTester } from './api-tester';
export type { 
  ApiTestConfig, 
  TestResult, 
  TestSuite, 
  ApiTest, 
  TestAssertion 
} from './api-tester';

// Combined development utilities interface
export interface DevUtilsConfig {
  mockGenerator: Partial<import('./mock-data-generator').MockDataGeneratorConfig>;
  apiTester: Partial<import('./api-tester').ApiTestConfig>;
}

export class DevUtils {
  constructor(config: Partial<DevUtilsConfig> = {}) {
    if (config.mockGenerator) {
      mockDataGenerator.setSeed(config.mockGenerator.seed || 12345);
    }
    
    if (config.apiTester) {
      // ApiTester config is handled in constructor
    }
  }

  // Quick access methods
  generateMockData(type: 'users' | 'learning-paths' | 'study-groups' | 'scenarios', count: number = 5) {
    switch (type) {
      case 'users':
        return mockDataGenerator.generateUsers(count);
      case 'learning-paths':
        return mockDataGenerator.generateLearningPaths(count);
      case 'study-groups':
        return mockDataGenerator.generateStudyGroups(count);
      case 'scenarios':
        return mockDataGenerator.generateApiScenarios();
      default:
        return [];
    }
  }

  async quickApiTest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET') {
    return apiTester.quickTest(endpoint, method);
  }

  async runHealthChecks() {
    const healthSuite = apiTester.getTestSuite('health-checks');
    if (healthSuite) {
      return apiTester.runTestSuite(healthSuite.id);
    }
    throw new Error('Health check suite not found');
  }

  // Export utilities for external use
  exportTestResults() {
    return apiTester.exportResults();
  }

  exportMockData(type: string, count: number = 10) {
    const data = this.generateMockData(type as any, count);
    return JSON.stringify(data, null, 2);
  }

  // Development helpers
  setupDevelopmentEnvironment() {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // Add helpful console commands
      (window as any).devUtils = {
        generateMockData: this.generateMockData.bind(this),
        quickTest: this.quickApiTest.bind(this),
        healthCheck: this.runHealthChecks.bind(this),
        mockGenerator: mockDataGenerator,
        apiTester: apiTester
      };
      
      console.log('🛠️ Development utilities available at window.devUtils');
    }
  }
}

// Singleton instance
export const devUtils = new DevUtils();

// Auto-setup in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  devUtils.setupDevelopmentEnvironment();
}