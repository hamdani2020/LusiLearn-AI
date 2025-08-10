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

  /**
   * POST /api/v1/collaboration/sessions
   * Create a new collaboration session
   */
  router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const sessionSchema = z.object({
        groupId: z.string().optional(),
        topic: z.string().min(1).max(200),
        participants: z.array(z.string()).min(1).max(8),
        duration: z.number().min(15).max(480).optional() // 15 minutes to 8 hours
      });

      const sessionData = sessionSchema.parse(req.body);

      // Verify user has access to group if specified
      if (sessionData.groupId) {
        const group = await collaborationService.getStudyGroup(sessionData.groupId);
        if (!group || !group.participants.some(p => p.userId === userId)) {
          return res.status(403).json({ error: 'Access denied to this study group' });
        }
      }

      // Create session in database
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const query = `
        INSERT INTO collaboration_session_data (
          session_id, group_id, topic, start_time, participant_count
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await dbPool.query(query, [
        sessionId,
        sessionData.groupId || null,
        sessionData.topic,
        new Date(),
        sessionData.participants.length
      ]);

      const session = result.rows[0];

      res.status(201).json({
        success: true,
        data: {
          sessionId: session.session_id,
          groupId: session.group_id,
          topic: session.topic,
          participants: sessionData.participants,
          startTime: session.start_time,
          websocketUrl: `ws://${req.get('host')}?sessionId=${sessionId}`
        }
      });

    } catch (error) {
      logger.error('Error creating collaboration session:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid session data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to create collaboration session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/collaboration/sessions/:sessionId/progress
   * Get real-time progress updates for a session
   */
  router.get('/sessions/:sessionId/progress', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get progress updates from database
      const query = `
        SELECT user_id, progress, content_id, milestone, timestamp
        FROM collaboration_progress_updates
        WHERE session_id = $1
        ORDER BY timestamp DESC
        LIMIT 50
      `;

      const result = await dbPool.query(query, [sessionId]);

      res.json({
        success: true,
        data: {
          sessionId,
          progressUpdates: result.rows.map(row => ({
            userId: row.user_id,
            progress: row.progress,
            contentId: row.content_id,
            milestone: row.milestone,
            timestamp: row.timestamp
          }))
        }
      });

    } catch (error) {
      logger.error('Error getting session progress:', error);
      res.status(500).json({
        error: 'Failed to get session progress',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/collaboration/sessions/:sessionId/files
   * Get shared files for a session
   */
  router.get('/sessions/:sessionId/files', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get shared files from database
      const query = `
        SELECT file_id, file_name, file_url, file_size, file_type, uploaded_by, timestamp
        FROM collaboration_shared_files
        WHERE session_id = $1
        ORDER BY timestamp DESC
      `;

      const result = await dbPool.query(query, [sessionId]);

      res.json({
        success: true,
        data: {
          sessionId,
          sharedFiles: result.rows.map(row => ({
            id: row.file_id,
            name: row.file_name,
            url: row.file_url,
            size: row.file_size,
            type: row.file_type,
            uploadedBy: row.uploaded_by,
            timestamp: row.timestamp
          }))
        }
      });

    } catch (error) {
      logger.error('Error getting session files:', error);
      res.status(500).json({
        error: 'Failed to get session files',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/collaboration/sessions/:sessionId/end
   * End a collaboration session
   */
  router.post('/sessions/:sessionId/end', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const endSessionSchema = z.object({
        outcomes: z.array(z.string()).optional(),
        satisfaction: z.number().min(1).max(5).optional(),
        feedback: z.string().max(1000).optional()
      });

      const endData = endSessionSchema.parse(req.body);

      // Update session end time and outcomes
      const query = `
        UPDATE collaboration_session_data
        SET end_time = $1, 
            activities = activities || $2::jsonb
        WHERE session_id = $3
        RETURNING *
      `;

      const endActivity = {
        type: 'session_end',
        timestamp: new Date(),
        userId,
        data: {
          outcomes: endData.outcomes || [],
          satisfaction: endData.satisfaction,
          feedback: endData.feedback
        }
      };

      const result = await dbPool.query(query, [
        new Date(),
        JSON.stringify([endActivity]),
        sessionId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        data: {
          sessionId,
          endTime: result.rows[0].end_time,
          message: 'Session ended successfully'
        }
      });

    } catch (error) {
      logger.error('Error ending session:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid end session data',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to end session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createCollaborationRoutes;