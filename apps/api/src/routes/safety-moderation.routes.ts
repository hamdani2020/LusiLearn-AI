import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { authenticateToken } from '../middleware/auth';
import { createValidationMiddleware, commonSchemas } from '../middleware/security';
import { SafetyModerationService, SafetyReportType, SafetyCategory } from '../services/safety-moderation.service';
import { CollaborationService } from '../services/collaboration.service';

// Extend Express Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

// Validation schemas
const CreateSafetyReportSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  reportedContentId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  groupId: z.string().uuid().optional(),
  type: z.nativeEnum(SafetyReportType),
  category: z.nativeEnum(SafetyCategory),
  description: z.string().min(10).max(1000),
  evidence: z.array(z.object({
    type: z.enum(['message', 'screenshot', 'file', 'log']),
    content: z.string(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.any()).optional()
  })).optional()
});

const ModerateMessageSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(2000),
  messageType: z.enum(['text', 'code', 'image', 'file']).default('text'),
  metadata: z.record(z.any()).optional()
});

const ValidateMinorParticipationSchema = z.object({
  sessionId: z.string(),
  participants: z.array(z.string().uuid())
});

const UpdateMinorSafetySettingsSchema = z.object({
  requiresSupervision: z.boolean().optional(),
  allowedCommunicationTypes: z.array(z.string()).optional(),
  restrictedFeatures: z.array(z.string()).optional(),
  parentalNotifications: z.boolean().optional(),
  emergencyContacts: z.array(z.string()).optional(),
  sessionTimeLimit: z.number().min(5).max(480).optional(), // 5 minutes to 8 hours
  allowedPeers: z.array(z.string().uuid()).optional()
});

