# LusiLearn AI Monitoring and Logging

This document describes the comprehensive monitoring and logging system implemented for the LusiLearn AI platform.

## Overview

The monitoring system provides:
- **Structured Logging**: JSON-formatted logs across all services
- **Performance Monitoring**: Real-time metrics and alerting
- **AI Cost Tracking**: Budget monitoring and usage analytics
- **User Analytics**: Platform usage and learning metrics
- **Health Checks**: Service availability and dependency monitoring

## Architecture

### Logging Stack
- **Winston** (Node.js API Service): Structured JSON logging
- **Python Logging** (AI Service): Custom structured formatter
- **Loki**: Log aggregation and storage
- **Promtail**: Log shipping and parsing

### Metrics Stack
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Node Exporter**: System metrics
- **Custom Exporters**: Redis, PostgreSQL metrics

## Log Types

### 1. Application Logs
- **Location**: `logs/combined.log`, `logs/error.log`
- **Format**: Structured JSON with timestamp, level, service, message
- **Retention**: 30 days

### 2. Performance Logs
- **Location**: `logs/performance.log`
- **Content**: API response times, throughput, slow queries
- **Retention**: 30 days

### 3. Security Logs
- **Location**: `logs/security.log`
- **Content**: Authentication events, authorization failures, suspicious activity
- **Retention**: 90 days

### 4. AI Usage Logs
- **Location**: `logs/ai-usage.log`
- **Content**: Model usage, token consumption, costs
- **Retention**: 90 days

### 5. Analytics Logs
- **Location**: `logs/analytics.log`
- **Content**: User events, learning metrics, platform usage
- **Retention**: 90 days

## Monitoring Endpoints

### API Service Endpoints
```
GET /api/v1/monitoring/health              # Basic health check
GET /api/v1/monitoring/health/detailed     # Detailed health with dependencies
GET /api/v1/monitoring/metrics             # System metrics
GET /api/v1/monitoring/ai-costs            # AI cost monitoring
GET /api/v1/monitoring/analytics/user/:id  # User analytics
GET /api/v1/monitoring/analytics/platform  # Platform analytics
```

### AI Service Endpoints
```
GET /monitoring/health                      # Basic health check
GET /monitoring/health/detailed             # Detailed health check
GET /monitoring/metrics                     # System metrics
GET /monitoring/ai-usage                    # AI usage statistics
```

## Key Metrics

### System Metrics
- CPU usage percentage
- Memory usage (RSS, heap)
- Disk space utilization
- Network I/O
- Active connections

### Application Metrics
- Request rate (requests/second)
- Response time (95th percentile)
- Error rate (4xx, 5xx responses)
- Active users
- Session duration

### AI Metrics
- Model inference latency
- Token consumption
- API costs (daily/monthly)
- Request success rate
- Model usage distribution

### Learning Metrics
- Learning session completions
- Content consumption rates
- Assessment scores
- Collaboration participation
- Progress tracking

## Alerting

### Critical Alerts
- Service down (any service unavailable)
- High error rate (>10% for 5 minutes)
- Database connection failures
- Disk space critical (<10%)

### Warning Alerts
- High CPU usage (>80% for 2 minutes)
- High memory usage (>85% for 2 minutes)
- Slow response times (>2s 95th percentile)
- AI budget approaching limit (>90%)

### Learning Platform Alerts
- High learning session failure rate (>5%)
- Content recommendation failures
- Collaboration service issues
- Assessment system errors

## Setup and Deployment

### 1. Start Monitoring Stack
```bash
# Start main services
docker-compose up -d

# Start monitoring services
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Dashboards
- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

### 3. Configure Alerts
1. Update `monitoring/alertmanager.yml` with your notification channels
2. Modify alert thresholds in `monitoring/alert_rules.yml`
3. Restart AlertManager: `docker-compose -f docker-compose.monitoring.yml restart alertmanager`

## Log Analysis

### Common Log Queries (Loki)

#### Find Errors
```logql
{service="lusilearn-api"} |= "ERROR"
```

#### Performance Issues
```logql
{log_type="performance"} | json | duration > 1000
```

#### AI Usage by User
```logql
{log_type="ai_usage"} | json | userId="user123"
```

#### Security Events
```logql
{log_type="security"} | json | success="false"
```

### Metric Queries (Prometheus)

#### API Response Time
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### Error Rate
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

#### AI Cost Tracking
```promql
increase(ai_cost_total[1d])
```

## Cost Monitoring

### AI Budget Configuration
Set environment variables:
```bash
AI_DAILY_BUDGET=100        # $100 daily limit
AI_MONTHLY_BUDGET=2000     # $2000 monthly limit
AI_USER_DAILY_LIMIT=10     # $10 per user daily limit
```

### Cost Tracking Features
- Real-time cost calculation
- Budget alerts at 80% and 90% thresholds
- Per-user spending limits
- Model usage breakdown
- Historical cost analysis

## Analytics Dashboard

### User Analytics
- Session duration and frequency
- Learning path progress
- Content consumption patterns
- Collaboration participation
- Achievement tracking

### Platform Analytics
- Daily/monthly active users
- Feature adoption rates
- Content popularity
- Performance trends
- Error patterns

## Troubleshooting

### Common Issues

#### High Memory Usage
1. Check memory metrics in Grafana
2. Review application logs for memory leaks
3. Analyze garbage collection patterns
4. Scale services if needed

#### Slow API Responses
1. Check performance logs for slow endpoints
2. Review database query performance
3. Analyze AI service response times
4. Check for resource contention

#### AI Cost Overruns
1. Review AI usage logs
2. Check per-user spending patterns
3. Analyze model usage efficiency
4. Implement additional rate limiting

### Log Rotation
Logs are automatically rotated based on size:
- Max file size: 50-100MB
- Max files: 5-10 per log type
- Automatic compression of old logs

### Backup and Retention
- Logs: Retained for 30-90 days based on type
- Metrics: Retained for 200 hours in Prometheus
- Long-term storage: Configure external storage for compliance

## Security Considerations

### Log Security
- Sensitive data is masked in logs
- Access logs include IP and user agent
- Authentication events are tracked
- Failed login attempts trigger alerts

### Monitoring Access
- Grafana requires authentication
- Prometheus metrics are internal only
- Log access is restricted to authorized personnel
- Audit trail for monitoring system access

## Performance Impact

### Logging Overhead
- Structured logging: ~1-2ms per request
- Log shipping: Minimal impact with async processing
- Storage: ~100MB per day per service

### Monitoring Overhead
- Metrics collection: ~0.5% CPU overhead
- Health checks: Every 15 seconds
- Alert evaluation: Every 15 seconds

## Maintenance

### Regular Tasks
- Review and update alert thresholds
- Clean up old log files
- Update dashboard configurations
- Test alert notification channels
- Review AI cost trends and budgets

### Scaling Considerations
- Increase log retention for compliance
- Add more Prometheus storage for metrics
- Scale Grafana for more users
- Implement log forwarding for multiple environments