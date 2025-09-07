'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { mockDataGenerator } from '@/lib/api-client/dev-utils';

interface ApiEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: {
    required: boolean;
    schema: any;
    example: any;
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: any;
      example?: any;
    };
  };
  tags: string[];
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description: string;
  example?: any;
}

interface ApiDocumentationProps {
  className?: string;
}

export function InteractiveApiDocumentation({ className }: ApiDocumentationProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [requestParams, setRequestParams] = useState<Record<string, any>>({});
  const [requestBody, setRequestBody] = useState<string>('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoints: ApiEndpoint[] = [
    {
      id: 'get-learning-paths',
      name: 'Get Learning Paths',
      method: 'GET',
      path: '/api/v1/learning-paths',
      description: 'Retrieve a list of learning paths with optional filtering',
      parameters: [
        {
          name: 'subject',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by subject',
          example: 'mathematics'
        },
        {
          name: 'difficulty',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by difficulty level',
          example: 'medium'
        },
        {
          name: 'page',
          in: 'query',
          required: false,
          type: 'number',
          description: 'Page number for pagination',
          example: 1
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          type: 'number',
          description: 'Number of items per page',
          example: 20
        }
      ],
      responses: {
        '200': {
          description: 'Successful response',
          example: mockDataGenerator.generateLearningPaths(3)
        },
        '400': {
          description: 'Bad request',
          example: { success: false, error: 'Invalid parameters' }
        },
        '500': {
          description: 'Internal server error',
          example: { success: false, error: 'Internal server error' }
        }
      },
      tags: ['Learning Paths']
    },
    {
      id: 'create-learning-path',
      name: 'Create Learning Path',
      method: 'POST',
      path: '/api/v1/learning-paths',
      description: 'Create a new learning path',
      requestBody: {
        required: true,
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Learning path title' },
            description: { type: 'string', description: 'Learning path description' },
            subject: { type: 'string', description: 'Subject area' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            objectives: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'subject', 'objectives']
        },
        example: {
          title: 'Advanced Calculus',
          description: 'Master advanced calculus concepts',
          subject: 'mathematics',
          difficulty: 'hard',
          objectives: [
            'Understand limits and continuity',
            'Master derivatives and integrals',
            'Apply calculus to real-world problems'
          ]
        }
      },
      responses: {
        '201': {
          description: 'Learning path created successfully',
          example: mockDataGenerator.generateLearningPath()
        },
        '400': {
          description: 'Validation error',
          example: { success: false, error: 'Title is required' }
        },
        '401': {
          description: 'Unauthorized',
          example: { success: false, error: 'Authentication required' }
        }
      },
      tags: ['Learning Paths']
    },
    {
      id: 'get-user-progress',
      name: 'Get User Progress',
      method: 'GET',
      path: '/api/v1/progress/{userId}',
      description: 'Get progress data for a specific user',
      parameters: [
        {
          name: 'userId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'User ID',
          example: '123e4567-e89b-12d3-a456-426614174000'
        },
        {
          name: 'timeRange',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Time range for progress data',
          example: 'week'
        }
      ],
      responses: {
        '200': {
          description: 'User progress data',
          example: mockDataGenerator.generateProgressData()
        },
        '404': {
          description: 'User not found',
          example: { success: false, error: 'User not found' }
        }
      },
      tags: ['Progress']
    },
    {
      id: 'get-study-groups',
      name: 'Get Study Groups',
      method: 'GET',
      path: '/api/v1/collaboration/study-groups',
      description: 'Retrieve available study groups',
      parameters: [
        {
          name: 'subject',
          in: 'query',
          required: false,
          type: 'string',
          description: 'Filter by subject',
          example: 'programming'
        },
        {
          name: 'isPublic',
          in: 'query',
          required: false,
          type: 'boolean',
          description: 'Filter by public/private groups',
          example: true
        }
      ],
      responses: {
        '200': {
          description: 'List of study groups',
          example: mockDataGenerator.generateStudyGroups(3)
        }
      },
      tags: ['Collaboration']
    },
    {
      id: 'join-study-group',
      name: 'Join Study Group',
      method: 'POST',
      path: '/api/v1/collaboration/study-groups/{groupId}/join',
      description: 'Join a study group',
      parameters: [
        {
          name: 'groupId',
          in: 'path',
          required: true,
          type: 'string',
          description: 'Study group ID',
          example: '123e4567-e89b-12d3-a456-426614174000'
        }
      ],
      requestBody: {
        required: false,
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Optional join message' }
          }
        },
        example: {
          message: 'Excited to learn with the group!'
        }
      },
      responses: {
        '200': {
          description: 'Successfully joined group',
          example: { success: true, message: 'Joined study group successfully' }
        },
        '400': {
          description: 'Cannot join group',
          example: { success: false, error: 'Group is full' }
        }
      },
      tags: ['Collaboration']
    }
  ];

  const executeRequest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let url = selectedEndpoint.path;
      
      // Replace path parameters
      Object.entries(requestParams).forEach(([key, value]) => {
        if (selectedEndpoint.parameters?.some(p => p.name === key && p.in === 'path')) {
          url = url.replace(`{${key}}`, value);
        }
      });

      // Add query parameters
      const queryParams = new URLSearchParams();
      Object.entries(requestParams).forEach(([key, value]) => {
        if (selectedEndpoint.parameters?.some(p => p.name === key && p.in === 'query') && value) {
          queryParams.append(key, value);
        }
      });

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      let result;
      const options = {
        headers: {} as Record<string, string>
      };

      // Add header parameters
      Object.entries(requestParams).forEach(([key, value]) => {
        if (selectedEndpoint.parameters?.some(p => p.name === key && p.in === 'header') && value) {
          options.headers[key] = value;
        }
      });

      switch (selectedEndpoint.method) {
        case 'GET':
          result = await apiClient.get(url, options);
          break;
        case 'POST':
          const postData = requestBody ? JSON.parse(requestBody) : undefined;
          result = await apiClient.post(url, postData, options);
          break;
        case 'PUT':
          const putData = requestBody ? JSON.parse(requestBody) : undefined;
          result = await apiClient.put(url, putData, options);
          break;
        case 'DELETE':
          result = await apiClient.delete(url, options);
          break;
        case 'PATCH':
          const patchData = requestBody ? JSON.parse(requestBody) : undefined;
          result = await apiClient.patch(url, patchData, options);
          break;
      }

      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    if (!selectedEndpoint) return;

    // Load example parameters
    const exampleParams: Record<string, any> = {};
    selectedEndpoint.parameters?.forEach(param => {
      if (param.example !== undefined) {
        exampleParams[param.name] = param.example;
      }
    });
    setRequestParams(exampleParams);

    // Load example request body
    if (selectedEndpoint.requestBody?.example) {
      setRequestBody(JSON.stringify(selectedEndpoint.requestBody.example, null, 2));
    }
  };

  const groupedEndpoints = endpoints.reduce((acc, endpoint) => {
    endpoint.tags.forEach(tag => {
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(endpoint);
    });
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Documentation</h1>
          <p className="text-muted-foreground">
            Interactive documentation for the LusiLearn API
          </p>
        </div>
        <Badge variant="outline">Development Only</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoint List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Endpoints</CardTitle>
            <CardDescription>
              Select an endpoint to test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {Object.entries(groupedEndpoints).map(([tag, tagEndpoints]) => (
                  <div key={tag}>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                      {tag}
                    </h3>
                    <div className="space-y-1">
                      {tagEndpoints.map(endpoint => (
                        <div
                          key={endpoint.id}
                          className={`p-2 border rounded cursor-pointer hover:bg-muted ${
                            selectedEndpoint?.id === endpoint.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedEndpoint(endpoint)}
                        >
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={endpoint.method === 'GET' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {endpoint.method}
                            </Badge>
                            <span className="text-sm font-medium">{endpoint.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {endpoint.path}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Endpoint Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedEndpoint ? selectedEndpoint.name : 'Select an endpoint'}
            </CardTitle>
            {selectedEndpoint && (
              <CardDescription>
                {selectedEndpoint.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {selectedEndpoint ? (
              <Tabs defaultValue="try-it">
                <TabsList>
                  <TabsTrigger value="try-it">Try It</TabsTrigger>
                  <TabsTrigger value="documentation">Documentation</TabsTrigger>
                  <TabsTrigger value="examples">Examples</TabsTrigger>
                </TabsList>

                <TabsContent value="try-it" className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedEndpoint.method}</Badge>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {selectedEndpoint.path}
                    </code>
                    <Button onClick={loadExample} variant="outline" size="sm">
                      Load Example
                    </Button>
                  </div>

                  {/* Parameters */}
                  {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Parameters</h4>
                      <div className="space-y-2">
                        {selectedEndpoint.parameters.map(param => (
                          <div key={param.name} className="grid grid-cols-4 gap-2 items-center">
                            <label className="text-sm font-medium">
                              {param.name}
                              {param.required && <span className="text-red-500">*</span>}
                            </label>
                            <Badge variant="outline" className="text-xs">
                              {param.in}
                            </Badge>
                            <Input
                              placeholder={param.example?.toString() || param.type}
                              value={requestParams[param.name] || ''}
                              onChange={(e) => setRequestParams(prev => ({
                                ...prev,
                                [param.name]: e.target.value
                              }))}
                              className="col-span-2"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  {selectedEndpoint.requestBody && (
                    <div>
                      <h4 className="font-semibold mb-2">
                        Request Body
                        {selectedEndpoint.requestBody.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </h4>
                      <Textarea
                        placeholder="Enter JSON request body"
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Execute Button */}
                  <Button 
                    onClick={executeRequest} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? 'Executing...' : 'Execute Request'}
                  </Button>

                  {/* Response */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {response && (
                    <div>
                      <h4 className="font-semibold mb-2">Response</h4>
                      <div className="bg-muted p-4 rounded">
                        <pre className="text-sm overflow-auto">
                          {JSON.stringify(response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documentation" className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedEndpoint.description}
                    </p>
                  </div>

                  {selectedEndpoint.parameters && (
                    <div>
                      <h4 className="font-semibold mb-2">Parameters</h4>
                      <div className="space-y-2">
                        {selectedEndpoint.parameters.map(param => (
                          <div key={param.name} className="border rounded p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-medium">{param.name}</code>
                              <Badge variant="outline" className="text-xs">
                                {param.type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {param.in}
                              </Badge>
                              {param.required && (
                                <Badge variant="destructive" className="text-xs">
                                  required
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {param.description}
                            </p>
                            {param.example && (
                              <div className="mt-2">
                                <span className="text-xs font-medium">Example: </span>
                                <code className="text-xs bg-muted px-1 rounded">
                                  {param.example.toString()}
                                </code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEndpoint.requestBody && (
                    <div>
                      <h4 className="font-semibold mb-2">Request Body</h4>
                      <div className="border rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">JSON</Badge>
                          {selectedEndpoint.requestBody.required && (
                            <Badge variant="destructive" className="text-xs">
                              required
                            </Badge>
                          )}
                        </div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(selectedEndpoint.requestBody.schema, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2">Responses</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedEndpoint.responses).map(([status, response]) => (
                        <div key={status} className="border rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={status.startsWith('2') ? 'default' : 'destructive'}
                            >
                              {status}
                            </Badge>
                            <span className="text-sm font-medium">
                              {response.description}
                            </span>
                          </div>
                          {response.schema && (
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto mt-2">
                              {JSON.stringify(response.schema, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="examples" className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Request Examples</h4>
                    
                    {selectedEndpoint.requestBody?.example && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">Request Body</h5>
                        <pre className="text-sm bg-muted p-3 rounded overflow-auto">
                          {JSON.stringify(selectedEndpoint.requestBody.example, null, 2)}
                        </pre>
                      </div>
                    )}

                    {selectedEndpoint.parameters?.some(p => p.example) && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">Parameters</h5>
                        <div className="space-y-1">
                          {selectedEndpoint.parameters
                            .filter(p => p.example)
                            .map(param => (
                              <div key={param.name} className="text-sm">
                                <code>{param.name}</code>: {param.example.toString()}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response Examples</h4>
                    <div className="space-y-3">
                      {Object.entries(selectedEndpoint.responses)
                        .filter(([, response]) => response.example)
                        .map(([status, response]) => (
                          <div key={status}>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={status.startsWith('2') ? 'default' : 'destructive'}
                              >
                                {status}
                              </Badge>
                              <span className="text-sm">{response.description}</span>
                            </div>
                            <pre className="text-sm bg-muted p-3 rounded overflow-auto">
                              {JSON.stringify(response.example, null, 2)}
                            </pre>
                          </div>
                        ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select an endpoint from the list to view its documentation and test it
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}