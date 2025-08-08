import { Router, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { 
  ProgressUpdateSchema, 
  LearningSessionSchema,
  LearningAnalyticsSchema 
} from '@lusilearn/shared-types';

export function createProgressRoutes(pool: Pool): Router {
  const router = Router();
  const progressService = new ProgressTrackingService(pool);

  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  /**
   * POST /api/v1/progress/update
   * Update progress based on learning session data
   */
  router.post('/update', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sessionData = LearningSessionSchema.parse(req.body);
      
      // Verify user owns this session
      if (sessionData.userId !== req.user!.id) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot update progress for another user'
        });
      }

      const progressUpdate = await progressService.updateProgress(sessionData);

      res.status(200).json({
        success: true,
        data: progressUpdate,
        message: 'Progress updated successfully'
      });
    } catch (error) {
      logger.error('Error updating progress:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/analytics/:timeframe
   * Get comprehensive learning analytics
   */
  router.get('/analytics/:timeframe', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { timeframe } = req.params;
      const userId = req.user!.id;

      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(timeframe)) {
        return res.status(400).json({
          error: 'Invalid timeframe',
          message: 'Timeframe must be one of: daily, weekly, monthly, yearly'
        });
      }

      const analytics = await progressService.calculateAnalytics(
        userId, 
        timeframe as 'daily' | 'weekly' | 'monthly' | 'yearly'
      );

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting analytics:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/visualization/:pathId
   * Get progress visualization data for a specific learning path
   */
  router.get('/visualization/:pathId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { pathId } = req.params;
      const userId = req.user!.id;

      const visualizationData = await progressService.getProgressVisualizationData(userId, pathId);

      res.status(200).json({
        success: true,
        data: visualizationData
      });
    } catch (error) {
      logger.error('Error getting progress visualization data:', error);
      next(error);
    }
  });

  /**
   * POST /api/v1/progress/milestone/:pathId/:milestoneId
   * Track milestone completion
   */
  router.post('/milestone/:pathId/:milestoneId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { pathId, milestoneId } = req.params;
      const userId = req.user!.id;

      const achievement = await progressService.trackMilestone(userId, pathId, milestoneId);

      if (achievement) {
        res.status(200).json({
          success: true,
          data: achievement,
          message: 'Milestone completed and achievement awarded!'
        });
      } else {
        res.status(200).json({
          success: true,
          data: null,
          message: 'Milestone not yet completed'
        });
      }
    } catch (error) {
      logger.error('Error tracking milestone:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/achievements
   * Get user achievements with optional filtering
   */
  router.get('/achievements', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { type } = req.query;

      const achievements = await progressService.getUserAchievements(
        userId,
        type as any
      );

      res.status(200).json({
        success: true,
        data: achievements
      });
    } catch (error) {
      logger.error('Error getting achievements:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/dashboard
   * Get comprehensive progress dashboard data
   */
  router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Get analytics for multiple timeframes
      const [weeklyAnalytics, monthlyAnalytics] = await Promise.all([
        progressService.calculateAnalytics(userId, 'weekly'),
        progressService.calculateAnalytics(userId, 'monthly')
      ]);

      // Get recent achievements
      const achievements = await progressService.getUserAchievements(userId);
      const recentAchievements = achievements
        .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
        .slice(0, 5);

      const dashboardData = {
        weeklyAnalytics,
        monthlyAnalytics,
        recentAchievements,
        totalPoints: achievements.reduce((sum, a) => sum + a.points, 0),
        totalAchievements: achievements.length
      };

      res.status(200).json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/streaks
   * Get user learning streaks
   */
  router.get('/streaks', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const progressRepository = new (require('../repositories/progress-tracking.repository').ProgressTrackingRepository)(pool);
      
      const streaks = await progressRepository.getUserStreaks(userId);

      res.status(200).json({
        success: true,
        data: streaks
      });
    } catch (error) {
      logger.error('Error getting streaks:', error);
      next(error);
    }
  });

  /**
   * GET /api/v1/progress/skills
   * Get user skill progress
   */
  router.get('/skills', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const progressRepository = new (require('../repositories/progress-tracking.repository').ProgressTrackingRepository)(pool);
      
      const skillProgress = await progressRepository.getUserSkillProgress(userId);

      res.status(200).json({
        success: true,
        data: skillProgress
      });
    } catch (error) {
      logger.error('Error getting skill progress:', error);
      next(error);
    }
  });

  return router;
}