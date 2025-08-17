import bcrypt from 'bcryptjs';
import { AuthService, LoginRequest, RegisterRequest, AuthResponse } from '../auth.service';
import { UserRepository } from '../../repositories/user.repository';
import { generateTokens, verifyRefreshToken } from '../../middleware/auth';
import { AuthenticationError, ValidationError, ConflictError } from '../../middleware/error-handler';
import {
  UserProfile,
  AgeRange,
  EducationLevel,
  LearningStyle,
  ContentType,
  DifficultyPreference
} from '@lusilearn/shared-types';

// Mock the dependencies
jest.mock('bcryptjs');
jest.mock('../../repositories/user.repository');
jest.mock('../../middleware/auth');
jest.mock('../../utils/logger');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockBcrypt: jest.Mocked<typeof bcrypt>;
  let mockGenerateTokens: jest.MockedFunction<typeof generateTokens>;
  let mockVerifyRefreshToken: jest.MockedFunction<typeof verifyRefreshToken>;

  beforeEach(() => {
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;
    mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
    mockGenerateTokens = generateTokens as jest.MockedFunction<typeof generateTokens>;
    mockVerifyRefreshToken = verifyRefreshToken as jest.MockedFunction<typeof verifyRefreshToken>;

    authService = new AuthService();
    (authService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData: RegisterRequest = {
      email: 'test@example.com',
      password: 'password123',
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
      }
    };

    it('should register adult user successfully', async () => {
      // Arrange
      const hashedPassword = 'hashedpassword123';
      const createdUser = createMockUserProfile('user-123');
      const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockGenerateTokens.mockReturnValue(tokens);

      // Act
      const result = await authService.register(validRegisterData);

      // Assert
      expect(result).toEqual({
        user: expect.objectContaining({
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username
        }),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

      expect(mockBcrypt.hash).toHaveBeenCalledWith(validRegisterData.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegisterData.email,
          username: validRegisterData.username,
          privacySettings: expect.objectContaining({
            profileVisibility: 'friends',
            allowPeerMatching: true
          })
        }),
        hashedPassword
      );
    });

    it('should register minor user with parental controls', async () => {
      // Arrange
      const minorRegisterData: RegisterRequest = {
        ...validRegisterData,
        demographics: {
          ...validRegisterData.demographics,
          ageRange: AgeRange.TEEN
        },
        parentalControls: {
          parentEmail: 'parent@example.com',
          restrictedInteractions: true,
          contentFiltering: 'strict',
          timeRestrictions: {
            dailyLimit: 120,
            allowedHours: { start: '09:00', end: '17:00' }
          }
        }
      };

      const hashedPassword = 'hashedpassword123';
      const createdUser = createMockUserProfile('user-123');
      createdUser.demographics.ageRange = AgeRange.TEEN;
      createdUser.parentalControls = minorRegisterData.parentalControls;
      const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockGenerateTokens.mockReturnValue(tokens);

      // Act
      const result = await authService.register(minorRegisterData);

      // Assert
      expect(result.user.parentalControls).toEqual(minorRegisterData.parentalControls);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          privacySettings: expect.objectContaining({
            profileVisibility: 'private', // Stricter for minors
            allowPeerMatching: false // Restricted for minors
          }),
          parentalControls: minorRegisterData.parentalControls
        }),
        hashedPassword
      );
    });

    it('should throw ConflictError when email already exists', async () => {
      // Arrange
      const existingUser = createMockUserProfile('existing-user');
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(validRegisterData)).rejects.toThrow(ConflictError);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictError when username already exists', async () => {
      // Arrange
      const existingUser = createMockUserProfile('existing-user');
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(validRegisterData)).rejects.toThrow(ConflictError);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when minor lacks parental controls', async () => {
      // Arrange
      const minorWithoutControls: RegisterRequest = {
        ...validRegisterData,
        demographics: {
          ...validRegisterData.demographics,
          ageRange: AgeRange.CHILD
        }
        // No parentalControls provided
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.register(minorWithoutControls)).rejects.toThrow(ValidationError);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should handle validation errors from schema', async () => {
      // Arrange
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email' // Invalid email format
      };

      // Act & Assert
      await expect(authService.register(invalidData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    const loginData: LoginRequest = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login user successfully', async () => {
      // Arrange
      const userWithPassword = {
        ...createMockUserProfile('user-123'),
        passwordHash: 'hashedpassword123',
        isActive: true
      };
      const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };

      mockUserRepository.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      mockBcrypt.compare.mockResolvedValue(true);
      mockGenerateTokens.mockReturnValue(tokens);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).toEqual({
        user: expect.objectContaining({
          id: userWithPassword.id,
          email: userWithPassword.email,
          username: userWithPassword.username
        }),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginData.password, userWithPassword.passwordHash);
      expect(mockGenerateTokens).toHaveBeenCalledWith(userWithPassword.id, userWithPassword.email, 'user');
    });

    it('should throw AuthenticationError when user does not exist', async () => {
      // Arrange
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when password is incorrect', async () => {
      // Arrange
      const userWithPassword = {
        ...createMockUserProfile('user-123'),
        passwordHash: 'hashedpassword123',
        isActive: true
      };

      mockUserRepository.findByEmailWithPassword.mockResolvedValue(userWithPassword);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
      expect(mockGenerateTokens).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when account is deactivated', async () => {
      // Arrange
      const deactivatedUser = {
        ...createMockUserProfile('user-123'),
        passwordHash: 'hashedpassword123',
        isActive: false
      };

      mockUserRepository.findByEmailWithPassword.mockResolvedValue(deactivatedUser);
      mockBcrypt.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError);
      expect(mockGenerateTokens).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { userId: 'user-123', email: 'test@example.com' };
      const user = createMockUserProfile('user-123');
      const newTokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };

      mockVerifyRefreshToken.mockReturnValue(decodedToken);
      mockUserRepository.findById.mockResolvedValue(user);
      mockGenerateTokens.mockReturnValue(newTokens);

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result).toEqual(newTokens);
      expect(mockVerifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(decodedToken.userId);
      expect(mockGenerateTokens).toHaveBeenCalledWith(user.id, user.email, 'user');
    });

    it('should throw AuthenticationError when refresh token is invalid', async () => {
      // Arrange
      const invalidRefreshToken = 'invalid-refresh-token';
      mockVerifyRefreshToken.mockReturnValue(null);

      // Act & Assert
      await expect(authService.refreshToken(invalidRefreshToken)).rejects.toThrow(AuthenticationError);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when user no longer exists', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { userId: 'user-123', email: 'test@example.com' };

      mockVerifyRefreshToken.mockReturnValue(decodedToken);
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
      expect(mockGenerateTokens).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'oldpassword123';
    const newPassword = 'newpassword123';

    it('should change password successfully', async () => {
      // Arrange
      const userWithPassword = {
        ...createMockUserProfile(userId),
        passwordHash: 'oldhashed'
      };
      const newHashedPassword = 'newhashed';

      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue(newHashedPassword);
      mockUserRepository.updatePassword.mockResolvedValue();

      // Act
      await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, userWithPassword.passwordHash);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(userId, newHashedPassword);
    });

    it('should throw AuthenticationError when user does not exist', async () => {
      // Arrange
      mockUserRepository.findByIdWithPassword.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(AuthenticationError);
      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when current password is incorrect', async () => {
      // Arrange
      const userWithPassword = {
        ...createMockUserProfile(userId),
        passwordHash: 'oldhashed'
      };

      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(AuthenticationError);
      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when new password is too short', async () => {
      // Arrange
      const userWithPassword = {
        ...createMockUserProfile(userId),
        passwordHash: 'oldhashed'
      };
      const shortPassword = '123';

      mockUserRepository.findByIdWithPassword.mockResolvedValue(userWithPassword);
      mockBcrypt.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(authService.changePassword(userId, currentPassword, shortPassword)).rejects.toThrow(ValidationError);
      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('should handle password reset request for existing user', async () => {
      // Arrange
      const email = 'test@example.com';
      const user = createMockUserProfile('user-123');
      mockUserRepository.findByEmail.mockResolvedValue(user);

      // Act
      await authService.requestPasswordReset(email);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      // In a real implementation, this would trigger email sending
    });

    it('should handle password reset request for non-existent user silently', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      await authService.requestPasswordReset(email);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      // Should not throw error for security reasons
    });

    it('should handle repository errors', async () => {
      // Arrange
      const email = 'test@example.com';
      const error = new Error('Database error');
      mockUserRepository.findByEmail.mockRejectedValue(error);

      // Act & Assert
      await expect(authService.requestPasswordReset(email)).rejects.toThrow(error);
    });
  });

  // Helper function
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
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
});