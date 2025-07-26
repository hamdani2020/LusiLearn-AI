import express from 'express';
import { z } from 'zod';
import { AssessmentService } from '../services/assessment.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { EducationLevel } from '@lusilearn/shared-types';

const router = express.Router();
const assessmentService = new AssessmentService();

// Validation schemas
const GetQuestionsSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  count: z.number().min(5).max(50).optional().default(20)
});

const AssessmentResponseSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  selectedAnswer: z.string().min(1, 'Selected answer is required'),
  timeSpent: z.number().min(0, 'Time spent must be non-negative')
});

const SubmitAssessmentSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  responses: z.array(AssessmentResponseSchema).min(1, 'At least one response is required')
});

const SkillGapAnalysisSchema = z.object({
  targetLevels: z.record(z.string(), z.number().min(1).max(10))
});

// GET /api/v1/assessments/questions
router.get('/questions', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { subject, count } = GetQuestionsSchema.parse(req.query);

    // Get user profile to determine education level
    const userProfile = await assessmentService.getUserSkillProfile(req.user.id);
    
    // For now, we'll assume college level. In a real implementation, 
    // this would come from the user's profile
    const educationLevel = EducationLevel.COLLEGE;

    const questions = await assessmentService.getAssessmentQuestions(
      subject,
      educationLevel,
      count
    );

    res.json({
      success: true,
      data: {
        subject,
        questionCount: questions.length,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          skillArea: q.skillArea
          // Note: correctAnswer is not included in the response
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assessments/submit
router.post('/submit', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = SubmitAssessmentSchema.parse(req.body);

    const result = await assessmentService.submitAssessment(
      req.user.id,
      validatedData.subject,
      validatedData.responses
    );

    logger.info('Assessment submitted:', { 
      userId: req.user.id,
      subject: validatedData.subject,
      score: result.score
    });

    res.json({
      success: true,
      message: 'Assessment completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/assessments/skill-profile
router.get('/skill-profile', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const skillProfile = await assessmentService.getUserSkillProfile(req.user.id);

    res.json({
      success: true,
      data: {
        skillProfile,
        lastUpdated: skillProfile.length > 0 
          ? Math.max(...skillProfile.map(s => s.lastAssessed.getTime()))
          : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assessments/skill-gaps
router.post('/skill-gaps', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const validatedData = SkillGapAnalysisSchema.parse(req.body);

    const skillGaps = await assessmentService.identifySkillGaps(
      req.user.id,
      validatedData.targetLevels
    );

    res.json({
      success: true,
      data: {
        skillGaps,
        analysisDate: new Date().toISOString(),
        totalGaps: skillGaps.length,
        highPriorityGaps: skillGaps.filter(gap => gap.priority === 'high').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/assessments/retake/:subject
router.post('/retake/:subject', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const subject = req.params.subject;
    if (!subject) {
      throw new ValidationError('Subject parameter is required');
    }

    const questions = await assessmentService.retakeAssessment(req.user.id, subject);

    logger.info('Assessment retake initiated:', { 
      userId: req.user.id,
      subject
    });

    res.json({
      success: true,
      message: 'Assessment retake questions generated',
      data: {
        subject,
        questionCount: questions.length,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          skillArea: q.skillArea
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/assessments/subjects
router.get('/subjects', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    // Return available assessment subjects
    // In a real implementation, this would come from a database
    const subjects = [
      {
        id: 'mathematics',
        name: 'Mathematics',
        description: 'Basic arithmetic, algebra, geometry, and calculus',
        skillAreas: ['basic_arithmetic', 'algebra', 'geometry', 'calculus', 'statistics']
      },
      {
        id: 'programming',
        name: 'Programming',
        description: 'Programming fundamentals, algorithms, and data structures',
        skillAreas: ['fundamentals', 'algorithms', 'data_structures', 'web_development', 'databases']
      },
      {
        id: 'science',
        name: 'Science',
        description: 'Physics, chemistry, and biology concepts',
        skillAreas: ['physics', 'chemistry', 'biology', 'scientific_method']
      },
      {
        id: 'english',
        name: 'English',
        description: 'Reading comprehension, writing, and grammar',
        skillAreas: ['reading_comprehension', 'writing', 'grammar', 'vocabulary']
      }
    ];

    res.json({
      success: true,
      data: subjects
    });
  } catch (error) {
    next(error);
  }
});

export { router as assessmentRouter };