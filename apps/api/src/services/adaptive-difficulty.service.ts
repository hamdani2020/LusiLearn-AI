import { Pool } from 'pg';
import { 
  LearningPath, 
  LearningSession,
  DifficultyLevel,
  PerformanceData,
  LearningObjective,
  PathAdaptation,
  SkillProgress
} from '@lusilearn/shared-types';
import { LearningPathRepository } from '../repositories/learning-path.repository';
import { ProgressTrackingRepository } from '../repositories/progress-tracking.repository';
import { logger } from '../utils/logger';

export interface DifficultyAdjustmentResult {
  newDifficulty: DifficultyLevel;
  reason: string;
  confidence: number; // 0-100
  recommendedActions: string[];
}

export interface ContentSequenceResult {
  nextObjectives: LearningObjective[];
  prerequisitesMet: boolean;
  blockedObjectives: string[];
  recommendedReview: string[];
}

export interface CompetencyTestResult {
  passed: boolean;
  score: number;
  skillsAssessed: string[];
  weakAreas: string[];
  readyForAdvancement: boolean;
}

export interface OptimalChallengeAnalysis {
  currentChallengeLevel: number; // 0-100
  isOptimal: boolean; // true if between 70-85%
  adjustment: 'increase' | 'decrease' | 'maintain';
  targetComprehension: number;
}

export class AdaptiveDifficultyService {
  private learningPathRepository: LearningPathRepository;
  private progressRepository: ProgressTrackingRepository;

  // Optimal comprehension range for effective learning
  private static readonly OPTIMAL_COMPREHENSION_MIN = 70;
  private static readonly OPTIMAL_COMPREHENSION_MAX = 85;
  private static readonly MASTERY_THRESHOLD = 90;
  private static readonly STRUGGLE_THRESHOLD = 60;

  constructor(pool: Pool) {
    this.learningPathRepository = new LearningPathRepository(pool);
    this.progressRepository = new ProgressTrackingRepository(pool);
  }

  /**
   * Analyze performance and determine if difficulty adjustment is needed
   */
  async analyzePerformanceForDifficultyAdjustment(
    userId: string, 
    pathId: string, 
    recentSessions: LearningSession[]
  ): Promise<DifficultyAdjustmentResult | null> {
    try {
      const learningPath = await this.learningPathRepository.findById(pathId);
      if (!learningPath) {
        throw new Error('Learning path not found');
      }

      // Get recent performance data (last 5 sessions)
      const performanceData = this.extractPerformanceMetrics(recentSessions);
      
      // Analyze performance trends
      const performanceTrend = this.analyzePerformanceTrend(performanceData);
      
      // Determine if adjustment is needed
      const adjustmentResult = this.calculateDifficultyAdjustment(
        learningPath.currentLevel,
        performanceTrend
      );

      if (adjustmentResult) {
        logger.info(`Difficulty adjustment recommended for user ${userId}`, {
          pathId,
          currentLevel: learningPath.currentLevel,
          newLevel: adjustmentResult.newDifficulty,
          reason: adjustmentResult.reason
        });
      }

      return adjustmentResult;
    } catch (error) {
      logger.error('Error analyzing performance for difficulty adjustment:', error);
      throw error;
    }
  }

  /**
   * Sequence content based on prerequisite mastery
   */
  async sequenceContentByPrerequisites(
    userId: string,
    pathId: string
  ): Promise<ContentSequenceResult> {
    try {
      const learningPath = await this.learningPathRepository.findById(pathId);
      if (!learningPath) {
        throw new Error('Learning path not found');
      }

      const skillProgress = await this.progressRepository.getUserSkillProgress(userId);
      const masteredSkills = skillProgress
        .filter(skill => skill.isMastered)
        .map(skill => skill.skillId);

      // Analyze prerequisites for each objective
      const availableObjectives: LearningObjective[] = [];
      const blockedObjectives: string[] = [];
      const recommendedReview: string[] = [];

      for (const objective of learningPath.objectives) {
        const prerequisiteAnalysis = this.analyzePrerequisites(
          objective,
          masteredSkills,
          learningPath.progress.completedObjectives
        );

        if (prerequisiteAnalysis.allMet) {
          availableObjectives.push(objective);
        } else {
          blockedObjectives.push(objective.id);
          recommendedReview.push(...prerequisiteAnalysis.missingPrerequisites);
        }
      }

      // Sort available objectives by difficulty and estimated duration
      const sequencedObjectives = this.sortObjectivesByOptimalSequence(
        availableObjectives,
        learningPath.currentLevel
      );

      return {
        nextObjectives: sequencedObjectives.slice(0, 3), // Return next 3 objectives
        prerequisitesMet: blockedObjectives.length === 0,
        blockedObjectives,
        recommendedReview: [...new Set(recommendedReview)] // Remove duplicates
      };
    } catch (error) {
      logger.error('Error sequencing content by prerequisites:', error);
      throw error;
    }
  }

