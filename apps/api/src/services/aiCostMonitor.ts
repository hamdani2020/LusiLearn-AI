import { logAIUsage, logger } from '../utils/logger';
import { RedisService } from './redis';

interface AIUsageRecord {
  userId?: string;
  model: string;
  operation: string;
  tokens: number;
  cost: number;
  timestamp: number;
}

interface CostAlert {
  type: 'daily' | 'monthly' | 'user';
  threshold: number;
  current: number;
  message: string;
}

export class AICostMonitor {
  private redis: RedisService;
  private dailyBudget: number;
  private monthlyBudget: number;
  private userDailyLimit: number;

  // Cost per token for different models (in USD)
  private modelCosts = {
    'gpt-4': 0.00003, // $0.03 per 1K tokens
    'gpt-3.5-turbo': 0.000002, // $0.002 per 1K tokens
    'text-embedding-ada-002': 0.0000001, // $0.0001 per 1K tokens
    'dall-e-3': 0.04, // $0.04 per image
    'whisper-1': 0.006 // $0.006 per minute
  };

  constructor(redis: RedisService) {
    this.redis = redis;
    this.dailyBudget = parseFloat(process.env.AI_DAILY_BUDGET || '100'); // $100 default
    this.monthlyBudget = parseFloat(process.env.AI_MONTHLY_BUDGET || '2000'); // $2000 default
    this.userDailyLimit = parseFloat(process.env.AI_USER_DAILY_LIMIT || '10'); // $10 per user default
  }

  /**
   * Record AI usage and calculate cost
   */
  async recordUsage(
    operation: string,
    model: string,
    tokens: number,
    userId?: string,
    additionalData?: Record<string, any>
  ): Promise<number> {
    const cost = this.calculateCost(model, tokens);
    const timestamp = Date.now();

    const usageRecord: AIUsageRecord = {
      userId,
      model,
      operation,
      tokens,
      cost,
      timestamp
    };

    // Log the usage
    logAIUsage(operation, model, tokens, cost, userId, additionalData);

    // Store in Redis for real-time monitoring
    await this.storeUsageRecord(usageRecord);

    // Check for budget alerts
    await this.checkBudgetAlerts(cost, userId);

    return cost;
  }

  /**
   * Calculate cost based on model and tokens
   */
  private calculateCost(model: string, tokens: number): number {
    const costPerToken = this.modelCosts[model as keyof typeof this.modelCosts] || 0.00001;
    return tokens * costPerToken;
  }

