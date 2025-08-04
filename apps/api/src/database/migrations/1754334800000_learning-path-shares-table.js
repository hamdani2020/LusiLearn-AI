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
  // Create learning_path_shares table for collaboration
  pgm.createTable('learning_path_shares', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    path_id: {
      type: 'uuid',
      notNull: true,
      references: 'learning_paths(id)',
      onDelete: 'CASCADE'
    },
    shared_with_user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    permissions: {
      type: 'varchar(20)',
      notNull: true
    },
    message: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()')
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Create indexes for learning path shares
  pgm.createIndex('learning_path_shares', 'path_id');
  pgm.createIndex('learning_path_shares', 'shared_with_user_id');
  pgm.createIndex('learning_path_shares', ['path_id', 'shared_with_user_id'], { unique: true });
  pgm.createIndex('learning_path_shares', 'permissions');
  pgm.createIndex('learning_path_shares', 'created_at');

  // Add check constraints
  pgm.addConstraint('learning_path_shares', 'valid_permissions', 
    "CHECK (permissions IN ('view', 'collaborate'))");

  // Create updated_at trigger for learning_path_shares
  pgm.sql(`
    CREATE TRIGGER update_learning_path_shares_updated_at
    BEFORE UPDATE ON learning_path_shares
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
  pgm.sql('DROP TRIGGER IF EXISTS update_learning_path_shares_updated_at ON learning_path_shares;');
  pgm.dropTable('learning_path_shares');
};