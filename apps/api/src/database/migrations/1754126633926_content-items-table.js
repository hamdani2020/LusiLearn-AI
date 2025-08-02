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
  // Create content_items table
  pgm.createTable('content_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    source: {
      type: 'varchar(50)',
      notNull: true
    },
    external_id: {
      type: 'varchar(255)',
      notNull: true
    },
    url: {
      type: 'text',
      notNull: true
    },
    title: {
      type: 'varchar(500)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    thumbnail_url: {
      type: 'text'
    },
    metadata: {
      type: 'jsonb',
      notNull: true
    },
    quality_metrics: {
      type: 'jsonb',
      notNull: true
    },
    age_rating: {
      type: 'varchar(20)',
      notNull: true
    },
    embeddings: {
      type: 'jsonb'
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true
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

  // Create indexes for better query performance
  pgm.createIndex('content_items', 'source');
  pgm.createIndex('content_items', ['source', 'external_id'], { unique: true });
  pgm.createIndex('content_items', 'is_active');
  pgm.createIndex('content_items', 'age_rating');
  pgm.createIndex('content_items', 'created_at');
  
  // GIN indexes for JSONB columns for better search performance
  pgm.createIndex('content_items', 'metadata', { method: 'gin' });
  pgm.createIndex('content_items', 'quality_metrics', { method: 'gin' });
  
  // Full-text search index
  pgm.sql(`
    CREATE INDEX content_items_search_idx ON content_items 
    USING gin(to_tsvector('english', title || ' ' || description));
  `);

  // Add check constraints
  pgm.addConstraint('content_items', 'valid_source', 
    "CHECK (source IN ('youtube', 'khan_academy', 'coursera', 'github', 'internal'))");
  
  pgm.addConstraint('content_items', 'valid_age_rating', 
    "CHECK (age_rating IN ('all_ages', 'teen', 'adult'))");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('content_items');
};
