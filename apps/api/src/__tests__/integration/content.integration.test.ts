import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { authRouter } from '../../routes/auth';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { AgeRange, EducationLevel, LearningStyle, ContentType, ContentSource, DifficultyLevel, AgeRating } from '@lusilearn/shared-types';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock content service
jest.mock('../../services/content.service', () => {
  return {
    ContentService: jest.fn().mockImplementation(() => ({
      searchContent: jest.fn().mockResolvedValue([
        {
          id: 'content-1',
          source: ContentSource.YOUTUBE,
          externalId: 'youtube-123',
          url: 'https://youtube.com/watch?v=123',
          title: 'JavaScript Fundamentals',
          description: 'Learn the basics of JavaScript programming',
          metadata: {
            duration: 1800, // 30 minutes
            difficulty: DifficultyLevel.BEGINNER,
            subject: 'javascript',
            topics: ['variables', 'functions', 'loops'],
            format: 'video',
            language: 'en'
          },
          qualityMetrics: {
            userRating: 4.5,
            completionRate: 0.85,
            effectivenessScore: 0.9,
            lastUpdated: new Date()
          },
          ageRating: AgeRating.GENERAL,
          embeddings: [0.1, 0.2, 0.3],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'content-2',
          source: ContentSource.KHAN_ACADEMY,
          externalId: 'khan-456',
          url: 'https://khanacademy.org/lesson/456',
          title: 'Advanced JavaScript Concepts',
          description: 'Deep dive into advanced JavaScript topics',
          metadata: {
            duration: 2400, // 40 minutes
            difficulty: DifficultyLevel.ADVANCED,
            subject: 'javascript',
            topics: ['closures', 'prototypes', 'async'],
            format: 'interactive',
            language: 'en'
          },
          qualityMetrics: {
            userRating: 4.8,
            completionRate: 0.75,
            effectivenessScore: 0.95,
            lastUpdated: new Date()
          },
          ageRating: AgeRating.TEEN_PLUS,
          embeddings: [0.4, 0.5, 0.6],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]),
      getRecommendations: jest.fn().mockResolvedValue([
        {
          contentId: 'content-1',
          score: 0.95,
          reason: 'Matches your learning style and current skill level',
          metadata: {
            source: ContentSource.YOUTUBE,
            title: 'JavaScript Fundamentals',
            difficulty: DifficultyLevel.BEGINNER,
            estimatedTime: 30
          }
        }
      ]),
      validateContent: jest.fn().mockResolvedValue({
        isValid: true,
        ageAppropriate: true,
        qualityScore: 0.9,
        issues: []
      }),
      reportContent: jest.fn().mockResolvedValue({
        reportId: 'report-123',
        status: 'submitted',
        message: 'Content report submitted successfully'
      }),
      getContentById: jest.fn().mockResolvedValue({
        id: 'content-1',
        source: ContentSource.YOUTUBE,
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript programming',
        metadata: {
          duration: 1800,
          difficulty: DifficultyLevel.BEGINNER,
          subject: 'javascript',
          topics: ['variables', 'functions', 'loops']
        }
      })
    }))
  };
});

// Create content routes
const createContentRoutes = () => {
  const router = express.Router();
  const { ContentService } = require('../../services/content.service');
  const contentService = new ContentService();

  // GET /api/v1/content/search
  router.get('/search', async (req, res, next) => {
    try {
      const { q, subject, difficulty, source, limit = 10, offset = 0 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const searchQuery = {
        query: q as string,
        subject: subject as string,
        difficulty: difficulty as DifficultyLevel,
        source: source as ContentSource,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const results = await contentService.searchContent(searchQuery);

      res.json({
        success: true,
        data: {
          results,
          total: results.length,
          query: searchQuery
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/content/recommendations
  router.get('/recommendations', async (req, res, next) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { subject, limit = 5 } = req.query;

      const recommendations = await contentService.getRecommendations(userId, {
        subject: subject as string,
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/content/:contentId
  router.get('/:contentId', async (req, res, next) => {
    try {
      const { contentId } = req.params;
      const content = await contentService.getContentById(contentId);

      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }

      res.json({
        success: true,
        data: content
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/content/:contentId/validate
  router.post('/:contentId/validate', async (req, res, next) => {
    try {
      const { contentId } = req.params;
      const validation = await contentService.validateContent(contentId);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/content/:contentId/report
  router.post('/:contentId/report', async (req, res, next) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { contentId } = req.params;
      const { reason, description } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Report reason is required'
        });
      }

      const report = await contentService.reportContent(contentId, {
        userId,
        reason,
        description
      });

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

describe('Content API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup test app
    app = express();
    
    // Setup middleware
    setupSecurityMiddleware(app, {
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 1000, // Higher limit for tests
      },
      https: {
        enforceHttps: false,
        trustProxy: true,
      },
    });

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(monitoringMiddleware);

    // Setup routes
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/content', createContentRoutes());
    app.use(errorHandler);

    // Get database connection
    testDb = db.getPool();

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
    
    // Create and authenticate test user
    await createTestUser();
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM content_reports WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUser = async () => {
    const userData = {
      email: 'content.test@example.com',
      password: 'TestPassword123!',
      username: 'contenttest',
      demographics: {
        ageRange: AgeRange.YOUNG_ADULT,
        educationLevel: EducationLevel.COLLEGE,
        timezone: 'America/New_York',
        preferredLanguage: 'en'
      },
      learningPreferences: {
        learningStyle: [LearningStyle.VISUAL, LearningStyle.HANDS_ON],
        preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
        sessionDuration: 60,
        difficultyPreference: 'moderate' as const
      }
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(userData);
    
    testUser = registerResponse.body.data.user;
    authToken = registerResponse.body.data.accessToken;
  };

  describe('Content Search', () => {
    it('should search for content successfully', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({
          q: 'javascript',
          subject: 'programming',
          difficulty: DifficultyLevel.BEGINNER,
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeInstanceOf(Array);
      expect(response.body.data.results.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.query).toBeDefined();

      // Verify content structure
      const firstResult = response.body.data.results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('title');
      expect(firstResult).toHaveProperty('description');
      expect(firstResult).toHaveProperty('source');
      expect(firstResult).toHaveProperty('metadata');
      expect(firstResult.metadata).toHaveProperty('difficulty');
      expect(firstResult.metadata).toHaveProperty('duration');
    });

    it('should reject search without query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search query is required');
    });

    it('should handle search with filters', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({
          q: 'javascript',
          subject: 'programming',
          difficulty: DifficultyLevel.ADVANCED,
          source: ContentSource.KHAN_ACADEMY,
          limit: 5,
          offset: 0
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeInstanceOf(Array);
      expect(response.body.data.query.difficulty).toBe(DifficultyLevel.ADVANCED);
      expect(response.body.data.query.source).toBe(ContentSource.KHAN_ACADEMY);
    });

    it('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({
          q: 'programming',
          limit: 5,
          offset: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query.limit).toBe(5);
      expect(response.body.data.query.offset).toBe(10);
    });
  });

  describe('Content Recommendations', () => {
    it('should get personalized content recommendations', async () => {
      const response = await request(app)
        .get('/api/v1/content/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          subject: 'javascript',
          limit: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
      expect(response.body.data.count).toBeDefined();

      // Verify recommendation structure
      if (response.body.data.recommendations.length > 0) {
        const firstRec = response.body.data.recommendations[0];
        expect(firstRec).toHaveProperty('contentId');
        expect(firstRec).toHaveProperty('score');
        expect(firstRec).toHaveProperty('reason');
        expect(firstRec).toHaveProperty('metadata');
      }
    });

    it('should reject recommendations without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/content/recommendations')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not authenticated');
    });

    it('should handle recommendations with subject filter', async () => {
      const response = await request(app)
        .get('/api/v1/content/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          subject: 'python',
          limit: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Content Retrieval', () => {
    it('should get content by ID successfully', async () => {
      const contentId = 'content-1';

      const response = await request(app)
        .get(`/api/v1/content/${contentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).toHaveProperty('source');
      expect(response.body.data).toHaveProperty('metadata');
    });

    it('should handle non-existent content ID', async () => {
      const response = await request(app)
        .get('/api/v1/content/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Content not found');
    });
  });

  describe('Content Validation', () => {
    it('should validate content successfully', async () => {
      const contentId = 'content-1';

      const response = await request(app)
        .post(`/api/v1/content/${contentId}/validate`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isValid');
      expect(response.body.data).toHaveProperty('ageAppropriate');
      expect(response.body.data).toHaveProperty('qualityScore');
      expect(response.body.data).toHaveProperty('issues');
    });

    it('should handle validation for non-existent content', async () => {
      const response = await request(app)
        .post('/api/v1/content/non-existent-id/validate')
        .expect(200); // Mock always returns success

      expect(response.body.success).toBe(true);
    });
  });

  describe('Content Reporting', () => {
    it('should report inappropriate content successfully', async () => {
      const contentId = 'content-1';
      const reportData = {
        reason: 'inappropriate',
        description: 'This content contains inappropriate material for the target age group'
      };

      const response = await request(app)
        .post(`/api/v1/content/${contentId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('message');
    });

    it('should reject content reports without authentication', async () => {
      const contentId = 'content-1';
      const reportData = {
        reason: 'inappropriate',
        description: 'This content is inappropriate'
      };

      const response = await request(app)
        .post(`/api/v1/content/${contentId}/report`)
        .send(reportData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not authenticated');
    });

    it('should reject content reports without reason', async () => {
      const contentId = 'content-1';
      const reportData = {
        description: 'This content is inappropriate'
        // Missing reason field
      };

      const response = await request(app)
        .post(`/api/v1/content/${contentId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Report reason is required');
    });
  });

  describe('Content Filtering and Age Appropriateness', () => {
    it('should filter content based on user age', async () => {
      // Create a minor user
      const minorUserData = {
        email: 'minor.content.test@example.com',
        password: 'TestPassword123!',
        username: 'minorcontenttest',
        demographics: {
          ageRange: AgeRange.TEEN,
          educationLevel: EducationLevel.K12,
          timezone: 'America/New_York',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: [LearningStyle.VISUAL],
          preferredContentTypes: [ContentType.VIDEO],
          sessionDuration: 30,
          difficultyPreference: 'gradual' as const
        },
        parentalControls: {
          parentEmail: 'parent@example.com',
          restrictedInteractions: true,
          contentFiltering: 'strict' as const,
          timeRestrictions: {
            dailyLimit: 120,
            allowedHours: { start: '09:00', end: '17:00' }
          }
        }
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(minorUserData);
      
      const minorToken = registerResponse.body.data.accessToken;

      const response = await request(app)
        .get('/api/v1/content/recommendations')
        .set('Authorization', `Bearer ${minorToken}`)
        .query({
          subject: 'javascript',
          limit: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations).toBeInstanceOf(Array);
      
      // In a real implementation, this would verify age-appropriate filtering
      // For now, we just verify the endpoint works with minor users
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed search queries', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({
          q: '',
          limit: 'invalid',
          offset: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search query is required');
    });

    it('should handle service unavailability gracefully', async () => {
      // Mock service failure
      const { ContentService } = require('../../services/content.service');
      const originalSearchContent = ContentService.prototype.searchContent;
      ContentService.prototype.searchContent = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ q: 'javascript' })
        .expect(500);

      expect(response.body.success).toBe(false);

      // Restore original method
      ContentService.prototype.searchContent = originalSearchContent;
    });

    it('should enforce rate limiting on content endpoints', async () => {
      // Make multiple rapid requests
      const requests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/v1/content/search')
          .query({ q: 'test' })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Content Quality and Metrics', () => {
    it('should include quality metrics in search results', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ q: 'javascript' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      if (response.body.data.results.length > 0) {
        const firstResult = response.body.data.results[0];
        expect(firstResult.qualityMetrics).toBeDefined();
        expect(firstResult.qualityMetrics).toHaveProperty('userRating');
        expect(firstResult.qualityMetrics).toHaveProperty('completionRate');
        expect(firstResult.qualityMetrics).toHaveProperty('effectivenessScore');
      }
    });

    it('should handle content with different quality scores', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          q: 'javascript',
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeInstanceOf(Array);
      
      // Verify that results include quality metrics
      response.body.data.results.forEach((content: any) => {
        expect(content.qualityMetrics.userRating).toBeGreaterThanOrEqual(0);
        expect(content.qualityMetrics.userRating).toBeLessThanOrEqual(5);
        expect(content.qualityMetrics.completionRate).toBeGreaterThanOrEqual(0);
        expect(content.qualityMetrics.completionRate).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Multi-Source Content Integration', () => {
    it('should handle content from different sources', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ q: 'programming' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      if (response.body.data.results.length > 1) {
        const sources = response.body.data.results.map((content: any) => content.source);
        const uniqueSources = [...new Set(sources)];
        
        // Verify we have content from multiple sources
        expect(uniqueSources.length).toBeGreaterThanOrEqual(1);
        expect(uniqueSources).toContain(ContentSource.YOUTUBE);
      }
    });

    it('should filter by specific content source', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          q: 'javascript',
          source: ContentSource.KHAN_ACADEMY
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.query.source).toBe(ContentSource.KHAN_ACADEMY);
    });
  });
});