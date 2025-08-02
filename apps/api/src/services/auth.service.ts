import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import { AuthenticationError, ValidationError, ConflictError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { 
  UserProfile, 
  CreateUserRequestSchema,
  AgeRange,
  EducationLevel,
  LearningStyle,
  ContentType,
  DifficultyPreference
} from '@lusilearn/shared-types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  demographics: {
    ageRange: AgeRange;
    educationLevel: EducationLevel;
    timezone: string;
    preferredLanguage: string;
  };
  learningPreferences: {
    learningStyle: LearningStyle[];
    preferredContentTypes: ContentType[];
    sessionDuration: number;
    difficultyPreference: DifficultyPreference;
  };
  parentalControls?: {
    parentEmail: string;
    restrictedInteractions: boolean;
    contentFiltering: 'strict' | 'moderate' | 'minimal';
    timeRestrictions: {
      dailyLimit: number;
      allowedHours: { start: string; end: string };
    };
  };
}

export interface AuthResponse {
  user: Omit<UserProfile, 'skillProfile'>;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      // Validate input data
      const validatedData = CreateUserRequestSchema.parse({
        email: data.email,
        username: data.username,
        demographics: data.demographics,
        learningPreferences: data.learningPreferences,
        parentalControls: data.parentalControls
      });

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      const existingUsername = await this.userRepository.findByUsername(data.username);
      if (existingUsername) {
        throw new ConflictError('Username is already taken');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(data.password, saltRounds);

      // Determine if parental controls are needed
      const needsParentalControls = data.demographics.ageRange === AgeRange.CHILD || 
                                   data.demographics.ageRange === AgeRange.TEEN;

      if (needsParentalControls && !data.parentalControls) {
        throw new ValidationError('Parental controls are required for users under 18');
      }

      // Create user profile
      const userProfile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        email: validatedData.email,
        username: validatedData.username,
        demographics: validatedData.demographics,
        learningPreferences: validatedData.learningPreferences,
        skillProfile: [],
        privacySettings: {
          profileVisibility: needsParentalControls ? 'private' : 'friends',
          allowPeerMatching: !needsParentalControls,
          shareProgressData: false,
          allowDataCollection: false
        },
        parentalControls: validatedData.parentalControls,
        isVerified: false
      };

      // Save user to database
      const createdUser = await this.userRepository.create(userProfile, passwordHash);

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        createdUser.id,
        createdUser.email,
        'user'
      );

      logger.info('User registered successfully:', { 
        userId: createdUser.id, 
        email: createdUser.email 
      });

      return {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
          demographics: createdUser.demographics,
          learningPreferences: createdUser.learningPreferences,
          privacySettings: createdUser.privacySettings,
          parentalControls: createdUser.parentalControls,
          isVerified: createdUser.isVerified,
          createdAt: createdUser.createdAt,
          updatedAt: createdUser.updatedAt
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmailWithPassword(data.email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is deactivated');
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        user.id,
        user.email,
        'user'
      );

      logger.info('User logged in successfully:', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          demographics: user.demographics,
          learningPreferences: user.learningPreferences,
          privacySettings: user.privacySettings,
          parentalControls: user.parentalControls,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        accessToken,
        refreshToken
      };

    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Check if user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new AuthenticationError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = generateTokens(user.id, user.email, 'user');

      logger.info('Token refreshed successfully:', { userId: user.id });

      return tokens;

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user with password
      const user = await this.userRepository.findByIdWithPassword(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await this.userRepository.updatePassword(userId, newPasswordHash);

      logger.info('Password changed successfully:', { userId });

    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.info('Password reset requested for non-existent email:', { email });
        return;
      }

      // TODO: Implement password reset token generation and email sending
      // For now, just log the request
      logger.info('Password reset requested:', { userId: user.id, email });

    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }
}