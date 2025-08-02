import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface ContentReport {
  id: string;
  contentId: string;
  userId: string;
  reason: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
}

export interface CreateReportRequest {
  contentId: string;
  userId: string;
  reason: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface UpdateReportRequest {
  status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  resolution?: string;
}

export class ContentReportRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(reportData: CreateReportRequest): Promise<ContentReport> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO content_reports (
          content_id, user_id, reason, description, severity, status, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, 'pending', NOW()
        ) RETURNING *
      `;

      const values = [
        reportData.contentId,
        reportData.userId,
        reportData.reason,
        reportData.description,
        reportData.severity
      ];

      const result = await client.query(query, values);
      return this.mapRowToReport(result.rows[0]);
    } catch (error) {
      logger.error('Error creating content report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ContentReport | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM content_reports WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToReport(result.rows[0]);
    } catch (error) {
      logger.error('Error finding content report by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByContentId(contentId: string): Promise<ContentReport[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM content_reports 
        WHERE content_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [contentId]);
      
      return result.rows.map(row => this.mapRowToReport(row));
    } catch (error) {
      logger.error('Error finding reports by content ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string): Promise<ContentReport[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM content_reports 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [userId]);
      
      return result.rows.map(row => this.mapRowToReport(row));
    } catch (error) {
      logger.error('Error finding reports by user ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findPendingReports(limit: number = 50): Promise<ContentReport[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT cr.*, ci.title as content_title, ci.url as content_url
        FROM content_reports cr
        JOIN content_items ci ON cr.content_id = ci.id
        WHERE cr.status = 'pending'
        ORDER BY 
          CASE cr.severity 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
          END,
          cr.created_at ASC
        LIMIT $1
      `;
      const result = await client.query(query, [limit]);
      
      return result.rows.map(row => ({
        ...this.mapRowToReport(row),
        contentTitle: row.content_title,
        contentUrl: row.content_url
      }));
    } catch (error) {
      logger.error('Error finding pending reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: UpdateReportRequest): Promise<ContentReport | null> {
    const client = await this.pool.connect();
    try {
      const updateFields: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex}`);
        queryParams.push(updates.status);
        paramIndex++;
      }

      if (updates.reviewedBy !== undefined) {
        updateFields.push(`reviewed_by = $${paramIndex}`);
        queryParams.push(updates.reviewedBy);
        paramIndex++;
        
        // Set reviewed_at when reviewer is assigned
        updateFields.push(`reviewed_at = NOW()`);
      }

      if (updates.resolution !== undefined) {
        updateFields.push(`resolution = $${paramIndex}`);
        queryParams.push(updates.resolution);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return await this.findById(id);
      }

      queryParams.push(id);

      const query = `
        UPDATE content_reports 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, queryParams);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToReport(result.rows[0]);
    } catch (error) {
      logger.error('Error updating content report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getReportStatsByContent(contentId: string): Promise<{
    totalReports: number;
    severityBreakdown: { low: number; medium: number; high: number };
    statusBreakdown: { pending: number; reviewed: number; resolved: number; dismissed: number };
  }> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          COUNT(*) as total_reports,
          COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_severity,
          COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_severity,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_status,
          COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_status,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_status,
          COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_status
        FROM content_reports 
        WHERE content_id = $1
      `;
      
      const result = await client.query(query, [contentId]);
      const row = result.rows[0];

      return {
        totalReports: parseInt(row.total_reports),
        severityBreakdown: {
          low: parseInt(row.low_severity),
          medium: parseInt(row.medium_severity),
          high: parseInt(row.high_severity)
        },
        statusBreakdown: {
          pending: parseInt(row.pending_status),
          reviewed: parseInt(row.reviewed_status),
          resolved: parseInt(row.resolved_status),
          dismissed: parseInt(row.dismissed_status)
        }
      };
    } catch (error) {
      logger.error('Error getting report stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecentReports(days: number = 7, limit: number = 100): Promise<ContentReport[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT cr.*, ci.title as content_title, ci.url as content_url
        FROM content_reports cr
        JOIN content_items ci ON cr.content_id = ci.id
        WHERE cr.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY cr.created_at DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return result.rows.map(row => ({
        ...this.mapRowToReport(row),
        contentTitle: row.content_title,
        contentUrl: row.content_url
      }));
    } catch (error) {
      logger.error('Error getting recent reports:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async checkUserReportLimit(userId: string, timeWindowHours: number = 24): Promise<{
    reportCount: number;
    canReport: boolean;
    maxReports: number;
  }> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT COUNT(*) as report_count
        FROM content_reports 
        WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${timeWindowHours} hours'
      `;
      
      const result = await client.query(query, [userId]);
      const reportCount = parseInt(result.rows[0].report_count);
      const maxReports = 10; // Maximum reports per 24 hours
      
      return {
        reportCount,
        canReport: reportCount < maxReports,
        maxReports
      };
    } catch (error) {
      logger.error('Error checking user report limit:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToReport(row: any): ContentReport {
    return {
      id: row.id,
      contentId: row.content_id,
      userId: row.user_id,
      reason: row.reason,
      description: row.description,
      severity: row.severity,
      status: row.status,
      createdAt: new Date(row.created_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by,
      resolution: row.resolution
    };
  }
}