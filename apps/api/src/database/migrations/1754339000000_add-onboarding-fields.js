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
  // Add onboarding fields to users table
  pgm.addColumns('users', {
    onboarding_completed: {
      type: 'boolean',
      default: false,
    },
    onboarding_completed_at: {
      type: 'timestamptz',
    },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Remove onboarding fields from users table
  pgm.dropColumns('users', ['onboarding_completed', 'onboarding_completed_at']);
}; 