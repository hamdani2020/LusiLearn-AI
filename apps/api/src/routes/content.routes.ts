import express from 'express';
import { z } from 'zod';
import { Pool } from 'pg';
import { ContentService } from '../services/content.service';
import { ContentRepository } from '../repositories/content.repository';
import { ContentReportRepository } from '../repositories/content-report.repository';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import {
    ContentSource,
    ContentFormat,
    DifficultyLevel,
    AgeRating
} from '@lusilearn/shared-types';

const router = express.Router();

// Validation schemas
const ContentSearchSchema = z.object({
    query: z.string().optional(),
    subject: z.string().optional(),
    difficulty: z.nativeEnum(DifficultyLevel).optional(),
    format: z.nativeEnum(ContentFormat).optional(),
    source: z.nativeEnum(ContentSource).optional(),
    ageRating: z.nativeEnum(AgeRating).optional(),
    duration: z.object({
        min: z.number().optional(),
        max: z.number().optional()
    }).optional(),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20)
});

const BookmarkSchema = z.object({
    tags: z.array(z.string()).default([]),
    notes: z.string().optional()
});

const UpdateBookmarkSchema = z.object({
    tags: z.array(z.string()).optional(),
    notes: z.string().optional()
});

const ContentInteractionSchema = z.object({
    contentId: z.string().uuid(),
    interactionType: z.enum(['view', 'complete', 'bookmark', 'rate', 'share', 'report']),
    duration: z.number().int().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    timestamp: z.string().datetime()
});

const ContentRatingSchema = z.object({
    rating: z.number().min(1).max(5)
});

const ContentReportSchema = z.object({
    reason: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high']).default('medium')
});

// Initialize services - will be set up when routes are created
let contentService: ContentService;
let contentRepository: ContentRepository;
let contentReportRepository: ContentReportRepository;

