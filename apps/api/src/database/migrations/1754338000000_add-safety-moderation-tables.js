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
  // Create enum types for safety and moderation
  pgm.createType('safety_report_type', [
    'user_behavior',
    'inappropriate_content', 
    'harassment',
    'bullying',
    'spam',
    'privacy_violation',
    'safety_concern',
    'other'
  ]);

  pgm.createType('safety_category', [
    'content',
    'communication',
    'behavior', 
    'privacy',
    'technical'
  ]);

  pgm.createType('safety_severity', [
    'low',
    'medium',
    'high',
    'critical'
  ]);

  pgm.createType('safety_report_status', [
    'pending',
    'under_review',
    'escalated',
    'resolved',
    'dismissed'
  ]);

  pgm.createType('moderation_action', [
    'none',
    'warning',
    'message_removal',
    'temporary_mute',
    'session_removal',
    'account_suspension',
    'escalate_to_human'
  ]);

  // Create safety_reports table
  pgm.createTable('safety_reports', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    reporter_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    reported_user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    reported_content_id: {
      type: 'uuid',
      notNull: false,
      references: 'content_items(id)',
      onDelete: 'CASCADE'
    },
    session_id: {
      type: 'varchar(255)',
      notNull: false
    },
    group_id: {
      type: 'uuid',
      notNull: false,
      references: 'study_groups(id)',
      onDelete: 'CASCADE'
    },
    type: {
      type: 'safety_report_type',
      notNull: true
    },
    category: {
      type: 'safety_category',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    severity: {
      type: 'safety_severity',
      notNull: true
    },
    status: {
      type: 'safety_report_status',
      notNull: true,
      default: 'pending'
    },
    evidence: {
      type: 'jsonb',
      notNull: false,
      default: '[]'
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
    },
    reviewed_at: {
      type: 'timestamp with time zone',
      notNull: false
    },
    reviewed_by: {
      type: 'uuid',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    resolution: {
      type: 'text',
      notNull: false
    },
    escalated_at: {
      type: 'timestamp with time zone',
      notNull: false
    },
    escalated_to: {
      type: 'varchar(255)',
      notNull: false
    }
  });

  // Create moderator_notifications table
  pgm.createTable('moderator_notifications', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    type: {
      type: 'varchar(50)',
      notNull: true,
      check: "type IN ('safety_report', 'escalation', 'critical_incident')"
    },
    priority: {
      type: 'varchar(20)',
      notNull: true,
      check: "priority IN ('low', 'medium', 'high', 'urgent')"
    },
    title: {
      type: 'varchar(255)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    related_report_id: {
      type: 'uuid',
      notNull: false,
      references: 'safety_reports(id)',
      onDelete: 'CASCADE'
    },
    assigned_to: {
      type: 'uuid',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL'
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'acknowledged', 'in_progress', 'resolved')"
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()')
    },
    acknowledged_at: {
      type: 'timestamp with time zone',
      notNull: false
    },
    resolved_at: {
      type: 'timestamp with time zone',
      notNull: false
    }
  });

  // Create conversation_moderation_log table
  pgm.createTable('conversation_moderation_log', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    session_id: {
      type: 'varchar(255)',
      notNull: true
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    message_content: {
      type: 'text',
      notNull: true
    },
    moderation_result: {
      type: 'jsonb',
      notNull: true
    },
    action_taken: {
      type: 'moderation_action',
      notNull: true
    },
    is_appropriate: {
      type: 'boolean',
      notNull: true
    },
    confidence_score: {
      type: 'decimal(3,2)',
      notNull: true,
      check: 'confidence_score >= 0 AND confidence_score <= 1'
    },
    flags: {
      type: 'jsonb',
      notNull: false,
      default: '[]'
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()')
    }
  });

  // Add minor_safety_settings column to users table
  pgm.addColumn('users', {
    minor_safety_settings: {
      type: 'jsonb',
      notNull: false,
      comment: 'Enhanced safety settings for minor users'
    }
  });

  // Create indexes for better performance
  pgm.createIndex('safety_reports', 'reporter_id');
  pgm.createIndex('safety_reports', 'reported_user_id');
  pgm.createIndex('safety_reports', 'reported_content_id');
  pgm.createIndex('safety_reports', 'session_id');
  pgm.createIndex('safety_reports', 'group_id');
  pgm.createIndex('safety_reports', 'type');
  pgm.createIndex('safety_reports', 'category');
  pgm.createIndex('safety_reports', 'severity');
  pgm.createIndex('safety_reports', 'status');
  pgm.createIndex('safety_reports', 'created_at');
  pgm.createIndex('safety_reports', ['status', 'severity', 'created_at']);

  pgm.createIndex('moderator_notifications', 'type');
  pgm.createIndex('moderator_notifications', 'priority');
  pgm.createIndex('moderator_notifications', 'status');
  pgm.createIndex('moderator_notifications', 'related_report_id');
  pgm.createIndex('moderator_notifications', 'assigned_to');
  pgm.createIndex('moderator_notifications', 'created_at');
  pgm.createIndex('moderator_notifications', ['status', 'priority', 'created_at']);

  pgm.createIndex('conversation_moderation_log', 'session_id');
  pgm.createIndex('conversation_moderation_log', 'user_id');
  pgm.createIndex('conversation_moderation_log', 'action_taken');
  pgm.createIndex('conversation_moderation_log', 'is_appropriate');
  pgm.createIndex('conversation_moderation_log', 'created_at');
  pgm.createIndex('conversation_moderation_log', ['session_id', 'user_id', 'created_at']);

  // Add trigger to update updated_at timestamp for safety_reports
  pgm.sql(`
    CREATE TRIGGER update_safety_reports_updated_at 
    BEFORE UPDATE ON safety_reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  // Add constraints for data integrity
  pgm.addConstraint('safety_reports', 'at_least_one_target', 
    'CHECK (reported_user_id IS NOT NULL OR reported_content_id IS NOT NULL OR session_id IS NOT NULL OR group_id IS NOT NULL)'
  );

  pgm.addConstraint('conversation_moderation_log', 'valid_confidence_range',
    'CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)'
  );

  // Create partial index for active safety reports
  pgm.sql(`
    CREATE INDEX idx_active_safety_reports 
    ON safety_reports (created_at DESC) 
    WHERE status IN ('pending', 'under_review', 'escalated');
  `);

  // Create partial index for urgent moderator notifications
  pgm.sql(`
    CREATE INDEX idx_urgent_moderator_notifications 
    ON moderator_notifications (created_at DESC) 
    WHERE status = 'pending' AND priority IN ('high', 'urgent');
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  // Drop triggers first
  pgm.sql('DROP TRIGGER IF EXISTS update_safety_reports_updated_at ON safety_reports;');

  // Drop indexes
  pgm.sql('DROP INDEX IF EXISTS idx_urgent_moderator_notifications;');
  pgm.sql('DROP INDEX IF EXISTS idx_active_safety_reports;');

  // Remove column from users table
  pgm.dropColumn('users', 'minor_safety_settings');

  // Drop tables in reverse order
  pgm.dropTable('conversation_moderation_log');
  pgm.dropTable('moderator_notifications');
  pgm.dropTable('safety_reports');

  // Drop enum types
  pgm.dropType('moderation_action');
  pgm.dropType('safety_report_status');
  pgm.dropType('safety_severity');
  pgm.dropType('safety_category');
  pgm.dropType('safety_report_type');
};