  /**
   * Store usage record in Redis
   */
  private async storeUsageRecord(record: AIUsageRecord): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    try {
      // Store daily usage
      await this.redis.zadd(`ai_usage:daily:${today}`, record.timestamp, JSON.stringify(record));
      await this.redis.expire(`ai_usage:daily:${today}`, 86400 * 7); // Keep for 7 days

      // Store monthly usage
      await this.redis.zadd(`ai_usage:monthly:${month}`, record.timestamp, JSON.stringify(record));
      await this.redis.expire(`ai_usage:monthly:${month}`, 86400 * 90); // Keep for 90 days

      // Store user daily usage if userId provided
      if (record.userId) {
        await this.redis.zadd(`ai_usage:user:${record.userId}:${today}`, record.timestamp, JSON.stringify(record));
        await this.redis.expire(`ai_usage:user:${record.userId}:${today}`, 86400 * 30); // Keep for 30 days
      }

      // Update running totals
      await this.updateRunningTotals(record, today, month);
    } catch (error) {
      logger.error('Failed to store AI usage record', { error: (error as Error).message, record });
    }
  }

  /**
   * Update running cost totals
   */
  private async updateRunningTotals(record: AIUsageRecord, today: string, month: string): Promise<void> {
    try {
      // Update daily total
      await this.redis.incrbyfloat(`ai_cost:daily:${today}`, record.cost);
      await this.redis.expire(`ai_cost:daily:${today}`, 86400 * 7);

      // Update monthly total
      await this.redis.incrbyfloat(`ai_cost:monthly:${month}`, record.cost);
      await this.redis.expire(`ai_cost:monthly:${month}`, 86400 * 90);

      // Update user daily total
      if (record.userId) {
        await this.redis.incrbyfloat(`ai_cost:user:${record.userId}:${today}`, record.cost);
        await this.redis.expire(`ai_cost:user:${record.userId}:${today}`, 86400 * 30);
      }
    } catch (error) {
      logger.error('Failed to update running totals', { error: (error as Error).message, record });
    }
  }

  /**
   * Check for budget alerts
   */
  private async checkBudgetAlerts(cost: number, userId?: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    try {
      // Check daily budget
      const dailyCost = await this.getDailyCost(today);
      if (dailyCost > this.dailyBudget * 0.8) { // 80% threshold
        const alert: CostAlert = {
          type: 'daily',
          threshold: this.dailyBudget,
          current: dailyCost,
          message: `Daily AI cost approaching limit: $${dailyCost.toFixed(2)} / $${this.dailyBudget}`
        };
        await this.sendAlert(alert);
      }

      // Check monthly budget
      const monthlyCost = await this.getMonthlyCost(month);
      if (monthlyCost > this.monthlyBudget * 0.8) { // 80% threshold
        const alert: CostAlert = {
          type: 'monthly',
          threshold: this.monthlyBudget,
          current: monthlyCost,
          message: `Monthly AI cost approaching limit: $${monthlyCost.toFixed(2)} / $${this.monthlyBudget}`
        };
        await this.sendAlert(alert);
      }

      // Check user daily limit
      if (userId) {
        const userDailyCost = await this.getUserDailyCost(userId, today);
        if (userDailyCost > this.userDailyLimit * 0.9) { // 90% threshold
          const alert: CostAlert = {
            type: 'user',
            threshold: this.userDailyLimit,
            current: userDailyCost,
            message: `User ${userId} approaching daily AI limit: $${userDailyCost.toFixed(2)} / $${this.userDailyLimit}`
          };
          await this.sendAlert(alert);
        }
      }
    } catch (error) {
      logger.error('Failed to check budget alerts', { error: (error as Error).message });
    }
  }

  /**
   * Send cost alert
   */
  private async sendAlert(alert: CostAlert): Promise<void> {
    logger.warn('AI Cost Alert', alert);

    // Store alert to prevent spam
    const alertKey = `ai_alert:${alert.type}:${new Date().toISOString().split('T')[0]}`;
    const alertSent = await this.redis.get(alertKey);
    
    if (!alertSent) {
      await this.redis.setex(alertKey, 3600, '1'); // Prevent duplicate alerts for 1 hour
      
      // Here you could integrate with external alerting systems
      // like Slack, email, or monitoring services
      logger.error('AI Budget Alert Triggered', alert);
    }
  }

  /**
   * Get daily cost
   */
  async getDailyCost(date?: string): Promise<number> {
    const today = date || new Date().toISOString().split('T')[0];
    try {
      const cost = await this.redis.get(`ai_cost:daily:${today}`);
      return parseFloat(cost || '0');
    } catch (error) {
      logger.error('Failed to get daily cost', { error: (error as Error).message, date: today });
      return 0;
    }
  }

  /**
   * Get monthly cost
   */
  async getMonthlyCost(month?: string): Promise<number> {
    const currentMonth = month || new Date().toISOString().substring(0, 7);
    try {
      const cost = await this.redis.get(`ai_cost:monthly:${currentMonth}`);
      return parseFloat(cost || '0');
    } catch (error) {
      logger.error('Failed to get monthly cost', { error: (error as Error).message, month: currentMonth });
      return 0;
    }
  }

  /**
   * Get user daily cost
   */
  async getUserDailyCost(userId: string, date?: string): Promise<number> {
    const today = date || new Date().toISOString().split('T')[0];
    try {
      const cost = await this.redis.get(`ai_cost:user:${userId}:${today}`);
      return parseFloat(cost || '0');
    } catch (error) {
      logger.error('Failed to get user daily cost', { error: (error as Error).message, userId, date: today });
      return 0;
    }
  }

  /**
   * Check if user has exceeded daily limit
   */
  async isUserOverLimit(userId: string): Promise<boolean> {
    const userDailyCost = await this.getUserDailyCost(userId);
    return userDailyCost >= this.userDailyLimit;
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(period: 'daily' | 'monthly' = 'daily'): Promise<{
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    const key = period === 'daily' ? `ai_usage:daily:${today}` : `ai_usage:monthly:${month}`;

    try {
      const records = await this.redis.zrange(key, 0, -1);
      const stats = {
        totalCost: 0,
        totalTokens: 0,
        requestCount: records.length,
        modelBreakdown: {} as Record<string, { cost: number; tokens: number; requests: number }>
      };

      for (const recordStr of records) {
        const record: AIUsageRecord = JSON.parse(recordStr);
        stats.totalCost += record.cost;
        stats.totalTokens += record.tokens;

        if (!stats.modelBreakdown[record.model]) {
          stats.modelBreakdown[record.model] = { cost: 0, tokens: 0, requests: 0 };
        }
        stats.modelBreakdown[record.model].cost += record.cost;
        stats.modelBreakdown[record.model].tokens += record.tokens;
        stats.modelBreakdown[record.model].requests += 1;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get usage stats', { error: (error as Error).message, period });
      return {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        modelBreakdown: {}
      };
    }
  }
}