export function createContentRoutes(pool: Pool): express.Router {
    contentRepository = new ContentRepository(pool);
    contentReportRepository = new ContentReportRepository(pool);
    contentService = new ContentService(contentRepository, contentReportRepository);

    /**
     * POST /api/v1/content/search
     * Search for content with filters
     */
    router.post('/search', async (req, res, next) => {
        try {
            const validatedData = ContentSearchSchema.parse(req.body);

            const searchResult = await contentService.searchContent({
                query: validatedData.query,
                subject: validatedData.subject,
                difficulty: validatedData.difficulty,
                format: validatedData.format,
                source: validatedData.source,
                ageRating: validatedData.ageRating,
                duration: validatedData.duration,
                page: validatedData.page,
                limit: validatedData.limit
            });

            // Get available filters for the frontend
            const filters = await contentRepository.getAvailableFilters();

            res.json({
                success: true,
                data: {
                    items: searchResult.items,
                    total: searchResult.total,
                    page: validatedData.page,
                    totalPages: Math.ceil(searchResult.total / validatedData.limit),
                    filters
                }
            });
        } catch (error) {
            logger.error('Error searching content:', error);
            next(error);
        }
    });

    /**
     * GET /api/v1/content/recommendations
     * Get personalized content recommendations
     */
    router.get('/recommendations', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ValidationError('User not authenticated');
            }

            const { subject, limit = 10 } = req.query;

            const recommendations = await contentService.getRecommendations(userId, {
                subject: subject as string,
                limit: parseInt(limit as string)
            });

            res.json({
                success: true,
                data: recommendations
            });
        } catch (error) {
            logger.error('Error getting content recommendations:', error);
            next(error);
        }
    });

    /**
     * GET /api/v1/content/:contentId
     * Get content by ID
     */
    router.get('/:contentId', async (req, res, next) => {
        try {
            const { contentId } = req.params;
            const content = await contentService.getContentById(contentId);

            res.json({
                success: true,
                data: content
            });
        } catch (error) {
            logger.error('Error getting content by ID:', error);
            next(error);
        }
    });

    /**
     * POST /api/v1/content/:contentId/rate
     * Rate content
     */
    router.post('/:contentId/rate', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ValidationError('User not authenticated');
            }

            const { contentId } = req.params;
            const validatedData = ContentRatingSchema.parse(req.body);

            await contentRepository.rateContent(contentId, userId, validatedData.rating);

            res.json({
                success: true,
                message: 'Content rated successfully'
            });
        } catch (error) {
            logger.error('Error rating content:', error);
            next(error);
        }
    });

    /**
     * POST /api/v1/content/:contentId/report
     * Report content
     */
    router.post('/:contentId/report', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new ValidationError('User not authenticated');
            }

            const { contentId } = req.params;
            const validatedData = ContentReportSchema.parse(req.body);

            await contentService.reportContent({
                contentId,
                userId,
                reason: validatedData.reason,
                description: validatedData.description,
                severity: validatedData.severity
            });

            res.json({
                success: true,
                message: 'Content reported successfully'
            });
        } catch (error) {
            logger.error('Error reporting content:', error);
            next(error);
        }
    });

    /**
     * GET /api/v1/users/:userId/bookmarks
     * Get user's bookmarked content
     */
    router.get('/users/:userId/bookmarks', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const requestedUserId = req.params.userId;
            const currentUserId = req.user?.id;

            // Users can only access their own bookmarks
            if (requestedUserId !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const bookmarks = await contentRepository.getUserBookmarks(requestedUserId);

            res.json({
                success: true,
                data: bookmarks
            });
        } catch (error) {
            logger.error('Error getting user bookmarks:', error);
            next(error);
        }
    });

    /**
     * POST /api/v1/users/:userId/bookmarks/:contentId
     * Bookmark content
     */
    router.post('/users/:userId/bookmarks/:contentId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const requestedUserId = req.params.userId;
            const currentUserId = req.user?.id;
            const { contentId } = req.params;

            // Users can only manage their own bookmarks
            if (requestedUserId !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const validatedData = BookmarkSchema.parse(req.body);

            const bookmark = await contentRepository.createBookmark({
                userId: requestedUserId,
                contentId,
                tags: validatedData.tags,
                notes: validatedData.notes
            });

            res.json({
                success: true,
                data: bookmark,
                message: 'Content bookmarked successfully'
            });
        } catch (error) {
            logger.error('Error bookmarking content:', error);
            next(error);
        }
    });

    /**
     * PUT /api/v1/bookmarks/:bookmarkId
     * Update bookmark
     */
    router.put('/bookmarks/:bookmarkId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const currentUserId = req.user?.id;
            const { bookmarkId } = req.params;

            // Verify bookmark ownership
            const bookmark = await contentRepository.getBookmarkById(bookmarkId);
            if (!bookmark) {
                throw new NotFoundError('Bookmark not found');
            }

            if (bookmark.userId !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const validatedData = UpdateBookmarkSchema.parse(req.body);

            const updatedBookmark = await contentRepository.updateBookmark(bookmarkId, validatedData);

            res.json({
                success: true,
                data: updatedBookmark,
                message: 'Bookmark updated successfully'
            });
        } catch (error) {
            logger.error('Error updating bookmark:', error);
            next(error);
        }
    });

    /**
     * DELETE /api/v1/bookmarks/:bookmarkId
     * Remove bookmark
     */
    router.delete('/bookmarks/:bookmarkId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const currentUserId = req.user?.id;
            const { bookmarkId } = req.params;

            // Verify bookmark ownership
            const bookmark = await contentRepository.getBookmarkById(bookmarkId);
            if (!bookmark) {
                throw new NotFoundError('Bookmark not found');
            }

            if (bookmark.userId !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            await contentRepository.deleteBookmark(bookmarkId);

            res.json({
                success: true,
                message: 'Bookmark removed successfully'
            });
        } catch (error) {
            logger.error('Error removing bookmark:', error);
            next(error);
        }
    });

    /**
     * POST /api/v1/users/:userId/interactions
     * Track content interaction
     */
    router.post('/users/:userId/interactions', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
        try {
            const requestedUserId = req.params.userId;
            const currentUserId = req.user?.id;

            // Users can only track their own interactions
            if (requestedUserId !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const validatedData = ContentInteractionSchema.parse(req.body);

            const interaction = await contentRepository.createInteraction({
                userId: requestedUserId,
                contentId: validatedData.contentId,
                interactionType: validatedData.interactionType,
                duration: validatedData.duration,
                progress: validatedData.progress,
                rating: validatedData.rating,
                timestamp: new Date(validatedData.timestamp)
            });

            res.json({
                success: true,
                data: interaction,
                message: 'Interaction tracked successfully'
            });
        } catch (error) {
            logger.error('Error tracking content interaction:', error);
            next(error);
        }
    });

    /**
     * GET /api/v1/content/trending
     * Get trending content
     */
    router.get('/trending', async (req, res, next) => {
        try {
            const { limit = 20 } = req.query;
            const trendingContent = await contentService.getTopRatedContent(parseInt(limit as string));

            res.json({
                success: true,
                data: trendingContent
            });
        } catch (error) {
            logger.error('Error getting trending content:', error);
            next(error);
        }
    });

    return router;
}

export { router as contentRouter };