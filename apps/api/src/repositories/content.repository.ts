import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { 
  ContentItem, 
  ContentQuery, 
  ContentMetadata, 
  QualityMetrics,
  ContentSource,
  DifficultyLevel,
  ContentFormat,
  AgeRating
} from '@lusilearn/shared-types';

export interface CreateContentRequest {
  source: ContentSource;
  externalId: string;
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  metadata: ContentMetadata;
  qualityMetrics: QualityMetrics;
  ageRating: AgeRating;
  embeddings?: number[];
}

export interface UpdateContentRequest {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  metadata?: Partial<ContentMetadata>;
  qualityMetrics?: Partial<QualityMetrics>;
  ageRating?: AgeRating;
  embeddings?: number[];
  isActive?: boolean;
}

export class ContentRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(contentData: CreateContentRequest): Promise<ContentItem> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO content_items (
          source, external_id, url, title, description, thumbnail_url,
          metadata, quality_metrics, age_rating, embeddings, is_active,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW(), NOW()
        ) RETURNING *
      `;

      const values = [
        contentData.source,
        contentData.externalId,
        contentData.url,
        contentData.title,
        contentData.description,
        contentData.thumbnailUrl,
        JSON.stringify(contentData.metadata),
        JSON.stringify(contentData.qualityMetrics),
        contentData.ageRating,
        contentData.embeddings ? JSON.stringify(contentData.embeddings) : null
      ];

      const result = await client.query(query, values);
      return this.mapRowToContentItem(result.rows[0]);
    } catch (error) {
      logger.error('Error creating content item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ContentItem | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM content_items WHERE id = $1 AND is_active = true';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContentItem(result.rows[0]);
    } catch (error) {
      logger.error('Error finding content item by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByExternalId(source: ContentSource, externalId: string): Promise<ContentItem | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM content_items WHERE source = $1 AND external_id = $2 AND is_active = true';
      const result = await client.query(query, [source, externalId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContentItem(result.rows[0]);
    } catch (error) {
      logger.error('Error finding content item by external ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async search(query: ContentQuery): Promise<{ items: ContentItem[], total: number }> {
    const client = await this.pool.connect();
    try {
      let whereConditions = ['is_active = true'];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (query.subject) {
        whereConditions.push(`metadata->>'subject' ILIKE $${paramIndex}`);
        queryParams.push(`%${query.subject}%`);
        paramIndex++;
      }

      if (query.difficulty) {
        whereConditions.push(`metadata->>'difficulty' = $${paramIndex}`);
        queryParams.push(query.difficulty);
        paramIndex++;
      }

      if (query.format) {
        whereConditions.push(`metadata->>'format' = $${paramIndex}`);
        queryParams.push(query.format);
        paramIndex++;
      }

      if (query.source) {
        whereConditions.push(`source = $${paramIndex}`);
        queryParams.push(query.source);
        paramIndex++;
      }

      if (query.ageRating) {
        whereConditions.push(`age_rating = $${paramIndex}`);
        queryParams.push(query.ageRating);
        paramIndex++;
      }

      if (query.duration) {
        if (query.duration.min !== undefined) {
          whereConditions.push(`(metadata->>'duration')::integer >= $${paramIndex}`);
          queryParams.push(query.duration.min);
          paramIndex++;
        }
        if (query.duration.max !== undefined) {
          whereConditions.push(`(metadata->>'duration')::integer <= $${paramIndex}`);
          queryParams.push(query.duration.max);
          paramIndex++;
        }
      }

      // Full-text search
      if (query.query) {
        whereConditions.push(`(
          title ILIKE $${paramIndex} OR 
          description ILIKE $${paramIndex} OR 
          metadata->>'topics' ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${query.query}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Count query
      const countQuery = `SELECT COUNT(*) FROM content_items WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // Main query with pagination
      const page = query.page || 1;
      const limit = query.limit || 20;
      const offset = (page - 1) * limit;

      const mainQuery = `
        SELECT * FROM content_items 
        WHERE ${whereClause}
        ORDER BY quality_metrics->>'effectivenessScore' DESC, created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const result = await client.query(mainQuery, queryParams);

      const items = result.rows.map(row => this.mapRowToContentItem(row));

      return { items, total };
    } catch (error) {
      logger.error('Error searching content items:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: UpdateContentRequest): Promise<ContentItem | null> {
    const client = await this.pool.connect();
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        updateFields.push(`title = $${paramIndex}`);
        queryParams.push(updates.title);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        queryParams.push(updates.description);
        paramIndex++;
      }

      if (updates.thumbnailUrl !== undefined) {
        updateFields.push(`thumbnail_url = $${paramIndex}`);
        queryParams.push(updates.thumbnailUrl);
        paramIndex++;
      }

      if (updates.metadata !== undefined) {
        // Get current metadata and merge with updates
        const currentItem = await this.findById(id);
        if (currentItem) {
          const updatedMetadata = { ...currentItem.metadata, ...updates.metadata };
          updateFields.push(`metadata = $${paramIndex}`);
          queryParams.push(JSON.stringify(updatedMetadata));
          paramIndex++;
        }
      }

      if (updates.qualityMetrics !== undefined) {
        // Get current quality metrics and merge with updates
        const currentItem = await this.findById(id);
        if (currentItem) {
          const updatedMetrics = { ...currentItem.qualityMetrics, ...updates.qualityMetrics };
          updateFields.push(`quality_metrics = $${paramIndex}`);
          queryParams.push(JSON.stringify(updatedMetrics));
          paramIndex++;
        }
      }

      if (updates.ageRating !== undefined) {
        updateFields.push(`age_rating = $${paramIndex}`);
        queryParams.push(updates.ageRating);
        paramIndex++;
      }

      if (updates.embeddings !== undefined) {
        updateFields.push(`embeddings = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.embeddings));
        paramIndex++;
      }

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        queryParams.push(updates.isActive);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.findById(id);
      }

      updateFields.push(`updated_at = NOW()`);
      queryParams.push(id);

      const query = `
        UPDATE content_items 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, queryParams);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToContentItem(result.rows[0]);
    } catch (error) {
      logger.error('Error updating content item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getBySource(source: ContentSource, limit: number = 100): Promise<ContentItem[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM content_items 
        WHERE source = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT $2
      `;
      
      const result = await client.query(query, [source, limit]);
      return result.rows.map(row => this.mapRowToContentItem(row));
    } catch (error) {
      logger.error('Error getting content by source:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getTopRated(limit: number = 20): Promise<ContentItem[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM content_items 
        WHERE is_active = true
        ORDER BY (quality_metrics->>'userRating')::float DESC, 
                 (quality_metrics->>'effectivenessScore')::float DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      return result.rows.map(row => this.mapRowToContentItem(row));
    } catch (error) {
      logger.error('Error getting top rated content:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deactivate(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'UPDATE content_items SET is_active = false, updated_at = NOW() WHERE id = $1';
      const result = await client.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Error deactivating content item:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Bookmark methods
  async createBookmark(bookmarkData: {
    userId: string;
    contentId: string;
    tags: string[];
    notes?: string;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO content_bookmarks (
          user_id, content_id, tags, notes, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const values = [
        bookmarkData.userId,
        bookmarkData.contentId,
        JSON.stringify(bookmarkData.tags),
        bookmarkData.notes
      ];

      const result = await client.query(query, values);
      return this.mapRowToBookmark(result.rows[0]);
    } catch (error) {
      logger.error('Error creating bookmark:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserBookmarks(userId: string): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          cb.*,
          ci.source, ci.external_id, ci.url, ci.title, ci.description, 
          ci.thumbnail_url, ci.metadata, ci.quality_metrics, ci.age_rating,
          ci.created_at as content_created_at, ci.updated_at as content_updated_at
        FROM content_bookmarks cb
        JOIN content_items ci ON cb.content_id = ci.id
        WHERE cb.user_id = $1 AND ci.is_active = true
        ORDER BY cb.created_at DESC
      `;

      const result = await client.query(query, [userId]);
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        contentId: row.content_id,
        tags: JSON.parse(row.tags || '[]'),
        notes: row.notes,
        createdAt: new Date(row.created_at),
        content: this.mapRowToContentItem({
          id: row.content_id,
          source: row.source,
          external_id: row.external_id,
          url: row.url,
          title: row.title,
          description: row.description,
          thumbnail_url: row.thumbnail_url,
          metadata: row.metadata,
          quality_metrics: row.quality_metrics,
          age_rating: row.age_rating,
          is_active: true,
          created_at: row.content_created_at,
          updated_at: row.content_updated_at
        })
      }));
    } catch (error) {
      logger.error('Error getting user bookmarks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getBookmarkById(bookmarkId: string): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM content_bookmarks WHERE id = $1';
      const result = await client.query(query, [bookmarkId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToBookmark(result.rows[0]);
    } catch (error) {
      logger.error('Error getting bookmark by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBookmark(bookmarkId: string, updates: {
    tags?: string[];
    notes?: string;
  }): Promise<any | null> {
    const client = await this.pool.connect();
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.tags !== undefined) {
        updateFields.push(`tags = $${paramIndex}`);
        queryParams.push(JSON.stringify(updates.tags));
        paramIndex++;
      }

      if (updates.notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        queryParams.push(updates.notes);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.getBookmarkById(bookmarkId);
      }

      queryParams.push(bookmarkId);

      const query = `
        UPDATE content_bookmarks 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, queryParams);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToBookmark(result.rows[0]);
    } catch (error) {
      logger.error('Error updating bookmark:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteBookmark(bookmarkId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM content_bookmarks WHERE id = $1';
      const result = await client.query(query, [bookmarkId]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Error deleting bookmark:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Interaction methods
  async createInteraction(interactionData: {
    userId: string;
    contentId: string;
    interactionType: string;
    duration?: number;
    progress?: number;
    rating?: number;
    timestamp: Date;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO content_interactions (
          user_id, content_id, interaction_type, duration, progress, rating, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        interactionData.userId,
        interactionData.contentId,
        interactionData.interactionType,
        interactionData.duration,
        interactionData.progress,
        interactionData.rating,
        interactionData.timestamp
      ];

      const result = await client.query(query, values);
      return this.mapRowToInteraction(result.rows[0]);
    } catch (error) {
      logger.error('Error creating interaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async rateContent(contentId: string, userId: string, rating: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      // First, record the rating interaction
      await this.createInteraction({
        userId,
        contentId,
        interactionType: 'rate',
        rating,
        timestamp: new Date()
      });

      // Then, update the content's average rating
      const avgQuery = `
        SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
        FROM content_interactions 
        WHERE content_id = $1 AND interaction_type = 'rate' AND rating IS NOT NULL
      `;
      
      const avgResult = await client.query(avgQuery, [contentId]);
      const avgRating = parseFloat(avgResult.rows[0].avg_rating) || 0;
      const ratingCount = parseInt(avgResult.rows[0].rating_count) || 0;

      // Update content quality metrics
      const updateQuery = `
        UPDATE content_items 
        SET quality_metrics = jsonb_set(
          quality_metrics, 
          '{userRating}', 
          $1::text::jsonb
        ),
        quality_metrics = jsonb_set(
          quality_metrics, 
          '{ratingCount}', 
          $2::text::jsonb
        ),
        updated_at = NOW()
        WHERE id = $3
      `;

      await client.query(updateQuery, [avgRating, ratingCount, contentId]);
    } catch (error) {
      logger.error('Error rating content:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAvailableFilters(): Promise<{
    subjects: string[];
    difficulties: string[];
    formats: string[];
    sources: string[];
  }> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT DISTINCT
          metadata->>'subject' as subject,
          metadata->>'difficulty' as difficulty,
          metadata->>'format' as format,
          source
        FROM content_items 
        WHERE is_active = true
      `;

      const result = await client.query(query);
      
      const subjects = [...new Set(result.rows.map(row => row.subject).filter(Boolean))];
      const difficulties = [...new Set(result.rows.map(row => row.difficulty).filter(Boolean))];
      const formats = [...new Set(result.rows.map(row => row.format).filter(Boolean))];
      const sources = [...new Set(result.rows.map(row => row.source).filter(Boolean))];

      return { subjects, difficulties, formats, sources };
    } catch (error) {
      logger.error('Error getting available filters:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToContentItem(row: any): ContentItem {
    return {
      id: row.id,
      source: row.source,
      externalId: row.external_id,
      url: row.url,
      title: row.title,
      description: row.description,
      thumbnailUrl: row.thumbnail_url,
      metadata: this.safeJsonParse(row.metadata, {}),
      qualityMetrics: this.safeJsonParse(row.quality_metrics, {}),
      ageRating: row.age_rating,
      embeddings: row.embeddings ? this.safeJsonParse(row.embeddings, undefined) : undefined,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private safeJsonParse(jsonString: any, defaultValue: any): any {
    if (!jsonString || typeof jsonString !== 'string') {
      return defaultValue;
    }
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.warn(`Failed to parse JSON: ${jsonString}`, error);
      return defaultValue;
    }
  }

  private mapRowToBookmark(row: any): any {
    return {
      id: row.id,
      userId: row.user_id,
      contentId: row.content_id,
      tags: this.safeJsonParse(row.tags, []),
      notes: row.notes,
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToInteraction(row: any): any {
    return {
      id: row.id,
      userId: row.user_id,
      contentId: row.content_id,
      interactionType: row.interaction_type,
      duration: row.duration,
      progress: row.progress,
      rating: row.rating,
      timestamp: new Date(row.timestamp)
    };
  }
}