  /**
   * Conduct competency test for advancement
   */
  async conductCompetencyTest(
    userId: string,
    pathId: string,
    requestedLevel: DifficultyLevel
  ): Promise<CompetencyTestResult> {
    try {
      const learningPath = await this.learningPathRepository.findById(pathId);
      if (!learningPath) {
        throw new Error('Learning path not found');
      }

      const skillProgress = await this.progressRepository.getUserSkillProgress(userId);
      const recentSessions = await this.getRecentLearningSessionsForPath(userId, pathId, 10);

      // Generate competency test based on current level and requested level
      const testResult = await this.generateAndEvaluateCompetencyTest(
        learningPath,
        skillProgress,
        recentSessions,
        requestedLevel
      );

      logger.info(`Competency test completed for user ${userId}`, {
        pathId,
        requestedLevel,
        passed: testResult.passed,
        score: testResult.score
      });

      return testResult;
    } catch (error) {
      logger.error('Error conducting competency test:', error);
      throw error;
    }
  }

  /**
   * Maintain optimal challenge level (70-85% comprehension)
   */
  async maintainOptimalChallengeLevel(
    userId: string,
    pathId: string
  ): Promise<OptimalChallengeAnalysis> {
    try {
      const recentSessions = await this.getRecentLearningSessionsForPath(userId, pathId, 5);
      
      if (recentSessions.length === 0) {
        return {
          currentChallengeLevel: 0,
          isOptimal: false,
          adjustment: 'maintain',
          targetComprehension: AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MIN
        };
      }

      // Calculate average comprehension score
      const avgComprehension = recentSessions.reduce(
        (sum, session) => sum + session.comprehensionScore, 0
      ) / recentSessions.length;

      // Analyze if current challenge level is optimal
      const analysis = this.analyzeOptimalChallenge(avgComprehension);

      // If not optimal, suggest adjustments
      if (!analysis.isOptimal) {
        await this.implementChallengeAdjustment(userId, pathId, analysis);
      }

      return analysis;
    } catch (error) {
      logger.error('Error maintaining optimal challenge level:', error);
      throw error;
    }
  }

  /**
   * Apply difficulty adjustment to learning path
   */
  async applyDifficultyAdjustment(
    pathId: string,
    adjustmentResult: DifficultyAdjustmentResult
  ): Promise<LearningPath | null> {
    try {
      const adaptation: PathAdaptation = {
        timestamp: new Date(),
        reason: adjustmentResult.reason,
        changes: {
          difficultyAdjustment: adjustmentResult.newDifficulty
        }
      };

      // Update the learning path with new difficulty
      const updatedPath = await this.learningPathRepository.update(pathId, {
        currentLevel: adjustmentResult.newDifficulty
      });

      if (updatedPath) {
        // Add adaptation record
        await this.learningPathRepository.addAdaptation(pathId, adaptation);
        
        logger.info(`Applied difficulty adjustment to path ${pathId}`, {
          newDifficulty: adjustmentResult.newDifficulty,
          confidence: adjustmentResult.confidence
        });
      }

      return updatedPath;
    } catch (error) {
      logger.error('Error applying difficulty adjustment:', error);
      throw error;
    }
  }

  // Private helper methods

  private extractPerformanceMetrics(sessions: LearningSession[]): PerformanceData[] {
    return sessions.map(session => ({
      sessionId: session.id,
      comprehensionScore: session.comprehensionScore,
      timeSpent: session.duration,
      strugglingConcepts: this.extractStrugglingConcepts(session),
      masteredConcepts: this.extractMasteredConcepts(session)
    }));
  }

