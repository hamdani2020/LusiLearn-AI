import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { ValidationError, NotFoundError, ConflictError } from '../middleware/error-handler';
import { 
  AgeRange, 
  EducationLevel, 
  LearningStyle, 
  ContentType, 
  DifficultyPreference,
  UserProfile 
} from '@lusilearn/shared-types';

// Mock dependencies
jest.mock('../repositories/user.repository');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: UserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    demographics: {
      ageRange: AgeRange.YOUNG_ADULT,
      educationLevel: EducationLevel.COLLEGE,
      timezone: 'UTC',
      preferredLanguage: 'en'
    },
    learningPreferences: {
      learningStyle: [LearningStyle.VISUAL],
      preferredContentTypes: [ContentType.VIDEO],
      sessionDuration: 60,
      difficultyPreference: DifficultyPreference.MODERATE
    },
    skillProfile: [],
    privacySettings: {
      profileVisibility: 'friends',
      allowPeerMatching: true,
      shareProgressData: false,
      allowDataCollection: false
    },
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
    (userService as any).userRepository = mockUserRepository;
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getProfile('user-123');

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getProfile('non-existent-user'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const updates = {
        username: 'newusername',
        demographics: {
          ...mockUser.demographics,
          timezone: 'America/New_York'
        }
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      const updatedUser = { ...mockUser, ...updates };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateProfile('user-123', updates);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('newusername');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updates);
    });

    it('should throw ConflictError if username is already taken', async () => {
      // Arrange
      const updates = { username: 'existinguser' };
      const existingUser = { ...mockUser, id: 'other-user', username: 'existinguser' };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.updateProfile('user-123', updates))
        .rejects.toThrow(ConflictError);
    });

    it('should allow username update to same username', async () => {
      // Arrange
      const updates = { username: 'testuser' }; // Same as current username

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByUsername.mockResolvedValue(mockUser); // Same user
      
      const updatedUser = { ...mockUser, ...updates };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateProfile('user-123', updates);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', updates);
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateProfile('non-existent-user', {}))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLearningPreferences', () => {
    it('should update learning preferences successfully', async () => {
      // Arrange
      const newPreferences = {
        learningStyle: [LearningStyle.AUDITORY, LearningStyle.KINESTHETIC],
        preferredContentTypes: [ContentType.INTERACTIVE, ContentType.QUIZ],
        sessionDuration: 90,
        difficultyPreference: DifficultyPreference.CHALLENGING
      };

      const updatedUser = { 
        ...mockUser, 
        learningPreferences: newPreferences 
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateLearningPreferences('user-123', newPreferences);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        learningPreferences: newPreferences
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      const newPreferences = {
        learningStyle: [LearningStyle.VISUAL],
        preferredContentTypes: [ContentType.VIDEO],
        sessionDuration: 60,
        difficultyPreference: DifficultyPreference.MODERATE
      };
      mockUserRepository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateLearningPreferences('non-existent-user', newPreferences))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePrivacySettings', () => {
    it('should update privacy settings for adult user', async () => {
      // Arrange
      const newSettings = {
        profileVisibility: 'public' as const,
        allowPeerMatching: true,
        shareProgressData: true,
        allowDataCollection: true
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const updatedUser = { 
        ...mockUser, 
        privacySettings: newSettings 
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updatePrivacySettings('user-123', newSettings);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        privacySettings: newSettings
      });
    });

    it('should enforce stricter privacy settings for minors', async () => {
      // Arrange
      const minorUser = {
        ...mockUser,
        demographics: {
          ...mockUser.demographics,
          ageRange: AgeRange.TEEN
        },
        parentalControls: {
          parentEmail: 'parent@example.com',
          restrictedInteractions: true,
          contentFiltering: 'strict' as const,
          timeRestrictions: {
            dailyLimit: 60,
            allowedHours: { start: '09:00', end: '17:00' }
          }
        }
      };

      const requestedSettings = {
        profileVisibility: 'public' as const,
        allowPeerMatching: true,
        shareProgressData: true,
        allowDataCollection: true
      };

      const expectedSettings = {
        profileVisibility: 'friends' as const, // Downgraded from public
        allowPeerMatching: false, // Disabled due to restricted interactions
        shareProgressData: true,
        allowDataCollection: true
      };

      mockUserRepository.findById.mockResolvedValue(minorUser);
      
      const updatedUser = { 
        ...minorUser, 
        privacySettings: expectedSettings 
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updatePrivacySettings('user-123', requestedSettings);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        privacySettings: expectedSettings
      });
    });
  });

  describe('updateParentalControls', () => {
    it('should update parental controls for minor user', async () => {
      // Arrange
      const minorUser = {
        ...mockUser,
        demographics: {
          ...mockUser.demographics,
          ageRange: AgeRange.TEEN
        }
      };

      const parentalControls = {
        parentEmail: 'parent@example.com',
        restrictedInteractions: true,
        contentFiltering: 'strict' as const,
        timeRestrictions: {
          dailyLimit: 120,
          allowedHours: { start: '08:00', end: '20:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(minorUser);
      
      const updatedUser = { 
        ...minorUser, 
        parentalControls 
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateParentalControls('user-123', parentalControls);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        parentalControls
      });
    });

    it('should throw ValidationError for adult user', async () => {
      // Arrange
      const parentalControls = {
        parentEmail: 'parent@example.com',
        restrictedInteractions: true,
        contentFiltering: 'strict' as const,
        timeRestrictions: {
          dailyLimit: 120,
          allowedHours: { start: '08:00', end: '20:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(mockUser); // Adult user

      // Act & Assert
      await expect(userService.updateParentalControls('user-123', parentalControls))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid daily limit', async () => {
      // Arrange
      const minorUser = {
        ...mockUser,
        demographics: {
          ...mockUser.demographics,
          ageRange: AgeRange.CHILD
        }
      };

      const parentalControls = {
        parentEmail: 'parent@example.com',
        restrictedInteractions: true,
        contentFiltering: 'strict' as const,
        timeRestrictions: {
          dailyLimit: 500, // Invalid: > 480 minutes
          allowedHours: { start: '08:00', end: '20:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(minorUser);

      // Act & Assert
      await expect(userService.updateParentalControls('user-123', parentalControls))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('removeParentalControls', () => {
    it('should remove parental controls for adult user', async () => {
      // Arrange
      const adultUser = {
        ...mockUser,
        demographics: {
          ...mockUser.demographics,
          ageRange: AgeRange.YOUNG_ADULT
        },
        parentalControls: {
          parentEmail: 'parent@example.com',
          restrictedInteractions: true,
          contentFiltering: 'strict' as const,
          timeRestrictions: {
            dailyLimit: 120,
            allowedHours: { start: '08:00', end: '20:00' }
          }
        }
      };

      mockUserRepository.findById.mockResolvedValue(adultUser);
      
      const updatedUser = { 
        ...adultUser, 
        parentalControls: undefined 
      };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.removeParentalControls('user-123');

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        parentalControls: undefined
      });
    });

    it('should throw ValidationError for minor user', async () => {
      // Arrange
      const minorUser = {
        ...mockUser,
        demographics: {
          ...mockUser.demographics,
          ageRange: AgeRange.TEEN
        }
      };

      mockUserRepository.findById.mockResolvedValue(minorUser);

      // Act & Assert
      await expect(userService.removeParentalControls('user-123'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate user account successfully', async () => {
      // Arrange
      mockUserRepository.deactivate.mockResolvedValue();

      // Act
      await userService.deactivateAccount('user-123');

      // Assert
      expect(mockUserRepository.deactivate).toHaveBeenCalledWith('user-123');
    });
  });
});