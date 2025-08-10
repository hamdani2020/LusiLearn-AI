import { Pool } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  StudyGroup,
  PeerMatch,
  MatchingCriteria,
  CollaborationPreferences,
  CollaborationSession,
  ModerationResult,
  GroupParticipant,
  CollaborationActivity,
  ModerationLevel,
  PrivacyLevel,
  CollaborationActivityType,
  StudyGroupSchema,
  PeerMatchSchema,
  CollaborationPreferencesSchema,
  CreateStudyGroupSchema,
  AgeRange
} from '@lusilearn/shared-types';
import {
  SafetyModerationService,
  SafetyReportType,
  SafetyCategory,
  ConversationModerationResult
} from './safety-moderation.service';

// AI Service integration types
interface AIServicePeerMatchRequest {
  user_id: string;
  subjects: string[];
  skill_levels: Record<string, string>;
  learning_goals: string[];
  availability: Record<string, string[]>;
  communication_preferences: string[];
  age_range?: string;
  education_level?: string;
}

interface AIServicePeerMatch {
  user_id: string;
  compatibility_score: number;
  shared_subjects: string[];
  complementary_skills: Record<string, string>;
  common_goals: string[];
  availability_overlap: string[];
  communication_match: string[];
  match_reasons: string[];
}

export class CollaborationService {
  private safetyModerationService: SafetyModerationService;

  constructor(
    private db: Pool,
    private aiServiceUrl: string = process.env.AI_SERVICE_URL || 'http://ai-service:8001'
  ) {
    this.safetyModerationService = new SafetyModerationService(this.db, this.aiServiceUrl);
  }

