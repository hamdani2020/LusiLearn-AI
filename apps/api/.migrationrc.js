const { getDatabaseUrl } = require('@lusilearn/config');

module.exports = {
  'database-url': getDatabaseUrl(),
  'migrations-dir': 'src/database/migrations',
  'migrations-table': 'pgmigrations',
  'schema': 'public',
  'dir': 'src/database/migrations',
  'check-order': true,
  'verbose': true,
  'create-schema': true,
  'single-transaction': false,
};