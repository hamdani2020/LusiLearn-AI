import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AuthService, RegisterRequest } from '../services/auth.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { AgeRange, EducationLevel, LearningStyle, ContentType, DifficultyPreference } from '@lusilearn/shared-types';

const router = express.Router();
const authService = new AuthService();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too Many Requests',
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must be at most 30 characters long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  demographics: z.object({
    ageRange: z.nativeEnum(AgeRange),
    educationLevel: z.nativeEnum(EducationLevel),
    timezone: z.string(),
    preferredLanguage: z.string()
  }),
  learningPreferences: z.object({
    learningStyle: z.array(z.nativeEnum(LearningStyle)),
    preferredContentTypes: z.array(z.nativeEnum(ContentType)),
    sessionDuration: z.number().min(5).max(180),
    difficultyPreference: z.enum(['gradual', 'moderate', 'challenging'])
  }),
  parentalControls: z.object({
    parentEmail: z.string().email(),
    restrictedInteractions: z.boolean(),
    contentFiltering: z.enum(['strict', 'moderate', 'minimal']),
    timeRestrictions: z.object({
      dailyLimit: z.number().min(0),
      allowedHours: z.object({
        start: z.string(),
        end: z.string()
      })
    })
  }).optional()
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'New password must contain at least one lowercase letter, one uppercase letter, and one number')
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format')
});

// POST /api/v1/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const validatedData = RegisterSchema.parse(req.body);

    // ✅ Cast here to fix the TS error
    const result = await authService.register(validatedData as RegisterRequest);

    logger.info('User registration successful:', { 
      userId: result.user.id,
      email: result.user.email 
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});


// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const validatedData = LoginSchema.parse(req.body);
    
    const result = await authService.login(validatedData);
    
    logger.info('User login successful:', { 
      userId: result.user.id,
      email: result.user.email 
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const validatedData = RefreshTokenSchema.parse(req.body);
    
    const result = await authService.refreshToken(validatedData.refreshToken);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const validatedData = ChangePasswordSchema.parse(req.body);
    
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }
    
    await authService.changePassword(
      req.user.id,
      validatedData.currentPassword,
      validatedData.newPassword
    );
    
    logger.info('Password changed successfully:', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const validatedData = PasswordResetRequestSchema.parse(req.body);
    
    await authService.requestPasswordReset(validatedData.email);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    // In a more complete implementation, you would invalidate the refresh token
    // For now, we just log the logout
    logger.info('User logged out:', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    // Return current user info (token is still valid)
    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };