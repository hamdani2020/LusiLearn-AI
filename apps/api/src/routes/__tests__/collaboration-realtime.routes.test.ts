import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createCollaborationRoutes } from '../collaboration.routes';
import { authenticateToken } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../middleware/auth');
jest.mock('../../utils/logger');
jest.mock('../../services/collaboration.service');

describe('Collaboration Real-time Routes', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<Pool>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock database pool
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock authentication middleware
    (authenticateToken as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'test-user-id' };
      next();
    });

    // Setup routes
    app.use('/api/v1/collaboration', createCollaborationRoutes(mockDb));
  });

  describe('POST /api/v1/collaboration/sessions', () => {
    it('should create a new collaboration session', async () => {
      // Mock database response
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          session_id: 'session_123',
          group_id: null,
          topic: 'Test Session',
          start_time: new Date(),
        }]
      });

      const sessionData = {
        topic: 'Test Session',
        participants: ['user1', 'user2'],
        duration: 60
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.topic).toBe('Test Session');
      expect(response.body.data.sessionId).toBeDefined();
      expect(response.body.data.websocketUrl).toContain('ws://');
    });

    it('should validate session data', async () => {
      const invalidSessionData = {
        topic: '', // Invalid: empty topic
        participants: [], // Invalid: no participants
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .send(invalidSessionData)
        .expect(400);

      expect(response.body.error).toBe('Invalid session data');
      expect(response.body.details).toBeDefined();
    });

    it('should require authentication', async () => {
      // Mock unauthenticated request
      (authenticateToken as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const sessionData = {
        topic: 'Test Session',
        participants: ['user1', 'user2']
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .send(sessionData)
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });
  });

  describe('GET /api/v1/collaboration/sessions/:sessionId/progress', () => {
    it('should get progress updates for a session', async () => {
      const mockProgressUpdates = [
        {
          user_id: 'user1',
          progress: 75,
          content_id: 'content123',
          milestone: 'Completed Chapter 1',
          timestamp: new Date()
        },
        {
          user_id: 'user2',
          progress: 60,
          content_id: 'content124',
          milestone: 'Started Chapter 2',
          timestamp: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockProgressUpdates
      });

      const response = await request(app)
        .get('/api/v1/collaboration/sessions/session123/progress')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('session123');
      expect(response.body.data.progressUpdates).toHaveLength(2);
      expect(response.body.data.progressUpdates[0].userId).toBe('user1');
      expect(response.body.data.progressUpdates[0].progress).toBe(75);
    });

    it('should require authentication', async () => {
      (authenticateToken as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = null;
        next();
      });

      const response = await request(app)
        .get('/api/v1/collaboration/sessions/session123/progress')
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });
  });

  describe('GET /api/v1/collaboration/sessions/:sessionId/files', () => {
    it('should get shared files for a session', async () => {
      const mockSharedFiles = [
        {
          file_id: 'file1',
          file_name: 'document.pdf',
          file_url: 'https://example.com/file1.pdf',
          file_size: 1024000,
          file_type: 'application/pdf',
          uploaded_by: 'user1',
          timestamp: new Date()
        },
        {
          file_id: 'file2',
          file_name: 'code.js',
          file_url: 'https://example.com/file2.js',
          file_size: 2048,
          file_type: 'text/javascript',
          uploaded_by: 'user2',
          timestamp: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockSharedFiles
      });

      const response = await request(app)
        .get('/api/v1/collaboration/sessions/session123/files')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('session123');
      expect(response.body.data.sharedFiles).toHaveLength(2);
      expect(response.body.data.sharedFiles[0].name).toBe('document.pdf');
      expect(response.body.data.sharedFiles[1].type).toBe('text/javascript');
    });
  });

  describe('POST /api/v1/collaboration/sessions/:sessionId/end', () => {
    it('should end a collaboration session', async () => {
      const mockSessionData = {
        session_id: 'session123',
        end_time: new Date()
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockSessionData]
      });

      const endData = {
        outcomes: ['Completed learning objectives', 'Good collaboration'],
        satisfaction: 4,
        feedback: 'Great session!'
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions/session123/end')
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('session123');
      expect(response.body.data.endTime).toBeDefined();
      expect(response.body.data.message).toBe('Session ended successfully');
    });

    it('should validate end session data', async () => {
      const invalidEndData = {
        satisfaction: 6, // Invalid: out of range (1-5)
        feedback: 'x'.repeat(1001) // Invalid: too long
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions/session123/end')
        .send(invalidEndData)
        .expect(400);

      expect(response.body.error).toBe('Invalid end session data');
      expect(response.body.details).toBeDefined();
    });

    it('should handle session not found', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [] // No session found
      });

      const endData = {
        outcomes: ['Test outcome'],
        satisfaction: 4
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions/nonexistent/end')
        .send(endData)
        .expect(404);

      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/v1/collaboration/sessions/session123/progress')
        .expect(500);

      expect(response.body.error).toBe('Failed to get session progress');
      expect(response.body.message).toBe('Database connection failed');
    });
  });
});