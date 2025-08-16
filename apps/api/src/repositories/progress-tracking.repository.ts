import { Pool } from 'pg';
import { 
  ProgressUpdate, 
  Achievement, 
  LearningStreak, 
  SkillProgress,
  LearningAnalytics,
  ProgressVisualizationData
} from '@lusilearn/shared-types';
import { logger } from '../utils/logger';

export interface CreateProgressUpdateRequest {
  sessionId: string;
  userId: string;
  pathId: string;
  progressData: {
    objectivesCompleted: string[];
    milestonesReached: string[];
    skillsImproved: string[];
    timeSpent: number;
    comprehensionScore: number;
    engagementLevel: number;
  };
}

export interface CreateAchievementRequest {
  userId: string;
  type: 'milestone' | 'streak' | 'skill_mastery' | 'collaboration' | 'consistency';
  title: string;
  description: string;
  iconUrl?: string;
  criteria: Record<string, any>;
  points: number;
}

export class ProgressTrackingRepository {
  constructor(private pool: Pool) {}

  async createProgressUpdate(data: CreateProgressUpdateRequest): Promise<ProgressUpdate> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO progress_updates (
          session_id, user_id, path_id, progress_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        data.sessionId,
        data.userId,
        data.pathId,
        JSON.stringify(data.progressData)
      ];
      
      const result = await client.query(query, values);
      const row = result.rows[0];
      
