import { Router, Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { CollaborationService } from '../services/collaboration.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  MatchingCriteriaSchema,
  CreateStudyGroupSchema,
  CollaborationActivityType
} from '@lusilearn/shared-types';

let collaborationService: CollaborationService;

export function createCollaborationRoutes(dbPool: Pool): Router {
  const router = Router();

  // Initialize collaboration service with database pool
  collaborationService = new CollaborationService(dbPool);

  // Apply authentication middleware to all routes
  router.use(authenticateToken);

  /**
   * POST /api/v1/collaboration/peer-matching
   * Find peer matches for the authenticated user
   */
  router.post('/peer-matching', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validate request body
      const matchingCriteria = MatchingCriteriaSchema.parse(req.body);

      // Find peer matches
      const matches = await collaborationService.matchPeers(userId, matchingCriteria);

      res.json({
        success: true,
        data: {
          matches,
          count: matches.length
        }
      });

    } catch (error) {
      logger.error('Error in peer matching endpoint:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to find peer matches',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/collaboration/study-groups
   * Create a new study group
   */
  router.post('/study-groups', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validate request body
      const groupData = CreateStudyGroupSchema.parse(req.body);

      // Create study group
      const studyGroup = await collaborationService.createStudyGroup(userId, groupData);

      res.status(201).json({
        success: true,
        data: studyGroup
      });

    } catch (error) {
      logger.error('Error creating study group:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to create study group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/collaboration/study-groups
   * Get user's study groups
   */
  router.get('/study-groups', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const studyGroups = await collaborationService.getUserStudyGroups(userId);

      res.json({
        success: true,
        data: {
          groups: studyGroups,
          count: studyGroups.length
        }
      });

    } catch (error) {
      logger.error('Error getting user study groups:', error);
      res.status(500).json({
        error: 'Failed to get study groups',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/collaboration/study-groups/:groupId
   * Get specific study group details
   */
  router.get('/study-groups/:groupId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { groupId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const studyGroup = await collaborationService.getStudyGroup(groupId);

      if (!studyGroup) {
        return res.status(404).json({ error: 'Study group not found' });
      }

      // Check if user is a participant
      const isParticipant = studyGroup.participants.some(p => p.userId === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Access denied to this study group' });
      }

      res.json({
        success: true,
        data: studyGroup
      });

    } catch (error) {
      logger.error('Error getting study group:', error);
      res.status(500).json({
        error: 'Failed to get study group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/collaboration/study-groups/:groupId/participants
   * Add participant to study group
   */
  router.post('/study-groups/:groupId/participants', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requesterId = req.user?.id;
      const { groupId } = req.params;
      const { userId } = req.body;

      if (!requesterId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const updatedGroup = await collaborationService.addParticipant(groupId, userId, requesterId);

      res.json({
        success: true,
        data: updatedGroup
      });

    } catch (error) {
      logger.error('Error adding participant:', error);
      res.status(500).json({
        error: 'Failed to add participant',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/collaboration/study-groups/:groupId/activities
   * Create group activity
   */
  router.post('/study-groups/:groupId/activities', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const creatorId = req.user?.id;
      const { groupId } = req.params;

      if (!creatorId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validate activity data
      const activitySchema = z.object({
        type: z.nativeEnum(CollaborationActivityType),
        title: z.string().min(1).max(200),
        description: z.string().max(1000),
        participants: z.array(z.string()),
        startTime: z.string().datetime().transform(str => new Date(str)),
        endTime: z.string().datetime().transform(str => new Date(str)).optional()
      });

      const activityData = activitySchema.parse(req.body);

      const activity = await collaborationService.createGroupActivity(groupId, creatorId, activityData);

      res.status(201).json({
        success: true,
        data: activity
      });

    } catch (error) {
      logger.error('Error creating group activity:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid activity data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to create group activity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/collaboration/moderation/:interactionId
   * Moderate interaction content
   */
  router.post('/moderation/:interactionId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { interactionId } = req.params;

      const moderationResult = await collaborationService.moderateInteraction(interactionId);

      res.json({
        success: true,
        data: moderationResult
      });

    } catch (error) {
      logger.error('Error moderating interaction:', error);
      res.status(500).json({
        error: 'Failed to moderate interaction',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/collaboration/sessions/:sessionId
   * Get collaboration session details
   */
  router.get('/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await collaborationService.facilitateSession(sessionId);

      // Check if user is a participant
      const isParticipant = session.participants.includes(userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Access denied to this session' });
      }

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      logger.error('Error getting collaboration session:', error);
      res.status(500).json({
        error: 'Failed to get collaboration session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createCollaborationRoutes;