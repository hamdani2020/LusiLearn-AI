module.exports = {
  'database-url': process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  'migrations-dir': 'src/database/migrations',
  'migrations-table': 'pgmigrations',
  'schema': 'public',
  'dir': 'src/database/migrations',
  'check-order': true,
  'verbose': true,
  'create-schema': true,
  'single-transaction': false,
};