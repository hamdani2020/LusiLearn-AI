import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
    LearningPath,
    LearningGoal,
    LearningObjective,
    Milestone,
    PathAdaptation,
    DifficultyLevel
} from '@lusilearn/shared-types';

export interface CreateLearningPathRequest {
    userId: string;
    subject: string;
    goals: LearningGoal[];
    currentLevel: DifficultyLevel;
    objectives: LearningObjective[];
    milestones: Milestone[];
}

export interface UpdateLearningPathRequest {
    subject?: string;
    currentLevel?: DifficultyLevel;
    objectives?: LearningObjective[];
    milestones?: Milestone[];
    progress?: {
        completedObjectives?: string[];
        currentMilestone?: string;
        overallProgress?: number;
        estimatedCompletion?: Date;
    };
}

export interface ShareLearningPathRequest {
    sharedWithUserId: string;
    permissions: 'view' | 'collaborate';
    message?: string;
}

export class LearningPathRepository {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    async create(pathData: CreateLearningPathRequest): Promise<LearningPath> {
        const client = await this.pool.connect();
        try {
            const query = `
        INSERT INTO learning_paths (
          user_id, subject, current_level, objectives, milestones,
          progress, adaptation_history, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()
        ) RETURNING *
      `;

            const initialProgress = {
                completedObjectives: [],
                currentMilestone: pathData.milestones.length > 0 ? pathData.milestones[0].id : '',
                overallProgress: 0,
                estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            };

            const values = [
                pathData.userId,
                pathData.subject,
                pathData.currentLevel,
                JSON.stringify(pathData.objectives),
                JSON.stringify(pathData.milestones),
                JSON.stringify(initialProgress),
                JSON.stringify([]), // empty adaptation history initially
            ];

            const result = await client.query(query, values);
            return this.mapRowToLearningPath(result.rows[0]);
        } catch (error) {
            logger.error('Error creating learning path:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async findById(id: string): Promise<LearningPath | null> {
        const client = await this.pool.connect();
        try {
            const query = 'SELECT * FROM learning_paths WHERE id = $1 AND is_active = true';
            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToLearningPath(result.rows[0]);
        } catch (error) {
            logger.error('Error finding learning path by ID:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async findByUserId(userId: string): Promise<LearningPath[]> {
        const client = await this.pool.connect();
        try {
            const query = `
        SELECT * FROM learning_paths 
        WHERE user_id = $1 AND is_active = true 
        ORDER BY updated_at DESC
      `;
            const result = await client.query(query, [userId]);

            return result.rows.map(row => this.mapRowToLearningPath(row));
        } catch (error) {
            logger.error('Error finding learning paths by user ID:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async findByUserIdAndSubject(userId: string, subject: string): Promise<LearningPath | null> {
        const client = await this.pool.connect();
        try {
            const query = `
        SELECT * FROM learning_paths 
        WHERE user_id = $1 AND subject = $2 AND is_active = true 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
            const result = await client.query(query, [userId, subject]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToLearningPath(result.rows[0]);
        } catch (error) {
            logger.error('Error finding learning path by user and subject:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async update(id: string, updates: UpdateLearningPathRequest): Promise<LearningPath | null> {
        const client = await this.pool.connect();
        try {
            const updateFields: string[] = [];
            const queryParams: any[] = [];
            let paramIndex = 1;

            if (updates.subject !== undefined) {
                updateFields.push(`subject = $${paramIndex}`);
                queryParams.push(updates.subject);
                paramIndex++;
            }

            if (updates.currentLevel !== undefined) {
                updateFields.push(`current_level = $${paramIndex}`);
                queryParams.push(updates.currentLevel);
                paramIndex++;
            }

            if (updates.objectives !== undefined) {
                updateFields.push(`objectives = $${paramIndex}`);
                queryParams.push(JSON.stringify(updates.objectives));
                paramIndex++;
            }

            if (updates.milestones !== undefined) {
                updateFields.push(`milestones = $${paramIndex}`);
                queryParams.push(JSON.stringify(updates.milestones));
                paramIndex++;
            }

            if (updates.progress !== undefined) {
                // Get current progress and merge with updates
                const currentPath = await this.findById(id);
                if (currentPath) {
                    const updatedProgress = { ...currentPath.progress, ...updates.progress };
                    updateFields.push(`progress = $${paramIndex}`);
                    queryParams.push(JSON.stringify(updatedProgress));
                    paramIndex++;
                }
            }

            if (updateFields.length === 0) {
                return await this.findById(id);
            }

            updateFields.push(`updated_at = NOW()`);
            queryParams.push(id);

            const query = `
        UPDATE learning_paths 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND is_active = true
        RETURNING *
      `;

            const result = await client.query(query, queryParams);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToLearningPath(result.rows[0]);
        } catch (error) {
            logger.error('Error updating learning path:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async addAdaptation(id: string, adaptation: PathAdaptation): Promise<LearningPath | null> {
        const client = await this.pool.connect();
        try {
            // Get current adaptation history
            const currentPath = await this.findById(id);
            if (!currentPath) {
                return null;
            }

            const updatedHistory = [...currentPath.adaptationHistory, adaptation];

            const query = `
        UPDATE learning_paths 
        SET adaptation_history = $1, updated_at = NOW()
        WHERE id = $2 AND is_active = true
        RETURNING *
      `;

            const result = await client.query(query, [JSON.stringify(updatedHistory), id]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToLearningPath(result.rows[0]);
        } catch (error) {
            logger.error('Error adding adaptation to learning path:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async sharePath(pathId: string, shareData: ShareLearningPathRequest): Promise<void> {
        const client = await this.pool.connect();
        try {
            const query = `
        INSERT INTO learning_path_shares (
          path_id, shared_with_user_id, permissions, message, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (path_id, shared_with_user_id) 
        DO UPDATE SET permissions = $3, message = $4, updated_at = NOW()
      `;

            await client.query(query, [
                pathId,
                shareData.sharedWithUserId,
                shareData.permissions,
                shareData.message
            ]);
        } catch (error) {
            logger.error('Error sharing learning path:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async getSharedPaths(userId: string): Promise<LearningPath[]> {
        const client = await this.pool.connect();
        try {
            const query = `
        SELECT lp.* FROM learning_paths lp
        INNER JOIN learning_path_shares lps ON lp.id = lps.path_id
        WHERE lps.shared_with_user_id = $1 AND lp.is_active = true
        ORDER BY lps.created_at DESC
      `;

            const result = await client.query(query, [userId]);
            return result.rows.map(row => this.mapRowToLearningPath(row));
        } catch (error) {
            logger.error('Error getting shared learning paths:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    async deactivate(id: string): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            const query = 'UPDATE learning_paths SET is_active = false, updated_at = NOW() WHERE id = $1';
            const result = await client.query(query, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            logger.error('Error deactivating learning path:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    private mapRowToLearningPath(row: any): LearningPath {
        return {
            id: row.id,
            userId: row.user_id,
            subject: row.subject,
            currentLevel: row.current_level,
            objectives: this.safeParseArray(row.objectives),
            milestones: this.safeParseArray(row.milestones),
            progress: this.safeParseObject(row.progress, {
                completedObjectives: [],
                currentMilestone: '',
                overallProgress: 0,
                estimatedCompletion: new Date()
            }),
            adaptationHistory: this.safeParseArray(row.adaptation_history),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }

    // Utility functions for safe JSON parsing
    private safeParseArray(input: any): any[] {
        try {
            if (!input || input === '') return [];
            return Array.isArray(input) ? input : JSON.parse(input);
        } catch (error) {
            logger.warn('Failed to parse JSON array, using empty array as fallback', { input, error });
            return [];
        }
    }

    private safeParseObject<T = any>(input: any, fallback: T): T {
        try {
            if (!input || input === '') return fallback;
            return typeof input === 'string' ? JSON.parse(input) : input;
        } catch (error) {
            logger.warn('Failed to parse JSON object, using fallback', { input, error, fallback });
            return fallback;
        }
    }
}