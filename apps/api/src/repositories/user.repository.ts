import { PoolClient } from 'pg';
import { db } from '../database/connection';
import { UserProfile } from '@lusilearn/shared-types';
import { logger } from '../utils/logger';

export interface UserWithPassword extends UserProfile {
  passwordHash: string;
  isActive: boolean;
}

export class UserRepository {
  async create(
    userProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>,
    passwordHash: string
  ): Promise<UserProfile> {
    const query = `
      INSERT INTO users (
        email, username, password_hash, demographics, learning_preferences,
        skill_profile, privacy_settings, parental_controls, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, username, demographics, learning_preferences,
                skill_profile, privacy_settings, parental_controls, is_verified,
                created_at, updated_at
    `;

    const values = [
      userProfile.email,
      userProfile.username,
      passwordHash,
      JSON.stringify(userProfile.demographics),
      JSON.stringify(userProfile.learningPreferences),
      JSON.stringify(userProfile.skillProfile),
      JSON.stringify(userProfile.privacySettings),
      userProfile.parentalControls ? JSON.stringify(userProfile.parentalControls) : null,
      userProfile.isVerified
    ];

    try {
      const result = await db.query(query, values);
      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, username, demographics, learning_preferences,
             skill_profile, privacy_settings, parental_controls, is_verified,
             is_active, created_at, updated_at
      FROM users
      WHERE id = $1 AND is_active = true
    `;

    try {
      const result = await db.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    const query = `
      SELECT id, email, username, password_hash, demographics, learning_preferences,
             skill_profile, privacy_settings, parental_controls, is_verified,
             is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    try {
      const result = await db.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error finding user by ID with password:', error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, username, demographics, learning_preferences,
             skill_profile, privacy_settings, parental_controls, is_verified,
             created_at, updated_at
      FROM users
      WHERE email = $1 AND is_active = true
    `;

    try {
      const result = await db.query(query, [email]);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const query = `
      SELECT id, email, username, password_hash, demographics, learning_preferences,
             skill_profile, privacy_settings, parental_controls, is_verified,
             is_active, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    try {
      const result = await db.query(query, [email]);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        passwordHash: user.password_hash,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error finding user by email with password:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserProfile | null> {
    const query = `
      SELECT id, email, username, demographics, learning_preferences,
             skill_profile, privacy_settings, parental_controls, is_verified,
             created_at, updated_at
      FROM users
      WHERE username = $1 AND is_active = true
    `;

    try {
      const result = await db.query(query, [username]);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (updates.username) {
      updateFields.push(`username = $${paramCount++}`);
      values.push(updates.username);
    }
    if (updates.demographics) {
      updateFields.push(`demographics = $${paramCount++}`);
      values.push(JSON.stringify(updates.demographics));
    }
    if (updates.learningPreferences) {
      updateFields.push(`learning_preferences = $${paramCount++}`);
      values.push(JSON.stringify(updates.learningPreferences));
    }
    if (updates.skillProfile) {
      updateFields.push(`skill_profile = $${paramCount++}`);
      values.push(JSON.stringify(updates.skillProfile));
    }
    if (updates.privacySettings) {
      updateFields.push(`privacy_settings = $${paramCount++}`);
      values.push(JSON.stringify(updates.privacySettings));
    }
    if (updates.parentalControls !== undefined) {
      updateFields.push(`parental_controls = $${paramCount++}`);
      values.push(updates.parentalControls ? JSON.stringify(updates.parentalControls) : null);
    }
    if (updates.isVerified !== undefined) {
      updateFields.push(`is_verified = $${paramCount++}`);
      values.push(updates.isVerified);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id); // Add ID as last parameter

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount} AND is_active = true
      RETURNING id, email, username, demographics, learning_preferences,
                skill_profile, privacy_settings, parental_controls, is_verified,
                created_at, updated_at
    `;

    try {
      const result = await db.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        username: user.username,
        demographics: user.demographics,
        learningPreferences: user.learning_preferences,
        skillProfile: user.skill_profile,
        privacySettings: user.privacy_settings,
        parentalControls: user.parental_controls,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
    `;

    try {
      const result = await db.query(query, [passwordHash, id]);
      if (result.rowCount === 0) {
        throw new Error('User not found or inactive');
      }
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  async deactivate(id: string): Promise<void> {
    const query = `
      UPDATE users
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;

    try {
      await db.query(query, [id]);
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  async updateSkillProfile(id: string, skillProfile: any[]): Promise<void> {
    const query = `
      UPDATE users
      SET skill_profile = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
    `;

    try {
      const result = await db.query(query, [JSON.stringify(skillProfile), id]);
      if (result.rowCount === 0) {
        throw new Error('User not found or inactive');
      }
    } catch (error) {
      logger.error('Error updating skill profile:', error);
      throw error;
    }
  }
}