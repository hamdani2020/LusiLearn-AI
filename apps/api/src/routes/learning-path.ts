import express from 'express';
import { z } from 'zod';
import { LearningPathService } from '../services/learning-path.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { 
  CreateLearningPathSchema,
  LearningGoalSchema,
  DifficultyLevel
} from '@lusilearn/shared-types';
import { Pool } from 'pg';

const router = express.Router();

// We'll need to inject the database pool - this will be done in the main app
let learningPathService: LearningPathService;

export const initializeLearningPathRoutes = (pool: Pool) => {
  learningPathService = new LearningPathService(pool);
};

// Validation schemas
const UpdateLearningPathSchema = z.object({
  subject: z.string().optional(),
  currentLevel: z.nativeEnum(DifficultyLevel).optional(),
  objectives: z.array(z.any()).optional(), // More specific validation would be done in service
  milestones: z.array(z.any()).optional()
});

const UpdateProgressSchema = z.object({
  sessionId: z.string(),
  comprehensionScore: z.number().min(0).max(100),
  timeSpent: z.number().min(0),
  strugglingConcepts: z.array(z.string()),
  masteredConcepts: z.array(z.string())
});

const SharePathSchema = z.object({
  sharedWithUserId: z.string(),
  permissions: z.enum(['view', 'collaborate']),
  message: z.string().optional()
});

// POST /api/v1/learning-paths
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = CreateLearningPathSchema.parse(req.body);
    
    const learningPath = await learningPathService.generatePath(
      req.user.id,
      validatedData.subject,
      validatedData.goals
    );

    res.status(201).json({
      success: true,
      message: 'Learning path created successfully',
      data: learningPath
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/learning-paths
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const learningPaths = await learningPathService.getUserPaths(req.user.id);

    res.json({
      success: true,
      data: learningPaths
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/learning-paths/:pathId
router.get('/:pathId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { pathId } = req.params;
    const learningPath = await learningPathService.getPath(pathId);

    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    // Check if user has access to this path (owner or shared with them)
    const userPaths = await learningPathService.getUserPaths(req.user.id);
    const hasAccess = userPaths.some(path => path.id === pathId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this learning path'
      });
    }

    res.json({
      success: true,
      data: learningPath
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/learning-paths/:pathId
router.put('/:pathId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { pathId } = req.params;
    const validatedData = UpdateLearningPathSchema.parse(req.body);

    // Verify user owns this path
    const existingPath = await learningPathService.getPath(pathId);
    if (!existingPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    if (existingPath.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you can only modify your own learning paths'
      });
    }

    const updatedPath = await learningPathService.updatePath(pathId, validatedData);

    res.json({
      success: true,
      message: 'Learning path updated successfully',
      data: updatedPath
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/learning-paths/:pathId/progress
router.post('/:pathId/progress', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { pathId } = req.params;
    const validatedData = UpdateProgressSchema.parse(req.body);

    // Verify user has access to this path
    const existingPath = await learningPathService.getPath(pathId);
    if (!existingPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    const userPaths = await learningPathService.getUserPaths(req.user.id);
    const hasAccess = userPaths.some(path => path.id === pathId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this learning path'
      });
    }

    const updatedPath = await learningPathService.updateProgress(pathId, validatedData);

    res.json({
      success: true,
      message: 'Progress updated successfully',
      data: updatedPath
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/learning-paths/:pathId/share
router.post('/:pathId/share', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { pathId } = req.params;
    const validatedData = SharePathSchema.parse(req.body);

    // Verify user owns this path
    const existingPath = await learningPathService.getPath(pathId);
    if (!existingPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    if (existingPath.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you can only share your own learning paths'
      });
    }

    await learningPathService.sharePath(pathId, validatedData);

    res.json({
      success: true,
      message: 'Learning path shared successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/learning-paths/:pathId
router.delete('/:pathId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { pathId } = req.params;

    // Verify user owns this path
    const existingPath = await learningPathService.getPath(pathId);
    if (!existingPath) {
      return res.status(404).json({
        success: false,
        message: 'Learning path not found'
      });
    }

    if (existingPath.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - you can only delete your own learning paths'
      });
    }

    const success = await learningPathService.deletePath(pathId);

    if (success) {
      res.json({
        success: true,
        message: 'Learning path deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete learning path'
      });
    }
  } catch (error) {
    next(error);
  }
});

export { router as learningPathRouter };