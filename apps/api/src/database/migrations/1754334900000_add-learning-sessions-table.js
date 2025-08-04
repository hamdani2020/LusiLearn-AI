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
  // Create learning_sessions table
  pgm.createTable('learning_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    path_id: {
      type: 'uuid',
      notNull: true,
      references: 'learning_paths(id)',
      onDelete: 'CASCADE'
    },
    content_items: {
      type: 'jsonb',
      default: '[]'
    },
    duration: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    interactions: {
      type: 'jsonb',
      default: '[]'
    },
    assessment_results: {
      type: 'jsonb',
      default: '[]'
    },
    comprehension_score: {
      type: 'decimal(5,2)',
      default: 0
    },
    engagement_metrics: {
      type: 'jsonb',
      notNull: true,
      default: '{}'
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()')
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for learning sessions
  pgm.createIndex('learning_sessions', 'user_id');
  pgm.createIndex('learning_sessions', 'path_id');
  pgm.createIndex('learning_sessions', ['user_id', 'path_id']);
  pgm.createIndex('learning_sessions', 'created_at');
  pgm.createIndex('learning_sessions', 'comprehension_score');
  
  // GIN indexes for JSONB columns
  pgm.createIndex('learning_sessions', 'content_items', { method: 'gin' });
  pgm.createIndex('learning_sessions', 'interactions', { method: 'gin' });
  pgm.createIndex('learning_sessions', 'assessment_results', { method: 'gin' });
  pgm.createIndex('learning_sessions', 'engagement_metrics', { method: 'gin' });

  // Add check constraints
  pgm.addConstraint('learning_sessions', 'valid_duration', 
    "CHECK (duration >= 0)");
  
  pgm.addConstraint('learning_sessions', 'valid_comprehension_score', 
    "CHECK (comprehension_score >= 0 AND comprehension_score <= 100)");

  // Create updated_at trigger for learning_sessions
  pgm.sql(`
    CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS update_learning_sessions_updated_at ON learning_sessions;');
  pgm.dropTable('learning_sessions');
};