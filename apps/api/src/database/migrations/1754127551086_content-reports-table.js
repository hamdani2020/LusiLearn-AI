/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Create content_reports table
  pgm.createTable('content_reports', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    content_id: {
      type: 'uuid',
      notNull: true,
      references: 'content_items(id)',
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    reason: {
      type: 'varchar(100)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    severity: {
      type: 'varchar(10)',
      notNull: true
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending'
    },
    reviewed_at: {
      type: 'timestamp with time zone'
    },
    reviewed_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    resolution: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for better query performance
  pgm.createIndex('content_reports', 'content_id');
  pgm.createIndex('content_reports', 'user_id');
  pgm.createIndex('content_reports', 'status');
  pgm.createIndex('content_reports', 'severity');
  pgm.createIndex('content_reports', 'created_at');
  pgm.createIndex('content_reports', ['status', 'severity', 'created_at']);

  // Add check constraints
  pgm.addConstraint('content_reports', 'valid_severity', 
    "CHECK (severity IN ('low', 'medium', 'high'))");
  
  pgm.addConstraint('content_reports', 'valid_status', 
    "CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'))");

  // Add constraint to prevent duplicate reports from same user for same content
  pgm.createIndex('content_reports', ['content_id', 'user_id'], { 
    unique: true,
    name: 'unique_user_content_report'
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('content_reports');
};
