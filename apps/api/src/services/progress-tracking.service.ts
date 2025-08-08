import { Pool } from 'pg';
import { 
  ProgressUpdate, 
  Achievement, 
  LearningStreak, 
  SkillProgress,
  LearningAnalytics,
  ProgressVisualizationData,
  LearningSession,
  LearningPath
} from '@lusilearn/shared-types';
import { 
  ProgressTrackingRepository, 
  CreateProgressUpdateRequest, 
  CreateAchievementRequest 
} from '../repositories/progress-tracking.repository';
import { LearningPathRepository } from '../repositories/learning-path.repository';
import { logger } from '../utils/logger';

export class ProgressTrackingService {
  private progressRepository: ProgressTrackingRepository;
  private learningPathRepository: LearningPathRepository;

  constructor(pool: Pool) {
    this.progressRepository = new ProgressTrackingRepository(pool);
    this.learningPathRepository = new LearningPathRepository(pool);
  }

  /**
   * Process real-time progress update during learning session
   */
  async updateProgress(sessionData: LearningSession): Promise<ProgressUpdate> {
    try {
      // Create progress update record
      const progressData: CreateProgressUpdateRequest = {
        sessionId: sessionData.id,
        userId: sessionData.userId,
        pathId: sessionData.pathId,
        progressData: {
          objectivesCompleted: this.extractCompletedObjectives(sessionData),
          milestonesReached: await this.checkMilestonesReached(sessionData),
          skillsImproved: this.extractImprovedSkills(sessionData),
          timeSpent: sessionData.duration,
          comprehensionScore: sessionData.comprehensionScore,
          engagementLevel: sessionData.engagementMetrics.attentionScore
        }
      };

      const progressUpdate = await this.progressRepository.createProgressUpdate(progressData);

      // Update learning streaks
      await this.updateLearningStreaks(sessionData.userId);

      // Update skill progress
      await this.updateSkillProgress(sessionData);

      // Check for new achievements
      await this.checkAndAwardAchievements(sessionData.userId, progressUpdate);

      logger.info(`Progress updated for user ${sessionData.userId}`, {
        sessionId: sessionData.id,
        comprehensionScore: sessionData.comprehensionScore,
        timeSpent: sessionData.duration
      });

      return progressUpdate;
    } catch (error) {
      logger.error('Error updating progress:', error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive analytics for user insights
   */
  async calculateAnalytics(userId: string, timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<LearningAnalytics> {
    try {
      // Get basic metrics from database
      const basicMetrics = await this.progressRepository.getAnalyticsData(userId, timeframe);
      
      // Get time series data for trends
      const timeSeriesData = await this.progressRepository.getTimeSeriesData(userId, undefined, this.getTimeframeDays(timeframe));
      
      // Get user achievements and streaks
      const achievements = await this.progressRepository.getUserAchievements(userId);
      const streaks = await this.progressRepository.getUserStreaks(userId);
      const skillProgress = await this.progressRepository.getUserSkillProgress(userId);

      // Calculate trends
      const comprehensionTrend = timeSeriesData.map(d => d.comprehensionScore);
      const engagementTrend = timeSeriesData.map(d => d.engagementLevel);

      // Calculate insights
      const insights = await this.generateInsights(userId, basicMetrics, skillProgress, timeSeriesData);
      
      // Generate predictions
      const predictions = await this.generatePredictions(userId, basicMetrics, timeSeriesData, skillProgress);

      const analytics: LearningAnalytics = {
        userId,
        timeframe,
        metrics: {
          totalTimeSpent: basicMetrics.totalTimeSpent,
          sessionsCompleted: basicMetrics.sessionsCompleted,
          averageSessionDuration: basicMetrics.averageSessionDuration,
          comprehensionTrend,
          engagementTrend,
          objectivesCompleted: this.countCompletedObjectives(skillProgress),
          milestonesReached: achievements.filter(a => a.type === 'milestone').length,
          skillsImproved: skillProgress.filter(s => s.improvementRate > 0).length,
          achievementsEarned: achievements.length,
          collaborationHours: 0, // TODO: Implement collaboration tracking
          consistencyScore: this.calculateConsistencyScore(timeSeriesData, streaks)
        },
        insights,
        predictions
      };

      return analytics;
    } catch (error) {
      logger.error('Error calculating analytics:', error);
      throw error;
    }
  }

  /**
   * Track milestone completion and award achievements
   */
  async trackMilestone(userId: string, pathId: string, milestoneId: string): Promise<Achievement | null> {
    try {
      const learningPath = await this.learningPathRepository.findById(pathId);
      if (!learningPath) {
        throw new Error('Learning path not found');
      }

      const milestone = learningPath.milestones.find(m => m.id === milestoneId);
      if (!milestone) {
        throw new Error('Milestone not found');
      }

      // Check if milestone is actually completed
      const isCompleted = await this.verifyMilestoneCompletion(learningPath, milestone);
      if (!isCompleted) {
        return null;
      }

      // Award milestone achievement
      const achievementData: CreateAchievementRequest = {
        userId,
        type: 'milestone',
        title: `Milestone Completed: ${milestone.title}`,
        description: `Successfully completed milestone "${milestone.title}" in ${learningPath.subject}`,
        criteria: {
          milestoneId,
          pathId,
          subject: learningPath.subject
        },
        points: this.calculateMilestonePoints(milestone)
      };

      const achievement = await this.progressRepository.createAchievement(achievementData);

      logger.info(`Milestone achievement awarded`, {
        userId,
        milestoneId,
        points: achievement.points
      });

      return achievement;
    } catch (error) {
      logger.error('Error tracking milestone:', error);
      throw error;
    }
  }

  /**
   * Prepare data for progress visualization
   */
  async getProgressVisualizationData(userId: string, pathId: string): Promise<ProgressVisualizationData> {
    try {
      const learningPath = await this.learningPathRepository.findById(pathId);
      if (!learningPath) {
        throw new Error('Learning path not found');
      }

      const achievements = await this.progressRepository.getUserAchievements(userId);
      const streaks = await this.progressRepository.getUserStreaks(userId);
      const skillProgress = await this.progressRepository.getUserSkillProgress(userId);
      const timeSeriesData = await this.progressRepository.getTimeSeriesData(userId, pathId, 30);

      // Calculate milestone progress
      const milestoneProgress = learningPath.milestones.map(milestone => ({
        milestoneId: milestone.id,
        title: milestone.title,
        progress: this.calculateMilestoneProgress(learningPath, milestone),
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt,
        objectives: milestone.objectives.map(objId => {
          const objective = learningPath.objectives.find(o => o.id === objId);
          return {
            id: objId,
            title: objective?.title || 'Unknown Objective',
            isCompleted: learningPath.progress.completedObjectives.includes(objId),
            completedAt: undefined // TODO: Track individual objective completion dates
          };
        })
      }));

      const visualizationData: ProgressVisualizationData = {
        userId,
        pathId,
        overallProgress: {
          percentage: learningPath.progress.overallProgress,
          completedObjectives: learningPath.progress.completedObjectives.length,
          totalObjectives: learningPath.objectives.length,
          estimatedCompletion: learningPath.progress.estimatedCompletion
        },
        milestoneProgress,
        skillProgression: skillProgress,
        timeSeriesData,
        achievements: achievements.filter(a => 
          a.criteria.pathId === pathId || a.type === 'streak' || a.type === 'consistency'
        ),
        streaks
      };

      return visualizationData;
    } catch (error) {
      logger.error('Error getting progress visualization data:', error);
      throw error;
    }
  }

  /**
   * Get user achievements with filtering options
   */
  async getUserAchievements(userId: string, type?: Achievement['type']): Promise<Achievement[]> {
    try {
      const achievements = await this.progressRepository.getUserAchievements(userId);
      
      if (type) {
        return achievements.filter(a => a.type === type);
      }
      
      return achievements;
    } catch (error) {
      logger.error('Error getting user achievements:', error);
      throw error;
    }
  }

  // Private helper methods

  private extractCompletedObjectives(sessionData: LearningSession): string[] {
    // Extract completed objectives from assessment results
    const masteredConcepts = sessionData.assessmentResults
      .filter(result => result.isCorrect && result.attempts <= 2)
      .map(result => result.questionId);
    
    return masteredConcepts;
  }

  private async checkMilestonesReached(sessionData: LearningSession): Promise<string[]> {
    try {
      const learningPath = await this.learningPathRepository.findById(sessionData.pathId);
      if (!learningPath) return [];

      const reachedMilestones: string[] = [];
      
      for (const milestone of learningPath.milestones) {
        if (!milestone.isCompleted) {
          const isCompleted = await this.verifyMilestoneCompletion(learningPath, milestone);
          if (isCompleted) {
            reachedMilestones.push(milestone.id);
          }
        }
      }

      return reachedMilestones;
    } catch (error) {
      logger.error('Error checking milestones:', error);
      return [];
    }
  }

  private extractImprovedSkills(sessionData: LearningSession): string[] {
    // Extract skills that showed improvement based on assessment results
    const improvedSkills: string[] = [];
    
    // Group assessment results by skill/topic
    const skillGroups = sessionData.assessmentResults.reduce((groups, result) => {
      const skill = result.questionId.split('-')[0]; // Assume question IDs are formatted as "skill-question"
      if (!groups[skill]) groups[skill] = [];
      groups[skill].push(result);
      return groups;
    }, {} as Record<string, typeof sessionData.assessmentResults>);

    // Check for improvement in each skill
    Object.entries(skillGroups).forEach(([skill, results]) => {
      const correctAnswers = results.filter(r => r.isCorrect).length;
      const accuracy = correctAnswers / results.length;
      
      if (accuracy >= 0.8) { // 80% accuracy threshold for improvement
        improvedSkills.push(skill);
      }
    });

    return improvedSkills;
  }

  private async updateLearningStreaks(userId: string): Promise<void> {
    try {
      const today = new Date();
      const streaks = await this.progressRepository.getUserStreaks(userId);
      
      // Update daily streak
      let dailyStreak = streaks.find(s => s.streakType === 'daily');
      if (!dailyStreak) {
        dailyStreak = {
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: today,
          streakType: 'daily'
        };
      } else {
        const daysSinceLastActivity = Math.floor(
          (today.getTime() - dailyStreak.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastActivity === 1) {
          // Consecutive day
          dailyStreak.currentStreak += 1;
          dailyStreak.longestStreak = Math.max(dailyStreak.longestStreak, dailyStreak.currentStreak);
        } else if (daysSinceLastActivity > 1) {
          // Streak broken
          dailyStreak.currentStreak = 1;
        }
        // Same day activity doesn't change streak

        dailyStreak.lastActivityDate = today;
      }

      await this.progressRepository.updateLearningStreak(userId, dailyStreak);
    } catch (error) {
      logger.error('Error updating learning streaks:', error);
    }
  }

  private async updateSkillProgress(sessionData: LearningSession): Promise<void> {
    try {
      const improvedSkills = this.extractImprovedSkills(sessionData);
      
      for (const skillId of improvedSkills) {
        const existingProgress = await this.progressRepository.getUserSkillProgress(sessionData.userId);
        const currentSkill = existingProgress.find(s => s.skillId === skillId);
        
        const newLevel = this.calculateSkillLevel(sessionData, skillId);
        const previousLevel = currentSkill?.currentLevel || 0;
        const improvementRate = ((newLevel - previousLevel) / previousLevel) * 100;

        const skillProgress: SkillProgress = {
          skillId,
          skillName: this.getSkillName(skillId),
          currentLevel: newLevel,
          previousLevel,
          improvementRate,
          lastAssessed: new Date(),
          masteryThreshold: 80,
          isMastered: newLevel >= 80
        };

        await this.progressRepository.updateSkillProgress(sessionData.userId, skillProgress);
      }
    } catch (error) {
      logger.error('Error updating skill progress:', error);
    }
  }

  private async checkAndAwardAchievements(userId: string, progressUpdate: ProgressUpdate): Promise<void> {
    try {
      const achievements = await this.progressRepository.getUserAchievements(userId);
      const streaks = await this.progressRepository.getUserStreaks(userId);
      
      // Check for streak achievements
      const dailyStreak = streaks.find(s => s.streakType === 'daily');
      if (dailyStreak && dailyStreak.currentStreak > 0) {
        const streakMilestones = [7, 30, 100, 365];
        
        for (const milestone of streakMilestones) {
          if (dailyStreak.currentStreak === milestone) {
            const existingAchievement = achievements.find(a => 
              a.type === 'streak' && a.criteria.streakLength === milestone
            );
            
            if (!existingAchievement) {
              await this.progressRepository.createAchievement({
                userId,
                type: 'streak',
                title: `${milestone} Day Streak!`,
                description: `Maintained a learning streak for ${milestone} consecutive days`,
                criteria: { streakLength: milestone, streakType: 'daily' },
                points: milestone * 10
              });
            }
          }
        }
      }

      // Check for consistency achievements
      if (progressUpdate.progressData.comprehensionScore >= 90) {
        const highPerformanceCount = achievements.filter(a => 
          a.type === 'consistency' && a.criteria.achievementType === 'high_performance'
        ).length;

        if (highPerformanceCount < 10) { // Award up to 10 high performance achievements
          await this.progressRepository.createAchievement({
            userId,
            type: 'consistency',
            title: 'Excellence in Learning',
            description: 'Achieved 90%+ comprehension score in a learning session',
            criteria: { achievementType: 'high_performance', score: progressUpdate.progressData.comprehensionScore },
            points: 50
          });
        }
      }
    } catch (error) {
      logger.error('Error checking and awarding achievements:', error);
    }
  }

  private async verifyMilestoneCompletion(learningPath: LearningPath, milestone: any): Promise<boolean> {
    // Check if all objectives in the milestone are completed
    return milestone.objectives.every((objId: string) => 
      learningPath.progress.completedObjectives.includes(objId)
    );
  }

  private calculateMilestonePoints(milestone: any): number {
    // Base points + bonus for number of objectives
    return 100 + (milestone.objectives.length * 25);
  }

  private calculateMilestoneProgress(learningPath: LearningPath, milestone: any): number {
    const completedObjectives = milestone.objectives.filter((objId: string) =>
      learningPath.progress.completedObjectives.includes(objId)
    ).length;
    
    return Math.round((completedObjectives / milestone.objectives.length) * 100);
  }

  private calculateSkillLevel(sessionData: LearningSession, skillId: string): number {
    // Calculate skill level based on assessment results for this skill
    const skillResults = sessionData.assessmentResults.filter(result =>
      result.questionId.startsWith(skillId)
    );
    
    if (skillResults.length === 0) return 0;
    
    const correctAnswers = skillResults.filter(r => r.isCorrect).length;
    const accuracy = correctAnswers / skillResults.length;
    
    // Convert accuracy to skill level (0-100)
    return Math.round(accuracy * 100);
  }

  private getSkillName(skillId: string): string {
    // Map skill IDs to human-readable names
    const skillNames: Record<string, string> = {
      'math': 'Mathematics',
      'algebra': 'Algebra',
      'geometry': 'Geometry',
      'programming': 'Programming',
      'javascript': 'JavaScript',
      'python': 'Python',
      'science': 'Science',
      'physics': 'Physics',
      'chemistry': 'Chemistry'
    };
    
    return skillNames[skillId] || skillId.charAt(0).toUpperCase() + skillId.slice(1);
  }

  private countCompletedObjectives(skillProgress: SkillProgress[]): number {
    return skillProgress.filter(s => s.isMastered).length;
  }

  private calculateConsistencyScore(timeSeriesData: any[], streaks: LearningStreak[]): number {
    if (timeSeriesData.length === 0) return 0;
    
    // Calculate consistency based on regular activity and streak maintenance
    const activeDays = timeSeriesData.filter(d => d.timeSpent > 0).length;
    const totalDays = timeSeriesData.length;
    const activityRate = activeDays / totalDays;
    
    const dailyStreak = streaks.find(s => s.streakType === 'daily');
    const streakBonus = dailyStreak ? Math.min(dailyStreak.currentStreak / 30, 1) : 0;
    
    return Math.round((activityRate * 70 + streakBonus * 30) * 100) / 100;
  }

  private async generateInsights(userId: string, basicMetrics: any, skillProgress: SkillProgress[], timeSeriesData: any[]): Promise<LearningAnalytics['insights']> {
    // Identify strongest subjects based on skill progress
    const strongestSubjects = skillProgress
      .filter(s => s.currentLevel >= 80)
      .map(s => s.skillName)
      .slice(0, 3);

    // Identify improvement areas
    const improvementAreas = skillProgress
      .filter(s => s.currentLevel < 60)
      .map(s => s.skillName)
      .slice(0, 3);

    // Analyze optimal learning times (simplified)
    const optimalLearningTimes = ['morning', 'afternoon']; // TODO: Implement time analysis

    return {
      strongestSubjects,
      improvementAreas,
      optimalLearningTimes,
      recommendedSessionDuration: Math.max(basicMetrics.averageSessionDuration, 30),
      learningVelocity: skillProgress.filter(s => s.improvementRate > 0).length / 7, // per week
      retentionRate: Math.min(basicMetrics.avgComprehension, 100)
    };
  }

  private async generatePredictions(userId: string, basicMetrics: any, timeSeriesData: any[], skillProgress: SkillProgress[]): Promise<LearningAnalytics['predictions']> {
    // Simple prediction logic - in production, this would use ML models
    const avgProgress = timeSeriesData.reduce((sum, d) => sum + d.comprehensionScore, 0) / timeSeriesData.length;
    
    return {
      nextMilestoneETA: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      goalCompletionProbability: Math.min(avgProgress, 95),
      suggestedFocusAreas: skillProgress
        .filter(s => s.currentLevel < 70)
        .map(s => s.skillName)
        .slice(0, 2),
      riskFactors: basicMetrics.avgEngagement < 60 ? ['Low engagement'] : []
    };
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'monthly': return 30;
      case 'yearly': return 365;
      default: return 30;
    }
  }
}