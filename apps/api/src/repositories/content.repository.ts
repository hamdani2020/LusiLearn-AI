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

  private mapRowToContentItem(row: any): ContentItem {
    return {
      id: row.id,
      source: row.source,
      externalId: row.external_id,
      url: row.url,
      title: row.title,
      description: row.description,
      thumbnailUrl: row.thumbnail_url,
      metadata: JSON.parse(row.metadata),
      qualityMetrics: JSON.parse(row.quality_metrics),
      ageRating: row.age_rating,
      embeddings: row.embeddings ? JSON.parse(row.embeddings) : undefined,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}