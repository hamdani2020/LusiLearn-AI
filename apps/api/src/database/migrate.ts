#!/usr/bin/env node

import { execSync } from 'child_process';
import { db } from './connection';
import { logger } from '../utils/logger';

/**
 * Database migration runner and health checker
 */

export class MigrationRunner {
  /**
   * Run all pending migrations
   */
  static async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');
      
      // Check database connection first
      const isHealthy = await db.healthCheck();
      if (!isHealthy) {
        throw new Error('Database connection failed');
      }

      // Run migrations using node-pg-migrate
      execSync('npm run migrate:up', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });

      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Check migration status
   */
  static async getMigrationStatus(): Promise<void> {
    try {
      execSync('npm run migrate:status', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  static async rollbackMigration(): Promise<void> {
    try {
      logger.info('Rolling back last migration...');
      
      execSync('npm run migrate:down', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });

      logger.info('Migration rollback completed');
    } catch (error) {
      logger.error('Migration rollback failed:', error);
      throw error;
    }
  }

  /**
   * Initialize database with seed data
   */
  static async seedDatabase(): Promise<void> {
    try {
      logger.info('Seeding database with initial data...');

      // Insert sample education levels and other enum data if needed
      await db.query(`
        INSERT INTO users (
          email, username, password_hash, demographics, learning_preferences, 
          privacy_settings, is_verified
        ) VALUES (
          'admin@lusilearn.com',
          'admin',
          '$2a$10$example.hash.for.development',
          '{"ageRange": "26-40", "educationLevel": "professional", "timezone": "UTC", "preferredLanguage": "en"}',
          '{"learningStyle": ["visual"], "preferredContentTypes": ["video"], "sessionDuration": 60, "difficultyPreference": "moderate"}',
          '{"profileVisibility": "public", "allowPeerMatching": true, "shareProgressData": true, "allowDataCollection": false}',
          true
        ) ON CONFLICT (email) DO NOTHING
      `);

      logger.info('Database seeding completed');
    } catch (error) {
      logger.error('Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive database health check
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};

    try {
      // Basic connection test
      const connectionHealthy = await db.healthCheck();
      details.connection = connectionHealthy;

      if (!connectionHealthy) {
        return { healthy: false, details };
      }

      // Check if migrations table exists
      const migrationTableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pgmigrations'
        )
      `);
      details.migrationTable = migrationTableExists.rows[0].exists;

      // Check core tables
      const coreTables = ['users', 'learning_paths', 'content_items', 'study_groups'];
      const tableChecks = await Promise.all(
        coreTables.map(async (table) => {
          try {
            const result = await db.query(`SELECT COUNT(*) FROM ${table}`);
            return { [table]: { exists: true, count: parseInt(result.rows[0].count) } };
          } catch (error) {
            return { [table]: { exists: false, error: error instanceof Error ? error.message : String(error) } };
          }
        })
      );

      details.tables = Object.assign({}, ...tableChecks);

      // Check database version
      const versionResult = await db.query('SELECT version()');
      details.version = versionResult.rows[0].version;

      const allHealthy = connectionHealthy && 
        details.migrationTable && 
        Object.values(details.tables).every((table: any) => table.exists);

      return { healthy: allHealthy, details };
    } catch (error) {
      logger.error('Health check failed:', error);
      details.error = error instanceof Error ? error.message : String(error);
      return { healthy: false, details };
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'migrate':
          await MigrationRunner.runMigrations();
          break;
        case 'status':
          await MigrationRunner.getMigrationStatus();
          break;
        case 'rollback':
          await MigrationRunner.rollbackMigration();
          break;
        case 'seed':
          await MigrationRunner.seedDatabase();
          break;
        case 'health':
          const health = await MigrationRunner.healthCheck();
          console.log(JSON.stringify(health, null, 2));
          break;
        default:
          console.log('Usage: npm run db:migrate|status|rollback|seed|health');
          process.exit(1);
      }
    } catch (error) {
      logger.error('Command failed:', error);
      process.exit(1);
    } finally {
      await db.close();
    }
  })();
}

export default MigrationRunner;