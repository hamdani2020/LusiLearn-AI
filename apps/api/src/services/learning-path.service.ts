import { 
  LearningPath, 
  LearningGoal, 
  DifficultyLevel,
  LearningObjective,
  Milestone,
  PathAdaptation,
  PerformanceData,
  DifficultyAdjustmentResult,
  ContentSequenceResult,
  CompetencyTestResult,
  OptimalChallengeAnalysis,
  LearningSession
} from '@lusilearn/shared-types';
import { LearningPathRepository, CreateLearningPathRequest, UpdateLearningPathRequest, ShareLearningPathRequest } from '../repositories/learning-path.repository';
import { UserService } from './user.service';
import { AdaptiveDifficultyService } from './adaptive-difficulty.service';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

export class LearningPathService {
  private learningPathRepository: LearningPathRepository;
  private userService: UserService;
  private adaptiveDifficultyService: AdaptiveDifficultyService;

  constructor(pool: Pool) {
    this.learningPathRepository = new LearningPathRepository(pool);
    this.userService = new UserService();
    this.adaptiveDifficultyService = new AdaptiveDifficultyService(pool);
  }

  async generatePath(userId: string, subject: string, goals: LearningGoal[]): Promise<LearningPath> {
    try {
      // Get user profile to understand their level and preferences
      const userProfile = await this.userService.getProfile(userId);
      
      // Check if user already has a path for this subject
      const existingPath = await this.learningPathRepository.findByUserIdAndSubject(userId, subject);
      if (existingPath) {
        logger.info(`User ${userId} already has a learning path for ${subject}`);
        return existingPath;
      }

      // Determine initial difficulty level based on user's education level and preferences
      const currentLevel = this.determineInitialDifficulty(userProfile.demographics.educationLevel);

      // Generate learning objectives and milestones
      const objectives = await this.generateLearningObjectives(subject, currentLevel, goals);
      const milestones = this.generateMilestones(objectives);

      const pathData: CreateLearningPathRequest = {
        userId,
        subject,
        goals,
        currentLevel,
        objectives,
        milestones
      };

      // Try to call AI service for enhanced path generation
      try {
        const enhancedPath = await this.callAIServiceForPathGeneration(userProfile, pathData);
        if (enhancedPath) {
          pathData.objectives = enhancedPath.objectives;
          pathData.milestones = enhancedPath.milestones;
          pathData.currentLevel = enhancedPath.currentLevel;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable, using fallback path generation', { error: aiError });
      }

      const learningPath = await this.learningPathRepository.create(pathData);
      
      logger.info(`Generated learning path for user ${userId} in subject ${subject}`, {
        pathId: learningPath.id,
        objectiveCount: objectives.length,
        milestoneCount: milestones.length
      });

      return learningPath;
    } catch (error) {
      logger.error('Error generating learning path:', error);
      throw error;
    }
  }

  async getPath(pathId: string): Promise<LearningPath | null> {
    try {
      return await this.learningPathRepository.findById(pathId);
    } catch (error) {
      logger.error('Error getting learning path:', error);
      throw error;
    }
  }

  async getUserPaths(userId: string): Promise<LearningPath[]> {
    try {
      const ownPaths = await this.learningPathRepository.findByUserId(userId);
      const sharedPaths = await this.learningPathRepository.getSharedPaths(userId);
      
      return [...ownPaths, ...sharedPaths];
    } catch (error) {
      logger.error('Error getting user learning paths:', error);
      throw error;
    }
  }

  async updatePath(pathId: string, updates: UpdateLearningPathRequest): Promise<LearningPath | null> {
    try {
      const updatedPath = await this.learningPathRepository.update(pathId, updates);
      
      if (updatedPath) {
        logger.info(`Updated learning path ${pathId}`, { updates });
      }
      
      return updatedPath;
    } catch (error) {
      logger.error('Error updating learning path:', error);
      throw error;
    }
  }

  async updateProgress(pathId: string, performanceData: PerformanceData): Promise<LearningPath | null> {
    try {
      const currentPath = await this.learningPathRepository.findById(pathId);
      if (!currentPath) {
        return null;
      }

      // Calculate new progress based on performance
      const newProgress = this.calculateProgress(currentPath, performanceData);
      
      // Check if difficulty adjustment is needed
      const difficultyAdjustment = this.shouldAdjustDifficulty(performanceData);
      
      const updates: UpdateLearningPathRequest = {
        progress: newProgress
      };

      if (difficultyAdjustment) {
        updates.currentLevel = difficultyAdjustment;
        
        // Add adaptation record
        const adaptation: PathAdaptation = {
          timestamp: new Date(),
          reason: `Performance-based difficulty adjustment: ${performanceData.comprehensionScore}% comprehension`,
          changes: {
            difficultyAdjustment
          }
        };
        
        await this.learningPathRepository.addAdaptation(pathId, adaptation);
      }

      return await this.learningPathRepository.update(pathId, updates);
    } catch (error) {
      logger.error('Error updating learning path progress:', error);
      throw error;
    }
  }

  async sharePath(pathId: string, shareData: ShareLearningPathRequest): Promise<void> {
    try {
      // Verify the path exists and user has permission to share
      const path = await this.learningPathRepository.findById(pathId);
      if (!path) {
        throw new Error('Learning path not found');
      }

      await this.learningPathRepository.sharePath(pathId, shareData);
      
      logger.info(`Learning path ${pathId} shared with user ${shareData.sharedWithUserId}`, {
        permissions: shareData.permissions
      });
    } catch (error) {
      logger.error('Error sharing learning path:', error);
      throw error;
    }
  }

  async deletePath(pathId: string): Promise<boolean> {
    try {
      const success = await this.learningPathRepository.deactivate(pathId);
      
      if (success) {
        logger.info(`Deactivated learning path ${pathId}`);
      }
      
      return success;
    } catch (error) {
      logger.error('Error deleting learning path:', error);
      throw error;
    }
  }

  /**
   * Adaptive Difficulty System Methods
   */

  /**
   * Analyze performance and adjust difficulty if needed
   */
  async adaptDifficulty(userId: string, pathId: string, recentSessions: LearningSession[]): Promise<DifficultyAdjustmentResult | null> {
    try {
      const adjustmentResult = await this.adaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        recentSessions
      );

      if (adjustmentResult) {
        // Apply the difficulty adjustment
        await this.adaptiveDifficultyService.applyDifficultyAdjustment(pathId, adjustmentResult);
        
        logger.info(`Applied difficulty adjustment for user ${userId}`, {
          pathId,
          newDifficulty: adjustmentResult.newDifficulty,
          reason: adjustmentResult.reason
        });
      }

      return adjustmentResult;
    } catch (error) {
      logger.error('Error adapting difficulty:', error);
      throw error;
    }
  }

