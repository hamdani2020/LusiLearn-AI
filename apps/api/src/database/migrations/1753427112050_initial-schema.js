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
  // Enable UUID extension
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // Create enum types
  pgm.createType('education_level', ['k12', 'college', 'professional']);
  pgm.createType('difficulty_level', ['beginner', 'intermediate', 'advanced', 'expert']);
  pgm.createType('content_source', ['youtube', 'khan_academy', 'coursera', 'github', 'internal']);
  pgm.createType('age_rating', ['all_ages', 'teen', 'adult']);
  pgm.createType('content_format', ['video', 'article', 'interactive', 'quiz', 'project']);
  pgm.createType('learning_style', ['visual', 'auditory', 'kinesthetic', 'reading_writing']);
  pgm.createType('age_range', ['5-12', '13-17', '18-25', '26-40', '40+']);
  pgm.createType('moderation_level', ['minimal', 'moderate', 'strict']);
  pgm.createType('privacy_level', ['public', 'friends', 'private']);
  pgm.createType('collaboration_activity_type', ['study_session', 'discussion', 'project', 'peer_review']);

  // Users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    username: {
      type: 'varchar(50)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    demographics: {
      type: 'jsonb',
      notNull: true,
    },
    learning_preferences: {
      type: 'jsonb',
      notNull: true,
    },
    skill_profile: {
      type: 'jsonb',
      default: '[]',
    },
    privacy_settings: {
      type: 'jsonb',
      notNull: true,
    },
    parental_controls: {
      type: 'jsonb',
    },
    is_verified: {
      type: 'boolean',
      default: false,
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Learning paths table
  pgm.createTable('learning_paths', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    subject: {
      type: 'varchar(100)',
      notNull: true,
    },
    current_level: {
      type: 'difficulty_level',
      notNull: true,
      default: 'beginner',
    },
    objectives: {
      type: 'jsonb',
      default: '[]',
    },
    milestones: {
      type: 'jsonb',
      default: '[]',
    },
    progress: {
      type: 'jsonb',
      notNull: true,
    },
    adaptation_history: {
      type: 'jsonb',
      default: '[]',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Learning sessions table
  pgm.createTable('learning_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    path_id: {
      type: 'uuid',
      notNull: true,
      references: 'learning_paths(id)',
      onDelete: 'CASCADE',
    },
    content_items: {
      type: 'jsonb',
      default: '[]',
    },
    duration: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    interactions: {
      type: 'jsonb',
      default: '[]',
    },
    assessment_results: {
      type: 'jsonb',
      default: '[]',
    },
    comprehension_score: {
      type: 'decimal(5,2)',
      default: 0,
    },
    engagement_metrics: {
      type: 'jsonb',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Content items table
  pgm.createTable('content_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    source: {
      type: 'content_source',
      notNull: true,
    },
    external_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    url: {
      type: 'text',
      notNull: true,
    },
    title: {
      type: 'varchar(500)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    thumbnail_url: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
      notNull: true,
    },
    quality_metrics: {
      type: 'jsonb',
      notNull: true,
    },
    age_rating: {
      type: 'age_rating',
      notNull: true,
      default: 'all_ages',
    },
    embeddings: {
      type: 'jsonb',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Study groups table
  pgm.createTable('study_groups', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    topic: {
      type: 'varchar(100)',
      notNull: true,
    },
    subject: {
      type: 'varchar(100)',
      notNull: true,
    },
    participants: {
      type: 'jsonb',
      default: '[]',
    },
    settings: {
      type: 'jsonb',
      notNull: true,
    },
    activities: {
      type: 'jsonb',
      default: '[]',
    },
    is_active: {
      type: 'boolean',
      default: true,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Collaboration sessions table
  pgm.createTable('collaboration_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    group_id: {
      type: 'uuid',
      notNull: true,
      references: 'study_groups(id)',
      onDelete: 'CASCADE',
    },
    participants: {
      type: 'jsonb',
      default: '[]',
    },
    topic: {
      type: 'varchar(200)',
      notNull: true,
    },
    duration: {
      type: 'integer',
      default: 0,
    },
    activities: {
      type: 'jsonb',
      default: '[]',
    },
    outcomes: {
      type: 'jsonb',
      default: '[]',
    },
    satisfaction: {
      type: 'jsonb',
      default: '[]',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // User assessments table
  pgm.createTable('user_assessments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    subject: {
      type: 'varchar(100)',
      notNull: true,
    },
    level: {
      type: 'integer',
      notNull: true,
    },
    confidence: {
      type: 'integer',
      notNull: true,
    },
    assessment_data: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for performance optimization
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', ['demographics'], { method: 'gin' });
  pgm.createIndex('learning_paths', 'user_id');
  pgm.createIndex('learning_paths', 'subject');
  pgm.createIndex('learning_paths', 'current_level');
  pgm.createIndex('learning_sessions', 'user_id');
  pgm.createIndex('learning_sessions', 'path_id');
  pgm.createIndex('learning_sessions', 'created_at');
  pgm.createIndex('content_items', 'source');
  pgm.createIndex('content_items', ['metadata'], { method: 'gin' });
  pgm.createIndex('content_items', 'age_rating');
  pgm.createIndex('content_items', 'is_active');
  pgm.createIndex('study_groups', 'subject');
  pgm.createIndex('study_groups', 'topic');
  pgm.createIndex('study_groups', 'created_by');
  pgm.createIndex('study_groups', 'is_active');
  pgm.createIndex('collaboration_sessions', 'group_id');
  pgm.createIndex('collaboration_sessions', 'created_at');
  pgm.createIndex('user_assessments', 'user_id');
  pgm.createIndex('user_assessments', 'subject');

  // Create unique constraints
  pgm.addConstraint('content_items', 'unique_source_external_id', {
    unique: ['source', 'external_id'],
  });

  // Create updated_at trigger function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Create triggers for updated_at
  const tables = [
    'users',
    'learning_paths',
    'learning_sessions',
    'content_items',
    'study_groups',
    'collaboration_sessions',
    'user_assessments',
  ];

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
  const tables = [
    'users',
    'learning_paths',
    'learning_sessions',
    'content_items',
    'study_groups',
    'collaboration_sessions',
    'user_assessments',
  ];

  tables.forEach((table) => {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
  });

  // Drop trigger function
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Drop tables in reverse order (respecting foreign key constraints)
  pgm.dropTable('user_assessments');
  pgm.dropTable('collaboration_sessions');
  pgm.dropTable('study_groups');
  pgm.dropTable('content_items');
  pgm.dropTable('learning_sessions');
  pgm.dropTable('learning_paths');
  pgm.dropTable('users');

  // Drop enum types
  pgm.dropType('collaboration_activity_type');
  pgm.dropType('privacy_level');
  pgm.dropType('moderation_level');
  pgm.dropType('age_range');
  pgm.dropType('learning_style');
  pgm.dropType('content_format');
  pgm.dropType('age_rating');
  pgm.dropType('content_source');
  pgm.dropType('difficulty_level');
  pgm.dropType('education_level');

  // Drop extension
  pgm.dropExtension('uuid-ossp');
};
