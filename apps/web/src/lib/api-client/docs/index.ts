// Documentation exports
export { InteractiveApiDocumentation } from '@/components/dev/interactive-api-docs';

// Documentation content (for programmatic access)
export const documentation = {
  guides: {
    'api-integration': {
      title: 'API Integration Guide',
      description: 'Comprehensive guide for integrating with the LusiLearn API',
      path: '/src/lib/api-client/docs/api-integration-guide.md',
      sections: [
        'Quick Start',
        'API Client',
        'React Hooks',
        'Error Handling',
        'Caching',
        'Real-time Features',
        'Performance Optimization',
        'Type Safety',
        'Testing',
        'Debugging',
        'Best Practices'
      ]
    },
    'typescript-types': {
      title: 'TypeScript Types Guide',
      description: 'Complete reference for all TypeScript types in the API system',
      path: '/src/lib/api-client/docs/typescript-types-guide.md',
      sections: [
        'Core API Types',
        'Request/Response Types',
        'Hook Types',
        'Error Types',
        'Configuration Types',
        'Utility Types',
        'Validation Types',
        'Real-time Types',
        'Type Guards',
        'Advanced Usage'
      ]
    }
  },
  
  examples: {
    'basic-usage': {
      title: 'Basic API Usage',
      code: `
import { apiClient } from '@/lib/api-client';
import { useLearningPaths } from '@/hooks/use-learning-paths';

// Using API client directly
const response = await apiClient.get('/api/v1/learning-paths');

// Using React hooks (recommended)
function MyComponent() {
  const { learningPaths, loading, error } = useLearningPaths();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      {learningPaths.map(path => (
        <div key={path.id}>{path.title}</div>
      ))}
    </div>
  );
}
      `
    },
    
    'error-handling': {
      title: 'Error Handling',
      code: `
import { EnhancedApiError, ErrorType } from '@/lib/api-client/errors';

try {
  const data = await apiClient.get('/api/v1/data');
} catch (error) {
  if (error instanceof EnhancedApiError) {
    switch (error.type) {
      case ErrorType.NETWORK:
        console.log('Network error - check connection');
        break;
      case ErrorType.AUTHENTICATION:
        console.log('Authentication error - redirect to login');
        break;
      case ErrorType.RATE_LIMIT:
        console.log(\`Rate limited - retry after \${error.retryAfter}s\`);
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
      `
    },
    
    'optimistic-updates': {
      title: 'Optimistic Updates',
      code: `
function LearningPathComponent() {
  const { 
    learningPaths, 
    updateLearningPath, 
    optimisticUpdate, 
    rollbackOptimisticUpdate 
  } = useLearningPaths();

  const handleUpdate = async (id: string, updates: Partial<LearningPath>) => {
    // Update UI immediately
    optimisticUpdate(id, updates);
    
    try {
      // Send actual update
      await updateLearningPath(id, updates);
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(id);
      console.error('Update failed:', error);
    }
  };

  return (
    <div>
      {learningPaths.map(path => (
        <div key={path.id}>
          <h3>{path.title}</h3>
          <button onClick={() => handleUpdate(path.id, { title: 'Updated Title' })}>
            Update
          </button>
        </div>
      ))}
    </div>
  );
}
      `
    },
    
    'real-time-collaboration': {
      title: 'Real-time Collaboration',
      code: `
import { useRealTimeCollaboration } from '@/hooks/use-real-time-collaboration';

function CollaborationComponent() {
  const {
    isConnected,
    participants,
    messages,
    sendMessage,
    joinSession,
    leaveSession
  } = useRealTimeCollaboration();

  useEffect(() => {
    joinSession('session-123');
    return () => leaveSession();
  }, []);

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Participants: {participants.length}</div>
      
      <div>
        {messages.map(message => (
          <div key={message.id}>
            <strong>{message.sender}:</strong> {message.content}
          </div>
        ))}
      </div>
      
      <button onClick={() => sendMessage('Hello everyone!')}>
        Send Message
      </button>
    </div>
  );
}
      `
    },
    
    'caching-configuration': {
      title: 'Caching Configuration',
      code: `
import { createApiClient } from '@/lib/api-client';

// Global cache configuration
const client = createApiClient({
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000 // 5 minutes
});

// Per-request cache configuration
const data = await client.get('/api/v1/data', {
  cache: true,
  cacheTTL: 10 * 60 * 1000 // 10 minutes
});

// Hook-level cache configuration
const { data } = useLearningPaths({
  cacheTime: 10 * 60 * 1000,  // Cache for 10 minutes
  staleTime: 5 * 60 * 1000    // Consider stale after 5 minutes
});

// Manual cache management
client.clearCache('/api/v1/users*'); // Clear specific cache
client.clearCache(); // Clear all cache
      `
    },
    
    'type-safety': {
      title: 'Type Safety',
      code: `
import { ApiResponse, LearningPath, CreateLearningPathRequest } from '@/lib/api-client/types';

// Type-safe API calls
const users: ApiResponse<User[]> = await client.get<User[]>('/api/v1/users');

// Type-safe hook usage
const { learningPaths }: { learningPaths: LearningPath[] } = useLearningPaths();

// Type-safe request payloads
const createPath = async (data: CreateLearningPathRequest): Promise<LearningPath | null> => {
  return createLearningPath(data);
};

// Runtime validation
import { validateApiResponse, UserArraySchema } from '@/lib/validation';

const response = await client.get('/api/v1/users');
const validationResult = validateApiResponse(response.data, UserArraySchema);

if (!validationResult.success) {
  console.error('Validation errors:', validationResult.errors);
}
      `
    },
    
    'testing': {
      title: 'Testing API Integrations',
      code: `
import { renderHook, act } from '@testing-library/react';
import { useLearningPaths } from '@/hooks/use-learning-paths';
import { apiTester, mockDataGenerator } from '@/lib/api-client/dev-utils';

// Unit testing hooks
test('should fetch learning paths', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useLearningPaths());

  act(() => {
    result.current.fetchLearningPaths();
  });

  await waitForNextUpdate();

  expect(result.current.loading).toBe(false);
  expect(result.current.learningPaths).toHaveLength(5);
});

// Integration testing
test('learning paths API integration', async () => {
  const result = await apiTester.quickTest('/api/v1/learning-paths', 'GET');
  
  expect(result.status).toBe('success');
  expect(result.response?.status).toBe(200);
});

// Mock data generation
test('component with mock data', () => {
  const mockPaths = mockDataGenerator.generateLearningPaths(5);
  
  render(<LearningPathsList paths={mockPaths} />);
  
  expect(screen.getAllByTestId('learning-path-item')).toHaveLength(5);
});
      `
    },
    
    'debugging': {
      title: 'Debugging and Development Tools',
      code: `
// Access debugging tools in development
if (process.env.NODE_ENV === 'development') {
  // Browser console access
  window.apiDebug.summary(); // Get debug summary
  window.apiDebug.export();  // Export all debug data
  window.apiDebug.clear();   // Clear all debug data

  // Individual tools
  window.__API_INSPECTOR__     // Request inspector
  window.__PERFORMANCE_PROFILER__ // Performance profiler
  window.__REQUEST_LOGGER__    // Request logger
}

// Enable detailed logging
client.enableDebugMode(true);

// Configure log levels
import { requestLogger } from '@/lib/api-client/debug';

requestLogger.updateConfig({
  logLevel: 'debug',
  enableConsoleOutput: true,
  enablePayloadLogging: true
});

// Add debug panel to your app
import { ApiDebugPanel } from '@/components/dev/api-debug-panel';

function App() {
  return (
    <div>
      {/* Your app content */}
      
      {process.env.NODE_ENV === 'development' && <ApiDebugPanel />}
    </div>
  );
}
      `
    }
  },
  
  quickReference: {
    'common-patterns': [
      {
        title: 'Fetch data with loading state',
        code: 'const { data, loading, error } = useApiData();'
      },
      {
        title: 'Create with optimistic update',
        code: 'optimisticUpdate(id, data); await create(data);'
      },
      {
        title: 'Handle errors gracefully',
        code: 'if (error instanceof EnhancedApiError) { /* handle */ }'
      },
      {
        title: 'Configure caching',
        code: 'const data = await client.get(url, { cache: true, cacheTTL: 300000 });'
      },
      {
        title: 'Real-time subscription',
        code: 'const unsubscribe = subscribe("channel", callback);'
      }
    ],
    
    'best-practices': [
      'Use hooks for React components instead of API client directly',
      'Handle loading and error states in your UI',
      'Use optimistic updates for better user experience',
      'Configure caching based on data volatility',
      'Set up proper authentication token refresh',
      'Use TypeScript strictly for type safety',
      'Test both success and error scenarios',
      'Monitor performance and optimize as needed'
    ],
    
    'troubleshooting': [
      {
        problem: 'Requests are slow',
        solutions: [
          'Check network conditions',
          'Enable caching for frequently accessed data',
          'Use request batching for multiple calls',
          'Optimize payload sizes'
        ]
      },
      {
        problem: 'Authentication errors',
        solutions: [
          'Check token expiration',
          'Verify refresh token callback is set',
          'Ensure proper token storage',
          'Check API endpoint permissions'
        ]
      },
      {
        problem: 'Cache not working',
        solutions: [
          'Verify cache is enabled globally and per-request',
          'Check cache TTL settings',
          'Ensure cache keys are consistent',
          'Clear cache if data is stale'
        ]
      },
      {
        problem: 'Real-time features not working',
        solutions: [
          'Check WebSocket connection status',
          'Verify channel subscriptions',
          'Check network connectivity',
          'Enable fallback polling if needed'
        ]
      }
    ]
  }
};