  /**
   * Get next content based on prerequisite mastery
   */
  async getNextContent(userId: string, pathId: string): Promise<ContentSequenceResult> {
    try {
      return await this.adaptiveDifficultyService.sequenceContentByPrerequisites(userId, pathId);
    } catch (error) {
      logger.error('Error getting next content:', error);
      throw error;
    }
  }

  /**
   * Conduct competency test for advancement
   */
  async requestAdvancement(userId: string, pathId: string, requestedLevel: DifficultyLevel): Promise<CompetencyTestResult> {
    try {
      const testResult = await this.adaptiveDifficultyService.conductCompetencyTest(
        userId, 
        pathId, 
        requestedLevel
      );

      // If test passed, apply the advancement
      if (testResult.passed && testResult.readyForAdvancement) {
        const adaptation: PathAdaptation = {
          timestamp: new Date(),
          reason: `User-requested advancement approved via competency test (score: ${testResult.score}%)`,
          changes: {
            difficultyAdjustment: requestedLevel
          }
        };

        await this.learningPathRepository.update(pathId, {
          currentLevel: requestedLevel
        });

        await this.learningPathRepository.addAdaptation(pathId, adaptation);

        logger.info(`User advancement approved for user ${userId}`, {
          pathId,
          newLevel: requestedLevel,
          testScore: testResult.score
        });
      }

      return testResult;
    } catch (error) {
      logger.error('Error processing advancement request:', error);
      throw error;
    }
  }

