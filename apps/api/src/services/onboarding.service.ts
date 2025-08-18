import { Pool } from 'pg';
import { 
  UserProfile,
  LearningPreferences,
  SkillAssessment,
  OnboardingStep,
  OnboardingProgress,
  GoalSetting,
  LearningPath,
  LearningStyle,
  ContentType,
  DifficultyPreference,
  SkillAssessmentResult
} from '@lusilearn/shared-types';
import { UserService } from './user.service';
import { LearningPathService } from './learning-path.service';
import { AssessmentService } from './assessment.service';
import { logger } from '../utils/logger';

export interface OnboardingSession {
  id: string;
  userId: string;
  currentStep: OnboardingStep;
  progress: OnboardingProgress;
  skillAssessment?: SkillAssessmentResult;
  learningPreferences?: LearningPreferences;
  goals?: GoalSetting[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface SkillAssessmentQuestion {
  id: string;
  category: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'rating' | 'text';
  options?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weight: number;
}



export interface OnboardingRecommendation {
  recommendedSubjects: string[];
  suggestedGoals: GoalSetting[];
  learningPathPreview?: Partial<LearningPath>;
  nextSteps: string[];
}

export class OnboardingService {
  private userService: UserService;
  private learningPathService: LearningPathService;
  private assessmentService: AssessmentService;
  private aiServiceUrl: string;

  constructor(pool: Pool) {
    this.userService = new UserService();
    this.learningPathService = new LearningPathService(pool);
    this.assessmentService = new AssessmentService();
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  }

  /**
   * Start onboarding process for a new user
   */
  async startOnboarding(userId: string): Promise<OnboardingSession> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      
      const onboardingSession: OnboardingSession = {
        id: `onboarding_${userId}_${Date.now()}`,
        userId,
        currentStep: OnboardingStep.WELCOME,
        progress: {
          completedSteps: [],
          currentStep: OnboardingStep.WELCOME,
          totalSteps: 7,
          completionPercentage: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info(`Started onboarding for user ${userId}`, {
        sessionId: onboardingSession.id,
        currentStep: onboardingSession.currentStep
      });

      return onboardingSession;
    } catch (error) {
      logger.error('Error starting onboarding:', error);
      throw error;
    }
  }

  /**
   * Get current onboarding session
   */
  async getOnboardingSession(userId: string): Promise<OnboardingSession | null> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll simulate by checking if user has completed onboarding
      const userProfile = await this.userService.getProfile(userId);
      
      if (userProfile.onboardingCompleted) {
        return null; // Onboarding already completed
      }

      // Return a simulated session
      return {
        id: `onboarding_${userId}`,
        userId,
        currentStep: OnboardingStep.WELCOME,
        progress: {
          completedSteps: [],
          currentStep: OnboardingStep.WELCOME,
          totalSteps: 7,
          completionPercentage: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error getting onboarding session:', error);
      throw error;
    }
  }

  /**
   * Update onboarding progress
   */
  async updateOnboardingProgress(
    userId: string, 
    step: OnboardingStep, 
    data: any
  ): Promise<OnboardingSession> {
    try {
      const session = await this.getOnboardingSession(userId);
      if (!session) {
        throw new Error('No active onboarding session found');
      }

      // Update session with new data
      session.currentStep = step;
      session.updatedAt = new Date();

      // Store step-specific data
      switch (step) {
        case OnboardingStep.SKILL_ASSESSMENT:
          session.skillAssessment = data;
          break;
        case OnboardingStep.LEARNING_PREFERENCES:
          session.learningPreferences = data;
          break;
        case OnboardingStep.GOAL_SETTING:
          session.goals = data;
          break;
      }

      // Update progress
      const completedSteps = [...session.progress.completedSteps];
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }

      session.progress = {
        completedSteps,
        currentStep: step,
        totalSteps: 7,
        completionPercentage: Math.round((completedSteps.length / 7) * 100)
      };

      logger.info(`Updated onboarding progress for user ${userId}`, {
        step,
        completionPercentage: session.progress.completionPercentage
      });

      return session;
    } catch (error) {
      logger.error('Error updating onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Generate skill assessment questions
   */
  async generateSkillAssessment(userId: string, subject?: string): Promise<SkillAssessmentQuestion[]> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      
      // Try to get AI-generated questions first
      try {
        const aiQuestions = await this.callAIServiceForSkillAssessment(userProfile, subject);
        if (aiQuestions && aiQuestions.length > 0) {
          logger.info(`Generated ${aiQuestions.length} AI-powered skill assessment questions for user ${userId}`);
          return aiQuestions;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for skill assessment, using fallback questions', { error: aiError });
      }

      // Fallback to predefined questions
      return this.generateFallbackSkillAssessment(userProfile.demographics.educationLevel, subject);
    } catch (error) {
      logger.error('Error generating skill assessment:', error);
      throw error;
    }
  }

  /**
   * Evaluate skill assessment results
   */
  async evaluateSkillAssessment(
    userId: string, 
    answers: Record<string, any>
  ): Promise<SkillAssessmentResult> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      
      // Try AI-powered evaluation first
      try {
        const aiResult = await this.callAIServiceForSkillEvaluation(userProfile, answers);
        if (aiResult) {
          logger.info(`AI-powered skill assessment evaluation completed for user ${userId}`, {
            overallScore: aiResult.overallScore,
            recommendedLevel: aiResult.recommendedLevel
          });
          return aiResult;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for skill evaluation, using fallback evaluation', { error: aiError });
      }

      // Fallback to algorithmic evaluation
      return this.evaluateSkillAssessmentAlgorithmically(answers);
    } catch (error) {
      logger.error('Error evaluating skill assessment:', error);
      throw error;
    }
  }

  /**
   * Generate learning preferences recommendations
   */
  async generateLearningPreferencesRecommendations(
    userId: string,
    skillAssessment?: SkillAssessmentResult
  ): Promise<LearningPreferences> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      
      // Try AI-powered recommendations first
      try {
        const aiRecommendations = await this.callAIServiceForLearningPreferences(userProfile, skillAssessment);
        if (aiRecommendations) {
          logger.info(`AI-powered learning preferences generated for user ${userId}`);
          return aiRecommendations;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for learning preferences, using fallback recommendations', { error: aiError });
      }

      // Fallback to rule-based recommendations
      return this.generateFallbackLearningPreferences(userProfile, skillAssessment);
    } catch (error) {
      logger.error('Error generating learning preferences:', error);
      throw error;
    }
  }

  /**
   * Generate goal recommendations
   */
  async generateGoalRecommendations(
    userId: string,
    skillAssessment?: SkillAssessmentResult,
    learningPreferences?: LearningPreferences
  ): Promise<GoalSetting[]> {
    try {
      const userProfile = await this.userService.getProfile(userId);
      
      // Try AI-powered goal recommendations first
      try {
        const aiGoals = await this.callAIServiceForGoalRecommendations(userProfile, skillAssessment, learningPreferences);
        if (aiGoals && aiGoals.length > 0) {
          logger.info(`AI-powered goal recommendations generated for user ${userId}`, {
            goalCount: aiGoals.length
          });
          return aiGoals;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for goal recommendations, using fallback goals', { error: aiError });
      }

      // Fallback to predefined goals
      return this.generateFallbackGoals(userProfile, skillAssessment);
    } catch (error) {
      logger.error('Error generating goal recommendations:', error);
      throw error;
    }
  }

  /**
   * Complete onboarding and generate initial learning path
   */
  async completeOnboarding(userId: string): Promise<OnboardingRecommendation> {
    try {
      const session = await this.getOnboardingSession(userId);
      if (!session) {
        throw new Error('No active onboarding session found');
      }

      // Generate recommendations based on collected data
      const recommendations: OnboardingRecommendation = {
        recommendedSubjects: [],
        suggestedGoals: [],
        nextSteps: []
      };

      // Determine recommended subjects based on skill assessment
      if (session.skillAssessment) {
        recommendations.recommendedSubjects = this.determineRecommendedSubjects(session.skillAssessment);
      }

      // Generate suggested goals
      if (session.goals) {
        recommendations.suggestedGoals = session.goals;
      } else {
        recommendations.suggestedGoals = await this.generateGoalRecommendations(
          userId,
          session.skillAssessment
        );
      }

      // Generate learning path preview for primary subject
      if (recommendations.recommendedSubjects.length > 0) {
        const primarySubject = recommendations.recommendedSubjects[0];
        try {
          // Convert GoalSetting[] to LearningGoal[]
          const learningGoals = recommendations.suggestedGoals.map(goal => ({
            objective: goal.title,
            timeline: `${goal.targetDate.toDateString()}`,
            priority: goal.priority
          }));
          
          const learningPath = await this.learningPathService.generatePath(
            userId,
            primarySubject,
            learningGoals
          );
          
          recommendations.learningPathPreview = {
            id: learningPath.id,
            subject: learningPath.subject,
            objectives: learningPath.objectives.slice(0, 3), // Show first 3 objectives
            currentLevel: learningPath.currentLevel,
            progress: learningPath.progress
          };
        } catch (pathError) {
          logger.warn('Failed to generate learning path preview', { error: pathError });
        }
      }

      // Generate next steps
      recommendations.nextSteps = this.generateNextSteps(session);

      // Mark onboarding as completed
      await this.userService.updateProfile(userId, {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date()
      });

      // Update session
      session.currentStep = OnboardingStep.COMPLETED;
      session.completedAt = new Date();
      session.progress.completionPercentage = 100;

      logger.info(`Completed onboarding for user ${userId}`, {
        recommendedSubjects: recommendations.recommendedSubjects,
        goalCount: recommendations.suggestedGoals.length
      });

      return recommendations;
    } catch (error) {
      logger.error('Error completing onboarding:', error);
      throw error;
    }
  }

  /**
   * AI Service Integration Methods
   */

  private async callAIServiceForSkillAssessment(
    userProfile: UserProfile,
    subject?: string
  ): Promise<SkillAssessmentQuestion[]> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/assessment/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_profile: userProfile,
          subject: subject,
          question_count: 10,
          difficulty_distribution: {
            beginner: 0.4,
            intermediate: 0.4,
            advanced: 0.2
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result.questions || [];
    } catch (error) {
      logger.warn('Failed to call AI service for skill assessment', { error });
      throw error;
    }
  }

  private async callAIServiceForSkillEvaluation(
    userProfile: UserProfile,
    answers: Record<string, any>
  ): Promise<SkillAssessmentResult | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/assessment/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_profile: userProfile,
          answers: answers
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result.evaluation || null;
    } catch (error) {
      logger.warn('Failed to call AI service for skill evaluation', { error });
      throw error;
    }
  }

  private async callAIServiceForLearningPreferences(
    userProfile: UserProfile,
    skillAssessment?: SkillAssessmentResult
  ): Promise<LearningPreferences | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/onboarding/learning-preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_profile: userProfile,
          skill_assessment: skillAssessment
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result.preferences || null;
    } catch (error) {
      logger.warn('Failed to call AI service for learning preferences', { error });
      throw error;
    }
  }

  private async callAIServiceForGoalRecommendations(
    userProfile: UserProfile,
    skillAssessment?: SkillAssessmentResult,
    learningPreferences?: LearningPreferences
  ): Promise<GoalSetting[] | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/onboarding/goal-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_profile: userProfile,
          skill_assessment: skillAssessment,
          learning_preferences: learningPreferences
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result.goals || null;
    } catch (error) {
      logger.warn('Failed to call AI service for goal recommendations', { error });
      throw error;
    }
  }

  /**
   * Fallback Methods
   */

  private generateFallbackSkillAssessment(
    educationLevel: string,
    subject?: string
  ): SkillAssessmentQuestion[] {
    const questions: SkillAssessmentQuestion[] = [
      {
        id: 'math-1',
        category: 'mathematics',
        question: 'How comfortable are you with basic arithmetic operations (addition, subtraction, multiplication, division)?',
        type: 'rating',
        difficulty: 'beginner',
        weight: 1
      },
      {
        id: 'math-2',
        category: 'mathematics',
        question: 'Do you understand the concept of variables and simple equations?',
        type: 'true_false',
        difficulty: 'intermediate',
        weight: 1
      },
      {
        id: 'prog-1',
        category: 'programming',
        question: 'Have you ever written code in any programming language?',
        type: 'true_false',
        difficulty: 'beginner',
        weight: 1
      },
      {
        id: 'prog-2',
        category: 'programming',
        question: 'Which programming concepts are you familiar with?',
        type: 'multiple_choice',
        options: ['Variables and loops', 'Functions and objects', 'Data structures and algorithms', 'None of the above'],
        difficulty: 'intermediate',
        weight: 1
      },
      {
        id: 'sci-1',
        category: 'science',
        question: 'How would you rate your understanding of the scientific method?',
        type: 'rating',
        difficulty: 'beginner',
        weight: 1
      }
    ];

    // Filter by subject if specified
    if (subject) {
      return questions.filter(q => q.category === subject.toLowerCase());
    }

    return questions;
  }

  private evaluateSkillAssessmentAlgorithmically(answers: Record<string, any>): SkillAssessmentResult {
    let totalScore = 0;
    let categoryScores: Record<string, number> = {};
    let strengths: string[] = [];
    let areasForImprovement: string[] = [];

    // Simple scoring algorithm
    Object.entries(answers).forEach(([questionId, answer]) => {
      const category = questionId.split('-')[0];
      let score = 0;

      if (typeof answer === 'number') {
        score = answer; // Rating scale 1-5
      } else if (typeof answer === 'boolean') {
        score = answer ? 5 : 1;
      } else if (typeof answer === 'string') {
        // Multiple choice scoring
        const options = ['Variables and loops', 'Functions and objects', 'Data structures and algorithms', 'None of the above'];
        const index = options.indexOf(answer);
        score = index >= 0 ? (index + 1) * 1.25 : 1;
      }

      totalScore += score;
      categoryScores[category] = (categoryScores[category] || 0) + score;
    });

    const avgScore = totalScore / Object.keys(answers).length;
    const recommendedLevel = avgScore >= 4 ? 'advanced' : avgScore >= 2.5 ? 'intermediate' : 'beginner';

    // Determine strengths and areas for improvement
    Object.entries(categoryScores).forEach(([category, score]) => {
      const avgCategoryScore = score / Object.keys(answers).filter(q => q.startsWith(category)).length;
      if (avgCategoryScore >= 4) {
        strengths.push(category);
      } else if (avgCategoryScore <= 2) {
        areasForImprovement.push(category);
      }
    });

    return {
      overallScore: Math.round(avgScore * 20), // Convert to 0-100 scale
      categoryScores,
      recommendedLevel,
      strengths,
      areasForImprovement,
      confidence: Math.min(95, 60 + (Object.keys(answers).length * 5)),
      completedAt: new Date()
    };
  }

  private generateFallbackLearningPreferences(
    userProfile: UserProfile,
    skillAssessment?: SkillAssessmentResult
  ): LearningPreferences {
    return {
      learningStyle: [LearningStyle.VISUAL, LearningStyle.AUDITORY],
      preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
      sessionDuration: 45,
      difficultyPreference: DifficultyPreference.MODERATE
    };
  }

  private generateFallbackGoals(
    userProfile: UserProfile,
    skillAssessment?: SkillAssessmentResult
  ): GoalSetting[] {
    const goals: GoalSetting[] = [
      {
        id: 'goal-1',
        title: 'Master Core Concepts',
        description: 'Build a strong foundation in the chosen subject area',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        priority: 'high',
        progress: 0,
        isCompleted: false
      },
      {
        id: 'goal-2',
        title: 'Complete First Learning Path',
        description: 'Finish a complete learning path to demonstrate understanding',
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        priority: 'medium',
        progress: 0,
        isCompleted: false
      }
    ];

    if (skillAssessment?.areasForImprovement.length) {
      goals.push({
        id: 'goal-3',
        title: 'Improve Weak Areas',
        description: `Focus on improving: ${skillAssessment.areasForImprovement.join(', ')}`,
        targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        priority: 'high',
        progress: 0,
        isCompleted: false
      });
    }

    return goals;
  }

  private determineRecommendedSubjects(skillAssessment: SkillAssessmentResult): string[] {
    const subjects = ['mathematics', 'programming', 'science'];
    const recommendations: string[] = [];

    // Recommend subjects based on strengths
    skillAssessment.strengths.forEach(strength => {
      if (subjects.includes(strength)) {
        recommendations.push(strength);
      }
    });

    // If no strengths match, recommend based on overall score
    if (recommendations.length === 0) {
      if (skillAssessment.overallScore >= 70) {
        recommendations.push('programming', 'mathematics');
      } else if (skillAssessment.overallScore >= 40) {
        recommendations.push('mathematics', 'science');
      } else {
        recommendations.push('mathematics');
      }
    }

    return recommendations.slice(0, 2); // Return top 2 recommendations
  }

  private generateNextSteps(session: OnboardingSession): string[] {
    const nextSteps = [
      'Complete your first learning session',
      'Explore recommended content',
      'Set up your study schedule',
      'Connect with study partners'
    ];

    if (session.skillAssessment?.areasForImprovement.length) {
      nextSteps.unshift(`Focus on improving: ${session.skillAssessment.areasForImprovement.join(', ')}`);
    }

    return nextSteps;
  }
} 