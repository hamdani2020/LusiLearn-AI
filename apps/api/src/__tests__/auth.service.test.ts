import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import { ConflictError, AuthenticationError, ValidationError } from '../middleware/error-handler';
import { AgeRange, EducationLevel, LearningStyle, ContentType, DifficultyPreference } from '@lusilearn/shared-types';

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('bcryptjs');
jest.mock('../middleware/auth');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    authService = new AuthService();
    (authService as any).userRepository = mockUserRepository;
  });

  describe('register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'Password123!',
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
      }
    };

    it('should register a new user successfully', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');

      const createdUser = {
        id: 'user-123',
        email: validRegistrationData.email,
        username: validRegistrationData.username,
        demographics: validRegistrationData.demographics,
        learningPreferences: validRegistrationData.learningPreferences,
        skillProfile: [],
        privacySettings: {
          profileVisibility: 'friends' as const,
          allowPeerMatching: true,
          shareProgressData: false,
          allowDataCollection: false
        },
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.create.mockResolvedValue(createdUser);

      // Mock token generation
      const mockGenerateTokens = require('../middleware/auth').generateTokens;
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Act
      const result = await authService.register(validRegistrationData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(validRegistrationData.email);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validRegistrationData.email);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(validRegistrationData.username);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(validRegistrationData.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictError if email already exists', async () => {
      // Arrange
      const existingUser = { id: 'existing-user', email: validRegistrationData.email };
      mockUserRepository.findByEmail.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(authService.register(validRegistrationData))
        .rejects.toThrow(ConflictError);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validRegistrationData.email);
    });

    it('should throw ConflictError if username already exists', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      const existingUser = { id: 'existing-user', username: validRegistrationData.username };
      mockUserRepository.findByUsername.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(authService.register(validRegistrationData))
        .rejects.toThrow(ConflictError);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(validRegistrationData.username);
    });

    it('should require parental controls for minors', async () => {
      // Arrange
      const minorRegistrationData = {
        ...validRegistrationData,
        demographics: {
          ...validRegistrationData.demographics,
          ageRange: AgeRange.TEEN
        }
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.register(minorRegistrationData))
        .rejects.toThrow(ValidationError);
    });

    it('should set appropriate privacy settings for minors', async () => {
      // Arrange
      const minorRegistrationData = {
        ...validRegistrationData,
        demographics: {
          ...validRegistrationData.demographics,
          ageRange: AgeRange.CHILD
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

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword');

      const createdUser = {
        id: 'user-123',
        email: minorRegistrationData.email,
        username: minorRegistrationData.username,
        demographics: minorRegistrationData.demographics,
        learningPreferences: minorRegistrationData.learningPreferences,
        skillProfile: [],
        privacySettings: {
          profileVisibility: 'private' as const,
          allowPeerMatching: false,
          shareProgressData: false,
          allowDataCollection: false
        },
        parentalControls: minorRegistrationData.parentalControls,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.create.mockResolvedValue(createdUser);

      const mockGenerateTokens = require('../middleware/auth').generateTokens;
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Act
      const result = await authService.register(minorRegistrationData);

      // Assert
      expect(result.user.privacySettings.profileVisibility).toBe('private');
      expect(result.user.privacySettings.allowPeerMatching).toBe(false);
      expect(result.user.parentalControls).toBeDefined();
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    it('should login user successfully with valid credentials', async () => {
      // Arrange
      const userWithPassword = {
        id: 'user-123',
        email: loginData.email,
        username: 'testuser',
        passwordHash: 'hashedPassword',
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
          profileVisibility: 'friends' as const,
          allowPeerMatching: true,
          shareProgressData: false,
          allowDataCollection: false
        },
        isVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      mockedBcrypt.compare.mockResolvedValue(true);

      const mockGenerateTokens = require('../middleware/auth').generateTokens;
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginData.email);
      expect(mockUserRepository.findByEmailWithPassword).toHaveBeenCalledWith(loginData.email);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginData.password, 'hashedPassword');
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      // Arrange
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginData))
        .rejects.toThrow(AuthenticationError);
      expect(mockUserRepository.findByEmailWithPassword).toHaveBeenCalledWith(loginData.email);
    });

    it('should throw AuthenticationError for invalid password', async () => {
      // Arrange
      const userWithPassword = {
        id: 'user-123',
        passwordHash: 'hashedPassword',
        isActive: true
      };
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(userWithPassword as any);
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginData))
        .rejects.toThrow(AuthenticationError);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginData.password, 'hashedPassword');
    });

    it('should throw AuthenticationError for inactive user', async () => {
      // Arrange
      const userWithPassword = {
        id: 'user-123',
        passwordHash: 'hashedPassword',
        isActive: false
      };
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(userWithPassword as any);
      mockedBcrypt.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(loginData))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = {
        userId: 'user-123',
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      const mockVerifyRefreshToken = require('../middleware/auth').verifyRefreshToken;
      mockVerifyRefreshToken.mockReturnValue(decodedToken);

      const user = {
        id: 'user-123',
        email: 'test@example.com',
        isActive: true
      };
      mockUserRepository.findById.mockResolvedValue(user as any);

      const mockGenerateTokens = require('../middleware/auth').generateTokens;
      mockGenerateTokens.mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockVerifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(decodedToken.userId);
    });

    it('should throw AuthenticationError for invalid refresh token', async () => {
      // Arrange
      const refreshToken = 'invalid-refresh-token';
      const mockVerifyRefreshToken = require('../middleware/auth').verifyRefreshToken;
      mockVerifyRefreshToken.mockReturnValue(null);

      // Act & Assert
      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError for inactive user', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { userId: 'user-123', email: 'test@example.com' };

      const mockVerifyRefreshToken = require('../middleware/auth').verifyRefreshToken;
      mockVerifyRefreshToken.mockReturnValue(decodedToken);

      const user = { id: 'user-123', isActive: false };
      mockUserRepository.findById.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';

      const userWithPassword = {
        id: userId,
        passwordHash: 'oldHashedPassword'
      };
      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword as any);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword');
      mockUserRepository.updatePassword.mockResolvedValue();

      // Act
      await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUserRepository.findByIdWithPassword).toHaveBeenCalledWith(userId);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(currentPassword, 'oldHashedPassword');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, 'newHashedPassword');
    });

    it('should throw AuthenticationError for incorrect current password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'WrongPassword';
      const newPassword = 'NewPassword123!';

      const userWithPassword = {
        id: userId,
        passwordHash: 'oldHashedPassword'
      };
      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword as any);
      mockedBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw ValidationError for weak new password', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'weak';

      const userWithPassword = {
        id: userId,
        passwordHash: 'oldHashedPassword'
      };
      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword as any);
      mockedBcrypt.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow(ValidationError);
    });
  });
});