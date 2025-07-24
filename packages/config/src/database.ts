// Database configuration utilities

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
}

export const getPostgresConfig = (): DatabaseConfig => {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'lusilearn',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
    connectionTimeout: parseInt(process.env.POSTGRES_TIMEOUT || '30000'),
  };
};

export const getDatabaseUrl = (): string => {
  const config = getPostgresConfig();
  const sslParam = config.ssl ? '?sslmode=require' : '';
  return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}${sslParam}`;
};