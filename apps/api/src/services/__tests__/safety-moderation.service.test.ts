import { Pool } from 'pg';
import { SafetyModerationService, SafetyReportType, SafetyCategory, SafetySeverity, ModerationAction } from '../safety-moderation.service';
import { AgeRange } from '@lusilearn/shared-types';

// Mock the database pool
const mockDb = {
  query: jest.fn()
} as unknown as Pool;

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('SafetyModerationService', () => {
  let service: SafetyModerationService;

  beforeEach(() => {
    service = new SafetyModerationService(mockDb, 'http://test-ai-service:8001');
    jest.clearAllMocks();
  });

  describe('moderateConversationMessage', () => {
    it('should moderate a conversation message and return appropriate result', async () => {
      // Mock user profile query
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.ADULT_26_40 } }] }) // getUserProfile
        .mockResolvedValueOnce({ rows: [] }) // getUserRecentMessages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      // Mock AI service response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'This is a test message',
        'text'
      );

      expect(result).toBeDefined();
      expect(result.isAppropriate).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.flags).toBeInstanceOf(Array);
      expect(result.severity).toBeDefined();
      expect(result.action).toBeDefined();
    });

    it('should escalate severity and action for minor users', async () => {
      // Mock minor user profile
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.TEEN_13_17 } }] }) // getUserProfile
        .mockResolvedValueOnce({ rows: [] }) // getUserRecentMessages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      // Mock AI service failure to trigger keyword moderation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.moderateConversationMessage(
        'session-123',
        'minor-user-456',
        'This message contains bullying content',
        'text'
      );

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('keyword_bullying');
      // Should be escalated for minor
      expect([SafetySeverity.MEDIUM, SafetySeverity.HIGH, SafetySeverity.CRITICAL]).toContain(result.severity);
    });

    it('should detect spam through contextual moderation', async () => {
      // Mock user profile
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.TEEN_13_17 } }] }) // getUserProfile - minor user
        .mockResolvedValueOnce({ 
          rows: [
            { message: 'spam message', timestamp: new Date() },
            { message: 'spam message', timestamp: new Date() },
            { message: 'spam message', timestamp: new Date() }
          ] 
        }) // getUserRecentMessages - repeated messages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'spam message',
        'text'
      );

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('spam_repeated_message');
      // For minor users, action gets escalated from TEMPORARY_MUTE to SESSION_REMOVAL
      expect(result.action).toBe(ModerationAction.SESSION_REMOVAL);
    });
  });

  describe('createSafetyReport', () => {
    it('should create a safety report successfully', async () => {
      const mockReportId = 'report-123';
      const mockTimestamp = new Date();

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: mockReportId, 
            created_at: mockTimestamp, 
            updated_at: mockTimestamp 
          }] 
        })
        .mockResolvedValueOnce({ rows: [] }) // escalateReport update (for high severity)
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'notification-id', 
            status: 'pending', 
            created_at: mockTimestamp 
          }] 
        }); // createModeratorNotification

      const reportData = {
        reportedUserId: 'reported-user-123',
        type: SafetyReportType.HARASSMENT,
        category: SafetyCategory.BEHAVIOR,
        description: 'User was harassing other participants in the study group',
        evidence: [{
          type: 'message' as const,
          content: 'Inappropriate message content',
          timestamp: new Date()
        }]
      };

      const result = await service.createSafetyReport('reporter-456', reportData);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockReportId);
      expect(result.reporterId).toBe('reporter-456');
      expect(result.type).toBe(SafetyReportType.HARASSMENT);
      expect(result.severity).toBe(SafetySeverity.HIGH); // Harassment should be high severity
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO safety_reports'),
        expect.arrayContaining(['reporter-456'])
      );
    });

    it('should auto-escalate high severity reports', async () => {
      const mockReportId = 'report-123';
      const mockTimestamp = new Date();

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: mockReportId, 
            created_at: mockTimestamp, 
            updated_at: mockTimestamp 
          }] 
        })
        .mockResolvedValueOnce({ rows: [] }) // escalateReport update
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'notification-id', 
            status: 'pending', 
            created_at: mockTimestamp 
          }] 
        }); // createModeratorNotification

      const reportData = {
        reportedUserId: 'reported-user-123',
        type: SafetyReportType.SAFETY_CONCERN,
        category: SafetyCategory.BEHAVIOR,
        description: 'User made threats of violence against other participants'
      };

      const result = await service.createSafetyReport('reporter-456', reportData);

      expect(result.severity).toBe(SafetySeverity.CRITICAL); // Should be critical due to "threat" keyword
      // Should have called escalateReport due to high severity
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE safety_reports'),
        expect.arrayContaining(['escalated'])
      );
    });
  });

  describe('validateMinorCollaboration', () => {
    it('should allow collaboration when all safety requirements are met', async () => {
      // Mock minor safety settings
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ 
          rows: [{ 
            minor_safety_settings: {
              requiresSupervision: false,
              allowedPeers: ['peer-1', 'peer-2'],
              sessionTimeLimit: 60
            }
          }] 
        })
        .mockResolvedValueOnce({ rows: [] }); // getRecentSafetyReports

      const result = await service.validateMinorCollaboration(
        'minor-user-123',
        'session-456',
        ['peer-1', 'peer-2']
      );

      expect(result.isAllowed).toBe(true);
      expect(result.restrictions).toBeUndefined();
    });

    it('should deny collaboration when supervision is required but not present', async () => {
      // Mock minor safety settings requiring supervision
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ 
          rows: [{ 
            minor_safety_settings: {
              requiresSupervision: true,
              allowedPeers: [],
              sessionTimeLimit: 60
            }
          }] 
        });

      const result = await service.validateMinorCollaboration(
        'minor-user-123',
        'session-456',
        ['peer-1', 'peer-2']
      );

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Supervision required but no supervisor present');
      expect(result.restrictions).toContain('requires_supervision');
    });

    it('should apply restrictions for unauthorized peers', async () => {
      // Mock minor safety settings with limited allowed peers
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ 
          rows: [{ 
            minor_safety_settings: {
              requiresSupervision: false,
              allowedPeers: ['peer-1'], // Only peer-1 is allowed
              sessionTimeLimit: 60
            }
          }] 
        })
        .mockResolvedValueOnce({ rows: [] }) // getSessionDuration
        .mockResolvedValueOnce({ rows: [] }); // getRecentSafetyReports

      const result = await service.validateMinorCollaboration(
        'minor-user-123',
        'session-456',
        ['peer-1', 'peer-2', 'peer-3'] // peer-2 and peer-3 are not allowed
      );

      expect(result.isAllowed).toBe(false);
      expect(result.restrictions).toContain('unauthorized_peers_present');
    });
  });

  describe('getMinorSafetySettings', () => {
    it('should return user-specific safety settings', async () => {
      const mockSettings = {
        requiresSupervision: true,
        allowedCommunicationTypes: ['text', 'voice_supervised'],
        restrictedFeatures: ['private_messaging', 'file_sharing', 'screen_sharing'],
        parentalNotifications: true,
        emergencyContacts: [],
        sessionTimeLimit: 60,
        allowedPeers: []
      };

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ 
        rows: [{ minor_safety_settings: mockSettings }] 
      });

      const result = await service.getMinorSafetySettings('minor-user-123');

      expect(result).toEqual(mockSettings);
    });

    it('should return default settings when none exist', async () => {
      (mockDb.query as jest.Mock).mockResolvedValueOnce({ 
        rows: [{ minor_safety_settings: null }] 
      });

      const result = await service.getMinorSafetySettings('minor-user-123');

      expect(result.requiresSupervision).toBe(true);
      expect(result.allowedCommunicationTypes).toContain('text');
      expect(result.restrictedFeatures).toContain('private_messaging');
      expect(result.sessionTimeLimit).toBe(60);
    });
  });

  describe('updateMinorSafetySettings', () => {
    it('should update minor safety settings successfully', async () => {
      const currentSettings = {
        requiresSupervision: true,
        allowedCommunicationTypes: ['text', 'voice_supervised'],
        restrictedFeatures: ['private_messaging', 'file_sharing', 'screen_sharing'],
        parentalNotifications: true,
        emergencyContacts: [],
        sessionTimeLimit: 60,
        allowedPeers: []
      };

      const updatedSettings = {
        ...currentSettings,
        sessionTimeLimit: 90,
        allowedPeers: ['peer-1', 'peer-2']
      };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ minor_safety_settings: currentSettings }] }) // getCurrentSettings
        .mockResolvedValueOnce({ rows: [{ minor_safety_settings: updatedSettings }] }); // update

      const result = await service.updateMinorSafetySettings('minor-user-123', {
        sessionTimeLimit: 90,
        allowedPeers: ['peer-1', 'peer-2']
      });

      expect(result.sessionTimeLimit).toBe(90);
      expect(result.allowedPeers).toEqual(['peer-1', 'peer-2']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([JSON.stringify(updatedSettings)])
      );
    });
  });

  describe('escalateReport', () => {
    it('should escalate a safety report successfully', async () => {
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // escalation update
        .mockResolvedValueOnce({ rows: [{ id: 'notification-id', status: 'pending', created_at: new Date() }] }); // moderator notification

      await service.escalateReport('report-123', 'High severity incident requiring immediate attention');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE safety_reports'),
        expect.arrayContaining(['escalated', 'human_moderator_team', 'report-123'])
      );

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO moderator_notifications'),
        expect.arrayContaining(['escalation', 'high'])
      );
    });
  });

  describe('createModeratorNotification', () => {
    it('should create a moderator notification successfully', async () => {
      const mockNotificationId = 'notification-123';
      const mockTimestamp = new Date();

      (mockDb.query as jest.Mock).mockResolvedValueOnce({ 
        rows: [{ 
          id: mockNotificationId, 
          status: 'pending',
          created_at: mockTimestamp 
        }] 
      });

      const notificationData = {
        type: 'safety_report' as const,
        priority: 'high' as const,
        title: 'New Safety Report',
        description: 'A new safety report requires attention',
        relatedReportId: 'report-123'
      };

      const result = await service.createModeratorNotification(notificationData);

      expect(result.id).toBe(mockNotificationId);
      expect(result.type).toBe('safety_report');
      expect(result.priority).toBe('high');
      expect(result.status).toBe('pending');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO moderator_notifications'),
        expect.arrayContaining(['safety_report', 'high', 'New Safety Report'])
      );
    });
  });

  describe('keyword moderation', () => {
    it('should detect inappropriate keywords', async () => {
      // Mock user profile
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.ADULT_26_40 } }] })
        .mockResolvedValueOnce({ rows: [] }) // getUserRecentMessages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      // Mock AI service failure to trigger keyword moderation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'This message contains harassment and bullying',
        'text'
      );

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('keyword_harassment');
      expect(result.flags).toContain('keyword_bullying');
      expect(result.severity).toBe(SafetySeverity.HIGH);
      expect(result.action).toBe(ModerationAction.TEMPORARY_MUTE);
    });

    it('should escalate for high-risk keywords', async () => {
      // Mock user profile
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.ADULT_26_40 } }] })
        .mockResolvedValueOnce({ rows: [] }) // getUserRecentMessages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      // Mock AI service failure to trigger keyword moderation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'This message contains threats of violence',
        'text'
      );

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('keyword_threat');
      expect(result.flags).toContain('keyword_violence');
      expect(result.severity).toBe(SafetySeverity.CRITICAL);
      expect(result.action).toBe(ModerationAction.ESCALATE_TO_HUMAN);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (mockDb.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'test message',
        'text'
      );

      expect(result.isAppropriate).toBe(false);
      expect(result.confidence).toBe(0.3);
      expect(result.flags).toContain('moderation_error');
      expect(result.action).toBe(ModerationAction.ESCALATE_TO_HUMAN);
    });

    it('should handle AI service errors with fallback', async () => {
      // Mock user profile
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ demographics: { ageRange: AgeRange.ADULT_26_40 } }] })
        .mockResolvedValueOnce({ rows: [] }) // getUserRecentMessages
        .mockResolvedValueOnce({ rows: [{ id: 'log-id' }] }); // storeModerationResult

      // Mock AI service failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      const result = await service.moderateConversationMessage(
        'session-123',
        'user-456',
        'This is a clean message',
        'text'
      );

      // Should still work with keyword moderation fallback
      expect(result).toBeDefined();
      expect(result.isAppropriate).toBe(true); // Clean message should pass keyword moderation
    });
  });
});