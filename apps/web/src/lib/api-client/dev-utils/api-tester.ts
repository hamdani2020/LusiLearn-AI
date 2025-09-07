import { EnhancedApiClient } from '../client';
import { mockDataGenerator, MockScenario } from './mock-data-generator';

export interface ApiTestConfig {
  baseURL?: string;
  timeout?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

export interface TestResult {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  status: 'pending' | 'success' | 'error' | 'timeout';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  request?: {
    headers?: Record<string, string>;
    payload?: any;
  };
  response?: {
    status?: number;
    headers?: Record<string, string>;
    data?: any;
    error?: string;
  };
  assertions?: {
    name: string;
    passed: boolean;
    expected: any;
    actual: any;
    message?: string;
  }[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: ApiTest[];
  results?: TestResult[];
  summary?: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

export interface ApiTest {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  payload?: any;
  timeout?: number;
  assertions: TestAssertion[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestAssertion {
  name: string;
  type: 'status' | 'header' | 'body' | 'response-time' | 'custom';
  expected: any;
  path?: string; // For nested object assertions
  validator?: (actual: any, expected: any) => boolean;
}

export class ApiTester {
  private client: EnhancedApiClient;
  private config: ApiTestConfig;
  private testSuites: Map<string, TestSuite> = new Map();
  private listeners: Set<(result: TestResult) => void> = new Set();

  constructor(config: ApiTestConfig = {}) {
    this.config = {
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      timeout: 10000,
      enableLogging: true,
      enableMetrics: true,
      ...config
    };

    this.client = new EnhancedApiClient({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      enableLogging: this.config.enableLogging,
      enableMetrics: this.config.enableMetrics
    });

    this.initializeDefaultTestSuites();
  }

  // Event listeners
  onTestComplete(listener: (result: TestResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitTestComplete(result: TestResult): void {
    this.listeners.forEach(listener => listener(result));
  }

  // Test suite management
  addTestSuite(suite: TestSuite): void {
    this.testSuites.set(suite.id, suite);
  }

  getTestSuite(id: string): TestSuite | undefined {
    return this.testSuites.get(id);
  }

  getAllTestSuites(): TestSuite[] {
    return Array.from(this.testSuites.values());
  }

  // Test execution
  async runTest(test: ApiTest): Promise<TestResult> {
    const result: TestResult = {
      id: `${test.id}_${Date.now()}`,
      name: test.name,
      endpoint: test.endpoint,
      method: test.method,
      status: 'pending',
      startTime: new Date(),
      request: {
        headers: test.headers,
        payload: test.payload
      },
      assertions: []
    };

    try {
      // Setup
      if (test.setup) {
        await test.setup();
      }

      // Execute request
      const response = await this.executeRequest(test);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.response = response;

      // Run assertions
      result.assertions = await this.runAssertions(test.assertions, response, result.duration!);
      
      // Determine overall status
      const failedAssertions = result.assertions.filter(a => !a.passed);
      result.status = failedAssertions.length === 0 ? 'success' : 'error';

      // Teardown
      if (test.teardown) {
        await test.teardown();
      }

    } catch (error) {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.status = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'error';
      result.response = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    this.emitTestComplete(result);
    return result;
  }

  async runTestSuite(suiteId: string): Promise<TestSuite> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const startTime = Date.now();
    const results: TestResult[] = [];

    for (const test of suite.tests) {
      const result = await this.runTest(test);
      results.push(result);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    suite.results = results;
    suite.summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error' || r.status === 'timeout').length,
      duration
    };

    return suite;
  }

  async runAllTestSuites(): Promise<TestSuite[]> {
    const results: TestSuite[] = [];
    
    for (const suite of this.testSuites.values()) {
      const result = await this.runTestSuite(suite.id);
      results.push(result);
    }

    return results;
  }

  // Request execution
  private async executeRequest(test: ApiTest): Promise<any> {
    const timeout = test.timeout || this.config.timeout;
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('Request timeout');
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
    });

    const requestPromise = this.makeRequest(test);

    return Promise.race([requestPromise, timeoutPromise]);
  }

  private async makeRequest(test: ApiTest): Promise<any> {
    const options = {
      headers: test.headers,
      timeout: test.timeout
    };

    let response;
    switch (test.method) {
      case 'GET':
        response = await this.client.get(test.endpoint, options);
        break;
      case 'POST':
        response = await this.client.post(test.endpoint, test.payload, options);
        break;
      case 'PUT':
        response = await this.client.put(test.endpoint, test.payload, options);
        break;
      case 'DELETE':
        response = await this.client.delete(test.endpoint, options);
        break;
      case 'PATCH':
        response = await this.client.patch(test.endpoint, test.payload, options);
        break;
      default:
        throw new Error(`Unsupported method: ${test.method}`);
    }

    return {
      status: response.success ? 200 : 400,
      headers: {},
      data: response.data,
      error: response.error
    };
  }

  // Assertion execution
  private async runAssertions(
    assertions: TestAssertion[],
    response: any,
    duration: number
  ): Promise<TestResult['assertions']> {
    const results: TestResult['assertions'] = [];

    for (const assertion of assertions) {
      const result = await this.runAssertion(assertion, response, duration);
      results.push(result);
    }

    return results;
  }

  private async runAssertion(
    assertion: TestAssertion,
    response: any,
    duration: number
  ): Promise<NonNullable<TestResult['assertions']>[0]> {
    let actual: any;
    let passed = false;
    let message: string | undefined;

    try {
      switch (assertion.type) {
        case 'status':
          actual = response.status;
          passed = actual === assertion.expected;
          break;

        case 'header':
          actual = response.headers?.[assertion.path!];
          passed = actual === assertion.expected;
          break;

        case 'body':
          actual = assertion.path 
            ? this.getNestedValue(response.data, assertion.path)
            : response.data;
          
          if (assertion.validator) {
            passed = assertion.validator(actual, assertion.expected);
          } else {
            passed = JSON.stringify(actual) === JSON.stringify(assertion.expected);
          }
          break;

        case 'response-time':
          actual = duration;
          passed = duration <= assertion.expected;
          break;

        case 'custom':
          if (assertion.validator) {
            passed = assertion.validator(response, assertion.expected);
            actual = response;
          } else {
            throw new Error('Custom assertion requires validator function');
          }
          break;

        default:
          throw new Error(`Unknown assertion type: ${assertion.type}`);
      }
    } catch (error) {
      passed = false;
      message = error instanceof Error ? error.message : 'Assertion error';
    }

    return {
      name: assertion.name,
      passed,
      expected: assertion.expected,
      actual,
      message
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Test builders and helpers
  createTest(config: Omit<ApiTest, 'id'>): ApiTest {
    return {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...config
    };
  }

  createTestSuite(config: Omit<TestSuite, 'id'>): TestSuite {
    return {
      id: `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...config
    };
  }

  // Quick test methods
  async quickTest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    payload?: any
  ): Promise<TestResult> {
    const test = this.createTest({
      name: `Quick test: ${method} ${endpoint}`,
      description: 'Quick manual test',
      endpoint,
      method,
      payload,
      assertions: [
        {
          name: 'Response received',
          type: 'custom',
          expected: true,
          validator: (response) => response !== undefined
        }
      ]
    });

    return this.runTest(test);
  }

  async testEndpointHealth(endpoint: string): Promise<TestResult> {
    const test = this.createTest({
      name: `Health check: ${endpoint}`,
      description: 'Basic endpoint health check',
      endpoint,
      method: 'GET',
      assertions: [
        {
          name: 'Status is 200',
          type: 'status',
          expected: 200
        },
        {
          name: 'Response time under 2s',
          type: 'response-time',
          expected: 2000
        }
      ]
    });

    return this.runTest(test);
  }

  // Mock scenario testing
  async testWithMockScenario(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    scenario: MockScenario
  ): Promise<TestResult> {
    const test = this.createTest({
      name: `Mock scenario: ${scenario.name}`,
      description: scenario.description,
      endpoint,
      method,
      payload: scenario.data,
      assertions: [
        {
          name: 'Matches expected response',
          type: 'body',
          expected: scenario.data
        }
      ]
    });

    if (scenario.metadata?.responseTime) {
      test.assertions.push({
        name: 'Response time within expected range',
        type: 'response-time',
        expected: scenario.metadata.responseTime * 2 // Allow 2x expected time
      });
    }

    return this.runTest(test);
  }

  // Default test suites
  private initializeDefaultTestSuites(): void {
    // Health check suite
    const healthSuite = this.createTestSuite({
      name: 'Health Checks',
      description: 'Basic health checks for all endpoints',
      tests: [
        this.createTest({
          name: 'API Health',
          description: 'Check if API is responding',
          endpoint: '/api/health',
          method: 'GET',
          assertions: [
            { name: 'Status is 200', type: 'status', expected: 200 },
            { name: 'Response time under 1s', type: 'response-time', expected: 1000 }
          ]
        }),
        this.createTest({
          name: 'Learning Paths Endpoint',
          description: 'Check learning paths endpoint',
          endpoint: '/api/v1/learning-paths',
          method: 'GET',
          assertions: [
            { name: 'Status is 200', type: 'status', expected: 200 },
            { name: 'Returns array', type: 'body', expected: [], validator: (actual) => Array.isArray(actual) }
          ]
        })
      ]
    });

    // Authentication suite
    const authSuite = this.createTestSuite({
      name: 'Authentication',
      description: 'Authentication and authorization tests',
      tests: [
        this.createTest({
          name: 'Unauthorized Access',
          description: 'Test unauthorized access to protected endpoint',
          endpoint: '/api/v1/user/profile',
          method: 'GET',
          assertions: [
            { name: 'Status is 401', type: 'status', expected: 401 }
          ]
        })
      ]
    });

    // Performance suite
    const performanceSuite = this.createTestSuite({
      name: 'Performance',
      description: 'Performance and load tests',
      tests: [
        this.createTest({
          name: 'Fast Response',
          description: 'Test response time for cached data',
          endpoint: '/api/v1/learning-paths',
          method: 'GET',
          assertions: [
            { name: 'Response time under 500ms', type: 'response-time', expected: 500 }
          ]
        })
      ]
    });

    this.addTestSuite(healthSuite);
    this.addTestSuite(authSuite);
    this.addTestSuite(performanceSuite);
  }

  // Utility methods
  generateTestReport(): {
    summary: {
      totalSuites: number;
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalDuration: number;
    };
    suites: TestSuite[];
  } {
    const suites = Array.from(this.testSuites.values());
    const totalTests = suites.reduce((sum, suite) => sum + (suite.results?.length || 0), 0);
    const passedTests = suites.reduce((sum, suite) => 
      sum + (suite.results?.filter(r => r.status === 'success').length || 0), 0);
    const failedTests = totalTests - passedTests;
    const totalDuration = suites.reduce((sum, suite) => sum + (suite.summary?.duration || 0), 0);

    return {
      summary: {
        totalSuites: suites.length,
        totalTests,
        passedTests,
        failedTests,
        totalDuration
      },
      suites
    };
  }

  exportResults(): string {
    const report = this.generateTestReport();
    return JSON.stringify(report, null, 2);
  }

  clearResults(): void {
    this.testSuites.forEach(suite => {
      suite.results = undefined;
      suite.summary = undefined;
    });
  }
}

// Singleton instance for development
export const apiTester = new ApiTester();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__API_TESTER__ = apiTester;
}