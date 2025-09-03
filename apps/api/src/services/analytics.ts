import { logAnalytics, logger } from '../utils/logger';
import { RedisService } from './redis';

interface AnalyticsEvent {
  userId: string;
  sessionId: string;
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  ip?: string;
  userAgent?: string;
}

interface UserSession {
  sessionId: string;
  userId: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  events: string[];
  deviceInfo: {
    userAgent: string;
    ip: string;
    platform?: string;
    browser?: string;
  };
}

interface LearningMetrics {
  userId: string;
  sessionDuration: number;
  contentViewed: string[];
  assessmentsCompleted: number;
  skillsImproved: string[];
  collaborationTime: number;
  achievementsUnlocked: string[];
}

export class AnalyticsService {
  private redis: RedisService;

  constructor(redis: RedisService) {
    this.redis = redis;
  }

  /**
   * Track user event
   */
  async trackEvent(
    userId: string,
    sessionId: string,
    event: string,
    properties: Record<string, any> = {},
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      userId,
      sessionId,
      event,
      properties,
      timestamp: Date.now(),
      ip,
      userAgent
    };

    // Log the event
    logAnalytics(event, userId, sessionId, properties);

    try {
      // Store event in Redis
      await this.storeEvent(analyticsEvent);

      // Update session data
      await this.updateSession(userId, sessionId, event, ip, userAgent);

      // Update real-time metrics
      await this.updateRealTimeMetrics(analyticsEvent);

      // Process learning-specific events
      if (this.isLearningEvent(event)) {
        await this.processLearningEvent(analyticsEvent);
      }
    } catch (error) {
      logger.error('Failed to track analytics event', { 
        error: (error as Error).message, 
        userId, 
        sessionId, 
        event 
      });
    }
  }

  /**
   * Store event in Redis
   */
  private async storeEvent(event: AnalyticsEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    // Store in multiple time buckets for different aggregation needs
    const keys = [
      `analytics:events:${today}`, // Daily events
      `analytics:events:${today}:${hour}`, // Hourly events
      `analytics:user:${event.userId}:${today}`, // User daily events
      `analytics:session:${event.sessionId}` // Session events
    ];

    const eventData = JSON.stringify(event);

    for (const key of keys) {
      await this.redis.zadd(key, event.timestamp, eventData);
      
      // Set appropriate expiration
      if (key.includes(':user:')) {
        await this.redis.expire(key, 86400 * 90); // 90 days for user data
      } else if (key.includes(':session:')) {
        await this.redis.expire(key, 86400 * 7); // 7 days for session data
      } else {
        await this.redis.expire(key, 86400 * 30); // 30 days for general events
      }
    }
  }

  /**
   * Update or create user session
   */
  private async updateSession(
    userId: string,
    sessionId: string,
    event: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const now = Date.now();

    try {
      const existingSession = await this.redis.get(sessionKey);
      
      if (existingSession) {
        const session: UserSession = JSON.parse(existingSession);
        session.lastActivity = now;
        session.events.push(event);
        
        if (event === 'page_view') {
          session.pageViews++;
        }

        await this.redis.setex(sessionKey, 86400, JSON.stringify(session)); // 24 hour expiry
      } else {
        // Create new session
        const newSession: UserSession = {
          sessionId,
          userId,
          startTime: now,
          lastActivity: now,
          pageViews: event === 'page_view' ? 1 : 0,
          events: [event],
          deviceInfo: {
            userAgent: userAgent || '',
            ip: ip || '',
            platform: this.extractPlatform(userAgent),
            browser: this.extractBrowser(userAgent)
          }
        };

        await this.redis.setex(sessionKey, 86400, JSON.stringify(newSession));
      }
    } catch (error) {
      logger.error('Failed to update session', { error: (error as Error).message, sessionId, userId });
    }
  }

  /**
   * Update real-time metrics
   */
  private async updateRealTimeMetrics(event: AnalyticsEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    try {
      // Update daily active users
      await this.redis.sadd(`metrics:dau:${today}`, event.userId);
      await this.redis.expire(`metrics:dau:${today}`, 86400 * 7);

      // Update hourly active users
      await this.redis.sadd(`metrics:hau:${today}:${hour}`, event.userId);
      await this.redis.expire(`metrics:hau:${today}:${hour}`, 86400 * 2);

      // Update event counters
      await this.redis.incr(`metrics:events:${event.event}:${today}`);
      await this.redis.expire(`metrics:events:${event.event}:${today}`, 86400 * 30);

      // Update platform metrics
      if (event.userAgent) {
        const platform = this.extractPlatform(event.userAgent);
        if (platform) {
          await this.redis.incr(`metrics:platform:${platform}:${today}`);
          await this.redis.expire(`metrics:platform:${platform}:${today}`, 86400 * 30);
        }
      }
    } catch (error) {
      logger.error('Failed to update real-time metrics', { error: (error as Error).message, event: event.event });
    }
  }

  /**
   * Process learning-specific events
   */
  private async processLearningEvent(event: AnalyticsEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
      switch (event.event) {
        case 'learning_session_start':
          await this.redis.incr(`metrics:learning:sessions:${today}`);
          break;

        case 'content_completed':
          await this.redis.incr(`metrics:learning:completions:${today}`);
          if (event.properties.contentType) {
            await this.redis.incr(`metrics:learning:completions:${event.properties.contentType}:${today}`);
          }
          break;

        case 'assessment_completed':
          await this.redis.incr(`metrics:learning:assessments:${today}`);
          if (event.properties.score) {
            await this.redis.lpush(`metrics:learning:scores:${today}`, event.properties.score);
            await this.redis.expire(`metrics:learning:scores:${today}`, 86400 * 30);
          }
          break;

        case 'collaboration_joined':
          await this.redis.incr(`metrics:collaboration:joins:${today}`);
          break;

        case 'ai_recommendation_clicked':
          await this.redis.incr(`metrics:ai:recommendations:clicks:${today}`);
          break;
      }

      // Set expiration for learning metrics
      const keys = await this.redis.keys(`metrics:learning:*:${today}`);
      for (const key of keys) {
        await this.redis.expire(key, 86400 * 30);
      }
    } catch (error) {
      logger.error('Failed to process learning event', { error: (error as Error).message, event: event.event });
    }
  }

  /**
   * Get user analytics summary
   */
  async getUserAnalytics(userId: string, days: number = 7): Promise<{
    totalSessions: number;
    totalEvents: number;
    averageSessionDuration: number;
    topEvents: Array<{ event: string; count: number }>;
    learningMetrics: {
      sessionsCompleted: number;
      contentViewed: number;
      assessmentsCompleted: number;
      averageScore: number;
    };
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      let totalSessions = 0;
      let totalEvents = 0;
      let totalSessionDuration = 0;
      const eventCounts: Record<string, number> = {};
      const learningMetrics = {
        sessionsCompleted: 0,
        contentViewed: 0,
        assessmentsCompleted: 0,
        totalScore: 0,
        scoreCount: 0
      };

      // Iterate through each day
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const userEventsKey = `analytics:user:${userId}:${dateStr}`;
        
        const events = await this.redis.zrange(userEventsKey, 0, -1);
        totalEvents += events.length;

        // Process events for this day
        const sessionIds = new Set<string>();
        for (const eventStr of events) {
          const event: AnalyticsEvent = JSON.parse(eventStr);
          sessionIds.add(event.sessionId);
          
          // Count event types
          eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;

          // Process learning events
          if (event.event === 'learning_session_completed') {
            learningMetrics.sessionsCompleted++;
          } else if (event.event === 'content_completed') {
            learningMetrics.contentViewed++;
          } else if (event.event === 'assessment_completed') {
            learningMetrics.assessmentsCompleted++;
            if (event.properties.score) {
              learningMetrics.totalScore += event.properties.score;
              learningMetrics.scoreCount++;
            }
          }
        }

        totalSessions += sessionIds.size;

        // Calculate session durations for this day
        for (const sessionId of sessionIds) {
          const sessionKey = `session:${sessionId}`;
          const sessionData = await this.redis.get(sessionKey);
          if (sessionData) {
            const session: UserSession = JSON.parse(sessionData);
            totalSessionDuration += (session.lastActivity - session.startTime);
          }
        }
      }

      // Sort events by count
      const topEvents = Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([event, count]) => ({ event, count }));

      return {
        totalSessions,
        totalEvents,
        averageSessionDuration: totalSessions > 0 ? totalSessionDuration / totalSessions : 0,
        topEvents,
        learningMetrics: {
          sessionsCompleted: learningMetrics.sessionsCompleted,
          contentViewed: learningMetrics.contentViewed,
          assessmentsCompleted: learningMetrics.assessmentsCompleted,
          averageScore: learningMetrics.scoreCount > 0 ? learningMetrics.totalScore / learningMetrics.scoreCount : 0
        }
      };
    } catch (error) {
      logger.error('Failed to get user analytics', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Get platform analytics
   */
  async getPlatformAnalytics(date?: string): Promise<{
    dailyActiveUsers: number;
    totalEvents: number;
    topEvents: Array<{ event: string; count: number }>;
    platformBreakdown: Record<string, number>;
    learningMetrics: {
      totalSessions: number;
      totalCompletions: number;
      averageScore: number;
      collaborationJoins: number;
    };
  }> {
    const today = date || new Date().toISOString().split('T')[0];

    try {
      // Get daily active users
      const dauCount = await this.redis.scard(`metrics:dau:${today}`);

      // Get event counts
      const eventKeys = await this.redis.keys(`metrics:events:*:${today}`);
      const eventCounts: Record<string, number> = {};
      let totalEvents = 0;

      for (const key of eventKeys) {
        const eventName = key.split(':')[2];
        const count = parseInt(await this.redis.get(key) || '0');
        eventCounts[eventName] = count;
        totalEvents += count;
      }

      // Get platform breakdown
      const platformKeys = await this.redis.keys(`metrics:platform:*:${today}`);
      const platformBreakdown: Record<string, number> = {};

      for (const key of platformKeys) {
        const platform = key.split(':')[2];
        const count = parseInt(await this.redis.get(key) || '0');
        platformBreakdown[platform] = count;
      }

      // Get learning metrics
      const learningSessionsCount = parseInt(await this.redis.get(`metrics:learning:sessions:${today}`) || '0');
      const learningCompletionsCount = parseInt(await this.redis.get(`metrics:learning:completions:${today}`) || '0');
      const collaborationJoinsCount = parseInt(await this.redis.get(`metrics:collaboration:joins:${today}`) || '0');

      // Calculate average score
      const scores = await this.redis.lrange(`metrics:learning:scores:${today}`, 0, -1);
      const averageScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + parseFloat(score), 0) / scores.length 
        : 0;

      // Sort events by count
      const topEvents = Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([event, count]) => ({ event, count }));

      return {
        dailyActiveUsers: dauCount,
        totalEvents,
        topEvents,
        platformBreakdown,
        learningMetrics: {
          totalSessions: learningSessionsCount,
          totalCompletions: learningCompletionsCount,
          averageScore,
          collaborationJoins: collaborationJoinsCount
        }
      };
    } catch (error) {
      logger.error('Failed to get platform analytics', { error: (error as Error).message, date: today });
      throw error;
    }
  }

  /**
   * Check if event is learning-related
   */
  private isLearningEvent(event: string): boolean {
    const learningEvents = [
      'learning_session_start',
      'learning_session_completed',
      'content_started',
      'content_completed',
      'assessment_started',
      'assessment_completed',
      'collaboration_joined',
      'collaboration_left',
      'ai_recommendation_clicked',
      'skill_improved',
      'achievement_unlocked'
    ];
    return learningEvents.includes(event);
  }

  /**
   * Extract platform from user agent
   */
  private extractPlatform(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'chrome';
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari')) return 'safari';
    if (ua.includes('edge')) return 'edge';
    return 'other';
  }
}