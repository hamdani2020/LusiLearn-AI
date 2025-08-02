import { UserRepository } from '../repositories/user.repository';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { 
  UserProfile, 
  UserDemographics,
  LearningPreferences,
  PrivacySettings,
  ParentalControls,
  AgeRange
} from '@lusilearn/shared-types';

export interface UpdateProfileRequest {
  username?: string;
  demographics?: UserDemographics;
  learningPreferences?: LearningPreferences;
  privacySettings?: PrivacySettings;
  parentalControls?: ParentalControls;
}

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      logger.info('User profile retrieved:', { userId });
      return user;
    } catch (error) {
      logger.error('Error retrieving user profile:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, updates: UpdateProfileRequest): Promise<UserProfile> {
    try {
      // Get current user to validate updates
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      // Validate username uniqueness if being updated
      if (updates.username && updates.username !== currentUser.username) {
        const existingUser = await this.userRepository.findByUsername(updates.username);
        if (existingUser && existingUser.id !== userId) {
          throw new ConflictError('Username is already taken');
        }
      }

      // Validate age-related restrictions
      if (updates.demographics?.ageRange) {
        await this.validateAgeRangeUpdate(currentUser, updates.demographics.ageRange);
      }

      // Validate parental controls
      if (updates.parentalControls !== undefined) {
        await this.validateParentalControlsUpdate(currentUser, updates.parentalControls);
      }

      // Update user profile
      const updatedUser = await this.userRepository.update(userId, updates);
      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      logger.info('User profile updated:', { 
        userId,
        updatedFields: Object.keys(updates)
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  async updateLearningPreferences(userId: string, preferences: LearningPreferences): Promise<UserProfile> {
    try {
      const updatedUser = await this.userRepository.update(userId, {
        learningPreferences: preferences
      });

      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      logger.info('Learning preferences updated:', { 
        userId,
        sessionDuration: preferences.sessionDuration,
        learningStyles: preferences.learningStyle,
        contentTypes: preferences.preferredContentTypes
      });

      // TODO: Trigger real-time update to connected clients
      await this.notifyPreferencesUpdate(userId, preferences);

      return updatedUser;
    } catch (error) {
      logger.error('Error updating learning preferences:', error);
      throw error;
    }
  }

  async updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<UserProfile> {
    try {
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      // Validate privacy settings for minors
      const isMinor = currentUser.demographics.ageRange === AgeRange.CHILD || 
                     currentUser.demographics.ageRange === AgeRange.TEEN;

      if (isMinor) {
        // Enforce stricter privacy settings for minors
        settings = {
          ...settings,
          profileVisibility: settings.profileVisibility === 'public' ? 'friends' : settings.profileVisibility,
          allowPeerMatching: settings.allowPeerMatching && !currentUser.parentalControls?.restrictedInteractions
        };
      }

      const updatedUser = await this.userRepository.update(userId, {
        privacySettings: settings
      });

      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      logger.info('Privacy settings updated:', { 
        userId,
        profileVisibility: settings.profileVisibility,
        allowPeerMatching: settings.allowPeerMatching
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating privacy settings:', error);
      throw error;
    }
  }

  async updateParentalControls(userId: string, controls: ParentalControls): Promise<UserProfile> {
    try {
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      // Validate that parental controls are appropriate for user's age
      const isMinor = currentUser.demographics.ageRange === AgeRange.CHILD || 
                     currentUser.demographics.ageRange === AgeRange.TEEN;

      if (!isMinor) {
        throw new ValidationError('Parental controls are only applicable for users under 18');
      }

      // Validate time restrictions
      if (controls.timeRestrictions.dailyLimit < 0 || controls.timeRestrictions.dailyLimit > 480) {
        throw new ValidationError('Daily limit must be between 0 and 480 minutes (8 hours)');
      }

      const updatedUser = await this.userRepository.update(userId, {
        parentalControls: controls
      });

      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      logger.info('Parental controls updated:', { 
        userId,
        parentEmail: controls.parentEmail,
        contentFiltering: controls.contentFiltering,
        dailyLimit: controls.timeRestrictions.dailyLimit
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating parental controls:', error);
      throw error;
    }
  }

  async removeParentalControls(userId: string): Promise<UserProfile> {
    try {
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      // Check if user is old enough to remove parental controls
      const isMinor = currentUser.demographics.ageRange === AgeRange.CHILD || 
                     currentUser.demographics.ageRange === AgeRange.TEEN;

      if (isMinor) {
        throw new ValidationError('Parental controls cannot be removed for users under 18');
      }

      const updatedUser = await this.userRepository.update(userId, {
        parentalControls: undefined
      });

      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      logger.info('Parental controls removed:', { userId });

      return updatedUser;
    } catch (error) {
      logger.error('Error removing parental controls:', error);
      throw error;
    }
  }

  async deactivateAccount(userId: string): Promise<void> {
    try {
      await this.userRepository.deactivate(userId);
      logger.info('User account deactivated:', { userId });
    } catch (error) {
      logger.error('Error deactivating account:', error);
      throw error;
    }
  }

  private async validateAgeRangeUpdate(currentUser: UserProfile, newAgeRange: AgeRange): Promise<void> {
    const currentIsMinor = currentUser.demographics.ageRange === AgeRange.CHILD || 
                          currentUser.demographics.ageRange === AgeRange.TEEN;
    const newIsMinor = newAgeRange === AgeRange.CHILD || newAgeRange === AgeRange.TEEN;

    // If transitioning from minor to adult, remove parental controls
    if (currentIsMinor && !newIsMinor) {
      logger.info('User transitioning from minor to adult, parental controls will be removed:', { 
        userId: currentUser.id 
      });
    }

    // If transitioning from adult to minor, require parental controls
    if (!currentIsMinor && newIsMinor && !currentUser.parentalControls) {
      throw new ValidationError('Parental controls are required when changing age range to under 18');
    }
  }

  private async validateParentalControlsUpdate(
    currentUser: UserProfile, 
    newControls: ParentalControls | undefined
  ): Promise<void> {
    const isMinor = currentUser.demographics.ageRange === AgeRange.CHILD || 
                   currentUser.demographics.ageRange === AgeRange.TEEN;

    if (isMinor && !newControls) {
      throw new ValidationError('Parental controls cannot be removed for users under 18');
    }

    if (!isMinor && newControls) {
      throw new ValidationError('Parental controls are only applicable for users under 18');
    }
  }

  private async notifyPreferencesUpdate(userId: string, preferences: LearningPreferences): Promise<void> {
    try {
      // TODO: Implement real-time notification system
      // This could use WebSockets, Server-Sent Events, or a message queue
      // For now, just log the event
      logger.info('Learning preferences update notification:', {
        userId,
        event: 'preferences_updated',
        timestamp: new Date().toISOString()
      });

      // In a real implementation, this might:
      // 1. Notify connected WebSocket clients
      // 2. Update cached recommendations
      // 3. Trigger AI service to regenerate learning paths
      // 4. Send push notifications to mobile apps
    } catch (error) {
      logger.error('Error sending preferences update notification:', error);
      // Don't throw error as this is a non-critical operation
    }
  }
}