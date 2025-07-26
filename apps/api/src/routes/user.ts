import express from 'express';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { 
  UserDemographicsSchema,
  LearningPreferencesSchema,
  PrivacySettingsSchema,
  ParentalControlsSchema
} from '@lusilearn/shared-types';

const router = express.Router();
const userService = new UserService();

// Validation schemas for updates
const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  demographics: UserDemographicsSchema.optional(),
  learningPreferences: LearningPreferencesSchema.optional(),
  privacySettings: PrivacySettingsSchema.optional(),
  parentalControls: ParentalControlsSchema.optional()
});

// GET /api/v1/users/profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const user = await userService.getProfile(req.user.id);

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/users/profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = UpdateProfileSchema.parse(req.body);
    
    const updatedUser = await userService.updateProfile(req.user.id, validatedData);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/users/learning-preferences
router.put('/learning-preferences', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = LearningPreferencesSchema.parse(req.body);
    
    const updatedUser = await userService.updateLearningPreferences(req.user.id, validatedData);

    res.json({
      success: true,
      message: 'Learning preferences updated successfully',
      data: {
        learningPreferences: updatedUser.learningPreferences
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/users/privacy-settings
router.put('/privacy-settings', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = PrivacySettingsSchema.parse(req.body);
    
    const updatedUser = await userService.updatePrivacySettings(req.user.id, validatedData);

    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: {
        privacySettings: updatedUser.privacySettings
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/users/parental-controls
router.put('/parental-controls', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = ParentalControlsSchema.parse(req.body);
    
    const updatedUser = await userService.updateParentalControls(req.user.id, validatedData);

    res.json({
      success: true,
      message: 'Parental controls updated successfully',
      data: {
        parentalControls: updatedUser.parentalControls
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/users/parental-controls
router.delete('/parental-controls', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    await userService.removeParentalControls(req.user.id);

    res.json({
      success: true,
      message: 'Parental controls removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/users/account
router.delete('/account', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    await userService.deactivateAccount(req.user.id);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };