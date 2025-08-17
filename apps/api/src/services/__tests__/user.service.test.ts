import { UserService, UpdateProfileRequest } from '../user.service';
import { UserRepository } from '../../repositories/user.repository';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/error-handler';
import { 
  UserProfile, 
  AgeRange, 
  EducationLevel,
  LearningStyle,
  ContentType,
  DifficultyPreference,
  LearningPreferences,
  PrivacySettings,
  ParentalControls
} from '@lusilearn/shared-types';

// Mock the dependencies
jest.mock('../../repositories/user.repository');
jest.mock('../../utils/logger');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
    (userService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile when user exists', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = createMockUserProfile(userId);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getProfile(userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.getProfile(userId)).rejects.toThrow(NotFoundError);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should handle repository errors', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Database connection failed');
      mockUserRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(userService.getProfile(userId)).rejects.toThrow(error);
    });
  });

  describe('updateProfile', () => {
    const userId = 'user-123';
    const mockCurrentUser = createMockUserProfile(userId);

    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockCurrentUser);
    });

    it('should update user profile successfully', async () => {
      // Arrange
      const updates: UpdateProfileRequest = {
        username: 'newusername',
        demographics: {
          ...mockCurrentUser.demographics,
          timezone: 'America/New_York'
        }
      };
      const updatedUser = { ...mockCurrentUser, ...updates };
      
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateProfile(userId, updates);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updates);
    });

    it('should throw ConflictError when username is already taken', async () => {
      // Arrange
      const updates: UpdateProfileRequest = {
        username: 'existingusername'
      };
      const existingUser = createMockUserProfile('other-user-id');
      existingUser.username = 'existingusername';
      
      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.updateProfile(userId, updates)).rejects.toThrow(ConflictError);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should allow username update to same username', async () => {
      // Arrange
      const updates: UpdateProfileRequest = {
        username: mockCurrentUser.username
      };
      const updatedUser = { ...mockCurrentUser, ...updates };
      
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateProfile(userId, updates);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should validate age range updates for minors', async () => {
      // Arrange
      const minorUser = {
        ...mockCurrentUser,
        demographics: { ...mockCurrentUser.demographics, ageRange: AgeRange.TEEN }
      };
      mockUserRepository.findById.mockResolvedValue(minorUser);

      const updates: UpdateProfileRequest = {
        demographics: {
          ...minorUser.demographics,
          ageRange: AgeRange.ADULT
        }
      };
      const updatedUser = { ...minorUser, ...updates };
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateProfile(userId, updates);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updates);
    });

    it('should throw ValidationError when removing parental controls from minor', async () => {
      // Arrange
      const minorUser = {
        ...mockCurrentUser,
        demographics: { ...mockCurrentUser.demographics, ageRange: AgeRange.TEEN },
        parentalControls: createMockParentalControls()
      };
      mockUserRepository.findById.mockResolvedValue(minorUser);

      const updates: UpdateProfileRequest = {
        parentalControls: undefined
      };

      // Act & Assert
      await expect(userService.updateProfile(userId, updates)).rejects.toThrow(ValidationError);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);
      const updates: UpdateProfileRequest = { username: 'newusername' };

      // Act & Assert
      await expect(userService.updateProfile(userId, updates)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLearningPreferences', () => {
    const userId = 'user-123';

    it('should update learning preferences successfully', async () => {
      // Arrange
      const preferences: LearningPreferences = {
        learningStyle: [LearningStyle.VISUAL, LearningStyle.KINESTHETIC],
        preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
        sessionDuration: 45,
        difficultyPreference: DifficultyPreference.MODERATE
      };
      const updatedUser = createMockUserProfile(userId);
      updatedUser.learningPreferences = preferences;

      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateLearningPreferences(userId, preferences);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        learningPreferences: preferences
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const preferences: LearningPreferences = {
        learningStyle: [LearningStyle.VISUAL],
        preferredContentTypes: [ContentType.VIDEO],
        sessionDuration: 30,
        difficultyPreference: DifficultyPreference.MODERATE
      };
      mockUserRepository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateLearningPreferences(userId, preferences)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePrivacySettings', () => {
    const userId = 'user-123';

    it('should update privacy settings for adult user', async () => {
      // Arrange
      const adultUser = createMockUserProfile(userId);
      adultUser.demographics.ageRange = AgeRange.ADULT;
      
      const settings: PrivacySettings = {
        profileVisibility: 'public',
        allowPeerMatching: true,
        shareProgressData: true,
        allowDataCollection: false
      };
      const updatedUser = { ...adultUser, privacySettings: settings };

      mockUserRepository.findById.mockResolvedValue(adultUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updatePrivacySettings(userId, settings);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        privacySettings: settings
      });
    });

    it('should enforce stricter privacy settings for minors', async () => {
      // Arrange
      const minorUser = createMockUserProfile(userId);
      minorUser.demographics.ageRange = AgeRange.TEEN;
      minorUser.parentalControls = createMockParentalControls();
      
      const settings: PrivacySettings = {
        profileVisibility: 'public', // Should be changed to 'friends'
        allowPeerMatching: true, // Should be restricted
        shareProgressData: false,
        allowDataCollection: false
      };

      const expectedSettings: PrivacySettings = {
        profileVisibility: 'friends', // Enforced for minors
        allowPeerMatching: false, // Restricted due to parental controls
        shareProgressData: false,
        allowDataCollection: false
      };

      const updatedUser = { ...minorUser, privacySettings: expectedSettings };

      mockUserRepository.findById.mockResolvedValue(minorUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updatePrivacySettings(userId, settings);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        privacySettings: expectedSettings
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const settings: PrivacySettings = {
        profileVisibility: 'private',
        allowPeerMatching: false,
        shareProgressData: false,
        allowDataCollection: false
      };
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updatePrivacySettings(userId, settings)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateParentalControls', () => {
    const userId = 'user-123';

    it('should update parental controls for minor user', async () => {
      // Arrange
      const minorUser = createMockUserProfile(userId);
      minorUser.demographics.ageRange = AgeRange.TEEN;
      
      const controls: ParentalControls = createMockParentalControls();
      const updatedUser = { ...minorUser, parentalControls: controls };

      mockUserRepository.findById.mockResolvedValue(minorUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateParentalControls(userId, controls);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        parentalControls: controls
      });
    });

    it('should throw ValidationError for adult user', async () => {
      // Arrange
      const adultUser = createMockUserProfile(userId);
      adultUser.demographics.ageRange = AgeRange.ADULT;
      
      const controls: ParentalControls = createMockParentalControls();

      mockUserRepository.findById.mockResolvedValue(adultUser);

      // Act & Assert
      await expect(userService.updateParentalControls(userId, controls)).rejects.toThrow(ValidationError);
    });

    it('should validate daily time limit', async () => {
      // Arrange
      const minorUser = createMockUserProfile(userId);
      minorUser.demographics.ageRange = AgeRange.CHILD;
      
      const invalidControls: ParentalControls = {
        ...createMockParentalControls(),
        timeRestrictions: {
          dailyLimit: 500, // Invalid: exceeds 480 minutes
          allowedHours: { start: '09:00', end: '17:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(minorUser);

      // Act & Assert
      await expect(userService.updateParentalControls(userId, invalidControls)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const controls: ParentalControls = createMockParentalControls();
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.updateParentalControls(userId, controls)).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeParentalControls', () => {
    const userId = 'user-123';

    it('should remove parental controls for adult user', async () => {
      // Arrange
      const adultUser = createMockUserProfile(userId);
      adultUser.demographics.ageRange = AgeRange.ADULT;
      adultUser.parentalControls = createMockParentalControls();
      
      const updatedUser = { ...adultUser, parentalControls: undefined };

      mockUserRepository.findById.mockResolvedValue(adultUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.removeParentalControls(userId);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        parentalControls: undefined
      });
    });

    it('should throw ValidationError for minor user', async () => {
      // Arrange
      const minorUser = createMockUserProfile(userId);
      minorUser.demographics.ageRange = AgeRange.TEEN;

      mockUserRepository.findById.mockResolvedValue(minorUser);

      // Act & Assert
      await expect(userService.removeParentalControls(userId)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.removeParentalControls(userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate user account successfully', async () => {
      // Arrange
      const userId = 'user-123';
      mockUserRepository.deactivate.mockResolvedValue();

      // Act
      await userService.deactivateAccount(userId);

      // Assert
      expect(mockUserRepository.deactivate).toHaveBeenCalledWith(userId);
    });

    it('should handle repository errors', async () => {
      // Arrange
      const userId = 'user-123';
      const error = new Error('Database error');
      mockUserRepository.deactivate.mockRejectedValue(error);

      // Act & Assert
      await expect(userService.deactivateAccount(userId)).rejects.toThrow(error);
    });
  });

  // Helper functions
  function createMockUserProfile(userId: string): UserProfile {
    return {
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      demographics: {
        ageRange: AgeRange.ADULT,
        educationLevel: EducationLevel.COLLEGE,
        timezone: 'UTC',
        preferredLanguage: 'en'
      },
      learningPreferences: {
        learningStyle: [LearningStyle.VISUAL],
        preferredContentTypes: [ContentType.VIDEO],
        sessionDuration: 30,
        difficultyPreference: DifficultyPreference.MODERATE
      },
      skillProfile: [],
      privacySettings: {
        profileVisibility: 'friends',
        allowPeerMatching: true,
        shareProgressData: false,
        allowDataCollection: false
      },
      parentalControls: undefined,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  function createMockParentalControls(): ParentalControls {
    return {
      parentEmail: 'parent@example.com',
      restrictedInteractions: true,
      contentFiltering: 'strict',
      timeRestrictions: {
        dailyLimit: 120,
        allowedHours: { start: '09:00', end: '17:00' }
      }
    };
  }
});