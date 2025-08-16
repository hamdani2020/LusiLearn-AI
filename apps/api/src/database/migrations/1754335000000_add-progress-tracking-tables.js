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
  // Create achievement types enum
  pgm.createType('achievement_type', ['milestone', 'streak', 'skill_mastery', 'collaboration', 'consistency']);
  pgm.createType('streak_type', ['daily', 'weekly', 'monthly']);

  // Progress updates table
  pgm.createTable('progress_updates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()')
    },
    session_id: {
      type: 'uuid',
      notNull: true,
      references: 'learning_sessions(id)',
      onDelete: 'CASCADE'
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
    progress_data: {
      type: 'jsonb',
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

  // Achievements table
  pgm.createTable('achievements', {
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
    type: {
      type: 'achievement_type',
      notNull: true
    },
    title: {
      type: 'varchar(200)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    icon_url: {
      type: 'text'
    },
    criteria: {
      type: 'jsonb',
      notNull: true
    },
    points: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    earned_at: {
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

  // Learning streaks table
  pgm.createTable('learning_streaks', {
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
    current_streak: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    longest_streak: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    last_activity_date: {
      type: 'timestamptz',
      notNull: true
    },
    streak_type: {
      type: 'streak_type',
      notNull: true,
      default: 'daily'
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

  // Skill progress table
  pgm.createTable('skill_progress', {
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
    skill_id: {
      type: 'varchar(100)',
      notNull: true
    },
    skill_name: {
      type: 'varchar(200)',
      notNull: true
    },
    current_level: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 0
    },
    previous_level: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 0
    },
    improvement_rate: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 0
    },
    last_assessed: {
      type: 'timestamptz',
      notNull: true
    },
    mastery_threshold: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 80
    },
    is_mastered: {
      type: 'boolean',
      notNull: true,
      default: false
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

  // Create indexes for performance
  pgm.createIndex('progress_updates', 'user_id');
  pgm.createIndex('progress_updates', 'path_id');
  pgm.createIndex('progress_updates', 'session_id');
  pgm.createIndex('progress_updates', 'created_at');
  pgm.createIndex('progress_updates', 'progress_data', { method: 'gin' });

  pgm.createIndex('achievements', 'user_id');
  pgm.createIndex('achievements', 'type');
  pgm.createIndex('achievements', 'earned_at');
  pgm.createIndex('achievements', 'points');

  pgm.createIndex('learning_streaks', 'user_id');
  pgm.createIndex('learning_streaks', 'streak_type');
  pgm.createIndex('learning_streaks', 'last_activity_date');
  pgm.createIndex('learning_streaks', 'current_streak');

  pgm.createIndex('skill_progress', 'user_id');
  pgm.createIndex('skill_progress', 'skill_id');
  pgm.createIndex('skill_progress', 'last_assessed');
  pgm.createIndex('skill_progress', 'is_mastered');
  pgm.createIndex('skill_progress', 'current_level');

  // Create unique constraints
  pgm.addConstraint('learning_streaks', 'unique_user_streak_type', {
    unique: ['user_id', 'streak_type']
  });

  pgm.addConstraint('skill_progress', 'unique_user_skill', {
    unique: ['user_id', 'skill_id']
  });

  // Add check constraints
  pgm.addConstraint('progress_updates', 'valid_progress_data', 
    "CHECK (progress_data ? 'timeSpent' AND progress_data ? 'comprehensionScore')");

  pgm.addConstraint('achievements', 'valid_points', 
    "CHECK (points >= 0)");

  pgm.addConstraint('learning_streaks', 'valid_streaks', 
    "CHECK (current_streak >= 0 AND longest_streak >= current_streak)");

  pgm.addConstraint('skill_progress', 'valid_levels', 
    "CHECK (current_level >= 0 AND current_level <= 100 AND previous_level >= 0 AND previous_level <= 100)");

  pgm.addConstraint('skill_progress', 'valid_mastery_threshold', 
    "CHECK (mastery_threshold >= 0 AND mastery_threshold <= 100)");

  // Create updated_at triggers
  const tables = ['progress_updates', 'achievements', 'learning_streaks', 'skill_progress'];
  
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
  const tables = ['progress_updates', 'achievements', 'learning_streaks', 'skill_progress'];
  
  tables.forEach((table) => {
    pgm.sql(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};`);
  });

  // Drop tables in reverse order
  pgm.dropTable('skill_progress');
  pgm.dropTable('learning_streaks');
  pgm.dropTable('achievements');
  pgm.dropTable('progress_updates');

  // Drop enum types
  pgm.dropType('streak_type');
  pgm.dropType('achievement_type');
};