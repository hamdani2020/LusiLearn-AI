import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { contentRecommendationsRouter } from '../../routes/content-recommendations.routes';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { AgeRange, EducationLevel, LearningStyle, ContentType } from '@lusilearn/shared-types';
import { AuthService } from '../../services/auth.service';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock external services
jest.mock('../../services/external/youtube.service', () => ({
  YouTubeService: jest.fn().mockImplementation(() => ({
    searchVideos: jest.fn().mockResolvedValue([
      {
        id: 'test-video-1',
        title: 'JavaScript Variables Tutorial',
        description: 'Learn about JavaScript variables and data types',
        duration: 900, // 15 minutes in seconds
        channelTitle: 'freeCodeCamp.org',
        thumbnailUrl: 'https://img.youtube.com/vi/test-video-1/maxresdefault.jpg'
      },
      {
        id: 'test-video-2',
        title: 'JavaScript Functions Explained',
        description: 'Master JavaScript functions with practical examples',
        duration: 1200, // 20 minutes in seconds
        channelTitle: 'Traversy Media',
        thumbnailUrl: 'https://img.youtube.com/vi/test-video-2/maxresdefault.jpg'
      }
    ])
  }))
}));

describe('Content Recommendations API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;
  let authService: AuthService;

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

    // Get database connection
    testDb = db.getPool();
    
    // Setup routes
    app.use('/api/v1/content', contentRecommendationsRouter);
    app.use(errorHandler);

    // Initialize auth service
    authService = new AuthService(testDb);

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
    
    // Create test user and get auth token
    const userData = createTestUserData();
    testUser = await createTestUser(userData);
    authToken = await generateAuthToken(testUser.id);
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%content.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
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
  });

  const createTestUser = async (userData: any) => {
    const hashedPassword = await authService.hashPassword(userData.password);
    
    const query = `
      INSERT INTO users (email, password_hash, username, demographics, learning_preferences, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, email, username, demographics, learning_preferences, created_at, updated_at
    `;

    const result = await testDb.query(query, [
      userData.email,
      hashedPassword,
      userData.username,
      JSON.stringify(userData.demographics),
      JSON.stringify(userData.learningPreferences)
    ]);

    return result.rows[0];
  };

  const generateAuthToken = async (userId: string): Promise<string> => {
    return authService.generateAccessToken(userId);
  };

  describe('Content Recommendations by Objective', () => {
    it('should get content recommendations for a valid objective', async () => {
      const objectiveId = 'obj-1'; // JavaScript Variables

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify recommendation structure
      const recommendation = response.body.data[0];
      expect(recommendation).toHaveProperty('id');
      expect(recommendation).toHaveProperty('title');
      expect(recommendation).toHaveProperty('description');
      expect(recommendation).toHaveProperty('url');
      expect(recommendation).toHaveProperty('type');
      expect(recommendation).toHaveProperty('duration');
      expect(recommendation).toHaveProperty('difficulty');
      expect(recommendation).toHaveProperty('source');

      // Verify content types are valid
      const validTypes = ['video', 'article', 'exercise', 'quiz'];
      expect(validTypes).toContain(recommendation.type);
    });

    it('should get recommendations for JavaScript functions objective', async () => {
      const objectiveId = 'obj-2'; // JavaScript Functions

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should include YouTube videos from mocked service
      const videoRecommendations = response.body.data.filter((rec: any) => rec.type === 'video');
      expect(videoRecommendations.length).toBeGreaterThan(0);

      // Check for expected YouTube content
      const youtubeRec = videoRecommendations.find((rec: any) => rec.source.includes('YouTube'));
      expect(youtubeRec).toBeDefined();
      expect(youtubeRec.title).toContain('JavaScript');
    });

    it('should handle unknown objective IDs gracefully', async () => {
      const objectiveId = 'unknown-objective';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should still return fallback content
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should require authentication for recommendations', async () => {
      const objectiveId = 'obj-1';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject invalid auth tokens', async () => {
      const objectiveId = 'obj-1';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('Content Search', () => {
    it('should search content with query parameter', async () => {
      const searchQuery = 'javascript variables';

      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ query: searchQuery })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Results should be relevant to the search query
      const firstResult = response.body.data[0];
      const titleAndDesc = (firstResult.title + ' ' + firstResult.description).toLowerCase();
      expect(titleAndDesc).toMatch(/javascript|variables/);
    });

    it('should filter content by type', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          query: 'javascript',
          type: 'video'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // All results should be videos
      response.body.data.forEach((item: any) => {
        expect(item.type).toBe('video');
      });
    });

    it('should filter content by difficulty', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          query: 'javascript',
          difficulty: 'beginner'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // All results should be beginner level
      response.body.data.forEach((item: any) => {
        expect(item.difficulty).toBe('beginner');
      });
    });

    it('should filter content by source', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          query: 'javascript',
          source: 'youtube'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // All results should be from YouTube
      response.body.data.forEach((item: any) => {
        expect(item.source.toLowerCase()).toContain('youtube');
      });
    });

    it('should combine multiple search filters', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          query: 'javascript',
          type: 'video',
          difficulty: 'beginner',
          source: 'youtube'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Results should match all filters
      response.body.data.forEach((item: any) => {
        expect(item.type).toBe('video');
        expect(item.difficulty).toBe('beginner');
        expect(item.source.toLowerCase()).toContain('youtube');
      });
    });

    it('should return empty results for very specific searches', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ 
          query: 'very-specific-nonexistent-topic-12345',
          type: 'quiz'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });

    it('should require authentication for search', async () => {
      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ query: 'javascript' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });
  });

  describe('Content Quality and Diversity', () => {
    it('should return diverse content types in recommendations', async () => {
      const objectiveId = 'js-1'; // Should return mixed content types

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(2);

      // Should have multiple content types
      const contentTypes = new Set(response.body.data.map((item: any) => item.type));
      expect(contentTypes.size).toBeGreaterThan(1);

      // Should include at least videos and articles
      expect(contentTypes.has('video')).toBe(true);
      expect([...contentTypes].some(type => ['article', 'exercise'].includes(type))).toBe(true);
    });

    it('should prioritize educational sources', async () => {
      const objectiveId = 'js-2';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should include educational sources
      const sources = response.body.data.map((item: any) => item.source);
      const hasEducationalSource = sources.some((source: string) => 
        source.includes('MDN') || 
        source.includes('freeCodeCamp') || 
        source.includes('W3Schools') ||
        source.includes('CodePen')
      );
      expect(hasEducationalSource).toBe(true);
    });

    it('should include appropriate duration ranges', async () => {
      const objectiveId = 'js-3';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // All content should have reasonable durations
      response.body.data.forEach((item: any) => {
        expect(item.duration).toBeGreaterThan(0);
        expect(item.duration).toBeLessThan(120); // Less than 2 hours
      });

      // Should have a mix of short and medium duration content
      const durations = response.body.data.map((item: any) => item.duration);
      const hasShortContent = durations.some((d: number) => d <= 20);
      const hasMediumContent = durations.some((d: number) => d > 20 && d <= 45);
      expect(hasShortContent || hasMediumContent).toBe(true);
    });
  });

  describe('AI Service Integration', () => {
    beforeEach(() => {
      // Mock fetch for AI service calls
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle AI service success', async () => {
      const mockAIResponse = {
        recommendations: [
          {
            content_id: 'ai-rec-1',
            title: 'AI Recommended JavaScript Tutorial',
            description: 'AI-curated content for JavaScript learning',
            url: 'https://example.com/ai-tutorial',
            content_type: 'video',
            estimated_duration: 25,
            difficulty_level: 'intermediate',
            source: 'AI Curated'
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAIResponse
      });

      const objectiveId = 'js-4';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should include AI recommendations
      const aiRec = response.body.data.find((item: any) => item.source === 'AI Curated');
      expect(aiRec).toBeDefined();
      expect(aiRec.title).toBe('AI Recommended JavaScript Tutorial');
    });

    it('should handle AI service failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      const objectiveId = 'js-1';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should still return content from other sources
      const sources = response.body.data.map((item: any) => item.source);
      expect(sources.some((source: string) => source.includes('YouTube'))).toBe(true);
    });

    it('should handle AI service timeout', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000)
        )
      );

      const objectiveId = 'js-2';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Should fallback to other sources
      expect(response.body.data.some((item: any) => item.source !== 'AI Curated')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/content/recommendations/')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Should return 404 for missing objective ID
    });

    it('should handle database connection issues', async () => {
      // This would require mocking the database connection
      // For now, we'll test that the endpoint doesn't crash
      const objectiveId = 'obj-1';

      const response = await request(app)
        .get(`/api/v1/content/recommendations/${objectiveId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle special characters in search queries', async () => {
      const specialQuery = 'javascript & functions || variables';

      const response = await request(app)
        .get('/api/v1/content/search')
        .query({ query: specialQuery })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});