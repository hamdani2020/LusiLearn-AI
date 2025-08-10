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
  // Create enum types for peer matching
  pgm.createType('collaboration_type', ['study_buddy', 'mentor', 'project_partner']);
  pgm.createType('communication_style', ['formal', 'casual', 'mixed']);
  pgm.createType('match_status', ['pending', 'accepted', 'declined', 'expired']);

  // Peer matches table
  pgm.createTable('peer_matches', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    requester_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    matched_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    compatibility_score: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 0
    },
    shared_subjects: {
      type: 'jsonb',
      default: '[]'
    },
    complementary_skills: {
      type: 'jsonb',
      default: '{}'
    },
    common_goals: {
      type: 'jsonb',
      default: '[]'
    },
    availability_overlap: {
      type: 'jsonb',
      default: '[]'
    },
    communication_match: {
      type: 'jsonb',
      default: '[]'
    },
    match_reasons: {
      type: 'jsonb',
      default: '[]'
    },
    status: {
      type: 'match_status',
      notNull: true,
      default: 'pending'
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true
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

  // Collaboration preferences table
  pgm.createTable('collaboration_preferences', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
      unique: true
    },
    preferred_group_size: {
      type: 'integer',
      notNull: true,
      default: 4
    },
    communication_style: {
      type: 'communication_style',
      notNull: true,
      default: 'mixed'
    },
    available_hours: {
      type: 'jsonb',
      notNull: true
    },
    subjects: {
      type: 'jsonb',
      default: '[]'
    },
    collaboration_types: {
      type: 'jsonb',
      default: '[]'
    },
    timezone: {
      type: 'varchar(50)',
      notNull: true
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

  // Group activities table (for tracking specific activities within study groups)
  pgm.createTable('group_activities', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'study_groups(id)',
      onDelete: 'CASCADE'
    },
    type: {
      type: 'collaboration_activity_type',
      notNull: true
    },
    title: {
      type: 'varchar(200)',
      notNull: true
    },
    description: {
      type: 'text'
    },
    participants: {
      type: 'jsonb',
      default: '[]'
    },
    start_time: {
      type: 'timestamptz',
      notNull: true
    },
    end_time: {
      type: 'timestamptz'
    },
    is_completed: {
      type: 'boolean',
      default: false
    },
    outcomes: {
      type: 'jsonb',
      default: '[]'
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)'
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

  // Match feedback table (for improving matching algorithms)
  pgm.createTable('match_feedback', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    match_id: {
      type: 'uuid',
      notNull: true,
      references: 'peer_matches(id)',
      onDelete: 'CASCADE'
    },
    feedback_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    rating: {
      type: 'integer',
      notNull: true
    },
    feedback_text: {
      type: 'text'
    },
    collaboration_success: {
      type: 'boolean'
    },
    would_collaborate_again: {
      type: 'boolean'
    },
    improvement_suggestions: {
      type: 'text'
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for performance
  pgm.createIndex('peer_matches', 'requester_id');
  pgm.createIndex('peer_matches', 'matched_user_id');
  pgm.createIndex('peer_matches', 'status');
  pgm.createIndex('peer_matches', 'compatibility_score');
  pgm.createIndex('peer_matches', 'expires_at');
  pgm.createIndex('peer_matches', 'created_at');
  pgm.createIndex('peer_matches', 'shared_subjects', { method: 'gin' });

  pgm.createIndex('collaboration_preferences', 'user_id');
  pgm.createIndex('collaboration_preferences', 'communication_style');
  pgm.createIndex('collaboration_preferences', 'timezone');
  pgm.createIndex('collaboration_preferences', 'subjects', { method: 'gin' });

  pgm.createIndex('group_activities', 'group_id');
  pgm.createIndex('group_activities', 'type');
  pgm.createIndex('group_activities', 'start_time');
  pgm.createIndex('group_activities', 'is_completed');
  pgm.createIndex('group_activities', 'created_by');

  pgm.createIndex('match_feedback', 'match_id');
  pgm.createIndex('match_feedback', 'feedback_by');
  pgm.createIndex('match_feedback', 'rating');
  pgm.createIndex('match_feedback', 'collaboration_success');

  // Add constraints
  pgm.addConstraint('peer_matches', 'no_self_match',
    "CHECK (requester_id != matched_user_id)");

  pgm.addConstraint('peer_matches', 'valid_compatibility_score',
    "CHECK (compatibility_score >= 0 AND compatibility_score <= 100)");

  pgm.addConstraint('collaboration_preferences', 'valid_group_size',
    "CHECK (preferred_group_size >= 2 AND preferred_group_size <= 8)");

  pgm.addConstraint('match_feedback', 'valid_rating',
    "CHECK (rating >= 1 AND rating <= 5)");

  pgm.addConstraint('group_activities', 'valid_time_range',
    "CHECK (end_time IS NULL OR end_time > start_time)");

  // Create unique constraint to prevent duplicate matches
  pgm.addConstraint('peer_matches', 'unique_active_match', {
    unique: ['requester_id', 'matched_user_id', 'status'],
    where: "status IN ('pending', 'accepted')"
  });

  // Create updated_at triggers
  const tables = ['peer_matches', 'collaboration_preferences', 'group_activities'];

  tables.forEach((table) => {
    pgm.sql(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop triggers
  const tables = ['peer_matches', 'collaboration_preferences', 'group_activities'];

  tables.forEach((table) => {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
  });

  // Drop tables in reverse order
  pgm.dropTable('match_feedback');
  pgm.dropTable('group_activities');
  pgm.dropTable('collaboration_preferences');
  pgm.dropTable('peer_matches');

  // Drop enum types
  pgm.dropType('match_status');
  pgm.dropType('communication_style');
  pgm.dropType('collaboration_type');
};