export function createSafetyModerationRoutes(db: Pool): Router {
  const router = Router();
  const safetyModerationService = new SafetyModerationService(db);
  const collaborationService = new CollaborationService(db);

  /**
   * POST /api/v1/safety/reports
   * Create a new safety report
   */
  router.post('/reports', 
    authenticateToken, 
    createValidationMiddleware({ body: CreateSafetyReportSchema }), 
    async (req, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: 'User not authenticated' });
        }

        const validatedData = req.body; // Already validated by middleware

        // Ensure at least one target is specified
        if (!validatedData.reportedUserId && !validatedData.reportedContentId &&
          !validatedData.sessionId && !validatedData.groupId) {
          return res.status(400).json({
            error: 'At least one target must be specified (user, content, session, or group)'
          });
        }

        const report = await collaborationService.createSafetyReport(userId, validatedData);

        logger.info(`Safety report created: ${report.id} by user ${userId}`);

        res.status(201).json({
          success: true,
          data: report,
          message: 'Safety report created successfully'
        });

      } catch (error) {
        logger.error('Error creating safety report:', error);
        res.status(500).json({
          error: 'Failed to create safety report',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

  /**
   * GET /api/v1/safety/reports
   * Get safety reports (for moderators)
   */
  router.get('/reports', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has moderator permissions
      const userRole = req.user?.role;
      if (userRole !== 'moderator' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { status, severity, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT sr.*, 
               u1.email as reporter_email,
               u2.email as reported_user_email
        FROM safety_reports sr
        LEFT JOIN users u1 ON sr.reporter_id = u1.id
        LEFT JOIN users u2 ON sr.reported_user_id = u2.id
        WHERE 1=1
      `;
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND sr.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (severity) {
        query += ` AND sr.severity = $${paramIndex}`;
        queryParams.push(severity);
        paramIndex++;
      }

      query += ` ORDER BY sr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, queryParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.rows.length
        }
      });

    } catch (error) {
      logger.error('Error fetching safety reports:', error);
      res.status(500).json({
        error: 'Failed to fetch safety reports',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/safety/moderate-message
   * Moderate a conversation message
   */
  router.post('/moderate-message', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = ModerateMessageSchema.parse(req.body);

      const result = await collaborationService.moderateConversationMessage(
        validatedData.sessionId,
        userId,
        validatedData.message,
        validatedData.messageType,
        validatedData.metadata
      );

      res.json({
        success: true,
        data: result,
        message: 'Message moderated successfully'
      });

    } catch (error) {
      logger.error('Error moderating message:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to moderate message',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/safety/validate-minor-participation
   * Validate if a minor can participate in a collaboration session
   */
  router.post('/validate-minor-participation', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = ValidateMinorParticipationSchema.parse(req.body);

      const validation = await collaborationService.validateMinorParticipation(
        userId,
        validatedData.sessionId,
        validatedData.participants
      );

      res.json({
        success: true,
        data: validation,
        message: 'Minor participation validation completed'
      });

    } catch (error) {
      logger.error('Error validating minor participation:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to validate minor participation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/safety/minor-settings
   * Get safety settings for minor users
   */
  router.get('/minor-settings', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const settings = await safetyModerationService.getMinorSafetySettings(userId);

      res.json({
        success: true,
        data: settings,
        message: 'Minor safety settings retrieved successfully'
      });

    } catch (error) {
      logger.error('Error getting minor safety settings:', error);
      res.status(500).json({
        error: 'Failed to get minor safety settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * PUT /api/v1/safety/minor-settings
   * Update safety settings for minor users
   */
  router.put('/minor-settings', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const validatedData = UpdateMinorSafetySettingsSchema.parse(req.body);

      const updatedSettings = await safetyModerationService.updateMinorSafetySettings(
        userId,
        validatedData
      );

      res.json({
        success: true,
        data: updatedSettings,
        message: 'Minor safety settings updated successfully'
      });

    } catch (error) {
      logger.error('Error updating minor safety settings:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      res.status(500).json({
        error: 'Failed to update minor safety settings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/v1/safety/moderator-notifications
   * Get notifications for moderators
   */
  router.get('/moderator-notifications', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has moderator permissions
      const userRole = req.user?.role;
      if (userRole !== 'moderator' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { status = 'pending', priority, limit = 20, offset = 0 } = req.query;

      let query = `
        SELECT mn.*, sr.description as report_description
        FROM moderator_notifications mn
        LEFT JOIN safety_reports sr ON mn.related_report_id = sr.id
        WHERE mn.status = $1
      `;
      const queryParams: any[] = [status];
      let paramIndex = 2;

      if (priority) {
        query += ` AND mn.priority = $${paramIndex}`;
        queryParams.push(priority);
        paramIndex++;
      }

      query += ` ORDER BY 
        CASE mn.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        mn.created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, queryParams);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: result.rows.length
        }
      });

    } catch (error) {
      logger.error('Error fetching moderator notifications:', error);
      res.status(500).json({
        error: 'Failed to fetch moderator notifications',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * PUT /api/v1/safety/moderator-notifications/:id/acknowledge
   * Acknowledge a moderator notification
   */
  router.put('/moderator-notifications/:id/acknowledge', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has moderator permissions
      const userRole = req.user?.role;
      if (userRole !== 'moderator' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const query = `
        UPDATE moderator_notifications 
        SET status = 'acknowledged', acknowledged_at = NOW(), assigned_to = $1
        WHERE id = $2
        RETURNING *
      `;

      const result = await db.query(query, [userId, notificationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Notification acknowledged successfully'
      });

    } catch (error) {
      logger.error('Error acknowledging moderator notification:', error);
      res.status(500).json({
        error: 'Failed to acknowledge notification',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/v1/safety/reports/:id/escalate
   * Escalate a safety report
   */
  router.post('/reports/:id/escalate', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      const reportId = req.params.id;
      const { reason } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if user has moderator permissions
      const userRole = req.user?.role;
      if (userRole !== 'moderator' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Escalation reason is required' });
      }

      await safetyModerationService.escalateReport(reportId, reason);

      res.json({
        success: true,
        message: 'Safety report escalated successfully'
      });

    } catch (error) {
      logger.error('Error escalating safety report:', error);
      res.status(500).json({
        error: 'Failed to escalate safety report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}