      return {
        sessionId: row.session_id,
        userId: row.user_id,
        pathId: row.path_id,
        timestamp: row.created_at,
        progressData: row.progress_data
      };
    } catch (error) {
      logger.error('Error creating progress update:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProgressUpdates(userId: string, pathId?: string, limit = 50): Promise<ProgressUpdate[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT * FROM progress_updates 
        WHERE user_id = $1
      `;
      const values: any[] = [userId];
      
      if (pathId) {
        query += ` AND path_id = $2`;
        values.push(pathId);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
      values.push(limit);
      
      const result = await client.query(query, values);
      
      return result.rows.map(row => ({
        sessionId: row.session_id,
        userId: row.user_id,
        pathId: row.path_id,
        timestamp: row.created_at,
        progressData: row.progress_data
      }));
    } catch (error) {
      logger.error('Error getting progress updates:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createAchievement(data: CreateAchievementRequest): Promise<Achievement> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO achievements (
          user_id, type, title, description, icon_url, criteria, points, earned_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
        RETURNING *
      `;
      
      const values = [
        data.userId,
        data.type,
        data.title,
        data.description,
        data.iconUrl || null,
        JSON.stringify(data.criteria),
        data.points
      ];
      
      const result = await client.query(query, values);
      const row = result.rows[0];
      
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        iconUrl: row.icon_url,
        criteria: row.criteria,
        earnedAt: row.earned_at,
        points: row.points
      };
    } catch (error) {
      logger.error('Error creating achievement:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserAchievements(userId: string): Promise<Achievement[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM achievements 
        WHERE user_id = $1 
        ORDER BY earned_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        iconUrl: row.icon_url,
        criteria: row.criteria,
        earnedAt: row.earned_at,
        points: row.points
      }));
    } catch (error) {
      logger.error('Error getting user achievements:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLearningStreak(userId: string, streakData: Partial<LearningStreak>): Promise<LearningStreak> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO learning_streaks (
          user_id, current_streak, longest_streak, last_activity_date, streak_type, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id, streak_type) 
        DO UPDATE SET 
          current_streak = $2,
          longest_streak = GREATEST(learning_streaks.longest_streak, $3),
          last_activity_date = $4,
          updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        userId,
        streakData.currentStreak || 0,
        streakData.longestStreak || 0,
        streakData.lastActivityDate || new Date(),
        streakData.streakType || 'daily'
      ];
      
      const result = await client.query(query, values);
      const row = result.rows[0];
      
      return {
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        lastActivityDate: row.last_activity_date,
        streakType: row.streak_type
      };
    } catch (error) {
      logger.error('Error updating learning streak:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserStreaks(userId: string): Promise<LearningStreak[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM learning_streaks 
        WHERE user_id = $1
      `;
      
      const result = await client.query(query, [userId]);
      
      return result.rows.map(row => ({
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        lastActivityDate: row.last_activity_date,
        streakType: row.streak_type
      }));
    } catch (error) {
      logger.error('Error getting user streaks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateSkillProgress(userId: string, skillProgress: SkillProgress): Promise<SkillProgress> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO skill_progress (
          user_id, skill_id, skill_name, current_level, previous_level, 
          improvement_rate, last_assessed, mastery_threshold, is_mastered, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (user_id, skill_id) 
        DO UPDATE SET 
          skill_name = $3,
          previous_level = skill_progress.current_level,
          current_level = $4,
          improvement_rate = $6,
          last_assessed = $7,
          mastery_threshold = $8,
          is_mastered = $9,
          updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        userId,
        skillProgress.skillId,
        skillProgress.skillName,
        skillProgress.currentLevel,
        skillProgress.previousLevel,
        skillProgress.improvementRate,
        skillProgress.lastAssessed,
        skillProgress.masteryThreshold,
        skillProgress.isMastered
      ];
      
      const result = await client.query(query, values);
      const row = result.rows[0];
      
      return {
        skillId: row.skill_id,
        skillName: row.skill_name,
        currentLevel: row.current_level,
        previousLevel: row.previous_level,
        improvementRate: row.improvement_rate,
        lastAssessed: row.last_assessed,
        masteryThreshold: row.mastery_threshold,
        isMastered: row.is_mastered
      };
    } catch (error) {
      logger.error('Error updating skill progress:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserSkillProgress(userId: string): Promise<SkillProgress[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM skill_progress 
        WHERE user_id = $1 
        ORDER BY last_assessed DESC
      `;
      
      const result = await client.query(query, [userId]);
      
      return result.rows.map(row => ({
        skillId: row.skill_id,
        skillName: row.skill_name,
        currentLevel: row.current_level,
        previousLevel: row.previous_level,
        improvementRate: row.improvement_rate,
        lastAssessed: row.last_assessed,
        masteryThreshold: row.mastery_threshold,
        isMastered: row.is_mastered
      }));
    } catch (error) {
      logger.error('Error getting user skill progress:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAnalyticsData(userId: string, timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      // Calculate date range based on timeframe
      let dateFilter = '';
      switch (timeframe) {
        case 'daily':
          dateFilter = "AND ls.created_at >= NOW() - INTERVAL '24 hours'";
          break;
        case 'weekly':
          dateFilter = "AND ls.created_at >= NOW() - INTERVAL '7 days'";
          break;
        case 'monthly':
          dateFilter = "AND ls.created_at >= NOW() - INTERVAL '30 days'";
          break;
        case 'yearly':
          dateFilter = "AND ls.created_at >= NOW() - INTERVAL '365 days'";
          break;
      }
      
      const query = `
        SELECT 
          COUNT(ls.id) as sessions_completed,
          COALESCE(SUM(ls.duration), 0) as total_time_spent,
          COALESCE(AVG(ls.duration), 0) as average_session_duration,
          COALESCE(AVG(ls.comprehension_score), 0) as avg_comprehension,
          COALESCE(AVG((ls.engagement_metrics->>'attentionScore')::numeric), 0) as avg_engagement,
          COUNT(DISTINCT pu.id) as progress_updates_count,
          COUNT(DISTINCT a.id) as achievements_earned
        FROM learning_sessions ls
        LEFT JOIN progress_updates pu ON pu.user_id = ls.user_id ${dateFilter.replace('ls.', 'pu.')}
        LEFT JOIN achievements a ON a.user_id = ls.user_id ${dateFilter.replace('ls.', 'a.')}
        WHERE ls.user_id = $1 ${dateFilter}
      `;
      
      const result = await client.query(query, [userId]);
      const row = result.rows[0];
      
      return {
        sessionsCompleted: parseInt(row.sessions_completed) || 0,
        totalTimeSpent: Math.round(parseFloat(row.total_time_spent) / 60) || 0, // Convert to minutes
        averageSessionDuration: Math.round(parseFloat(row.average_session_duration) / 60) || 0,
        avgComprehension: parseFloat(row.avg_comprehension) || 0,
        avgEngagement: parseFloat(row.avg_engagement) || 0,
        progressUpdatesCount: parseInt(row.progress_updates_count) || 0,
        achievementsEarned: parseInt(row.achievements_earned) || 0
      };
    } catch (error) {
      logger.error('Error getting analytics data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTimeSeriesData(userId: string, pathId?: string, days = 30): Promise<any[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          DATE(ls.created_at) as date,
          AVG(ls.comprehension_score) as comprehension_score,
          SUM(ls.duration) / 60 as time_spent,
          AVG((ls.engagement_metrics->>'attentionScore')::numeric) as engagement_level
        FROM learning_sessions ls
        WHERE ls.user_id = $1 
        AND ls.created_at >= NOW() - INTERVAL '${days} days'
      `;
      
      const values: any[] = [userId];
      
      if (pathId) {
        query += ` AND ls.path_id = $2`;
        values.push(pathId);
      }
      
      query += `
        GROUP BY DATE(ls.created_at)
        ORDER BY date DESC
      `;
      
      const result = await client.query(query, values);
      
      return result.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        comprehensionScore: parseFloat(row.comprehension_score) || 0,
        timeSpent: parseFloat(row.time_spent) || 0,
        engagementLevel: parseFloat(row.engagement_level) || 0
      }));
    } catch (error) {
      logger.error('Error getting time series data:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}