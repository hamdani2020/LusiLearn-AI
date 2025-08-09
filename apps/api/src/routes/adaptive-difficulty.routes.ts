import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { 
  DifficultyAdjustmentResultSchema,
  ContentSequenceResultSchema,
  CompetencyTestResultSchema,
  OptimalChallengeAnalysisSchema,
  LearningSessionSchema,
  DifficultyLevel
} from '@lusilearn/shared-types';
import { LearningPathService } from '../services/learning-path.service';
import { AdaptiveDifficultyService } from '../services/adaptive-difficulty.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// Request validation schemas
const AdaptDifficultyRequestSchema = z.object({
  pathId: z.string(),
  recentSessions: z.array(LearningSessionSchema)
});

const GetNextContentRequestSchema = z.object({
  pathId: z.string()
});

const RequestAdvancementSchema = z.object({
  pathId: z.string(),
  requestedLevel: z.nativeEnum(DifficultyLevel)
});

const MaintainOptimalChallengeSchema = z.object({
  pathId: z.string()
});

export function createAdaptiveDifficultyRoutes(pool: Pool): Router {
  const learningPathService = new LearningPathService(pool);
  const adaptiveDifficultyService = new AdaptiveDifficultyService(pool);

  /**
   * POST /api/v1/adaptive-difficulty/analyze
   * Analyze performance and adjust difficulty if needed
   */
  router.post('/analyze', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = AdaptDifficultyRequestSchema.parse(req.body);
      const { pathId, recentSessions } = validatedData;

      const adjustmentResult = await learningPathService.adaptDifficulty(
        userId, 
        pathId, 
        recentSessions
      );

      if (adjustmentResult) {
        const validatedResult = DifficultyAdjustmentResultSchema.parse(adjustmentResult);
        res.json({
          success: true,
          data: validatedResult,
          message: 'Difficulty adjustment applied successfully'
        });
      } else {
        res.json({
          success: true,
          data: null,
          message: 'No difficulty adjustment needed at this time'
        });
      }
    } catch (error) {
      logger.error('Error in adaptive difficulty analysis:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to analyze difficulty adjustment',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/adaptive-difficulty/next-content
   * Get next content based on prerequisite mastery
   */
  router.post('/next-content', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = GetNextContentRequestSchema.parse(req.body);
      const { pathId } = validatedData;

      const contentSequence = await learningPathService.getNextContent(userId, pathId);
      const validatedResult = ContentSequenceResultSchema.parse(contentSequence);

      res.json({
        success: true,
        data: validatedResult,
        message: 'Content sequence generated successfully'
      });
    } catch (error) {
      logger.error('Error getting next content:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to get next content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/adaptive-difficulty/request-advancement
   * Conduct competency test for advancement request
   */
  router.post('/request-advancement', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = RequestAdvancementSchema.parse(req.body);
      const { pathId, requestedLevel } = validatedData;

      const testResult = await learningPathService.requestAdvancement(
        userId, 
        pathId, 
        requestedLevel
      );

      const validatedResult = CompetencyTestResultSchema.parse(testResult);

      res.json({
        success: true,
        data: validatedResult,
        message: testResult.passed 
          ? 'Competency test passed - advancement approved'
          : 'Competency test not passed - advancement denied'
      });
    } catch (error) {
      logger.error('Error processing advancement request:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to process advancement request',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/adaptive-difficulty/optimal-challenge
   * Maintain optimal challenge level (70-85% comprehension)
   */
  router.post('/optimal-challenge', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = MaintainOptimalChallengeSchema.parse(req.body);
      const { pathId } = validatedData;

      const analysis = await learningPathService.maintainOptimalChallenge(userId, pathId);
      const validatedResult = OptimalChallengeAnalysisSchema.parse(analysis);

      res.json({
        success: true,
        data: validatedResult,
        message: analysis.isOptimal 
          ? 'Challenge level is optimal'
          : `Challenge level needs adjustment: ${analysis.adjustment}`
      });
    } catch (error) {
      logger.error('Error maintaining optimal challenge level:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to maintain optimal challenge level',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/adaptive-difficulty/path/:pathId/analysis
   * Get comprehensive adaptive difficulty analysis for a learning path
   */
  router.get('/path/:pathId/analysis', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { pathId } = req.params;

      // Get comprehensive analysis
      const [contentSequence, optimalChallenge] = await Promise.all([
        learningPathService.getNextContent(userId, pathId),
        learningPathService.maintainOptimalChallenge(userId, pathId)
      ]);

      const validatedContentSequence = ContentSequenceResultSchema.parse(contentSequence);
      const validatedOptimalChallenge = OptimalChallengeAnalysisSchema.parse(optimalChallenge);

      res.json({
        success: true,
        data: {
          contentSequence: validatedContentSequence,
          optimalChallenge: validatedOptimalChallenge,
          recommendations: {
            nextActions: generateRecommendations(contentSequence, optimalChallenge),
            focusAreas: contentSequence.recommendedReview,
            difficultyAdjustment: optimalChallenge.adjustment
          }
        },
        message: 'Adaptive difficulty analysis completed successfully'
      });
    } catch (error) {
      logger.error('Error getting adaptive difficulty analysis:', error);

      res.status(500).json({
        error: 'Failed to get adaptive difficulty analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Helper method to generate recommendations
   */
  function generateRecommendations(contentSequence: any, optimalChallenge: any): string[] {
    const recommendations: string[] = [];

    if (!contentSequence.prerequisitesMet) {
      recommendations.push('Review prerequisite concepts before advancing');
    }

    if (contentSequence.blockedObjectives.length > 0) {
      recommendations.push(`Focus on mastering ${contentSequence.blockedObjectives.length} blocked objectives`);
    }

    if (!optimalChallenge.isOptimal) {
      if (optimalChallenge.adjustment === 'increase') {
        recommendations.push('Consider more challenging content to maintain engagement');
      } else if (optimalChallenge.adjustment === 'decrease') {
        recommendations.push('Provide additional support and scaffolding');
      }
    }

    if (contentSequence.nextObjectives.length > 0) {
      recommendations.push(`Ready to proceed with ${contentSequence.nextObjectives.length} new objectives`);
    }

    return recommendations;
  }

  return router;
}

export default createAdaptiveDifficultyRoutes;