  /**
   * Find peer matches using AI service recommendations
   */
  async matchPeers(userId: string, criteria: MatchingCriteria): Promise<PeerMatch[]> {
    try {
      logger.info(`Finding peer matches for user ${userId}`);

      // Get user profile and preferences
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Prepare AI service request
      const aiRequest: AIServicePeerMatchRequest = {
        user_id: userId,
        subjects: criteria.subjects,
        skill_levels: this.convertSkillLevels(criteria.subjects, criteria.skillLevels),
        learning_goals: criteria.learningGoals,
        availability: await this.getUserAvailability(userId),
        communication_preferences: await this.getUserCommunicationPreferences(userId),
        age_range: criteria.ageRange,
        education_level: userProfile.education_level
      };

      // Call AI service for peer matching
      const aiMatches = await this.callAIServiceForMatching(aiRequest);

      // Convert AI matches to our format and store in database
      const peerMatches: PeerMatch[] = [];
      logger.info(`Converting ${aiMatches.length} AI matches to PeerMatch format`);

      for (const aiMatch of aiMatches) {
        try {
          const peerMatch: PeerMatch = {
            userId: aiMatch.user_id,
            compatibilityScore: aiMatch.compatibility_score,
            sharedInterests: aiMatch.shared_subjects || [],
            complementarySkills: Object.keys(aiMatch.complementary_skills || {}),
            matchReason: (aiMatch.match_reasons || []).join('; '),
            estimatedCollaborationSuccess: Math.min(aiMatch.compatibility_score * 1.2, 100)
          };

          // Store match in database
          await this.storePeerMatch(userId, peerMatch);
          peerMatches.push(peerMatch);

          logger.info(`Converted match: ${peerMatch.userId} with score ${peerMatch.compatibilityScore}`);
        } catch (error) {
          logger.error(`Error converting AI match:`, error);
          logger.error(`AI match data:`, JSON.stringify(aiMatch, null, 2));
        }
      }

      logger.info(`Found ${peerMatches.length} peer matches for user ${userId}`);
      return peerMatches;

    } catch (error) {
      logger.error('Error finding peer matches:', error);
      throw new Error(`Failed to find peer matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new study group
   */
  async createStudyGroup(creatorId: string, groupData: z.infer<typeof CreateStudyGroupSchema>): Promise<StudyGroup> {
    try {
      logger.info(`Creating study group for user ${creatorId}`);

      // Validate input
      const validatedData = CreateStudyGroupSchema.parse(groupData);

      // Create group participant for creator
      const creatorParticipant: GroupParticipant = {
        userId: creatorId,
        role: 'admin',
        joinedAt: new Date(),
        isActive: true,
        contributionScore: 0
      };

      const studyGroup: StudyGroup = {
        id: '', // Will be set by database
        name: validatedData.name,
        description: validatedData.description,
        topic: validatedData.topic,
        subject: validatedData.subject,
        participants: [creatorParticipant],
        settings: {
          maxSize: validatedData.maxSize,
          ageRestrictions: validatedData.ageRestrictions || [],
          moderationLevel: validatedData.moderationLevel,
          privacy: validatedData.privacy,
          requiresApproval: validatedData.privacy !== PrivacyLevel.PUBLIC
        },
        activities: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert into database
      const query = `
        INSERT INTO study_groups (
          name, description, topic, subject, participants, settings, 
          activities, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at, updated_at
      `;

      const values = [
        studyGroup.name,
        studyGroup.description,
        studyGroup.topic,
        studyGroup.subject,
        JSON.stringify(studyGroup.participants),
        JSON.stringify(studyGroup.settings),
        JSON.stringify(studyGroup.activities),
        studyGroup.isActive,
        creatorId
      ];

      const result = await this.db.query(query, values);
      const row = result.rows[0];

      studyGroup.id = row.id;
      studyGroup.createdAt = row.created_at;
      studyGroup.updatedAt = row.updated_at;

      logger.info(`Created study group ${studyGroup.id} for user ${creatorId}`);
      return studyGroup;

    } catch (error) {
      logger.error('Error creating study group:', error);
      throw new Error(`Failed to create study group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add participant to study group with size limits
   */
  async addParticipant(groupId: string, userId: string, requesterId: string): Promise<StudyGroup> {
    try {
      logger.info(`Adding participant ${userId} to group ${groupId}`);

      // Get current group
      const group = await this.getStudyGroup(groupId);
      if (!group) {
        throw new Error('Study group not found');
      }

      // Check if requester has permission
      const requesterParticipant = group.participants.find(p => p.userId === requesterId);
      if (!requesterParticipant || !['admin', 'moderator'].includes(requesterParticipant.role)) {
        throw new Error('Insufficient permissions to add participants');
      }

      // Check group size limits
      if (group.participants.length >= group.settings.maxSize) {
        throw new Error(`Group is full (max size: ${group.settings.maxSize})`);
      }

      // Check if user is already a participant
      if (group.participants.some(p => p.userId === userId)) {
        throw new Error('User is already a participant');
      }

      // Add new participant
      const newParticipant: GroupParticipant = {
        userId,
        role: 'member',
        joinedAt: new Date(),
        isActive: true,
        contributionScore: 0
      };

      group.participants.push(newParticipant);
      group.updatedAt = new Date();

      // Update database
      const query = `
        UPDATE study_groups 
        SET participants = $1, updated_at = $2
        WHERE id = $3
        RETURNING *
      `;

      await this.db.query(query, [
        JSON.stringify(group.participants),
        group.updatedAt,
        groupId
      ]);

      logger.info(`Added participant ${userId} to group ${groupId}`);
      return group;

    } catch (error) {
      logger.error('Error adding participant:', error);
      throw new Error(`Failed to add participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create and track group activity
   */
  async createGroupActivity(
    groupId: string,
    creatorId: string,
    activityData: {
      type: CollaborationActivityType;
      title: string;
      description: string;
      participants: string[];
      startTime: Date;
      endTime?: Date;
    }
  ): Promise<CollaborationActivity> {
    try {
      logger.info(`Creating activity for group ${groupId}`);

      // Verify group exists and user has permission
      const group = await this.getStudyGroup(groupId);
      if (!group) {
        throw new Error('Study group not found');
      }

      const creatorParticipant = group.participants.find(p => p.userId === creatorId);
      if (!creatorParticipant) {
        throw new Error('User is not a member of this group');
      }

      // Create activity
      const activity: CollaborationActivity = {
        id: '', // Will be set by database
        type: activityData.type,
        title: activityData.title,
        description: activityData.description,
        participants: activityData.participants,
        startTime: activityData.startTime,
        endTime: activityData.endTime,
        isCompleted: false
      };

      // Insert into database
      const query = `
        INSERT INTO group_activities (
          group_id, type, title, description, participants, 
          start_time, end_time, is_completed, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at, updated_at
      `;

      const values = [
        groupId,
        activity.type,
        activity.title,
        activity.description,
        JSON.stringify(activity.participants),
        activity.startTime,
        activity.endTime,
        activity.isCompleted,
        creatorId
      ];

      const result = await this.db.query(query, values);
      activity.id = result.rows[0].id;

      logger.info(`Created activity ${activity.id} for group ${groupId}`);
      return activity;

    } catch (error) {
      logger.error('Error creating group activity:', error);
      throw new Error(`Failed to create group activity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get study group by ID
   */
  async getStudyGroup(groupId: string): Promise<StudyGroup | null> {
    try {
      const query = `
        SELECT * FROM study_groups 
        WHERE id = $1 AND is_active = true
      `;

      const result = await this.db.query(query, [groupId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        topic: row.topic,
        subject: row.subject,
        participants: row.participants,
        settings: row.settings,
        activities: row.activities,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      logger.error('Error getting study group:', error);
      throw new Error(`Failed to get study group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's study groups
   */
  async getUserStudyGroups(userId: string): Promise<StudyGroup[]> {
    try {
      const query = `
        SELECT * FROM study_groups 
        WHERE is_active = true 
        AND participants @> $1
        ORDER BY updated_at DESC
      `;

      const result = await this.db.query(query, [
        JSON.stringify([{ userId }])
      ]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        topic: row.topic,
        subject: row.subject,
        participants: row.participants,
        settings: row.settings,
        activities: row.activities,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      logger.error('Error getting user study groups:', error);
      throw new Error(`Failed to get user study groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Moderate conversation message with enhanced safety features
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

      // Use the safety moderation service for comprehensive moderation
      const result = await this.safetyModerationService.moderateConversationMessage(
        sessionId,
        userId,
        message,
        messageType,
        metadata
      );

      // Log the moderation result for audit purposes
      await this.logModerationResult(sessionId, userId, message, result);

      return result;

    } catch (error) {
      logger.error('Error moderating conversation message:', error);
      throw new Error(`Failed to moderate message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a safety report for inappropriate behavior or content
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
      evidence?: any[];
    }
  ) {
    try {
      logger.info(`Creating safety report from user ${reporterId}`);

      const report = await this.safetyModerationService.createSafetyReport(reporterId, reportData);

      // If the report involves a study group, notify group moderators
      if (reportData.groupId) {
        await this.notifyGroupModerators(reportData.groupId, report);
      }

      return report;

    } catch (error) {
      logger.error('Error creating safety report:', error);
      throw new Error(`Failed to create safety report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if a minor user can safely participate in a collaboration session
   */
  async validateMinorParticipation(
    minorUserId: string,
    sessionId: string,
    participants: string[]
  ) {
    try {
      logger.info(`Validating minor participation for user ${minorUserId} in session ${sessionId}`);

      const validation = await this.safetyModerationService.validateMinorCollaboration(
        minorUserId,
        sessionId,
        participants
      );

      // If validation fails, log the reason and take appropriate action
      if (!validation.isAllowed) {
        logger.warn(`Minor participation denied:`, {
          minorUserId,
          sessionId,
          reason: validation.reason,
          restrictions: validation.restrictions
        });

        // Optionally remove the minor from the session if they're already in it
        if (participants.includes(minorUserId)) {
          await this.removeUserFromSession(sessionId, minorUserId, 'safety_restriction');
        }
      }

      return validation;

    } catch (error) {
      logger.error('Error validating minor participation:', error);
      throw new Error(`Failed to validate minor participation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced study group creation with safety checks
   */
  async createStudyGroupWithSafetyChecks(
    creatorId: string,
    groupData: z.infer<typeof CreateStudyGroupSchema>
  ): Promise<StudyGroup> {
    try {
      logger.info(`Creating study group with safety checks for user ${creatorId}`);

      // Check if creator is a minor and apply appropriate restrictions
      const userProfile = await this.getUserProfile(creatorId);
      const isMinor = this.isUserMinor(userProfile?.age_range);

      if (isMinor) {
        // Apply stricter moderation for groups created by minors
        if (groupData.moderationLevel === ModerationLevel.MINIMAL) {
          groupData.moderationLevel = ModerationLevel.MODERATE;
          logger.info(`Upgraded moderation level to MODERATE for minor user ${creatorId}`);
        }

        // Ensure privacy is not completely public for minors
        if (groupData.privacy === PrivacyLevel.PUBLIC) {
          groupData.privacy = PrivacyLevel.FRIENDS;
          logger.info(`Changed privacy to FRIENDS for minor user ${creatorId}`);
        }
      }

      // Create the study group
      const studyGroup = await this.createStudyGroup(creatorId, groupData);

      // Set up enhanced monitoring for groups with minors
      if (isMinor) {
        await this.setupMinorGroupMonitoring(studyGroup.id);
      }

      return studyGroup;

    } catch (error) {
      logger.error('Error creating study group with safety checks:', error);
      throw new Error(`Failed to create study group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced participant addition with safety validation
   */
  async addParticipantWithSafetyChecks(
    groupId: string,
    userId: string,
    requesterId: string
  ): Promise<StudyGroup> {
    try {
      logger.info(`Adding participant ${userId} to group ${groupId} with safety checks`);

      // Get group information
      const group = await this.getStudyGroup(groupId);
      if (!group) {
        throw new Error('Study group not found');
      }

      // Check if the new participant is a minor
      const userProfile = await this.getUserProfile(userId);
      const isMinor = this.isUserMinor(userProfile?.age_range);

      // Check age restrictions
      if (group.settings.ageRestrictions.length > 0) {
        const userAgeRange = userProfile?.age_range;
        if (userAgeRange && !group.settings.ageRestrictions.includes(userAgeRange)) {
          throw new Error(`User age range ${userAgeRange} not allowed in this group`);
        }
      }

      // If adding a minor, perform additional safety checks
      if (isMinor) {
        const currentParticipants = group.participants.map(p => p.userId);
        const validation = await this.validateMinorParticipation(
          userId,
          `group_${groupId}`, // Use group ID as session ID for validation
          currentParticipants
        );

        if (!validation.isAllowed) {
          throw new Error(`Minor participation not allowed: ${validation.reason}`);
        }
      }

      // Add the participant
      const updatedGroup = await this.addParticipant(groupId, userId, requesterId);

      // Set up monitoring if a minor was added
      if (isMinor) {
        await this.setupMinorGroupMonitoring(groupId);
      }

      return updatedGroup;

    } catch (error) {
      logger.error('Error adding participant with safety checks:', error);
      throw new Error(`Failed to add participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Basic content moderation (legacy method - kept for backward compatibility)
   */
  async moderateInteraction(interactionId: string): Promise<ModerationResult> {
    try {
      logger.info(`Moderating interaction ${interactionId} (legacy method)`);

      // For backward compatibility, return a basic result
      return {
        isAppropriate: true,
        severity: 'low',
        action: 'none'
      };

    } catch (error) {
      logger.error('Error moderating interaction:', error);
      return {
        isAppropriate: false,
        severity: 'high',
        action: 'ban',
        reason: 'Moderation service error'
      };
    }
  }

  /**
   * Facilitate collaboration session
   */
  async facilitateSession(sessionId: string): Promise<CollaborationSession> {
    try {
      logger.info(`Facilitating session ${sessionId}`);

      const query = `
        SELECT * FROM collaboration_sessions 
        WHERE id = $1
      `;

      const result = await this.db.query(query, [sessionId]);
      if (result.rows.length === 0) {
        throw new Error('Collaboration session not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        groupId: row.group_id,
        participants: row.participants,
        topic: row.topic,
        duration: row.duration,
        activities: row.activities,
        outcomes: row.outcomes,
        satisfaction: row.satisfaction,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      logger.error('Error facilitating session:', error);
      throw new Error(`Failed to facilitate session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const query = `
        SELECT demographics, learning_preferences 
        FROM users 
        WHERE id = $1
      `;

      const result = await this.db.query(query, [userId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        education_level: row.demographics?.educationLevel,
        age_range: row.demographics?.ageRange,
        learning_preferences: row.learning_preferences
      };

    } catch (error) {
      logger.error('Error getting user profile:', error);
      return null;
    }
  }

  private async getUserAvailability(userId: string): Promise<Record<string, string[]>> {
    try {
      const query = `
        SELECT available_hours 
        FROM collaboration_preferences 
        WHERE user_id = $1
      `;

      const result = await this.db.query(query, [userId]);
      if (result.rows.length === 0) {
        // Return default availability
        return {
          monday: ['09:00-17:00'],
          tuesday: ['09:00-17:00'],
          wednesday: ['09:00-17:00'],
          thursday: ['09:00-17:00'],
          friday: ['09:00-17:00']
        };
      }

      return result.rows[0].available_hours;

    } catch (error) {
      logger.error('Error getting user availability:', error);
      return {};
    }
  }

  private async getUserCommunicationPreferences(userId: string): Promise<string[]> {
    try {
      const query = `
        SELECT communication_style 
        FROM collaboration_preferences 
        WHERE user_id = $1
      `;

      const result = await this.db.query(query, [userId]);
      if (result.rows.length === 0) {
        return ['chat', 'video_call'];
      }

      const style = result.rows[0].communication_style;
      return style === 'formal' ? ['email', 'video_call'] :
        style === 'casual' ? ['chat', 'voice_call'] :
          ['chat', 'video_call', 'email'];

    } catch (error) {
      logger.error('Error getting user communication preferences:', error);
      return ['chat'];
    }
  }

  private convertSkillLevels(subjects: string[], skillLevels: string[]): Record<string, string> {
    // Map subjects to their corresponding skill levels for AI service
    const skillMap: Record<string, string> = {};
    subjects.forEach((subject, index) => {
      // Use the skill level at the same index, or default to 'beginner' if not enough skill levels provided
      const level = skillLevels[index] || 'beginner';
      skillMap[subject] = level;
    });
    return skillMap;
  }

  private async callAIServiceForMatching(request: AIServicePeerMatchRequest): Promise<AIServicePeerMatch[]> {
    try {
      logger.info(`Calling AI service for peer matching at ${this.aiServiceUrl}/api/v1/peer-matching/`);
      logger.info(`Request data: ${JSON.stringify(request, null, 2)}`);

      const response = await fetch(`${this.aiServiceUrl}/api/v1/peer-matching/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      logger.info(`AI service response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`AI service error response: ${errorText}`);
        throw new Error(`AI service responded with status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      logger.info(`AI service response has matches: ${!!data.matches}, matches length: ${data.matches?.length || 0}`);

      if (data.matches && data.matches.length > 0) {
        logger.info(`First AI match sample: ${JSON.stringify(data.matches[0], null, 2)}`);
      }

      if (!data.matches || data.matches.length === 0) {
        logger.warn('AI service returned no matches, falling back to mock data');
        return this.getMockMatches(request.user_id);
      }

      return data.matches;

    } catch (error) {
      logger.error('Error calling AI service for matching:', error);
      logger.info('Falling back to mock data');
      // Return mock data as fallback
      return this.getMockMatches(request.user_id);
    }
  }

  private getMockMatches(userId: string): AIServicePeerMatch[] {
    // Fallback mock data when AI service is unavailable
    return [
      {
        user_id: `mock_peer_1_${userId}`,
        compatibility_score: 85,
        shared_subjects: ['mathematics', 'programming'],
        complementary_skills: { 'mathematics': 'They can help with advanced topics' },
        common_goals: ['learn algorithms', 'improve problem solving'],
        availability_overlap: ['monday: 14:00-16:00', 'wednesday: 10:00-12:00'],
        communication_match: ['chat', 'video_call'],
        match_reasons: ['High skill complementarity', 'Shared learning goals']
      },
      {
        user_id: `mock_peer_2_${userId}`,
        compatibility_score: 78,
        shared_subjects: ['science', 'programming'],
        complementary_skills: { 'science': 'You can help with basics' },
        common_goals: ['learn data structures'],
        availability_overlap: ['tuesday: 15:00-17:00'],
        communication_match: ['chat'],
        match_reasons: ['Good availability overlap', 'Similar learning pace']
      }
    ];
  }

  private async storePeerMatch(requesterId: string, match: PeerMatch): Promise<void> {
    try {
      // First check if a similar match already exists
      const existingQuery = `
        SELECT id FROM peer_matches 
        WHERE requester_id = $1 AND matched_user_id = $2 
        AND status IN ('pending', 'accepted')
        AND expires_at > NOW()
      `;

      const existing = await this.db.query(existingQuery, [requesterId, match.userId]);

      if (existing.rows.length > 0) {
        // Update existing match
        const updateQuery = `
          UPDATE peer_matches 
          SET compatibility_score = $3, updated_at = NOW()
          WHERE id = $1
        `;
        await this.db.query(updateQuery, [existing.rows[0].id, requesterId, match.compatibilityScore]);
        logger.info(`Updated existing peer match: ${requesterId} -> ${match.userId}`);
      } else {
        // Insert new match
        const insertQuery = `
          INSERT INTO peer_matches (
            requester_id, matched_user_id, compatibility_score, 
            shared_subjects, complementary_skills, common_goals,
            availability_overlap, communication_match, match_reasons,
            expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

        const values = [
          requesterId,
          match.userId,
          match.compatibilityScore,
          JSON.stringify(match.sharedInterests),
          JSON.stringify(match.complementarySkills),
          JSON.stringify([]), // common_goals - not in PeerMatch interface
          JSON.stringify([]), // availability_overlap - not in PeerMatch interface  
          JSON.stringify([]), // communication_match - not in PeerMatch interface
          JSON.stringify([match.matchReason]),
          expiresAt
        ];

        await this.db.query(insertQuery, values);
        logger.info(`Stored new peer match: ${requesterId} -> ${match.userId}`);
      }

    } catch (error: any) {
      // Check if it's a foreign key constraint error (user doesn't exist)
      if (error?.code === '23503') {
        logger.warn(`Skipping peer match storage - user ${match.userId} not found in database`);
      } else {
        logger.error('Error storing peer match:', error);
      }
      // Don't throw - this is not critical for the main flow
    }
  }

  // Additional helper methods for safety and moderation

  private async logModerationResult(
    sessionId: string,
    userId: string,
    message: string,
    result: ConversationModerationResult
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO conversation_moderation_log (
          session_id, user_id, message_content, moderation_result, 
          action_taken, is_appropriate, confidence_score, flags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      const values = [
        sessionId,
        userId,
        message,
        JSON.stringify(result),
        result.action,
        result.isAppropriate,
        result.confidence,
        JSON.stringify(result.flags)
      ];

      await this.db.query(query, values);

    } catch (error) {
      logger.error('Error logging moderation result:', error);
    }
  }

  private async notifyGroupModerators(groupId: string, report: any): Promise<void> {
    try {
      logger.info(`Notifying group moderators for group ${groupId} about report ${report.id}`);

      // Get group moderators
      const group = await this.getStudyGroup(groupId);
      if (!group) {
        return;
      }

      const moderators = group.participants.filter(p =>
        p.role === 'admin' || p.role === 'moderator'
      );

      // Send notifications to each moderator
      for (const moderator of moderators) {
        await this.sendModeratorNotification(moderator.userId, {
          type: 'safety_report',
          title: `Safety Report in Group: ${group.name}`,
          description: `A safety report has been filed in your study group: ${report.description.substring(0, 100)}...`,
          groupId: groupId,
          reportId: report.id
        });
      }

    } catch (error) {
      logger.error('Error notifying group moderators:', error);
    }
  }

  private async removeUserFromSession(
    sessionId: string,
    userId: string,
    reason: string = 'moderation_action'
  ): Promise<void> {
    try {
      logger.info(`Removing user ${userId} from session ${sessionId}, reason: ${reason}`);

      // Update session data to remove the user
      const query = `
        UPDATE collaboration_session_data 
        SET activities = activities || $1
        WHERE session_id = $2
      `;

      const removalActivity = {
        type: 'user_removed',
        user_id: userId,
        reason: reason,
        timestamp: new Date().toISOString()
      };

      await this.db.query(query, [
        JSON.stringify([removalActivity]),
        sessionId
      ]);

      // Optionally send notification to the user
      await this.sendUserNotification(userId, {
        type: 'session_removal',
        title: 'Removed from Collaboration Session',
        description: `You have been removed from the collaboration session due to: ${reason}`,
        sessionId: sessionId
      });

    } catch (error) {
      logger.error('Error removing user from session:', error);
    }
  }

  private isUserMinor(ageRange?: string): boolean {
    return ageRange === AgeRange.CHILD || ageRange === AgeRange.TEEN;
  }

  private async setupMinorGroupMonitoring(groupId: string): Promise<void> {
    try {
      logger.info(`Setting up enhanced monitoring for group ${groupId} with minor participants`);

      // Create a monitoring record
      const query = `
        INSERT INTO group_monitoring (
          group_id, monitoring_level, enabled_features, created_at
        ) VALUES ($1, $2, $3, NOW())
        ON CONFLICT (group_id) DO UPDATE SET
          monitoring_level = $2,
          enabled_features = $3,
          updated_at = NOW()
      `;

      const monitoringFeatures = [
        'enhanced_content_filtering',
        'real_time_message_scanning',
        'automatic_escalation',
        'parental_notifications',
        'session_time_limits'
      ];

      await this.db.query(query, [
        groupId,
        'enhanced',
        JSON.stringify(monitoringFeatures)
      ]);

    } catch (error) {
      logger.error('Error setting up minor group monitoring:', error);
    }
  }

  private async sendModeratorNotification(
    moderatorId: string,
    notification: {
      type: string;
      title: string;
      description: string;
      groupId?: string;
      reportId?: string;
    }
  ): Promise<void> {
    try {
      // This would integrate with a notification service
      logger.info(`Sending moderator notification to ${moderatorId}:`, notification);

      // Store notification in database
      const query = `
        INSERT INTO user_notifications (
          user_id, type, title, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;

      const metadata = {
        group_id: notification.groupId,
        report_id: notification.reportId
      };

      await this.db.query(query, [
        moderatorId,
        notification.type,
        notification.title,
        notification.description,
        JSON.stringify(metadata)
      ]);

    } catch (error) {
      logger.error('Error sending moderator notification:', error);
    }
  }

  private async sendUserNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      description: string;
      sessionId?: string;
    }
  ): Promise<void> {
    try {
      logger.info(`Sending user notification to ${userId}:`, notification);

      // Store notification in database
      const query = `
        INSERT INTO user_notifications (
          user_id, type, title, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;

      const metadata = {
        session_id: notification.sessionId
      };

      await this.db.query(query, [
        userId,
        notification.type,
        notification.title,
        notification.description,
        JSON.stringify(metadata)
      ]);

    } catch (error) {
      logger.error('Error sending user notification:', error);
    }
  }
}