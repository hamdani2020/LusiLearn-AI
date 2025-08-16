import { Pool } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ContentModerationService } from './content-moderation.service';
import { AgeRange } from '@lusilearn/shared-types';

// Safety and moderation types
export interface SafetyReport {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  reportedContentId?: string;
  sessionId?: string;
  groupId?: string;
  type: SafetyReportType;
  category: SafetyCategory;
  description: string;
  severity: SafetySeverity;
  status: SafetyReportStatus;
  evidence?: SafetyEvidence[];
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
  escalatedAt?: Date;
  escalatedTo?: string;
}

export enum SafetyReportType {
  USER_BEHAVIOR = 'user_behavior',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  BULLYING = 'bullying',
  SPAM = 'spam',
  PRIVACY_VIOLATION = 'privacy_violation',
  SAFETY_CONCERN = 'safety_concern',
  OTHER = 'other'
}

export enum SafetyCategory {
  CONTENT = 'content',
  COMMUNICATION = 'communication',
  BEHAVIOR = 'behavior',
  PRIVACY = 'privacy',
  TECHNICAL = 'technical'
}

export enum SafetySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SafetyReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

export interface SafetyEvidence {
  type: 'message' | 'screenshot' | 'file' | 'log';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ConversationModerationResult {
  isAppropriate: boolean;
  confidence: number;
  flags: string[];
  severity: SafetySeverity;
  action: ModerationAction;
  reason?: string;
  suggestedResponse?: string;
}

export enum ModerationAction {
  NONE = 'none',
  WARNING = 'warning',
  MESSAGE_REMOVAL = 'message_removal',
  TEMPORARY_MUTE = 'temporary_mute',
  SESSION_REMOVAL = 'session_removal',
  ACCOUNT_SUSPENSION = 'account_suspension',
  ESCALATE_TO_HUMAN = 'escalate_to_human'
}

export interface MinorSafetySettings {
  requiresSupervision: boolean;
  allowedCommunicationTypes: string[];
  restrictedFeatures: string[];
  parentalNotifications: boolean;
  emergencyContacts: string[];
  sessionTimeLimit: number; // in minutes
  allowedPeers: string[]; // whitelist of allowed peer IDs
}

export interface ModeratorNotification {
  id: string;
  type: 'safety_report' | 'escalation' | 'critical_incident';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  relatedReportId?: string;
  assignedTo?: string;
  status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved';
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export class SafetyModerationService {
  private contentModerationService: ContentModerationService;

  constructor(
    private db: Pool,
    private aiServiceUrl: string = process.env.AI_SERVICE_URL || 'http://ai-service:8001'
  ) {
    this.contentModerationService = new ContentModerationService();
  }

  /**
   * Monitor conversation messages for inappropriate content
   */
  async moderateConversationMessage(
    sessionId: string,
    userId: string,
    message: string,
    messageType: string = 'text',
    metadata?: Record<string, any>
  ): Promise<ConversationModerationResult> {
    try {
      logger.info(`Moderating conversation message in session ${sessionId} from user ${userId}`);

      // Get user profile to check if they're a minor
      const userProfile = await this.getUserProfile(userId);
      const isMinor = this.isUserMinor(userProfile?.demographics?.ageRange);

      // Run multiple moderation checks
      const [
        aiModerationResult,
        keywordModerationResult,
        contextModerationResult
      ] = await Promise.allSettled([
        this.runAIConversationModeration(message, messageType, metadata),
        this.runKeywordModeration(message),
        this.runContextualModeration(sessionId, userId, message)
      ]);

      // Combine results
      let result: ConversationModerationResult = {
        isAppropriate: true,
        confidence: 0.8,
        flags: [],
        severity: SafetySeverity.LOW,
        action: ModerationAction.NONE
      };

      // Process AI moderation result
      if (aiModerationResult.status === 'fulfilled') {
        const aiResult = aiModerationResult.value;
        if (!aiResult.isAppropriate) {
          result = this.combineModeratorResults(result, aiResult);
        }
      }

      // Process keyword moderation result
      if (keywordModerationResult.status === 'fulfilled') {
        const keywordResult = keywordModerationResult.value;
        if (!keywordResult.isAppropriate) {
          result = this.combineModeratorResults(result, keywordResult);
        }
      }

      // Process contextual moderation result
      if (contextModerationResult.status === 'fulfilled') {
        const contextResult = contextModerationResult.value;
        if (!contextResult.isAppropriate) {
          result = this.combineModeratorResults(result, contextResult);
        }
      }

      // Apply stricter moderation for minors
      if (isMinor && !result.isAppropriate) {
        result.severity = this.escalateSeverityForMinor(result.severity);
        result.action = this.escalateActionForMinor(result.action);
      }

      // Store moderation result
      await this.storeModerationResult(sessionId, userId, message, result);

      // Take immediate action if needed
      if (result.action !== ModerationAction.NONE) {
        await this.executeModerationAction(sessionId, userId, result.action, result.reason);
      }

      logger.info(`Conversation moderation completed for session ${sessionId}:`, {
        isAppropriate: result.isAppropriate,
        severity: result.severity,
        action: result.action
      });

      return result;

    } catch (error) {
      logger.error('Error moderating conversation message:', error);
      
      // Return conservative result on error
      return {
        isAppropriate: false,
        confidence: 0.3,
        flags: ['moderation_error'],
        severity: SafetySeverity.HIGH,
        action: ModerationAction.ESCALATE_TO_HUMAN,
        reason: 'Moderation service encountered an error'
      };
    }
  }

  /**
   * Create a safety report
   */
  async createSafetyReport(
    reporterId: string,
    reportData: {
      reportedUserId?: string;
      reportedContentId?: string;
      sessionId?: string;
      groupId?: string;
      type: SafetyReportType;
      category: SafetyCategory;
      description: string;
      evidence?: SafetyEvidence[];
    }
  ): Promise<SafetyReport> {
    try {
      logger.info(`Creating safety report from user ${reporterId}`);

      // Determine severity based on report type and content
      const severity = this.determineSeverity(reportData.type, reportData.description);

      const report: Omit<SafetyReport, 'id' | 'createdAt' | 'updatedAt'> = {
        reporterId,
        reportedUserId: reportData.reportedUserId,
        reportedContentId: reportData.reportedContentId,
        sessionId: reportData.sessionId,
        groupId: reportData.groupId,
        type: reportData.type,
        category: reportData.category,
        description: reportData.description,
        severity,
        status: SafetyReportStatus.PENDING,
        evidence: reportData.evidence || []
      };

      // Insert into database
      const query = `
        INSERT INTO safety_reports (
          reporter_id, reported_user_id, reported_content_id, session_id, group_id,
          type, category, description, severity, status, evidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at, updated_at
      `;

      const values = [
        report.reporterId,
        report.reportedUserId,
        report.reportedContentId,
        report.sessionId,
        report.groupId,
        report.type,
        report.category,
        report.description,
        report.severity,
        report.status,
        JSON.stringify(report.evidence)
      ];

      const result = await this.db.query(query, values);
      const row = result.rows[0];

      const safetyReport: SafetyReport = {
        ...report,
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      // Auto-escalate high severity reports
      if (severity === SafetySeverity.HIGH || severity === SafetySeverity.CRITICAL) {
        await this.escalateReport(safetyReport.id, 'auto_escalation');
      }

      // Notify moderators
      await this.notifyModerators(safetyReport);

      logger.info(`Created safety report ${safetyReport.id} with severity ${severity}`);
      return safetyReport;

    } catch (error) {
      logger.error('Error creating safety report:', error);
      throw new Error(`Failed to create safety report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Escalate a safety report to human moderators
   */
  async escalateReport(reportId: string, reason: string): Promise<void> {
    try {
      logger.info(`Escalating safety report ${reportId}: ${reason}`);

      const updateQuery = `
        UPDATE safety_reports 
        SET status = $1, escalated_at = NOW(), escalated_to = $2, updated_at = NOW()
        WHERE id = $3
      `;

      await this.db.query(updateQuery, [
        SafetyReportStatus.ESCALATED,
        'human_moderator_team',
        reportId
      ]);

      // Create moderator notification
      await this.createModeratorNotification({
        type: 'escalation',
        priority: 'high',
        title: 'Safety Report Escalated',
        description: `Safety report ${reportId} has been escalated: ${reason}`,
        relatedReportId: reportId
      });

      logger.info(`Successfully escalated safety report ${reportId}`);

    } catch (error) {
      logger.error('Error escalating safety report:', error);
      throw new Error(`Failed to escalate report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get enhanced safety settings for minor users
   */
  async getMinorSafetySettings(userId: string): Promise<MinorSafetySettings> {
    try {
      const query = `
        SELECT minor_safety_settings 
        FROM users 
        WHERE id = $1
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const settings = result.rows[0].minor_safety_settings;
      
      // Return default settings if none exist
      if (!settings) {
        return this.getDefaultMinorSafetySettings();
      }

      return settings;

    } catch (error) {
      logger.error('Error getting minor safety settings:', error);
      return this.getDefaultMinorSafetySettings();
    }
  }

  /**
   * Update safety settings for minor users
   */
  async updateMinorSafetySettings(
    userId: string, 
    settings: Partial<MinorSafetySettings>
  ): Promise<MinorSafetySettings> {
    try {
      logger.info(`Updating minor safety settings for user ${userId}`);

      // Get current settings
      const currentSettings = await this.getMinorSafetySettings(userId);
      const updatedSettings = { ...currentSettings, ...settings };

      const query = `
        UPDATE users 
        SET minor_safety_settings = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING minor_safety_settings
      `;

      const result = await this.db.query(query, [
        JSON.stringify(updatedSettings),
        userId
      ]);

      logger.info(`Updated minor safety settings for user ${userId}`);
      return result.rows[0].minor_safety_settings;

    } catch (error) {
      logger.error('Error updating minor safety settings:', error);
      throw new Error(`Failed to update minor safety settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a collaboration session is safe for minors
   */
  async validateMinorCollaboration(
    minorUserId: string,
    sessionId: string,
    participants: string[]
  ): Promise<{ isAllowed: boolean; reason?: string; restrictions?: string[] }> {
    try {
      logger.info(`Validating minor collaboration for user ${minorUserId} in session ${sessionId}`);

      const safetySettings = await this.getMinorSafetySettings(minorUserId);
      const restrictions: string[] = [];

      // Check if supervision is required
      if (safetySettings.requiresSupervision) {
        const hasSupervisor = await this.checkForSupervisor(sessionId);
        if (!hasSupervisor) {
          return {
            isAllowed: false,
            reason: 'Supervision required but no supervisor present',
            restrictions: ['requires_supervision']
          };
        }
      }

      // Check allowed peers
      if (safetySettings.allowedPeers.length > 0) {
        const unauthorizedPeers = participants.filter(
          participantId => 
            participantId !== minorUserId && 
            !safetySettings.allowedPeers.includes(participantId)
        );

        if (unauthorizedPeers.length > 0) {
          restrictions.push('unauthorized_peers_present');
        }
      }

      // Check session time limits
      const sessionDuration = await this.getSessionDuration(sessionId);
      if (sessionDuration > safetySettings.sessionTimeLimit) {
        restrictions.push('session_time_limit_exceeded');
      }

      // Check for any recent safety reports involving the minor
      const recentReports = await this.getRecentSafetyReports(minorUserId);
      if (recentReports.length > 0) {
        restrictions.push('recent_safety_concerns');
      }

      const isAllowed = restrictions.length === 0;

      logger.info(`Minor collaboration validation result:`, {
        minorUserId,
        sessionId,
        isAllowed,
        restrictions
      });

      return {
        isAllowed,
        reason: isAllowed ? undefined : 'Safety restrictions apply',
        restrictions: restrictions.length > 0 ? restrictions : undefined
      };

    } catch (error) {
      logger.error('Error validating minor collaboration:', error);
      return {
        isAllowed: false,
        reason: 'Safety validation failed',
        restrictions: ['validation_error']
      };
    }
  }

  /**
   * Create a notification for human moderators
   */
  async createModeratorNotification(
    notificationData: Omit<ModeratorNotification, 'id' | 'status' | 'createdAt'>
  ): Promise<ModeratorNotification> {
    try {
      const query = `
        INSERT INTO moderator_notifications (
          type, priority, title, description, related_report_id, assigned_to
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, status, created_at
      `;

      const values = [
        notificationData.type,
        notificationData.priority,
        notificationData.title,
        notificationData.description,
        notificationData.relatedReportId,
        notificationData.assignedTo
      ];

      const result = await this.db.query(query, values);
      const row = result.rows[0];

      const notification: ModeratorNotification = {
        ...notificationData,
        id: row.id,
        status: row.status,
        createdAt: row.created_at
      };

      // Send real-time notification to moderators (placeholder for WebSocket implementation)
      await this.sendRealtimeModeratorNotification(notification);

      logger.info(`Created moderator notification ${notification.id}`);
      return notification;

    } catch (error) {
      logger.error('Error creating moderator notification:', error);
      throw new Error(`Failed to create moderator notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async runAIConversationModeration(
    message: string,
    messageType: string,
    metadata?: Record<string, any>
  ): Promise<ConversationModerationResult> {
    try {
      // Call AI service for conversation moderation
      const response = await fetch(`${this.aiServiceUrl}/api/v1/moderate-conversation/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          message_type: messageType,
          metadata
        })
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        isAppropriate: data.is_appropriate,
        confidence: data.confidence,
        flags: data.flags || [],
        severity: this.mapAISeverity(data.severity),
        action: this.mapAIAction(data.suggested_action),
        reason: data.reason,
        suggestedResponse: data.suggested_response
      };

    } catch (error) {
      logger.error('AI conversation moderation failed:', error);
      
      // Fallback to basic keyword moderation
      return await this.runKeywordModeration(message);
    }
  }

  private async runKeywordModeration(message: string): Promise<ConversationModerationResult> {
    const inappropriateKeywords = [
      'bullying', 'harassment', 'threat', 'violence', 'hate', 'discrimination',
      'inappropriate', 'explicit', 'offensive', 'abuse', 'spam'
    ];

    const lowerMessage = message.toLowerCase();
    const flags: string[] = [];
    let severity = SafetySeverity.LOW;
    let action = ModerationAction.NONE;

    for (const keyword of inappropriateKeywords) {
      if (lowerMessage.includes(keyword)) {
        flags.push(`keyword_${keyword}`);
        
        // Escalate severity based on keyword type
        if (['threat', 'violence', 'hate'].includes(keyword)) {
          severity = SafetySeverity.HIGH;
          action = ModerationAction.ESCALATE_TO_HUMAN;
        } else if (['bullying', 'harassment', 'abuse'].includes(keyword)) {
          severity = SafetySeverity.MEDIUM;
          action = ModerationAction.WARNING;
        }
      }
    }

    return {
      isAppropriate: flags.length === 0,
      confidence: 0.7,
      flags,
      severity,
      action,
      reason: flags.length > 0 ? `Inappropriate keywords detected: ${flags.join(', ')}` : undefined
    };
  }

  private async runContextualModeration(
    sessionId: string,
    userId: string,
    message: string
  ): Promise<ConversationModerationResult> {
    try {
      // Check user's recent message history for patterns
      const recentMessages = await this.getUserRecentMessages(sessionId, userId, 10);
      
      // Check for spam (repeated messages)
      const duplicateCount = recentMessages.filter(msg => msg.message === message).length;
      if (duplicateCount >= 3) {
        return {
          isAppropriate: false,
          confidence: 0.9,
          flags: ['spam_repeated_message'],
          severity: SafetySeverity.MEDIUM,
          action: ModerationAction.TEMPORARY_MUTE,
          reason: 'Repeated message spam detected'
        };
      }

      // Check message frequency (rate limiting)
      const recentMessageCount = recentMessages.filter(
        msg => new Date(msg.timestamp).getTime() > Date.now() - 60000 // Last minute
      ).length;

      if (recentMessageCount > 10) {
        return {
          isAppropriate: false,
          confidence: 0.8,
          flags: ['spam_high_frequency'],
          severity: SafetySeverity.MEDIUM,
          action: ModerationAction.TEMPORARY_MUTE,
          reason: 'High message frequency detected'
        };
      }

      return {
        isAppropriate: true,
        confidence: 0.8,
        flags: [],
        severity: SafetySeverity.LOW,
        action: ModerationAction.NONE
      };

    } catch (error) {
      logger.error('Contextual moderation failed:', error);
      return {
        isAppropriate: true,
        confidence: 0.5,
        flags: [],
        severity: SafetySeverity.LOW,
        action: ModerationAction.NONE
      };
    }
  }

  private combineModeratorResults(
    result1: ConversationModerationResult,
    result2: ConversationModerationResult
  ): ConversationModerationResult {
    return {
      isAppropriate: result1.isAppropriate && result2.isAppropriate,
      confidence: Math.min(result1.confidence, result2.confidence),
      flags: [...result1.flags, ...result2.flags],
      severity: this.getHigherSeverity(result1.severity, result2.severity),
      action: this.getStricterAction(result1.action, result2.action),
      reason: [result1.reason, result2.reason].filter(Boolean).join('; ')
    };
  }

  private escalateSeverityForMinor(severity: SafetySeverity): SafetySeverity {
    const severityOrder = {
      [SafetySeverity.LOW]: SafetySeverity.MEDIUM,
      [SafetySeverity.MEDIUM]: SafetySeverity.HIGH,
      [SafetySeverity.HIGH]: SafetySeverity.CRITICAL,
      [SafetySeverity.CRITICAL]: SafetySeverity.CRITICAL
    };

    return severityOrder[severity];
  }

  private escalateActionForMinor(action: ModerationAction): ModerationAction {
    const actionOrder = {
      [ModerationAction.NONE]: ModerationAction.WARNING,
      [ModerationAction.WARNING]: ModerationAction.TEMPORARY_MUTE,
      [ModerationAction.MESSAGE_REMOVAL]: ModerationAction.SESSION_REMOVAL,
      [ModerationAction.TEMPORARY_MUTE]: ModerationAction.SESSION_REMOVAL,
      [ModerationAction.SESSION_REMOVAL]: ModerationAction.ESCALATE_TO_HUMAN,
      [ModerationAction.ACCOUNT_SUSPENSION]: ModerationAction.ESCALATE_TO_HUMAN,
      [ModerationAction.ESCALATE_TO_HUMAN]: ModerationAction.ESCALATE_TO_HUMAN
    };

    return actionOrder[action];
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const query = `SELECT demographics FROM users WHERE id = $1`;
      const result = await this.db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user profile:', error);
      return null;
    }
  }

  private isUserMinor(ageRange?: string): boolean {
    return ageRange === AgeRange.CHILD || ageRange === AgeRange.TEEN;
  }

  private determineSeverity(type: SafetyReportType, description: string): SafetySeverity {
    const highSeverityTypes = [
      SafetyReportType.HARASSMENT,
      SafetyReportType.BULLYING,
      SafetyReportType.SAFETY_CONCERN
    ];

    const criticalKeywords = ['threat', 'violence', 'harm', 'danger', 'emergency'];
    const hasкритicalKeywords = criticalKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (hasкритicalKeywords) {
      return SafetySeverity.CRITICAL;
    }

    if (highSeverityTypes.includes(type)) {
      return SafetySeverity.HIGH;
    }

    return SafetySeverity.MEDIUM;
  }

  private getDefaultMinorSafetySettings(): MinorSafetySettings {
    return {
      requiresSupervision: true,
      allowedCommunicationTypes: ['text', 'voice_supervised'],
      restrictedFeatures: ['private_messaging', 'file_sharing', 'screen_sharing'],
      parentalNotifications: true,
      emergencyContacts: [],
      sessionTimeLimit: 60, // 1 hour
      allowedPeers: []
    };
  }

  private async storeModerationResult(
    sessionId: string,
    userId: string,
    message: string,
    result: ConversationModerationResult
  ): Promise<void> {
    try {
      const query = `
        UPDATE collaboration_messages 
        SET is_moderated = true, moderation_result = $1
        WHERE session_id = $2 AND user_id = $3 AND message = $4
      `;

      await this.db.query(query, [
        JSON.stringify(result),
        sessionId,
        userId,
        message
      ]);

    } catch (error) {
      logger.error('Error storing moderation result:', error);
    }
  }

  private async executeModerationAction(
    sessionId: string,
    userId: string,
    action: ModerationAction,
    reason?: string
  ): Promise<void> {
    try {
      logger.info(`Executing moderation action ${action} for user ${userId} in session ${sessionId}`);

      switch (action) {
        case ModerationAction.WARNING:
          await this.sendWarningToUser(userId, reason);
          break;
        case ModerationAction.MESSAGE_REMOVAL:
          await this.removeMessage(sessionId, userId);
          break;
        case ModerationAction.TEMPORARY_MUTE:
          await this.muteUser(sessionId, userId, 300); // 5 minutes
          break;
        case ModerationAction.SESSION_REMOVAL:
          await this.removeUserFromSession(sessionId, userId);
          break;
        case ModerationAction.ESCALATE_TO_HUMAN:
          await this.escalateToHumanModerator(sessionId, userId, reason);
          break;
      }

    } catch (error) {
      logger.error('Error executing moderation action:', error);
    }
  }

  private async notifyModerators(report: SafetyReport): Promise<void> {
    const priority = report.severity === SafetySeverity.CRITICAL ? 'urgent' :
                    report.severity === SafetySeverity.HIGH ? 'high' : 'medium';

    await this.createModeratorNotification({
      type: 'safety_report',
      priority,
      title: `New Safety Report: ${report.type}`,
      description: `${report.description.substring(0, 100)}...`,
      relatedReportId: report.id
    });
  }

  private async sendRealtimeModeratorNotification(notification: ModeratorNotification): Promise<void> {
    // Placeholder for WebSocket implementation
    logger.info(`Would send real-time notification to moderators:`, notification);
  }

  private mapAISeverity(aiSeverity: string): SafetySeverity {
    const mapping: Record<string, SafetySeverity> = {
      'low': SafetySeverity.LOW,
      'medium': SafetySeverity.MEDIUM,
      'high': SafetySeverity.HIGH,
      'critical': SafetySeverity.CRITICAL
    };
    return mapping[aiSeverity] || SafetySeverity.MEDIUM;
  }

  private mapAIAction(aiAction: string): ModerationAction {
    const mapping: Record<string, ModerationAction> = {
      'none': ModerationAction.NONE,
      'warning': ModerationAction.WARNING,
      'remove_message': ModerationAction.MESSAGE_REMOVAL,
      'mute': ModerationAction.TEMPORARY_MUTE,
      'remove_from_session': ModerationAction.SESSION_REMOVAL,
      'escalate': ModerationAction.ESCALATE_TO_HUMAN
    };
    return mapping[aiAction] || ModerationAction.NONE;
  }

  private getHigherSeverity(severity1: SafetySeverity, severity2: SafetySeverity): SafetySeverity {
    const order = [SafetySeverity.LOW, SafetySeverity.MEDIUM, SafetySeverity.HIGH, SafetySeverity.CRITICAL];
    const index1 = order.indexOf(severity1);
    const index2 = order.indexOf(severity2);
    return order[Math.max(index1, index2)];
  }

  private getStricterAction(action1: ModerationAction, action2: ModerationAction): ModerationAction {
    const order = [
      ModerationAction.NONE,
      ModerationAction.WARNING,
      ModerationAction.MESSAGE_REMOVAL,
      ModerationAction.TEMPORARY_MUTE,
      ModerationAction.SESSION_REMOVAL,
      ModerationAction.ACCOUNT_SUSPENSION,
      ModerationAction.ESCALATE_TO_HUMAN
    ];
    const index1 = order.indexOf(action1);
    const index2 = order.indexOf(action2);
    return order[Math.max(index1, index2)];
  }

  // Placeholder methods for moderation actions
  private async sendWarningToUser(userId: string, reason?: string): Promise<void> {
    logger.info(`Sending warning to user ${userId}: ${reason}`);
  }

  private async removeMessage(sessionId: string, userId: string): Promise<void> {
    logger.info(`Removing message from user ${userId} in session ${sessionId}`);
  }

  private async muteUser(sessionId: string, userId: string, duration: number): Promise<void> {
    logger.info(`Muting user ${userId} in session ${sessionId} for ${duration} seconds`);
  }

  private async removeUserFromSession(sessionId: string, userId: string): Promise<void> {
    logger.info(`Removing user ${userId} from session ${sessionId}`);
  }

  private async escalateToHumanModerator(sessionId: string, userId: string, reason?: string): Promise<void> {
    logger.info(`Escalating to human moderator: user ${userId} in session ${sessionId}, reason: ${reason}`);
  }

  private async getUserRecentMessages(sessionId: string, userId: string, limit: number): Promise<any[]> {
    try {
      const query = `
        SELECT message, timestamp 
        FROM collaboration_messages 
        WHERE session_id = $1 AND user_id = $2 
        ORDER BY timestamp DESC 
        LIMIT $3
      `;
      const result = await this.db.query(query, [sessionId, userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user recent messages:', error);
      return [];
    }
  }

  private async checkForSupervisor(sessionId: string): Promise<boolean> {
    // Placeholder - would check if there's a verified supervisor in the session
    return false;
  }

  private async getSessionDuration(sessionId: string): Promise<number> {
    // Placeholder - would calculate current session duration
    return 0;
  }

  private async getRecentSafetyReports(userId: string): Promise<SafetyReport[]> {
    try {
      const query = `
        SELECT * FROM safety_reports 
        WHERE (reported_user_id = $1 OR reporter_id = $1) 
        AND created_at > NOW() - INTERVAL '7 days'
        AND status != 'dismissed'
      `;
      const result = await this.db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting recent safety reports:', error);
      return [];
    }
  }
}