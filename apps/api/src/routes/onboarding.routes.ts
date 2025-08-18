import { Router } from 'express';
import { OnboardingService } from '../services/onboarding.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

export function createOnboardingRoutes(pool: Pool): Router {
  const router = Router();
  const onboardingService = new OnboardingService(pool);

  /**
   * @route POST /api/v1/onboarding/start
   * @desc Start onboarding process for a new user
   * @access Private
   */
  router.post('/start', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await onboardingService.startOnboarding(userId);
      
      res.status(201).json({
        success: true,
        data: session,
        message: 'Onboarding session started successfully'
      });
    } catch (error) {
      logger.error('Error starting onboarding:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start onboarding process'
      });
    }
  });

  /**
   * @route GET /api/v1/onboarding/session
   * @desc Get current onboarding session
   * @access Private
   */
  router.get('/session', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await onboardingService.getOnboardingSession(userId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'No active onboarding session found'
        });
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      logger.error('Error getting onboarding session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get onboarding session'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/skill-assessment/questions
   * @desc Generate skill assessment questions
   * @access Private
   */
  router.post('/skill-assessment/questions', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { subject } = req.body;
      const questions = await onboardingService.generateSkillAssessment(userId, subject);
      
      res.json({
        success: true,
        data: {
          questions,
          totalQuestions: questions.length,
          estimatedDuration: questions.length * 2 // 2 minutes per question
        }
      });
    } catch (error) {
      logger.error('Error generating skill assessment questions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate skill assessment questions'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/skill-assessment/evaluate
   * @desc Evaluate skill assessment answers
   * @access Private
   */
  router.post('/skill-assessment/evaluate', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { answers } = req.body;
      
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Answers are required'
        });
      }

      const result = await onboardingService.evaluateSkillAssessment(userId, answers);
      
      // Update onboarding progress
      await onboardingService.updateOnboardingProgress(
        userId,
        'SKILL_ASSESSMENT' as any,
        result
      );

      res.json({
        success: true,
        data: result,
        message: 'Skill assessment completed successfully'
      });
    } catch (error) {
      logger.error('Error evaluating skill assessment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate skill assessment'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/learning-preferences
   * @desc Generate learning preferences recommendations
   * @access Private
   */
  router.post('/learning-preferences', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { skillAssessment } = req.body;
      const preferences = await onboardingService.generateLearningPreferencesRecommendations(
        userId,
        skillAssessment
      );
      
      // Update onboarding progress
      await onboardingService.updateOnboardingProgress(
        userId,
        'LEARNING_PREFERENCES' as any,
        preferences
      );

      res.json({
        success: true,
        data: preferences,
        message: 'Learning preferences generated successfully'
      });
    } catch (error) {
      logger.error('Error generating learning preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate learning preferences'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/goals
   * @desc Generate goal recommendations
   * @access Private
   */
  router.post('/goals', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { skillAssessment, learningPreferences } = req.body;
      const goals = await onboardingService.generateGoalRecommendations(
        userId,
        skillAssessment,
        learningPreferences
      );
      
      // Update onboarding progress
      await onboardingService.updateOnboardingProgress(
        userId,
        'GOAL_SETTING' as any,
        goals
      );

      res.json({
        success: true,
        data: goals,
        message: 'Goal recommendations generated successfully'
      });
    } catch (error) {
      logger.error('Error generating goal recommendations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate goal recommendations'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/complete
   * @desc Complete onboarding process
   * @access Private
   */
  router.post('/complete', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const recommendations = await onboardingService.completeOnboarding(userId);
      
      res.json({
        success: true,
        data: recommendations,
        message: 'Onboarding completed successfully! Welcome to LusiLearn AI!'
      });
    } catch (error) {
      logger.error('Error completing onboarding:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete onboarding'
      });
    }
  });

  /**
   * @route POST /api/v1/onboarding/progress
   * @desc Update onboarding progress
   * @access Private
   */
  router.post('/progress', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { step, data } = req.body;
      
      if (!step) {
        return res.status(400).json({
          success: false,
          error: 'Step is required'
        });
      }

      const session = await onboardingService.updateOnboardingProgress(userId, step, data);
      
      res.json({
        success: true,
        data: session,
        message: 'Onboarding progress updated successfully'
      });
    } catch (error) {
      logger.error('Error updating onboarding progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update onboarding progress'
      });
    }
  });

  /**
   * @route GET /api/v1/onboarding/status
   * @desc Get onboarding status and progress
   * @access Private
   */
  router.get('/status', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await onboardingService.getOnboardingSession(userId);
      
      if (!session) {
        return res.json({
          success: true,
          data: {
            isCompleted: true,
            message: 'Onboarding already completed'
          }
        });
      }

      res.json({
        success: true,
        data: {
          isCompleted: false,
          currentStep: session.currentStep,
          progress: session.progress,
          session: session
        }
      });
    } catch (error) {
      logger.error('Error getting onboarding status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get onboarding status'
      });
    }
  });

  return router;
} 