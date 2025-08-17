import { Pool } from 'pg';
import { db } from '../../database/connection';

// Global test setup for integration tests
export class IntegrationTestSetup {
  private static instance: IntegrationTestSetup;
  private testDb: Pool;

  private constructor() {
    this.testDb = db.getPool();
  }

  public static getInstance(): IntegrationTestSetup {
    if (!IntegrationTestSetup.instance) {
      IntegrationTestSetup.instance = new IntegrationTestSetup();
    }
    return IntegrationTestSetup.instance;
  }

  public async setupDatabase(): Promise<void> {
    // Ensure test database is ready
    try {
      await this.testDb.query('SELECT 1');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  public async cleanupDatabase(): Promise<void> {
    // Clean up all test data
    try {
      // Clean up in reverse dependency order
      await this.testDb.query('DELETE FROM collaboration_progress_updates WHERE session_id LIKE $1', ['%test%']);
      await this.testDb.query('DELETE FROM collaboration_shared_files WHERE session_id LIKE $1', ['%test%']);
      await this.testDb.query('DELETE FROM collaboration_session_data WHERE session_id LIKE $1', ['%test%']);
      await this.testDb.query('DELETE FROM collaboration_activities WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await this.testDb.query('DELETE FROM study_group_participants WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await this.testDb.query('DELETE FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.testDb.query('DELETE FROM peer_matches WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.testDb.query('DELETE FROM content_reports WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.testDb.query('DELETE FROM learning_path_shares WHERE learning_path_id IN (SELECT id FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await this.testDb.query('DELETE FROM learning_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.testDb.query('DELETE FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.testDb.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Cleanup warning:', error);
    }
  }

  public async createTestUser(userData: any): Promise<{ user: any; token: string }> {
    // This would typically use the actual auth service
    // For now, return mock data
    return {
      user: {
        id: 'test-user-id',
        email: userData.email,
        username: userData.username,
        ...userData
      },
      token: 'mock-jwt-token'
    };
  }

  public getDatabase(): Pool {
    return this.testDb;
  }
}

// Global setup and teardown
beforeAll(async () => {
  const setup = IntegrationTestSetup.getInstance();
  await setup.setupDatabase();
});

afterAll(async () => {
  const setup = IntegrationTestSetup.getInstance();
  await setup.cleanupDatabase();
});

export default IntegrationTestSetup;