import { logger } from '../utils/logger';
import { ErrorTrackingService } from '../middleware/error-handler';

export interface PerformanceMetric {
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  threshold: number;
  currentValue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
  comparison: 'greater' | 'less';
}

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private readonly maxMetrics = 10000;
  private readonly maxAlerts = 1000;
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.setupDefaultThresholds();
    this.startMonitoring();
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      {
        metric: 'response_time',
        warning: 1000,
        critical: 5000,
        unit: 'ms',
        comparison: 'greater'
      },
      {
        metric: 'memory_usage_percent',
        warning: 70,
        critical: 85,
        unit: '%',
        comparison: 'greater'
      },
      {
        metric: 'cpu_usage_percent',
        warning: 70,
        critical: 90,
        unit: '%',
        comparison: 'greater'
      },
      {
        metric: 'error_rate',
        warning: 5,
        critical: 10,
        unit: 'errors/min',
        comparison: 'greater'
      },
      {
        metric: 'database_connections',
        warning: 80,
        critical: 95,
        unit: 'connections',
        comparison: 'greater'
      },
      {
        metric: 'disk_usage_percent',
        warning: 80,
        critical: 90,
        unit: '%',
        comparison: 'greater'
      }
    ];
  }

  private startMonitoring(): void {
    // Monitor system metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Clean up old metrics every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const timestamp = new Date();

      // Memory metrics
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      this.recordMetric({
        timestamp,
        metric: 'memory_usage_percent',
        value: heapUsedPercent,
        unit: '%'
      });

      this.recordMetric({
        timestamp,
        metric: 'memory_heap_used',
        value: memoryUsage.heapUsed / 1024 / 1024,
        unit: 'MB'
      });

      this.recordMetric({
        timestamp,
        metric: 'memory_rss',
        value: memoryUsage.rss / 1024 / 1024,
        unit: 'MB'
      });

      // CPU metrics (simplified)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      
      this.recordMetric({
        timestamp,
        metric: 'cpu_usage_percent',
        value: cpuPercent,
        unit: '%'
      });

      // Error rate metrics
      const errorTracker = ErrorTrackingService.getInstance();
      const errorStats = errorTracker.getErrorStats();
      
      this.recordMetric({
        timestamp,
        metric: 'error_rate',
        value: errorStats.totalErrors,
        unit: 'errors/hour'
      });

      this.recordMetric({
        timestamp,
        metric: 'critical_errors',
        value: errorStats.criticalErrorsLastHour,
        unit: 'errors/hour'
      });

      // Uptime metric
      this.recordMetric({
        timestamp,
        metric: 'uptime',
        value: process.uptime(),
        unit: 'seconds'
      });

      // Check thresholds and generate alerts
      this.checkThresholds();

    } catch (error: any) {
      logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log high-value metrics
    if (this.isHighValueMetric(metric)) {
      logger.warn('High performance metric detected', {
        metric: metric.metric,
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp
      });
    }
  }

  private isHighValueMetric(metric: PerformanceMetric): boolean {
    const threshold = this.thresholds.find(t => t.metric === metric.metric);
    if (!threshold) return false;

    if (threshold.comparison === 'greater') {
      return metric.value > threshold.warning;
    } else {
      return metric.value < threshold.warning;
    }
  }

  private checkThresholds(): void {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    for (const threshold of this.thresholds) {
      // Get recent metrics for this threshold
      const recentMetrics = this.metrics.filter(m => 
        m.metric === threshold.metric && 
        m.timestamp > fiveMinutesAgo
      );

      if (recentMetrics.length === 0) continue;

      // Calculate average value over the last 5 minutes
      const avgValue = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
      const latestValue = recentMetrics[recentMetrics.length - 1].value;

      // Check if we should trigger an alert
      const shouldAlert = threshold.comparison === 'greater' 
        ? latestValue > threshold.critical || avgValue > threshold.warning
        : latestValue < threshold.critical || avgValue < threshold.warning;

      if (shouldAlert) {
        const severity = this.determineSeverity(latestValue, threshold);
        this.createAlert({
          metric: threshold.metric,
          threshold: threshold.comparison === 'greater' ? threshold.critical : threshold.warning,
          currentValue: latestValue,
          severity,
          message: this.generateAlertMessage(threshold.metric, latestValue, threshold)
        });
      }
    }
  }

  private determineSeverity(value: number, threshold: PerformanceThreshold): 'low' | 'medium' | 'high' | 'critical' {
    if (threshold.comparison === 'greater') {
      if (value > threshold.critical) return 'critical';
      if (value > threshold.warning) return 'high';
      return 'medium';
    } else {
      if (value < threshold.critical) return 'critical';
      if (value < threshold.warning) return 'high';
      return 'medium';
    }
  }

  private generateAlertMessage(metric: string, value: number, threshold: PerformanceThreshold): string {
    const formattedValue = Math.round(value * 100) / 100;
    
    switch (metric) {
      case 'response_time':
        return `Response time is ${formattedValue}ms, exceeding threshold of ${threshold.warning}ms`;
      case 'memory_usage_percent':
        return `Memory usage is ${formattedValue}%, exceeding threshold of ${threshold.warning}%`;
      case 'cpu_usage_percent':
        return `CPU usage is ${formattedValue}%, exceeding threshold of ${threshold.warning}%`;
      case 'error_rate':
        return `Error rate is ${formattedValue} errors/hour, exceeding threshold of ${threshold.warning}`;
      case 'database_connections':
        return `Database connections at ${formattedValue}, exceeding threshold of ${threshold.warning}`;
      default:
        return `${metric} is ${formattedValue}${threshold.unit}, exceeding threshold`;
    }
  }

  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    // Check if we already have a recent alert for this metric
    const recentAlert = this.alerts.find(alert => 
      alert.metric === alertData.metric && 
      !alert.resolved &&
      (Date.now() - alert.timestamp.getTime()) < 10 * 60 * 1000 // 10 minutes
    );

    if (recentAlert) {
      // Update existing alert
      recentAlert.currentValue = alertData.currentValue;
      recentAlert.severity = alertData.severity;
      recentAlert.message = alertData.message;
      return;
    }

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alertData
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Log the alert
    logger.error('PERFORMANCE ALERT', {
      alertId: alert.id,
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    });

    // Send external alert if critical
    if (alert.severity === 'critical') {
      this.sendExternalAlert(alert);
    }
  }

  private sendExternalAlert(alert: PerformanceAlert): void {
    // In production, this would integrate with external alerting services
    logger.error('CRITICAL PERFORMANCE ALERT - External notification would be sent', {
      alert,
      notificationChannels: ['email', 'slack', 'pagerduty']
    });

    // Example webhook call (would be implemented in production)
    if (process.env.ALERT_WEBHOOK_URL) {
      // Implementation would go here
      logger.info('Alert would be sent to webhook', { webhookUrl: process.env.ALERT_WEBHOOK_URL });
    }
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      logger.info('Performance alert resolved', {
        alertId,
        metric: alert.metric,
        resolvedAt: alert.resolvedAt
      });
      
      return true;
    }
    return false;
  }

  public getMetrics(metric?: string, limit: number = 100): PerformanceMetric[] {
    let filteredMetrics = this.metrics;
    
    if (metric) {
      filteredMetrics = this.metrics.filter(m => m.metric === metric);
    }
    
    return filteredMetrics.slice(-limit);
  }

  public getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  public getAllAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  public getPerformanceSummary(): any {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    const activeAlerts = this.getActiveAlerts();
    
    // Calculate averages for key metrics
    const metricAverages: Record<string, number> = {};
    const metricTypes = [...new Set(recentMetrics.map(m => m.metric))];
    
    for (const metricType of metricTypes) {
      const typeMetrics = recentMetrics.filter(m => m.metric === metricType);
      if (typeMetrics.length > 0) {
        metricAverages[metricType] = typeMetrics.reduce((sum, m) => sum + m.value, 0) / typeMetrics.length;
      }
    }

    return {
      summary: {
        totalMetrics: recentMetrics.length,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
        timeWindow: '1 hour'
      },
      averages: metricAverages,
      alerts: {
        active: activeAlerts.length,
        bySeverity: {
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          high: activeAlerts.filter(a => a.severity === 'high').length,
          medium: activeAlerts.filter(a => a.severity === 'medium').length,
          low: activeAlerts.filter(a => a.severity === 'low').length
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  private cleanupOldData(): void {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Clean up old metrics (keep last 24 hours)
    this.metrics = this.metrics.filter(m => m.timestamp > twentyFourHoursAgo);
    
    // Clean up old resolved alerts (keep last 24 hours)
    this.alerts = this.alerts.filter(a => 
      !a.resolved || (a.resolvedAt && a.resolvedAt > twentyFourHoursAgo)
    );
  }

  public addCustomThreshold(threshold: PerformanceThreshold): void {
    const existingIndex = this.thresholds.findIndex(t => t.metric === threshold.metric);
    if (existingIndex >= 0) {
      this.thresholds[existingIndex] = threshold;
    } else {
      this.thresholds.push(threshold);
    }
    
    logger.info('Performance threshold updated', { threshold });
  }

  public removeThreshold(metric: string): boolean {
    const initialLength = this.thresholds.length;
    this.thresholds = this.thresholds.filter(t => t.metric !== metric);
    return this.thresholds.length < initialLength;
  }
}