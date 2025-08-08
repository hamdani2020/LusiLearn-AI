import { Pool } from 'pg';
import { ProgressTrackingService } from '../progress-tracking.service';
import { ProgressTrackingRepository } from '../../repositories/progress-tracking.repository';
import { LearningPathRepository } from '../../repositories/learning-path.repository';
import { 
  LearningSession, 
  LearningPath, 
  ProgressUpdate,
  Achievement,
  LearningAnalytics,
  ProgressVisualizationData,
  DifficultyLevel
} from '@lusilearn/shared-types';

// Mock the repositories
jest.mock('../../repositories/progress-tracking.repository');
jest.mock('../../repositories/learning-path.repository');
jest.mock('../../utils/logger');

const MockedProgressTrackingRepository = ProgressTrackingRepository as jest.MockedClass<typeof ProgressTrackingRepository>;
const MockedLearningPathRepository = LearningPathRepository as jest.MockedClass<typeof LearningPathRepository>;

describe('ProgressTrackingService', () => {
  let service: ProgressTrackingService;
  let mockPool: jest.Mocked<Pool>;
  let mockProgressRepo: jest.Mocked<ProgressTrackingRepository>;
  let mockLearningPathRepo: jest.Mocked<LearningPathRepository>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    mockProgressRepo = new MockedProgressTrackingRepository(mockPool) as jest.Mocked<ProgressTrackingRepository>;
    mockLearningPathRepo = new MockedLearningPathRepository(mockPool) as jest.Mocked<LearningPathRepository>;

    service = new ProgressTrackingService(mockPool);
    
    // Replace the repositories with mocked versions
    (service as any).progressRepository = mockProgressRepo;
    (service as any).learningPathRepository = mockLearningPathRepo;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateProgress', () => {
    it('should create progress update and update related data', async () => {
      // Arrange
      const mockSessionData: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        pathId: 'path-123',
        contentItems: ['content-1'],
        duration: 1800, // 30 minutes
        interactions: [
          {
            type: 'click',
            timestamp: new Date(),
            duration: 5
          }
        ],
        assessmentResults: [
          {
            questionId: 'math-1',
            answer: 'correct',
            isCorrect: true,
            timeSpent: 30,
            attempts: 1
          }
        ],
        comprehensionScore: 85,
        engagementMetrics: {
          attentionScore: 90,
          interactionCount: 15,
          pauseCount: 2,
          replayCount: 1,
          completionRate: 100
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockProgressUpdate: ProgressUpdate = {
        sessionId: 'session-123',
        userId: 'user-123',
        pathId: 'path-123',
        timestamp: new Date(),
        progressData: {
          objectivesCompleted: ['math-1'],
          milestonesReached: [],
          skillsImproved: ['math'],
          timeSpent: 1800,
          comprehensionScore: 85,
          engagementLevel: 90
        }
      };

      const mockLearningPath: LearningPath = {
        id: 'path-123',
        userId: 'user-123',
        subject: 'mathematics',
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'math-1',
            title: 'Basic Arithmetic',
            description: 'Learn basic arithmetic operations',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['addition', 'subtraction']
          }
        ],
        milestones: [
          {
            id: 'milestone-1',
            title: 'First Milestone',
            description: 'Complete basic objectives',
            objectives: ['math-1'],
            completionCriteria: ['Complete all objectives'],
            isCompleted: false
          }
        ],
        progress: {
          completedObjectives: [],
          currentMilestone: 'milestone-1',
          overallProgress: 0,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockProgressRepo.createProgressUpdate.mockResolvedValue(mockProgressUpdate);
      mockLearningPathRepo.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepo.getUserStreaks.mockResolvedValue([]);
      mockProgressRepo.updateLearningStreak.mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
        streakType: 'daily'
      });
      mockProgressRepo.getUserSkillProgress.mockResolvedValue([]);
      mockProgressRepo.updateSkillProgress.mockResolvedValue({
        skillId: 'math',
        skillName: 'Mathematics',
        currentLevel: 85,
        previousLevel: 0,
        improvementRate: 100,
        lastAssessed: new Date(),
        masteryThreshold: 80,
        isMastered: true
      });
      mockProgressRepo.getUserAchievements.mockResolvedValue([]);

      // Act
      const result = await service.updateProgress(mockSessionData);

      // Assert
      expect(result).toEqual(mockProgressUpdate);
      expect(mockProgressRepo.createProgressUpdate).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userId: 'user-123',
        pathId: 'path-123',
        progressData: expect.objectContaining({
          timeSpent: 1800,
          comprehensionScore: 85,
          engagementLevel: 90
        })
      });
      expect(mockProgressRepo.updateLearningStreak).toHaveBeenCalled();
      expect(mockProgressRepo.updateSkillProgress).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const mockSessionData: LearningSession = {
        id: 'session-123',
        userId: 'user-123',
        pathId: 'path-123',
        contentItems: [],
        duration: 0,
        interactions: [],
        assessmentResults: [],
        comprehensionScore: 0,
        engagementMetrics: {
          attentionScore: 0,
          interactionCount: 0,
          pauseCount: 0,
          replayCount: 0,
          completionRate: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockProgressRepo.createProgressUpdate.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.updateProgress(mockSessionData)).rejects.toThrow('Database error');
    });
  });

  describe('calculateAnalytics', () => {
    it('should calculate comprehensive analytics for user', async () => {
      // Arrange
      const userId = 'user-123';
      const timeframe = 'weekly';

      const mockBasicMetrics = {
        totalTimeSpent: 300, // 5 hours in minutes
        sessionsCompleted: 10,
        averageSessionDuration: 30,
        avgComprehension: 85,
        avgEngagement: 80,
        progressUpdatesCount: 15,
        achievementsEarned: 3
      };

      const mockTimeSeriesData = [
        { date: '2024-01-01', comprehensionScore: 80, timeSpent: 60, engagementLevel: 75 },
        { date: '2024-01-02', comprehensionScore: 85, timeSpent: 45, engagementLevel: 80 },
        { date: '2024-01-03', comprehensionScore: 90, timeSpent: 30, engagementLevel: 85 }
      ];

      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        }
      ];

      const mockStreaks = [
        {
          currentStreak: 5,
          longestStreak: 10,
          lastActivityDate: new Date(),
          streakType: 'daily' as const
        }
      ];

      const mockSkillProgress = [
        {
          skillId: 'math',
          skillName: 'Mathematics',
          currentLevel: 85,
          previousLevel: 70,
          improvementRate: 21.4,
          lastAssessed: new Date(),
          masteryThreshold: 80,
          isMastered: true
        }
      ];

      mockProgressRepo.getAnalyticsData.mockResolvedValue(mockBasicMetrics);
      mockProgressRepo.getTimeSeriesData.mockResolvedValue(mockTimeSeriesData);
      mockProgressRepo.getUserAchievements.mockResolvedValue(mockAchievements);
      mockProgressRepo.getUserStreaks.mockResolvedValue(mockStreaks);
      mockProgressRepo.getUserSkillProgress.mockResolvedValue(mockSkillProgress);

      // Act
      const result = await service.calculateAnalytics(userId, timeframe);

      // Assert
      expect(result).toMatchObject({
        userId,
        timeframe,
        metrics: expect.objectContaining({
          totalTimeSpent: 300,
          sessionsCompleted: 10,
          averageSessionDuration: 30,
          comprehensionTrend: [80, 85, 90],
          engagementTrend: [75, 80, 85],
          objectivesCompleted: 1, // One mastered skill
          milestonesReached: 1, // One milestone achievement
          skillsImproved: 1, // One skill with positive improvement
          achievementsEarned: 1,
          collaborationHours: 0
        }),
        insights: expect.objectContaining({
          strongestSubjects: ['Mathematics'],
          improvementAreas: [],
          recommendedSessionDuration: 30,
          retentionRate: 85
        }),
        predictions: expect.objectContaining({
          goalCompletionProbability: expect.any(Number),
          suggestedFocusAreas: expect.any(Array),
          riskFactors: expect.any(Array)
        })
      });
    });
  });

  describe('trackMilestone', () => {
    it('should award achievement when milestone is completed', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const milestoneId = 'milestone-1';

      const mockLearningPath: LearningPath = {
        id: pathId,
        userId,
        subject: 'mathematics',
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'obj-1',
            title: 'Objective 1',
            description: 'First objective',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['math']
          }
        ],
        milestones: [
          {
            id: milestoneId,
            title: 'First Milestone',
            description: 'Complete first objective',
            objectives: ['obj-1'],
            completionCriteria: ['Complete objective'],
            isCompleted: false
          }
        ],
        progress: {
          completedObjectives: ['obj-1'], // Objective is completed
          currentMilestone: milestoneId,
          overallProgress: 100,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAchievement: Achievement = {
        id: 'achievement-1',
        type: 'milestone',
        title: 'Milestone Completed: First Milestone',
        description: 'Successfully completed milestone "First Milestone" in mathematics',
        criteria: {
          milestoneId,
          pathId,
          subject: 'mathematics'
        },
        earnedAt: new Date(),
        points: 125
      };

      mockLearningPathRepo.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepo.createAchievement.mockResolvedValue(mockAchievement);

      // Act
      const result = await service.trackMilestone(userId, pathId, milestoneId);

      // Assert
      expect(result).toEqual(mockAchievement);
      expect(mockProgressRepo.createAchievement).toHaveBeenCalledWith({
        userId,
        type: 'milestone',
        title: 'Milestone Completed: First Milestone',
        description: 'Successfully completed milestone "First Milestone" in mathematics',
        criteria: {
          milestoneId,
          pathId,
          subject: 'mathematics'
        },
        points: 125
      });
    });

    it('should return null when milestone is not completed', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const milestoneId = 'milestone-1';

      const mockLearningPath: LearningPath = {
        id: pathId,
        userId,
        subject: 'mathematics',
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'obj-1',
            title: 'Objective 1',
            description: 'First objective',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['math']
          }
        ],
        milestones: [
          {
            id: milestoneId,
            title: 'First Milestone',
            description: 'Complete first objective',
            objectives: ['obj-1'],
            completionCriteria: ['Complete objective'],
            isCompleted: false
          }
        ],
        progress: {
          completedObjectives: [], // Objective is NOT completed
          currentMilestone: milestoneId,
          overallProgress: 0,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockLearningPathRepo.findById.mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.trackMilestone(userId, pathId, milestoneId);

      // Assert
      expect(result).toBeNull();
      expect(mockProgressRepo.createAchievement).not.toHaveBeenCalled();
    });
  });

  describe('getProgressVisualizationData', () => {
    it('should return comprehensive visualization data', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';

      const mockLearningPath: LearningPath = {
        id: pathId,
        userId,
        subject: 'mathematics',
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'obj-1',
            title: 'Objective 1',
            description: 'First objective',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['math']
          },
          {
            id: 'obj-2',
            title: 'Objective 2',
            description: 'Second objective',
            estimatedDuration: 90,
            prerequisites: ['obj-1'],
            skills: ['algebra']
          }
        ],
        milestones: [
          {
            id: 'milestone-1',
            title: 'First Milestone',
            description: 'Complete first two objectives',
            objectives: ['obj-1', 'obj-2'],
            completionCriteria: ['Complete all objectives'],
            isCompleted: false
          }
        ],
        progress: {
          completedObjectives: ['obj-1'],
          currentMilestone: 'milestone-1',
          overallProgress: 50,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockAchievements: Achievement[] = [];
      const mockStreaks = [];
      const mockSkillProgress = [];
      const mockTimeSeriesData = [];

      mockLearningPathRepo.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepo.getUserAchievements.mockResolvedValue(mockAchievements);
      mockProgressRepo.getUserStreaks.mockResolvedValue(mockStreaks);
      mockProgressRepo.getUserSkillProgress.mockResolvedValue(mockSkillProgress);
      mockProgressRepo.getTimeSeriesData.mockResolvedValue(mockTimeSeriesData);

      // Act
      const result = await service.getProgressVisualizationData(userId, pathId);

      // Assert
      expect(result).toMatchObject({
        userId,
        pathId,
        overallProgress: {
          percentage: 50,
          completedObjectives: 1,
          totalObjectives: 2,
          estimatedCompletion: expect.any(Date)
        },
        milestoneProgress: [
          {
            milestoneId: 'milestone-1',
            title: 'First Milestone',
            progress: 50, // 1 out of 2 objectives completed
            isCompleted: false,
            objectives: [
              {
                id: 'obj-1',
                title: 'Objective 1',
                isCompleted: true
              },
              {
                id: 'obj-2',
                title: 'Objective 2',
                isCompleted: false
              }
            ]
          }
        ],
        skillProgression: mockSkillProgress,
        timeSeriesData: mockTimeSeriesData,
        achievements: mockAchievements,
        streaks: mockStreaks
      });
    });
  });

  describe('getUserAchievements', () => {
    it('should return all achievements when no type filter is provided', async () => {
      // Arrange
      const userId = 'user-123';
      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'Milestone Achievement',
          description: 'Completed a milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        },
        {
          id: 'achievement-2',
          type: 'streak',
          title: 'Streak Achievement',
          description: 'Maintained a streak',
          criteria: {},
          earnedAt: new Date(),
          points: 50
        }
      ];

      mockProgressRepo.getUserAchievements.mockResolvedValue(mockAchievements);

      // Act
      const result = await service.getUserAchievements(userId);

      // Assert
      expect(result).toEqual(mockAchievements);
      expect(mockProgressRepo.getUserAchievements).toHaveBeenCalledWith(userId);
    });

    it('should filter achievements by type when type is provided', async () => {
      // Arrange
      const userId = 'user-123';
      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'Milestone Achievement',
          description: 'Completed a milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        },
        {
          id: 'achievement-2',
          type: 'streak',
          title: 'Streak Achievement',
          description: 'Maintained a streak',
          criteria: {},
          earnedAt: new Date(),
          points: 50
        }
      ];

      mockProgressRepo.getUserAchievements.mockResolvedValue(mockAchievements);

      // Act
      const result = await service.getUserAchievements(userId, 'milestone');

      // Assert
      expect(result).toEqual([mockAchievements[0]]);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('milestone');
    });
  });
});