// Utility functions for documentation
export function getDocumentationSection(guide: string, section: string): string | null {
  // In a real implementation, this would load the actual markdown content
  // For now, return a placeholder
  return `Documentation for ${guide} - ${section}`;
}

export function searchDocumentation(query: string): Array<{
  type: 'guide' | 'example' | 'reference';
  title: string;
  description: string;
  relevance: number;
}> {
  const results: Array<{
    type: 'guide' | 'example' | 'reference';
    title: string;
    description: string;
    relevance: number;
  }> = [];

  const lowerQuery = query.toLowerCase();

  // Search guides
  Object.entries(documentation.guides).forEach(([key, guide]) => {
    if (guide.title.toLowerCase().includes(lowerQuery) || 
        guide.description.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'guide',
        title: guide.title,
        description: guide.description,
        relevance: guide.title.toLowerCase().includes(lowerQuery) ? 1.0 : 0.7
      });
    }
  });

  // Search examples
  Object.entries(documentation.examples).forEach(([key, example]) => {
    if (example.title.toLowerCase().includes(lowerQuery) || 
        example.code.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'example',
        title: example.title,
        description: `Code example for ${example.title}`,
        relevance: example.title.toLowerCase().includes(lowerQuery) ? 1.0 : 0.5
      });
    }
  });

  // Search quick reference
  documentation.quickReference['common-patterns'].forEach(pattern => {
    if (pattern.title.toLowerCase().includes(lowerQuery) || 
        pattern.code.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'reference',
        title: pattern.title,
        description: 'Common pattern reference',
        relevance: 0.6
      });
    }
  });

  return results.sort((a, b) => b.relevance - a.relevance);
}

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__API_DOCUMENTATION__ = {
    documentation,
    search: searchDocumentation,
    getSection: getDocumentationSection
  };
  
  console.log('📚 API Documentation available at window.__API_DOCUMENTATION__');
}