  /**
   * Maintain optimal challenge level (70-85% comprehension)
   */
  async maintainOptimalChallenge(userId: string, pathId: string): Promise<OptimalChallengeAnalysis> {
    try {
      const analysis = await this.adaptiveDifficultyService.maintainOptimalChallengeLevel(userId, pathId);
      
      logger.info(`Optimal challenge analysis completed for user ${userId}`, {
        pathId,
        currentLevel: analysis.currentChallengeLevel,
        isOptimal: analysis.isOptimal,
        adjustment: analysis.adjustment
      });

      return analysis;
    } catch (error) {
      logger.error('Error maintaining optimal challenge level:', error);
      throw error;
    }
  }

  /**
   * Enhanced progress update with adaptive difficulty
   */
  async updateProgressWithAdaptation(pathId: string, performanceData: PerformanceData, recentSessions: LearningSession[]): Promise<LearningPath | null> {
    try {
      const currentPath = await this.learningPathRepository.findById(pathId);
      if (!currentPath) {
        return null;
      }

      // Calculate new progress based on performance
      const newProgress = this.calculateProgress(currentPath, performanceData);
      
      // Use adaptive difficulty service for more sophisticated analysis
      const difficultyAdjustment = await this.adaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment(
        currentPath.userId,
        pathId,
        recentSessions
      );
      
      const updates: UpdateLearningPathRequest = {
        progress: newProgress
      };

      if (difficultyAdjustment) {
        updates.currentLevel = difficultyAdjustment.newDifficulty;
        
        // Add adaptation record with detailed reasoning
        const adaptation: PathAdaptation = {
          timestamp: new Date(),
          reason: difficultyAdjustment.reason,
          changes: {
            difficultyAdjustment: difficultyAdjustment.newDifficulty
          }
        };
        
        await this.learningPathRepository.addAdaptation(pathId, adaptation);
      }

      // Also check optimal challenge level
      await this.maintainOptimalChallenge(currentPath.userId, pathId);

      return await this.learningPathRepository.update(pathId, updates);
    } catch (error) {
      logger.error('Error updating learning path progress with adaptation:', error);
      throw error;
    }
  }

  private determineInitialDifficulty(educationLevel: string): DifficultyLevel {
    switch (educationLevel.toLowerCase()) {
      case 'elementary':
      case 'k-5':
        return DifficultyLevel.BEGINNER;
      case 'middle_school':
      case '6-8':
        return DifficultyLevel.BEGINNER;
      case 'high_school':
      case '9-12':
        return DifficultyLevel.INTERMEDIATE;
      case 'college':
      case 'university':
        return DifficultyLevel.INTERMEDIATE;
      case 'graduate':
      case 'professional':
        return DifficultyLevel.ADVANCED;
      default:
        return DifficultyLevel.BEGINNER;
    }
  }

  private async generateLearningObjectives(
    subject: string, 
    level: DifficultyLevel, 
    goals: LearningGoal[]
  ): Promise<LearningObjective[]> {
    // This is a fallback implementation - in production, this would call the AI service
    const baseObjectives: Record<string, LearningObjective[]> = {
      mathematics: [
        {
          id: 'math-1',
          title: 'Number Systems and Operations',
          description: 'Master basic arithmetic operations and number properties',
          estimatedDuration: 120,
          prerequisites: [],
          skills: ['addition', 'subtraction', 'multiplication', 'division']
        },
        {
          id: 'math-2',
          title: 'Algebraic Thinking',
          description: 'Introduction to variables and simple equations',
          estimatedDuration: 180,
          prerequisites: ['math-1'],
          skills: ['variables', 'equations', 'problem-solving']
        }
      ],
      science: [
        {
          id: 'sci-1',
          title: 'Scientific Method',
          description: 'Understanding how science works through observation and experimentation',
          estimatedDuration: 90,
          prerequisites: [],
          skills: ['observation', 'hypothesis', 'experimentation']
        }
      ],
      programming: [
        {
          id: 'prog-1',
          title: 'Programming Fundamentals',
          description: 'Basic concepts of programming including variables and control structures',
          estimatedDuration: 240,
          prerequisites: [],
          skills: ['variables', 'loops', 'conditionals', 'functions']
        }
      ]
    };

    return baseObjectives[subject.toLowerCase()] || [];
  }