  private extractStrugglingConcepts(session: LearningSession): string[] {
    return session.assessmentResults
      .filter(result => !result.isCorrect || result.attempts > 2)
      .map(result => result.questionId.split('-')[0])
      .filter((concept, index, array) => array.indexOf(concept) === index);
  }

  private extractMasteredConcepts(session: LearningSession): string[] {
    return session.assessmentResults
      .filter(result => result.isCorrect && result.attempts <= 2)
      .map(result => result.questionId.split('-')[0])
      .filter((concept, index, array) => array.indexOf(concept) === index);
  }

  private analyzePerformanceTrend(performanceData: PerformanceData[]): {
    avgComprehension: number;
    trend: 'improving' | 'declining' | 'stable';
    consistency: number;
    strugglingAreas: string[];
  } {
    if (performanceData.length === 0) {
      return {
        avgComprehension: 0,
        trend: 'stable',
        consistency: 0,
        strugglingAreas: []
      };
    }

    const comprehensionScores = performanceData.map(data => data.comprehensionScore);
    const avgComprehension = comprehensionScores.reduce((sum, score) => sum + score, 0) / comprehensionScores.length;

    // Calculate trend (simple linear regression slope)
    const trend = this.calculateTrend(comprehensionScores);
    
    // Calculate consistency (inverse of standard deviation)
    const consistency = this.calculateConsistency(comprehensionScores);

    // Identify struggling areas
    const strugglingAreas = this.identifyStrugglingAreas(performanceData);

    return {
      avgComprehension,
      trend,
      consistency,
      strugglingAreas
    };
  }

