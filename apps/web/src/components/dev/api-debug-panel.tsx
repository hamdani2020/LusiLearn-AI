'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  apiInspector,
  performanceProfiler,
  requestLogger,
  debugTools
} from '@/lib/api-client/debug';
import { apiTester, mockDataGenerator } from '@/lib/api-client/dev-utils';
import type {
  RequestInspectorData,
  PerformanceAlert,
  DetailedRequestLog
} from '@/lib/api-client/debug';
import type { TestResult } from '@/lib/api-client/dev-utils';

interface ApiDebugPanelProps {
  className?: string;
}

export function ApiDebugPanel({ className }: ApiDebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('inspector');
  const [requestHistory, setRequestHistory] = useState<RequestInspectorData[]>([]);
  const [performanceAlerts, setPerformanceAlerts] = useState<PerformanceAlert[]>([]);
  const [logs, setLogs] = useState<DetailedRequestLog[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Only show in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // Listen for API inspector events
    const unsubscribeInspector = apiInspector.addEventListener((event) => {
      if (event.type === 'request-completed') {
        setRequestHistory(prev => [event.data, ...prev.slice(0, 99)]);
      }
    });

    // Listen for performance alerts
    const unsubscribeProfiler = performanceProfiler.onAlert((alert) => {
      setPerformanceAlerts(prev => [alert, ...prev.slice(0, 49)]);
    });

    // Listen for test results
    const unsubscribeTests = apiTester.onTestComplete((result) => {
      setTestResults(prev => [result, ...prev.slice(0, 49)]);
    });

    // Initial data load
    setRequestHistory(apiInspector.getRequestHistory().slice(0, 100));
    setPerformanceAlerts(performanceProfiler.getAlerts());
    setLogs(requestLogger.getLogs({ level: 'error' }));

    return () => {
      unsubscribeInspector();
      unsubscribeProfiler();
      unsubscribeTests();
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
        >
          🔧 API Debug
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg ${className}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">API Debug Panel</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => debugTools.clearAllData()}
            variant="outline"
            size="sm"
          >
            Clear All
          </Button>
          <Button
            onClick={() => setIsVisible(false)}
            variant="outline"
            size="sm"
          >
            ✕
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="inspector">Inspector</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="tester">Tester</TabsTrigger>
            <TabsTrigger value="mock">Mock Data</TabsTrigger>
          </TabsList>

          <TabsContent value="inspector" className="space-y-4">
            <InspectorTab requestHistory={requestHistory} />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceTab alerts={performanceAlerts} />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <LogsTab logs={logs} />
          </TabsContent>

          <TabsContent value="tester" className="space-y-4">
            <TesterTab testResults={testResults} />
          </TabsContent>

          <TabsContent value="mock" className="space-y-4">
            <MockDataTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InspectorTab({ requestHistory }: { requestHistory: RequestInspectorData[] }) {
  const [filter, setFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestInspectorData | null>(null);

  const filteredRequests = requestHistory.filter(req =>
    req.endpoint.toLowerCase().includes(filter.toLowerCase()) ||
    req.method.toLowerCase().includes(filter.toLowerCase())
  );

  const bottlenecks = apiInspector.detectBottlenecks();

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requestHistory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Slow Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bottlenecks.slowEndpoints.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requestHistory.length > 0
                ? Math.round((requestHistory.filter(r => r.error).length / requestHistory.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottlenecks Alert */}
      {bottlenecks.slowEndpoints.length > 0 && (
        <Alert>
          <AlertDescription>
            Found {bottlenecks.slowEndpoints.length} slow endpoints.
            Consider optimizing: {bottlenecks.slowEndpoints.slice(0, 3).map(e => e.endpoint).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter */}
      <Input
        placeholder="Filter requests by endpoint or method..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Request List */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Request History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-2 border rounded cursor-pointer hover:bg-muted ${selectedRequest?.id === request.id ? 'bg-muted' : ''
                      }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={request.error ? 'destructive' : 'default'}>
                          {request.method}
                        </Badge>
                        <span className="text-sm font-mono">{request.endpoint}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.duration}ms
                      </div>
                    </div>
                    {request.error && (
                      <div className="text-xs text-destructive mt-1">
                        {request.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRequest ? (
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">Basic Info</h4>
                    <div className="text-sm space-y-1">
                      <div>ID: {selectedRequest.id}</div>
                      <div>Method: {selectedRequest.method}</div>
                      <div>Endpoint: {selectedRequest.endpoint}</div>
                      <div>Duration: {selectedRequest.duration}ms</div>
                      <div>Status: {selectedRequest.status}</div>
                      <div>Cached: {selectedRequest.cached ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  {selectedRequest.requestHeaders && (
                    <div>
                      <h4 className="font-semibold">Request Headers</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(selectedRequest.requestHeaders, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedRequest.requestBody && (
                    <div>
                      <h4 className="font-semibold">Request Body</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(selectedRequest.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedRequest.responseHeaders && (
                    <div>
                      <h4 className="font-semibold">Response Headers</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(selectedRequest.responseHeaders, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedRequest.responseBody && (
                    <div>
                      <h4 className="font-semibold">Response Body</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(selectedRequest.responseBody, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center text-muted-foreground">
                Select a request to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PerformanceTab({ alerts }: { alerts: PerformanceAlert[] }) {
  const stats = performanceProfiler.getPerformanceStatistics();

  return (
    <div className="space-y-4">
      {/* Performance Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.averageResponseTime)}ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">P95 Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.p95ResponseTime)}ms</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Memory Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{stats.memoryTrend.trend}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Network Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{stats.networkQuality.quality}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <Alert key={index} variant={alert.severity === 'high' ? 'destructive' : 'default'}>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>{alert.message}</span>
                      <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.timestamp.toLocaleTimeString()}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Slowest Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Slowest Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.slowestEndpoints.slice(0, 5).map((endpoint, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-mono text-sm">{endpoint.method} {endpoint.endpoint}</div>
                  <div className="text-xs text-muted-foreground">
                    {endpoint.sampleCount} samples
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{Math.round(endpoint.averageTime)}ms</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsTab({ logs }: { logs: DetailedRequestLog[] }) {
  const [logLevel, setLogLevel] = useState<string>('all');
  const [logType, setLogType] = useState<string>('all');

  const filteredLogs = logs.filter(log => {
    if (logLevel !== 'all' && log.level !== logLevel) return false;
    if (logType !== 'all' && log.type !== logType) return false;
    return true;
  });

  const stats = requestLogger.getLogStatistics();

  return (
    <div className="space-y-4">
      {/* Log Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.errorRate)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.cacheHitRate)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.averageResponseTime)}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={logLevel} onValueChange={setLogLevel}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={logType} onValueChange={setLogType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="request">Request</SelectItem>
            <SelectItem value="response">Response</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="cache">Cache</SelectItem>
            <SelectItem value="retry">Retry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-2 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.level === 'error' ? 'destructive' : 'default'}>
                        {log.level}
                      </Badge>
                      <Badge variant="outline">{log.type}</Badge>
                      <span className="font-mono text-sm">{log.method} {log.endpoint}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {log.error && (
                    <div className="text-sm text-destructive mt-1">
                      {log.error.message}
                    </div>
                  )}
                  {log.timing && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Duration: {log.timing.duration}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function TesterTab({ testResults }: { testResults: TestResult[] }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('GET');
  const [isRunning, setIsRunning] = useState(false);

  const runQuickTest = async () => {
    if (!selectedEndpoint) return;

    setIsRunning(true);
    try {
      await apiTester.quickTest(selectedEndpoint, selectedMethod as any);
    } finally {
      setIsRunning(false);
    }
  };

  const runHealthChecks = async () => {
    setIsRunning(true);
    try {
      await apiTester.runTestSuite('health-checks');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="/api/v1/endpoint"
              value={selectedEndpoint}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="flex-1"
            />
            <Button onClick={runQuickTest} disabled={isRunning || !selectedEndpoint}>
              {isRunning ? 'Testing...' : 'Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Suites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Test Suites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={runHealthChecks} disabled={isRunning}>
              Run Health Checks
            </Button>
            <Button
              onClick={() => apiTester.runAllTestSuites()}
              disabled={isRunning}
              variant="outline"
            >
              Run All Tests
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {testResults.map((result) => (
                <div key={result.id} className="p-2 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                        {result.status}
                      </Badge>
                      <span className="text-sm">{result.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.duration}ms
                    </div>
                  </div>
                  {result.response?.error && (
                    <div className="text-xs text-destructive mt-1">
                      {result.response.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function MockDataTab() {
  const [dataType, setDataType] = useState('users');
  const [count, setCount] = useState(5);
  const [generatedData, setGeneratedData] = useState<any>(null);

  const generateData = () => {
    let data;
    switch (dataType) {
      case 'users':
        data = mockDataGenerator.generateUsers(count);
        break;
      case 'learning-paths':
        data = mockDataGenerator.generateLearningPaths(count);
        break;
      case 'study-groups':
        data = mockDataGenerator.generateStudyGroups(count);
        break;
      case 'scenarios':
        data = mockDataGenerator.generateApiScenarios();
        break;
      default:
        data = [];
    }
    setGeneratedData(data);
  };

  return (
    <div className="space-y-4">
      {/* Generator Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mock Data Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="learning-paths">Learning Paths</SelectItem>
                <SelectItem value="study-groups">Study Groups</SelectItem>
                <SelectItem value="scenarios">API Scenarios</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Count"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 5)}
              className="w-20"
              min="1"
              max="50"
            />
            <Button onClick={generateData}>Generate</Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Data */}
      {generatedData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Generated Data</CardTitle>
            <CardDescription>
              Copy this data for testing purposes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                {JSON.stringify(generatedData, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}