/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  // Table for storing collaboration progress updates
  pgm.createTable('collaboration_progress_updates', {
    id: 'id',
    session_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    progress: {
      type: 'integer',
      notNull: true,
      check: 'progress >= 0 AND progress <= 100',
    },
    content_id: {
      type: 'varchar(255)',
      notNull: false,
    },
    milestone: {
      type: 'varchar(500)',
      notNull: false,
    },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Table for storing shared files in collaboration sessions
  pgm.createTable('collaboration_shared_files', {
    id: 'id',
    session_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    file_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    file_name: {
      type: 'varchar(500)',
      notNull: true,
    },
    file_url: {
      type: 'text',
      notNull: true,
    },
    file_size: {
      type: 'bigint',
      notNull: false,
    },
    file_type: {
      type: 'varchar(100)',
      notNull: false,
    },
    uploaded_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Table for storing collaboration session data
  pgm.createTable('collaboration_session_data', {
    id: 'id',
    session_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    group_id: {
      type: 'uuid',
      notNull: false,
      references: 'study_groups(id)',
      onDelete: 'SET NULL',
    },
    topic: {
      type: 'varchar(500)',
      notNull: true,
    },
    start_time: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    end_time: {
      type: 'timestamp with time zone',
      notNull: false,
    },
    activities: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    participant_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    total_duration: {
      type: 'integer',
      notNull: false,
      comment: 'Duration in minutes',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Table for storing real-time collaboration messages
  pgm.createTable('collaboration_messages', {
    id: 'id',
    session_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    message: {
      type: 'text',
      notNull: true,
    },
    message_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'text',
      check: "message_type IN ('text', 'code', 'image', 'file')",
    },
    metadata: {
      type: 'jsonb',
      notNull: false,
      comment: 'Additional message metadata like file info, code language, etc.',
    },
    is_moderated: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    moderation_result: {
      type: 'jsonb',
      notNull: false,
    },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Indexes for better performance
  pgm.createIndex('collaboration_progress_updates', ['session_id', 'user_id']);
  pgm.createIndex('collaboration_progress_updates', ['timestamp']);
  pgm.createIndex('collaboration_shared_files', ['session_id']);
  pgm.createIndex('collaboration_shared_files', ['uploaded_by']);
  pgm.createIndex('collaboration_session_data', ['session_id']);
  pgm.createIndex('collaboration_session_data', ['group_id']);
  pgm.createIndex('collaboration_session_data', ['start_time']);
  pgm.createIndex('collaboration_messages', ['session_id', 'timestamp']);
  pgm.createIndex('collaboration_messages', ['user_id']);

  // Add unique constraint for progress updates to prevent duplicates
  pgm.addConstraint('collaboration_progress_updates', 'unique_session_user_timestamp', {
    unique: ['session_id', 'user_id', 'timestamp'],
  });

  // Add trigger to update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  pgm.sql(`
    CREATE TRIGGER update_collaboration_session_data_updated_at 
    BEFORE UPDATE ON collaboration_session_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop triggers first
  pgm.sql('DROP TRIGGER IF EXISTS update_collaboration_session_data_updated_at ON collaboration_session_data;');
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Drop tables in reverse order
  pgm.dropTable('collaboration_messages');
  pgm.dropTable('collaboration_session_data');
  pgm.dropTable('collaboration_shared_files');
  pgm.dropTable('collaboration_progress_updates');
};