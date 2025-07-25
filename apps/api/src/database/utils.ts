import { PoolClient } from 'pg';
import { db } from './connection';
import { logger } from '../utils/logger';

/**
 * Database utility functions for common operations
 */

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export class DatabaseUtils {
  /**
   * Execute a parameterized query safely
   */
  static async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    try {
      const result = await db.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      logger.error('Database query failed:', { text, params, error });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  static async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback);
  }

  /**
   * Check if a table exists
   */
  static async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  }

  /**
   * Get table row count
   */
  static async getRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  }

  /**
   * Build WHERE clause from filters
   */
  static buildWhereClause(
    filters: Record<string, any>,
    startIndex = 1
  ): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          const placeholders = value
            .map(() => `$${paramIndex++}`)
            .join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        } else if (typeof value === 'object' && value.operator) {
          conditions.push(`${key} ${value.operator} $${paramIndex++}`);
          params.push(value.value);
        } else {
          conditions.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    });

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Build pagination clause
   */
  static buildPaginationClause(
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'ASC'
  ): { clause: string; offset: number } {
    const offset = (page - 1) * limit;
    let clause = '';

    if (sortBy) {
      clause += ` ORDER BY ${sortBy} ${sortOrder}`;
    }

    clause += ` LIMIT ${limit} OFFSET ${offset}`;

    return { clause, offset };
  }

  /**
   * Upsert operation (INSERT ... ON CONFLICT DO UPDATE)
   */
  static async upsert(
    tableName: string,
    data: Record<string, any>,
    conflictColumns: string[],
    updateColumns?: string[]
  ): Promise<QueryResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const updateCols = updateColumns || columns.filter(col => !conflictColumns.includes(col));
    const updateClause = updateCols
      .map(col => `${col} = EXCLUDED.${col}`)
      .join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (${conflictColumns.join(', ')})
      DO UPDATE SET ${updateClause}
      RETURNING *
    `;

    return this.query(query, values);
  }

  /**
   * Soft delete (set is_active = false)
   */
  static async softDelete(
    tableName: string,
    id: string
  ): Promise<QueryResult> {
    return this.query(
      `UPDATE ${tableName} SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
  }

  /**
   * Bulk insert with conflict handling
   */
  static async bulkInsert(
    tableName: string,
    data: Record<string, any>[],
    conflictAction: 'ignore' | 'update' = 'ignore'
  ): Promise<QueryResult> {
    if (data.length === 0) {
      return { rows: [], rowCount: 0 };
    }

    const columns = Object.keys(data[0]);
    const values: any[] = [];
    const placeholders: string[] = [];

    data.forEach((row, rowIndex) => {
      const rowPlaceholders = columns
        .map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`)
        .join(', ');
      placeholders.push(`(${rowPlaceholders})`);
      values.push(...columns.map(col => row[col]));
    });

    let query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
    `;

    if (conflictAction === 'ignore') {
      query += ' ON CONFLICT DO NOTHING';
    }

    query += ' RETURNING *';

    return this.query(query, values);
  }

  /**
   * Search with full-text search
   */
  static async fullTextSearch(
    tableName: string,
    searchColumns: string[],
    searchTerm: string,
    additionalFilters?: Record<string, any>,
    limit: number = 10
  ): Promise<QueryResult> {
    const searchClause = searchColumns
      .map(col => `${col} ILIKE $1`)
      .join(' OR ');

    let query = `SELECT * FROM ${tableName} WHERE (${searchClause})`;
    const params = [`%${searchTerm}%`];

    if (additionalFilters) {
      const { clause, params: filterParams } = this.buildWhereClause(
        additionalFilters,
        2
      );
      if (clause) {
        query += ` AND ${clause.replace('WHERE ', '')}`;
        params.push(...filterParams);
      }
    }

    query += ` LIMIT ${limit}`;

    return this.query(query, params);
  }
}

export default DatabaseUtils;