  private calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 2) return 'stable';

    const n = scores.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const sumY = scores.reduce((sum, score) => sum + score, 0);
    const sumXY = scores.reduce((sum, score, index) => sum + (index * score), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 2) return 'improving';
    if (slope < -2) return 'declining';
    return 'stable';
  }

  private calculateConsistency(scores: number[]): number {
    if (scores.length < 2) return 100;

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert to consistency score (0-100, higher is more consistent)
    return Math.max(0, 100 - (standardDeviation * 2));
  }

  private identifyStrugglingAreas(performanceData: PerformanceData[]): string[] {
    const conceptCounts: Record<string, { total: number; struggling: number }> = {};

    performanceData.forEach(data => {
      data.strugglingConcepts.forEach(concept => {
        if (!conceptCounts[concept]) {
          conceptCounts[concept] = { total: 0, struggling: 0 };
        }
        conceptCounts[concept].struggling++;
        conceptCounts[concept].total++;
      });

      data.masteredConcepts.forEach(concept => {
        if (!conceptCounts[concept]) {
          conceptCounts[concept] = { total: 0, struggling: 0 };
        }
        conceptCounts[concept].total++;
      });
    });

    // Return concepts where struggling rate > 60%
    return Object.entries(conceptCounts)
      .filter(([_, counts]) => counts.struggling / counts.total > 0.6)
      .map(([concept, _]) => concept);
  }

  private calculateDifficultyAdjustment(
    currentLevel: DifficultyLevel,
    performanceTrend: any
  ): DifficultyAdjustmentResult | null {
    const { avgComprehension, trend, consistency, strugglingAreas } = performanceTrend;

    // Don't adjust if we don't have enough data
    if (consistency < 50) {
      return null;
    }

    // Increase difficulty if consistently scoring above mastery threshold
    if (avgComprehension >= AdaptiveDifficultyService.MASTERY_THRESHOLD && trend !== 'declining') {
      const newLevel = this.getNextDifficultyLevel(currentLevel, 'increase');
      if (newLevel !== currentLevel) {
        return {
          newDifficulty: newLevel,
          reason: `Consistent high performance (${avgComprehension.toFixed(1)}%) indicates readiness for increased difficulty`,
          confidence: Math.min(95, 60 + consistency * 0.35),
          recommendedActions: [
            'Introduce more complex concepts',
            'Reduce scaffolding and hints',
            'Add advanced problem-solving challenges'
          ]
        };
      }
    }

    // Decrease difficulty if consistently scoring below struggle threshold
    if (avgComprehension <= AdaptiveDifficultyService.STRUGGLE_THRESHOLD && trend !== 'improving') {
      const newLevel = this.getNextDifficultyLevel(currentLevel, 'decrease');
      if (newLevel !== currentLevel) {
        return {
          newDifficulty: newLevel,
          reason: `Consistent low performance (${avgComprehension.toFixed(1)}%) indicates need for foundational support`,
          confidence: Math.min(95, 60 + consistency * 0.35),
          recommendedActions: [
            'Review prerequisite concepts',
            'Provide additional scaffolding',
            'Focus on struggling areas: ' + strugglingAreas.join(', ')
          ]
        };
      }
    }

    return null; // No adjustment needed
  }

  private getNextDifficultyLevel(currentLevel: DifficultyLevel, direction: 'increase' | 'decrease'): DifficultyLevel {
    const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.ADVANCED];
    const currentIndex = levels.indexOf(currentLevel);

    if (direction === 'increase' && currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }

    if (direction === 'decrease' && currentIndex > 0) {
      return levels[currentIndex - 1];
    }

    return currentLevel;
  }

  private analyzePrerequisites(
    objective: LearningObjective,
    masteredSkills: string[],
    completedObjectives: string[]
  ): { allMet: boolean; missingPrerequisites: string[] } {
    const missingPrerequisites: string[] = [];

    // Check objective prerequisites (these are strict requirements)
    objective.prerequisites.forEach(prereqId => {
      if (!completedObjectives.includes(prereqId)) {
        missingPrerequisites.push(prereqId);
      }
    });

    // For skills, we're more lenient - objectives with no prerequisites should be available
    // even if skills aren't mastered yet (they can learn the skills through the objective)
    if (objective.prerequisites.length === 0) {
      // If no objective prerequisites, this should be available regardless of skill mastery
      return {
        allMet: true,
        missingPrerequisites: []
      };
    }

    // For objectives with prerequisites, check if skills are mastered
    const requiredSkills = objective.skills.filter(skill => !masteredSkills.includes(skill));
    if (objective.skills.length > 0 && requiredSkills.length === objective.skills.length) {
      // Only add to missing if ALL skills are missing AND there are objective prerequisites
      missingPrerequisites.push(...requiredSkills);
    }

    return {
      allMet: missingPrerequisites.length === 0,
      missingPrerequisites
    };
  }

  private sortObjectivesByOptimalSequence(
    objectives: LearningObjective[],
    currentLevel: DifficultyLevel
  ): LearningObjective[] {
    // Sort by: 1) Prerequisites (fewer first), 2) Estimated duration (shorter first), 3) Skill complexity
    return objectives.sort((a, b) => {
      // Prioritize objectives with fewer prerequisites
      if (a.prerequisites.length !== b.prerequisites.length) {
        return a.prerequisites.length - b.prerequisites.length;
      }

      // Then by estimated duration (shorter tasks first for quick wins)
      if (a.estimatedDuration !== b.estimatedDuration) {
        return a.estimatedDuration - b.estimatedDuration;
      }

      // Finally by skill count (simpler objectives first)
      return a.skills.length - b.skills.length;
    });
  }

  private async generateAndEvaluateCompetencyTest(
    learningPath: LearningPath,
    skillProgress: SkillProgress[],
    recentSessions: LearningSession[],
    requestedLevel: DifficultyLevel
  ): Promise<CompetencyTestResult> {
    // Simulate competency test evaluation
    const skillsToAssess = this.getSkillsForLevel(learningPath.subject, requestedLevel);
    const userSkillLevels = skillProgress.reduce((acc, skill) => {
      acc[skill.skillId] = skill.currentLevel;
      return acc;
    }, {} as Record<string, number>);

    let totalScore = 0;
    let assessedSkills = 0;
    const weakAreas: string[] = [];
    const requiredLevel = this.getRequiredLevelForDifficulty(requestedLevel);

    skillsToAssess.forEach(skill => {
      const skillLevel = userSkillLevels[skill] || 0;
      
      if (skillLevel >= requiredLevel) {
        totalScore += skillLevel;
      } else {
        totalScore += skillLevel * 0.5; // Partial credit
        weakAreas.push(skill);
      }
      assessedSkills++;
    });

    const averageScore = assessedSkills > 0 ? totalScore / assessedSkills : 0;
    
    // More lenient passing criteria: pass if average score meets requirement OR if most skills are mastered
    const skillsMastered = skillsToAssess.filter(skill => (userSkillLevels[skill] || 0) >= requiredLevel).length;
    const masteryRate = skillsToAssess.length > 0 ? skillsMastered / skillsToAssess.length : 0;
    
    const passed = averageScore >= requiredLevel || masteryRate >= 0.75; // Pass if 75% of skills are mastered

    return {
      passed,
      score: Math.round(averageScore),
      skillsAssessed: skillsToAssess,
      weakAreas,
      readyForAdvancement: passed && weakAreas.length <= Math.ceil(skillsToAssess.length * 0.25) // Allow up to 25% weak areas
    };
  }

  private getSkillsForLevel(subject: string, level: DifficultyLevel): string[] {
    const skillsBySubject: Record<string, Record<DifficultyLevel, string[]>> = {
      mathematics: {
        [DifficultyLevel.BEGINNER]: ['addition', 'subtraction', 'multiplication', 'division'],
        [DifficultyLevel.INTERMEDIATE]: ['algebra', 'geometry', 'fractions', 'decimals'],
        [DifficultyLevel.ADVANCED]: ['calculus', 'statistics', 'trigonometry', 'advanced_algebra'],
        [DifficultyLevel.EXPERT]: ['advanced_calculus', 'linear_algebra', 'differential_equations', 'mathematical_proofs']
      },
      programming: {
        [DifficultyLevel.BEGINNER]: ['variables', 'loops', 'conditionals'],
        [DifficultyLevel.INTERMEDIATE]: ['functions', 'objects', 'arrays', 'debugging'],
        [DifficultyLevel.ADVANCED]: ['algorithms', 'data_structures', 'design_patterns', 'optimization'],
        [DifficultyLevel.EXPERT]: ['system_design', 'distributed_systems', 'performance_optimization', 'architecture_patterns']
      },
      science: {
        [DifficultyLevel.BEGINNER]: ['observation', 'hypothesis', 'basic_experiments'],
        [DifficultyLevel.INTERMEDIATE]: ['scientific_method', 'data_analysis', 'lab_techniques'],
        [DifficultyLevel.ADVANCED]: ['research_design', 'statistical_analysis', 'peer_review'],
        [DifficultyLevel.EXPERT]: ['advanced_research', 'publication', 'grant_writing', 'peer_collaboration']
      }
    };

    return skillsBySubject[subject.toLowerCase()]?.[level] || [];
  }

  private getRequiredLevelForDifficulty(difficulty: DifficultyLevel): number {
    switch (difficulty) {
      case DifficultyLevel.BEGINNER: return 60;
      case DifficultyLevel.INTERMEDIATE: return 75;
      case DifficultyLevel.ADVANCED: return 85;
      case DifficultyLevel.EXPERT: return 95;
      default: return 60;
    }
  }

  private analyzeOptimalChallenge(avgComprehension: number): OptimalChallengeAnalysis {
    const isOptimal = avgComprehension >= AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MIN && 
                     avgComprehension <= AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MAX;

    let adjustment: 'increase' | 'decrease' | 'maintain' = 'maintain';
    let targetComprehension = avgComprehension;

    if (avgComprehension > AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MAX) {
      adjustment = 'increase';
      targetComprehension = AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MAX;
    } else if (avgComprehension < AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MIN) {
      adjustment = 'decrease';
      targetComprehension = AdaptiveDifficultyService.OPTIMAL_COMPREHENSION_MIN;
    }

    return {
      currentChallengeLevel: avgComprehension,
      isOptimal,
      adjustment,
      targetComprehension
    };
  }

  private async implementChallengeAdjustment(
    userId: string,
    pathId: string,
    analysis: OptimalChallengeAnalysis
  ): Promise<void> {
    // This would implement specific adjustments like:
    // - Modifying content difficulty
    // - Adjusting hint frequency
    // - Changing assessment complexity
    
    logger.info(`Implementing challenge adjustment for user ${userId}`, {
      pathId,
      adjustment: analysis.adjustment,
      currentLevel: analysis.currentChallengeLevel,
      targetLevel: analysis.targetComprehension
    });

    // For now, we'll log the recommendation
    // In a full implementation, this would modify content parameters
  }

  private async getRecentLearningSessionsForPath(
    userId: string,
    pathId: string,
    limit: number
  ): Promise<LearningSession[]> {
    // This would query the database for recent learning sessions
    // For now, return empty array as placeholder
    return [];
  }
}