'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    PerformanceDashboard as DashboardData,
    PerformanceAlert,
    PerformanceTrend,
    EndpointPerformance
} from '@/lib/api-client/performance-monitor';
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Minus,
    Clock,
    Zap,
    Database,
    Activity
} from 'lucide-react';

interface PerformanceDashboardProps {
    data: DashboardData;
    onRefresh?: () => void;
    onAcknowledgeAlert?: (alertId: string) => void;
    refreshInterval?: number;
}

export function PerformanceDashboard({
    data,
    onRefresh,
    onAcknowledgeAlert,
    refreshInterval = 30000
}: PerformanceDashboardProps) {
    const [lastUpdated, setLastUpdated] = useState(new Date());

    useEffect(() => {
        if (refreshInterval > 0 && onRefresh) {
            const interval = setInterval(() => {
                onRefresh();
                setLastUpdated(new Date());
            }, refreshInterval);

            return () => clearInterval(interval);
        }
    }, [refreshInterval, onRefresh]);

    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    };

    const formatUptime = (ms: number): string => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const getHealthStatusColor = (status: string): string => {
        switch (status) {
            case 'healthy': return 'text-green-600';
            case 'warning': return 'text-yellow-600';
            case 'critical': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getHealthStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
            case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
            default: return <Minus className="h-5 w-5 text-gray-600" />;
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
            case 'degrading': return <TrendingDown className="h-4 w-4 text-red-600" />;
            default: return <Minus className="h-4 w-4 text-gray-600" />;
        }
    };

    const getAlertVariant = (type: string): 'default' | 'destructive' => {
        return type === 'error' || type === 'critical' ? 'destructive' : 'default';
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'error':
            case 'critical':
                return <XCircle className="h-4 w-4" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4" />;
            default:
                return <CheckCircle className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">API Performance Dashboard</h2>
                    <p className="text-muted-foreground">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                {onRefresh && (
                    <Button onClick={onRefresh} variant="outline">
                        <Activity className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                )}
            </div>

            {/* System Health Overview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {getHealthStatusIcon(data.systemHealth.status)}
                        System Health
                        <Badge variant={data.systemHealth.status === 'healthy' ? 'default' : 'destructive'}>
                            {data.systemHealth.status.toUpperCase()}
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Overall system health score: {data.systemHealth.score}/100
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Progress value={data.systemHealth.score} className="w-full" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {data.systemHealth.factors.map((factor, index) => (
                                <div key={index} className="text-center">
                                    <div className="text-2xl font-bold">{factor.score}</div>
                                    <div className="text-sm text-muted-foreground">{factor.name}</div>
                                    <Badge variant={factor.impact === 'high' ? 'destructive' : factor.impact === 'medium' ? 'secondary' : 'outline'}>
                                        {factor.impact} impact
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatUptime(data.summary.uptime)}</div>
                        <p className="text-xs text-muted-foreground">
                            {data.summary.totalRequests} total requests
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.successRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            {data.summary.requestsPerMinute} req/min
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatDuration(data.summary.averageResponseTime)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Average response time
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.summary.cacheHitRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            {data.summary.activeAlerts} active alerts
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Tabs */}
            <Tabs defaultValue="alerts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="alerts">
                        Alerts ({data.alerts.filter(a => !a.acknowledged).length})
                    </TabsTrigger>
                    <TabsTrigger value="trends">Trends</TabsTrigger>
                    <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                </TabsList>

                <TabsContent value="alerts" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Active Alerts</CardTitle>
                            <CardDescription>
                                Recent performance alerts and issues
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-96">
                                <div className="space-y-3">
                                    {data.alerts.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No alerts at this time
                                        </div>
                                    ) : (
                                        data.alerts.map((alert) => (
                                            <Alert key={alert.id} variant={getAlertVariant(alert.type)}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-2">
                                                        {getAlertIcon(alert.type)}
                                                        <div className="flex-1">
                                                            <AlertTitle className="flex items-center gap-2">
                                                                {alert.title}
                                                                <Badge variant="outline">{alert.type}</Badge>
                                                                {alert.acknowledged && (
                                                                    <Badge variant="secondary">Acknowledged</Badge>
                                                                )}
                                                            </AlertTitle>
                                                            <AlertDescription className="mt-1">
                                                                {alert.message}
                                                                <div className="text-xs mt-1 text-muted-foreground">
                                                                    {alert.timestamp.toLocaleString()} • {alert.category}
                                                                    {alert.endpoint && ` • ${alert.endpoint}`}
                                                                </div>
                                                            </AlertDescription>
                                                        </div>
                                                    </div>
                                                    {!alert.acknowledged && onAcknowledgeAlert && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => onAcknowledgeAlert(alert.id)}
                                                        >
                                                            Acknowledge
                                                        </Button>
                                                    )}
                                                </div>
                                            </Alert>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="trends" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.trends.map((trend) => (
                            <Card key={trend.metric}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {trend.metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        {getTrendIcon(trend.trend)}
                                    </CardTitle>
                                    <CardDescription>
                                        {trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage.toFixed(1)}% change
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="text-sm text-muted-foreground">
                                            {trend.values.length} data points
                                        </div>
                                        {trend.values.length > 0 && (
                                            <div className="text-lg font-semibold">
                                                Current: {trend.values[0].value.toFixed(1)}
                                                {trend.metric.includes('Rate') || trend.metric.includes('cache') ? '%' :
                                                    trend.metric.includes('Time') ? 'ms' : ''}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="endpoints" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Endpoint Performance</CardTitle>
                            <CardDescription>
                                Performance metrics for individual API endpoints
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-96">
                                <div className="space-y-4">
                                    {data.endpoints.map((endpoint, index) => (
                                        <div key={`${endpoint.method}-${endpoint.endpoint}`} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{endpoint.method}</Badge>
                                                    <code className="text-sm">{endpoint.endpoint}</code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getTrendIcon(endpoint.trends.responseTime)}
                                                    <span className="text-sm text-muted-foreground">
                                                        {endpoint.totalRequests} requests
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">Avg Response</div>
                                                    <div className="font-semibold">
                                                        {formatDuration(endpoint.averageResponseTime)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Error Rate</div>
                                                    <div className="font-semibold">
                                                        {endpoint.errorRate.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">P95</div>
                                                    <div className="font-semibold">
                                                        {formatDuration(endpoint.p95ResponseTime)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Cache Hit</div>
                                                    <div className="font-semibold">
                                                        {endpoint.cacheHitRate.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default PerformanceDashboard;