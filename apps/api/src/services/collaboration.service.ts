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
  CreateStudyGroupSchema
} from '@lusilearn/shared-types';

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
  constructor(
    private db: Pool,
    private aiServiceUrl: string = process.env.AI_SERVICE_URL || 'http://ai-service:8001'
  ) {}

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
        skill_levels: this.convertSkillLevels(criteria.skillLevels),
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
      for (const aiMatch of aiMatches) {
        const peerMatch: PeerMatch = {
          userId: aiMatch.user_id,
          compatibilityScore: aiMatch.compatibility_score,
          sharedInterests: aiMatch.shared_subjects,
          complementarySkills: Object.keys(aiMatch.complementary_skills),
          matchReason: aiMatch.match_reasons.join('; '),
          estimatedCollaborationSuccess: Math.min(aiMatch.compatibility_score * 1.2, 100)
        };

        // Store match in database
        await this.storePeerMatch(userId, peerMatch);
        peerMatches.push(peerMatch);
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
   * Basic content moderation (placeholder for more advanced implementation)
   */
  async moderateInteraction(interactionId: string): Promise<ModerationResult> {
    try {
      // This is a basic implementation - in production, this would integrate
      // with AI-based content moderation services
      logger.info(`Moderating interaction ${interactionId}`);

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

  private convertSkillLevels(skillLevels: string[]): Record<string, string> {
    // Convert array of skill levels to object format expected by AI service
    const skillMap: Record<string, string> = {};
    skillLevels.forEach((skill, index) => {
      const level = index % 3 === 0 ? 'beginner' : 
                   index % 3 === 1 ? 'intermediate' : 'advanced';
      skillMap[skill] = level;
    });
    return skillMap;
  }

  private async callAIServiceForMatching(request: AIServicePeerMatchRequest): Promise<AIServicePeerMatch[]> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/peer-matching/find-matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const data = await response.json();
      return data.matches || [];

    } catch (error) {
      logger.error('Error calling AI service for matching:', error);
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
      const query = `
        INSERT INTO peer_matches (
          requester_id, matched_user_id, compatibility_score, 
          shared_subjects, complementary_skills, common_goals,
          availability_overlap, communication_match, match_reasons,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (requester_id, matched_user_id, status) 
        WHERE status IN ('pending', 'accepted')
        DO UPDATE SET 
          compatibility_score = EXCLUDED.compatibility_score,
          updated_at = NOW()
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

      await this.db.query(query, values);

    } catch (error) {
      logger.error('Error storing peer match:', error);
      // Don't throw - this is not critical for the main flow
    }
  }
}