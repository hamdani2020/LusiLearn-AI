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
  private aiServiceUrl: string;

  constructor(pool: Pool) {
    this.learningPathRepository = new LearningPathRepository(pool);
    this.userService = new UserService();
    this.adaptiveDifficultyService = new AdaptiveDifficultyService(pool);
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
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

      // Enhanced AI service integration for path generation
      try {
        const enhancedPath = await this.callAIServiceForPathGeneration(userProfile, pathData);
        if (enhancedPath) {
          pathData.objectives = enhancedPath.objectives;
          pathData.milestones = enhancedPath.milestones;
          pathData.currentLevel = enhancedPath.currentLevel;
          
          logger.info(`AI-enhanced learning path generated for user ${userId}`, {
            subject,
            objectiveCount: enhancedPath.objectives.length,
            difficultyLevel: enhancedPath.currentLevel
          });
        }
      } catch (aiError) {
        logger.warn('AI service unavailable, using fallback path generation', { error: aiError });
        // Use fallback path generation
        const fallbackPath = await this.generateFallbackPath(userProfile, pathData);
        if (fallbackPath) {
          pathData.objectives = fallbackPath.objectives;
          pathData.milestones = fallbackPath.milestones;
        }
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
   * Enhanced Adaptive Difficulty System Methods
   */

  /**
   * Analyze performance and adjust difficulty if needed with AI integration
   */
  async adaptDifficulty(userId: string, pathId: string, recentSessions: LearningSession[]): Promise<DifficultyAdjustmentResult | null> {
    try {
      // First, use the adaptive difficulty service for local analysis
      const adjustmentResult = await this.adaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        recentSessions
      );

      // If local analysis suggests adjustment, enhance it with AI insights
      if (adjustmentResult) {
        try {
          const aiEnhancedAdjustment = await this.callAIServiceForDifficultyAdaptation(
            userId,
            pathId,
            adjustmentResult,
            recentSessions
          );
          
          if (aiEnhancedAdjustment) {
            // Apply the AI-enhanced difficulty adjustment
            await this.adaptiveDifficultyService.applyDifficultyAdjustment(pathId, aiEnhancedAdjustment);
            
            logger.info(`Applied AI-enhanced difficulty adjustment for user ${userId}`, {
              pathId,
              newDifficulty: aiEnhancedAdjustment.newDifficulty,
              reason: aiEnhancedAdjustment.reason,
              confidence: aiEnhancedAdjustment.confidence
            });
            
            return aiEnhancedAdjustment;
          }
        } catch (aiError) {
          logger.warn('AI service unavailable for difficulty adaptation, using local analysis', { error: aiError });
          // Fall back to local adjustment
          await this.adaptiveDifficultyService.applyDifficultyAdjustment(pathId, adjustmentResult);
          return adjustmentResult;
        }
      }

      return adjustmentResult;
    } catch (error) {
      logger.error('Error adapting difficulty:', error);
      throw error;
    }
  }

  /**
   * Get next content based on prerequisite mastery with AI sequencing
   */
  async getNextContent(userId: string, pathId: string): Promise<ContentSequenceResult> {
    try {
      // Get local sequencing first
      const localSequencing = await this.adaptiveDifficultyService.sequenceContentByPrerequisites(userId, pathId);
      
      // Enhance with AI sequencing if available
      try {
        const aiSequencing = await this.callAIServiceForContentSequencing(userId, pathId, localSequencing);
        if (aiSequencing) {
          logger.info(`AI-enhanced content sequencing applied for user ${userId}`, {
            pathId,
            originalCount: localSequencing.nextObjectives.length,
            enhancedCount: aiSequencing.nextObjectives.length
          });
          return aiSequencing;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for content sequencing, using local sequencing', { error: aiError });
      }
      
      return localSequencing;
    } catch (error) {
      logger.error('Error getting next content:', error);
      throw error;
    }
  }

  /**
   * Conduct competency test for advancement with AI enhancement
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
   * Maintain optimal challenge level (70-85% comprehension) with AI monitoring
   */
  async maintainOptimalChallenge(userId: string, pathId: string): Promise<OptimalChallengeAnalysis> {
    try {
      const analysis = await this.adaptiveDifficultyService.maintainOptimalChallengeLevel(userId, pathId);
      
      // Enhance with AI insights if available
      try {
        const aiEnhancedAnalysis = await this.callAIServiceForOptimalChallenge(userId, pathId, analysis);
        if (aiEnhancedAnalysis) {
          logger.info(`AI-enhanced optimal challenge analysis for user ${userId}`, {
            pathId,
            currentLevel: aiEnhancedAnalysis.currentChallengeLevel,
            isOptimal: aiEnhancedAnalysis.isOptimal,
            adjustment: aiEnhancedAnalysis.adjustment
          });
          return aiEnhancedAnalysis;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable for optimal challenge analysis, using local analysis', { error: aiError });
      }
      
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
   * Enhanced progress update with adaptive difficulty and AI integration
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
    // Enhanced fallback implementation with more comprehensive objectives
    const subjectKey = subject.toLowerCase().replace(/\s+/g, '');
    
    const baseObjectives: Record<string, LearningObjective[]> = {
      'javascript': [
        {
          id: 'js-1',
          title: 'Variables and Data Types',
          description: 'Learn about different data types, variable declarations (var, let, const), and basic operations',
          estimatedDuration: 120,
          prerequisites: [],
          skills: ['variables', 'data-types', 'operators']
        },
        {
          id: 'js-2',
          title: 'Functions and Scope',
          description: 'Master function declarations, expressions, arrow functions, and understand scope concepts',
          estimatedDuration: 180,
          prerequisites: ['js-1'],
          skills: ['functions', 'scope', 'closures']
        },
        {
          id: 'js-3',
          title: 'Objects and Arrays',
          description: 'Work with complex data structures, object methods, and array manipulation',
          estimatedDuration: 150,
          prerequisites: ['js-1'],
          skills: ['objects', 'arrays', 'methods']
        },
        {
          id: 'js-4',
          title: 'DOM Manipulation',
          description: 'Learn to interact with HTML elements and handle user events',
          estimatedDuration: 200,
          prerequisites: ['js-2', 'js-3'],
          skills: ['dom', 'events', 'html-interaction']
        }
      ],
      'javascriptfundamentals': [
        {
          id: 'jsf-1',
          title: 'JavaScript Basics',
          description: 'Introduction to JavaScript syntax, variables, and basic programming concepts',
          estimatedDuration: 120,
          prerequisites: [],
          skills: ['syntax', 'variables', 'basic-programming']
        },
        {
          id: 'jsf-2',
          title: 'Control Structures',
          description: 'Learn conditional statements, loops, and program flow control',
          estimatedDuration: 150,
          prerequisites: ['jsf-1'],
          skills: ['conditionals', 'loops', 'control-flow']
        },
        {
          id: 'jsf-3',
          title: 'Functions and Methods',
          description: 'Understanding function creation, parameters, return values, and built-in methods',
          estimatedDuration: 180,
          prerequisites: ['jsf-2'],
          skills: ['functions', 'parameters', 'methods']
        }
      ],
      'python': [
        {
          id: 'py-1',
          title: 'Python Syntax and Variables',
          description: 'Learn Python syntax, variable assignment, and basic data types',
          estimatedDuration: 120,
          prerequisites: [],
          skills: ['python-syntax', 'variables', 'data-types']
        },
        {
          id: 'py-2',
          title: 'Control Flow and Functions',
          description: 'Master if statements, loops, and function definitions in Python',
          estimatedDuration: 180,
          prerequisites: ['py-1'],
          skills: ['control-flow', 'functions', 'loops']
        }
      ],
      'mathematics': [
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
      'science': [
        {
          id: 'sci-1',
          title: 'Scientific Method',
          description: 'Understanding how science works through observation and experimentation',
          estimatedDuration: 90,
          prerequisites: [],
          skills: ['observation', 'hypothesis', 'experimentation']
        }
      ]
    };

    // Try to find objectives for the subject
    let objectives = baseObjectives[subjectKey] || [];
    
    // If no specific objectives found, create generic ones based on goals
    if (objectives.length === 0) {
      objectives = goals.map((goal, index) => ({
        id: `obj-${index + 1}`,
        title: `${subject} - ${goal.objective}`,
        description: `Learn and master: ${goal.objective}`,
        estimatedDuration: 120 + (index * 30), // Increasing duration
        prerequisites: index > 0 ? [`obj-${index}`] : [],
        skills: [goal.objective.toLowerCase().replace(/\s+/g, '-')]
      }));
    }

    logger.info(`Generated ${objectives.length} fallback objectives for subject: ${subject}`);
    return objectives;
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

  /**
   * AI Service Integration Methods
   */

  private async callAIServiceForPathGeneration(userProfile: any, pathData: CreateLearningPathRequest): Promise<any> {
    try {
      // Map our education levels to AI service format
      const educationLevelMap: Record<string, string> = {
        'elementary': 'elementary',
        'k-5': 'elementary', 
        'middle_school': 'middle_school',
        '6-8': 'middle_school',
        'high_school': 'high_school',
        '9-12': 'high_school',
        'college': 'college',
        'university': 'college',
        'graduate': 'graduate',
        'professional': 'professional'
      };

      // Map difficulty levels to AI service format
      const difficultyMap: Record<string, string> = {
        'BEGINNER': 'beginner',
        'INTERMEDIATE': 'intermediate', 
        'ADVANCED': 'advanced',
        'EXPERT': 'expert'
      };

      // Map learning styles to AI service format
      const learningStyleMap: Record<string, string> = {
        'visual': 'visual',
        'auditory': 'auditory',
        'kinesthetic': 'kinesthetic',
        'reading': 'reading'
      };

      const requestBody = {
        user_id: pathData.userId,
        subject: pathData.subject,
        education_level: educationLevelMap[userProfile.demographics.educationLevel] || 'college',
        current_level: difficultyMap[pathData.currentLevel] || 'beginner',
        learning_goals: pathData.goals.map(goal => goal.objective),
        time_commitment: Math.floor((userProfile.learningPreferences?.sessionDuration || 45) / 60) || 1, // Convert minutes to hours
        learning_style: learningStyleMap[userProfile.learningPreferences?.learningStyle?.[0]] || 'visual',
        prerequisites: []
      };

      logger.info('Calling AI service for path generation', { requestBody });

      const response = await fetch(`${this.aiServiceUrl}/api/v1/learning-paths/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI service responded with status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      logger.info('AI service response received', { 
        pathId: result.path_id,
        objectiveCount: result.objectives?.length || 0 
      });

      // Convert AI service objectives to our format
      const objectives = (result.objectives || []).map((obj: any) => ({
        id: obj.id,
        title: obj.title,
        description: obj.description,
        estimatedDuration: (obj.estimated_hours || 2) * 60, // Convert hours to minutes
        prerequisites: obj.prerequisites || [],
        skills: obj.skills_gained || []
      }));

      return {
        objectives,
        milestones: this.generateMilestones(objectives),
        currentLevel: this.parseDifficultyLevel(result.difficulty_progression) || pathData.currentLevel
      };
    } catch (error) {
      logger.error('Failed to call AI service for path generation', { 
        error: error instanceof Error ? error.message : error,
        aiServiceUrl: this.aiServiceUrl 
      });
      throw error;
    }
  }

  private async callAIServiceForDifficultyAdaptation(
    userId: string,
    pathId: string,
    localAdjustment: DifficultyAdjustmentResult,
    recentSessions: LearningSession[]
  ): Promise<DifficultyAdjustmentResult | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/learning-paths/adapt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_path: { userId, pathId },
          performance_data: {
            recent_sessions: recentSessions,
            local_adjustment: localAdjustment
          },
          user_profile: { userId }
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.adapted_path) {
        return {
          newDifficulty: result.adapted_path.new_difficulty || localAdjustment.newDifficulty,
          reason: result.adapted_path.reason || localAdjustment.reason,
          confidence: result.adapted_path.confidence || localAdjustment.confidence,
          recommendedActions: result.adapted_path.recommended_actions || localAdjustment.recommendedActions
        };
      }

      return localAdjustment;
    } catch (error) {
      logger.warn('Failed to call AI service for difficulty adaptation', { error });
      throw error;
    }
  }

  private async callAIServiceForContentSequencing(
    userId: string,
    pathId: string,
    localSequencing: ContentSequenceResult
  ): Promise<ContentSequenceResult | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/learning-paths/sequence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          objectives: localSequencing.nextObjectives,
          user_completed: [] // This would be populated with actual completed objectives
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.sequenced_objectives) {
        return {
          nextObjectives: result.sequenced_objectives,
          prerequisitesMet: result.sequencing_info?.prerequisites_considered || localSequencing.prerequisitesMet,
          blockedObjectives: localSequencing.blockedObjectives,
          recommendedReview: localSequencing.recommendedReview
        };
      }

      return localSequencing;
    } catch (error) {
      logger.warn('Failed to call AI service for content sequencing', { error });
      throw error;
    }
  }

  private async callAIServiceForOptimalChallenge(
    userId: string,
    pathId: string,
    localAnalysis: OptimalChallengeAnalysis
  ): Promise<OptimalChallengeAnalysis | null> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/learning-paths/adapt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_path: { userId, pathId },
          performance_data: {
            current_challenge_level: localAnalysis.currentChallengeLevel,
            is_optimal: localAnalysis.isOptimal,
            target_comprehension: localAnalysis.targetComprehension
          },
          user_profile: { userId }
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.adapted_path) {
        return {
          currentChallengeLevel: result.adapted_path.challenge_level || localAnalysis.currentChallengeLevel,
          isOptimal: result.adapted_path.is_optimal || localAnalysis.isOptimal,
          adjustment: result.adapted_path.adjustment || localAnalysis.adjustment,
          targetComprehension: result.adapted_path.target_comprehension || localAnalysis.targetComprehension
        };
      }

      return localAnalysis;
    } catch (error) {
      logger.warn('Failed to call AI service for optimal challenge analysis', { error });
      throw error;
    }
  }

  private async generateFallbackPath(userProfile: any, pathData: CreateLearningPathRequest): Promise<any> {
    try {
      const response = await fetch(`${this.aiServiceUrl}/api/v1/learning-paths/fallback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          education_level: userProfile.demographics.educationLevel,
          subject: pathData.subject,
          learning_goals: pathData.goals.map(goal => goal.objective),
          time_commitment: userProfile.learningPreferences.sessionDuration || 45
        }),
        signal: AbortSignal.timeout(8000) // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.fallback_path) {
        return {
          objectives: result.fallback_path.objectives || pathData.objectives,
          milestones: this.generateMilestones(result.fallback_path.objectives || pathData.objectives)
        };
      }

      return null;
    } catch (error) {
      logger.warn('Failed to call AI service for fallback path generation', { error });
      return null;
    }
  }

  private parseDifficultyLevel(difficultyString: string): DifficultyLevel {
    if (difficultyString.toLowerCase().includes('beginner')) {
      return DifficultyLevel.BEGINNER;
    } else if (difficultyString.toLowerCase().includes('intermediate')) {
      return DifficultyLevel.INTERMEDIATE;
    } else if (difficultyString.toLowerCase().includes('advanced')) {
      return DifficultyLevel.ADVANCED;
    } else if (difficultyString.toLowerCase().includes('expert')) {
      return DifficultyLevel.EXPERT;
    }
    return DifficultyLevel.BEGINNER;
  }
}