import { Pool, PoolClient } from 'pg';
import { getPostgresConfig, getDatabaseUrl } from '@lusilearn/config';
import { logger } from '../utils/logger';

class DatabaseConnection {
    private pool: Pool;
    private static instance: DatabaseConnection;

    private constructor() {
        const config = getPostgresConfig();

        this.pool = new Pool({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.username,
            password: config.password,
            ssl: config.ssl ? { rejectUnauthorized: false } : false,
            max: config.maxConnections,
            connectionTimeoutMillis: config.connectionTimeout,
            idleTimeoutMillis: 30000,
            allowExitOnIdle: false,
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
        });

        // Handle pool connection
        this.pool.on('connect', (client) => {
            logger.info('New client connected to database');
        });

        // Handle pool removal
        this.pool.on('remove', (client) => {
            logger.info('Client removed from pool');
        });
    }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    public async getClient(): Promise<PoolClient> {
        try {
            const client = await this.pool.connect();
            return client;
        } catch (error) {
            logger.error('Error getting database client:', error);
            throw error;
        }
    }

    public async query(text: string, params?: any[]): Promise<any> {
        const client = await this.getClient();
        try {
            const start = Date.now();
            const result = await client.query(text, params);
            const duration = Date.now() - start;

            logger.debug('Executed query', {
                text,
                duration,
                rows: result.rowCount,
            });

            return result;
        } catch (error) {
            logger.error('Database query error:', { text, params, error });
            throw error;
        } finally {
            client.release();
        }
    }

    public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction rolled back:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const result = await this.query('SELECT 1 as health');
            return result.rows[0].health === 1;
        } catch (error) {
            logger.error('Database health check failed:', error);
            return false;
        }
    }

    public async close(): Promise<void> {
        try {
            await this.pool.end();
            logger.info('Database connection pool closed');
        } catch (error) {
            logger.error('Error closing database connection pool:', error);
            throw error;
        }
    }

    public getPool(): Pool {
        return this.pool;
    }
}

export const db = DatabaseConnection.getInstance();
export default db;