  private generateMilestones(objectives: LearningObjective[]): Milestone[] {
    const milestones: Milestone[] = [];
    
    // Group objectives into milestones (every 2-3 objectives)
    for (let i = 0; i < objectives.length; i += 2) {
      const objectiveGroup = objectives.slice(i, i + 2);
      const milestone: Milestone = {
        id: `milestone-${Math.floor(i / 2) + 1}`,
        title: `Milestone ${Math.floor(i / 2) + 1}`,
        description: `Complete objectives: ${objectiveGroup.map(obj => obj.title).join(', ')}`,
        objectives: objectiveGroup.map(obj => obj.id),
        completionCriteria: [
          'Complete all assigned objectives',
          'Pass milestone assessment with 80% or higher',
          'Demonstrate practical application of learned concepts'
        ],
        isCompleted: false
      };
      milestones.push(milestone);
    }

    return milestones;
  }

  private calculateProgress(currentPath: LearningPath, performanceData: PerformanceData): any {
    const currentProgress = currentPath.progress;
    
    // Update completed objectives based on mastered concepts
    const newCompletedObjectives = [
      ...currentProgress.completedObjectives,
      ...performanceData.masteredConcepts.filter(
        concept => !currentProgress.completedObjectives.includes(concept)
      )
    ];

    // Calculate overall progress percentage
    const totalObjectives = currentPath.objectives.length;
    const overallProgress = totalObjectives > 0 
      ? Math.round((newCompletedObjectives.length / totalObjectives) * 100)
      : 0;

    // Update current milestone if needed
    let currentMilestone = currentProgress.currentMilestone;
    for (const milestone of currentPath.milestones) {
      const milestoneObjectivesCompleted = milestone.objectives.every(
        objId => newCompletedObjectives.includes(objId)
      );
      
      if (milestoneObjectivesCompleted && !milestone.isCompleted) {
        currentMilestone = milestone.id;
        break;
      }
    }

    return {
      completedObjectives: newCompletedObjectives,
      currentMilestone,
      overallProgress,
      estimatedCompletion: currentProgress.estimatedCompletion // Keep existing estimate for now
    };
  }

  private shouldAdjustDifficulty(performanceData: PerformanceData): DifficultyLevel | null {
    const { comprehensionScore } = performanceData;
    
    // Increase difficulty if consistently scoring above 90%
    if (comprehensionScore > 90) {
      return DifficultyLevel.ADVANCED;
    }
    
    // Decrease difficulty if consistently scoring below 60%
    if (comprehensionScore < 60) {
      return DifficultyLevel.BEGINNER;
    }
    
    // Maintain intermediate level for scores between 60-90%
    if (comprehensionScore >= 60 && comprehensionScore <= 90) {
      return DifficultyLevel.INTERMEDIATE;
    }
    
    return null; // No adjustment needed
  }

  private async callAIServiceForPathGeneration(userProfile: any, pathData: CreateLearningPathRequest): Promise<any> {
    // This would make an HTTP call to the AI service
    // For now, we'll simulate this with a placeholder
    
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/learning-paths/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userProfile,
          subject: pathData.subject,
          goals: pathData.goals,
          currentLevel: pathData.currentLevel
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      logger.warn('Failed to call AI service for path generation', { error });
      throw error;
    }
  }
}