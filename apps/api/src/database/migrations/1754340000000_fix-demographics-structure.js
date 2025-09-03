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
  // First, let's migrate existing data to JSONB format
  // Add new JSONB columns
  pgm.addColumns('users', {
    demographics: {
      type: 'jsonb',
    },
    learning_preferences: {
      type: 'jsonb',
    },
    skill_profile: {
      type: 'jsonb',
      default: '[]',
    },
    privacy_settings: {
      type: 'jsonb',
    },
    parental_controls: {
      type: 'jsonb',
    },
  });

  // Migrate existing data to the new JSONB structure
  pgm.sql(`
    UPDATE users SET 
      demographics = jsonb_build_object(
        'ageRange', age_range,
        'educationLevel', education_level::text,
        'timezone', COALESCE(timezone, 'UTC'),
        'preferredLanguage', COALESCE(preferred_language, 'en')
      ),
      learning_preferences = jsonb_build_object(
        'learningStyle', '["visual"]',
        'preferredContentTypes', '["video", "interactive"]',
        'sessionDuration', 30,
        'difficultyPreference', 'moderate'
      ),
      privacy_settings = jsonb_build_object(
        'profileVisibility', 'public',
        'allowPeerMatching', true,
        'shareProgressData', true,
        'allowDataCollection', true
      )
    WHERE demographics IS NULL;
  `);

  // Make the new columns NOT NULL after data migration
  pgm.alterColumn('users', 'demographics', {
    notNull: true,
  });
  
  pgm.alterColumn('users', 'learning_preferences', {
    notNull: true,
  });
  
  pgm.alterColumn('users', 'privacy_settings', {
    notNull: true,
  });

  // Drop the old individual columns
  pgm.dropColumns('users', [
    'education_level',
    'age_range', 
    'timezone',
    'preferred_language'
  ]);

  // Add missing columns that should exist
  pgm.addColumns('users', {
    onboarding_completed: {
      type: 'boolean',
      default: false,
    },
    onboarding_completed_at: {
      type: 'timestamptz',
    },
  });

  // Create GIN indexes for JSONB columns
  pgm.createIndex('users', ['demographics'], { method: 'gin' });
  pgm.createIndex('users', ['learning_preferences'], { method: 'gin' });
  pgm.createIndex('users', ['skill_profile'], { method: 'gin' });
  pgm.createIndex('users', ['privacy_settings'], { method: 'gin' });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop GIN indexes
  pgm.dropIndex('users', ['demographics']);
  pgm.dropIndex('users', ['learning_preferences']);
  pgm.dropIndex('users', ['skill_profile']);
  pgm.dropIndex('users', ['privacy_settings']);

  // Add back the individual columns
  pgm.addColumns('users', {
    education_level: {
      type: 'education_level',
      notNull: true,
    },
    age_range: {
      type: 'varchar(20)',
      notNull: true,
    },
    timezone: {
      type: 'varchar(50)',
      default: 'UTC',
    },
    preferred_language: {
      type: 'varchar(10)',
      default: 'en',
    },
  });

  // Migrate data back from JSONB to individual columns
  pgm.sql(`
    UPDATE users SET 
      education_level = (demographics->>'educationLevel')::education_level,
      age_range = demographics->>'ageRange',
      timezone = COALESCE(demographics->>'timezone', 'UTC'),
      preferred_language = COALESCE(demographics->>'preferredLanguage', 'en')
    WHERE demographics IS NOT NULL;
  `);

  // Drop the JSONB columns
  pgm.dropColumns('users', [
    'demographics',
    'learning_preferences', 
    'skill_profile',
    'privacy_settings',
    'parental_controls',
    'onboarding_completed',
    'onboarding_completed_at'
  ]);
};