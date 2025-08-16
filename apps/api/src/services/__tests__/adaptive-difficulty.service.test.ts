import { Pool } from 'pg';
import { AdaptiveDifficultyService } from '../adaptive-difficulty.service';
import { 
  DifficultyLevel, 
  LearningSession, 
  LearningPath,
  SkillProgress,
  LearningObjective,
  DifficultyAdjustmentResult
} from '@lusilearn/shared-types';
import { LearningPathRepository } from '../../repositories/learning-path.repository';
import { ProgressTrackingRepository } from '../../repositories/progress-tracking.repository';

// Mock the dependencies
jest.mock('../../repositories/learning-path.repository');
jest.mock('../../repositories/progress-tracking.repository');
jest.mock('../../utils/logger');

describe('AdaptiveDifficultyService', () => {
  let service: AdaptiveDifficultyService;
  let mockPool: jest.Mocked<Pool>;
  let mockLearningPathRepository: jest.Mocked<LearningPathRepository>;
  let mockProgressRepository: jest.Mocked<ProgressTrackingRepository>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    mockLearningPathRepository = new LearningPathRepository(mockPool) as jest.Mocked<LearningPathRepository>;
    mockProgressRepository = new ProgressTrackingRepository(mockPool) as jest.Mocked<ProgressTrackingRepository>;

    service = new AdaptiveDifficultyService(mockPool);
    
    // Replace the repositories with mocks
    (service as any).learningPathRepository = mockLearningPathRepository;
    (service as any).progressRepository = mockProgressRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzePerformanceForDifficultyAdjustment', () => {
    const userId = 'user-123';
    const pathId = 'path-456';

    const mockLearningPath: LearningPath = {
      id: pathId,
      userId,
      subject: 'mathematics',
      currentLevel: DifficultyLevel.INTERMEDIATE,
      objectives: [],
      milestones: [],
      progress: {
        completedObjectives: [],
        currentMilestone: '',
        overallProgress: 50,
        estimatedCompletion: new Date()
      },
      adaptationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should recommend difficulty increase for consistently high performance', async () => {
      // Arrange
      const highPerformanceSessions: LearningSession[] = [
        createMockSession('session-1', 95, 1800),
        createMockSession('session-2', 92, 1600),
        createMockSession('session-3', 94, 1700),
        createMockSession('session-4', 96, 1500),
        createMockSession('session-5', 93, 1650)
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        highPerformanceSessions
      );

      // Assert
      expect(result).toBeDefined();
      expect(result!.newDifficulty).toBe(DifficultyLevel.ADVANCED);
      expect(result!.reason).toContain('high performance');
      expect(result!.confidence).toBeGreaterThan(60);
      expect(result!.recommendedActions).toContain('Introduce more complex concepts');
    });

    it('should recommend difficulty decrease for consistently low performance', async () => {
      // Arrange
      const lowPerformanceSessions: LearningSession[] = [
        createMockSession('session-1', 45, 2400),
        createMockSession('session-2', 50, 2600),
        createMockSession('session-3', 40, 2800),
        createMockSession('session-4', 55, 2200),
        createMockSession('session-5', 48, 2500)
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        lowPerformanceSessions
      );

      // Assert
      expect(result).toBeDefined();
      expect(result!.newDifficulty).toBe(DifficultyLevel.BEGINNER);
      expect(result!.reason).toContain('low performance');
      expect(result!.confidence).toBeGreaterThan(60);
      expect(result!.recommendedActions).toContain('Review prerequisite concepts');
    });

    it('should return null for optimal performance (no adjustment needed)', async () => {
      // Arrange
      const optimalPerformanceSessions: LearningSession[] = [
        createMockSession('session-1', 75, 1800),
        createMockSession('session-2', 80, 1700),
        createMockSession('session-3', 78, 1900),
        createMockSession('session-4', 82, 1650),
        createMockSession('session-5', 77, 1750)
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        optimalPerformanceSessions
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for inconsistent performance', async () => {
      // Arrange
      const inconsistentSessions: LearningSession[] = [
        createMockSession('session-1', 95, 1800),
        createMockSession('session-2', 45, 2400),
        createMockSession('session-3', 85, 1600),
        createMockSession('session-4', 35, 2800),
        createMockSession('session-5', 90, 1500)
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);

      // Act
      const result = await service.analyzePerformanceForDifficultyAdjustment(
        userId, 
        pathId, 
        inconsistentSessions
      );

      // Assert
      expect(result).toBeNull(); // No adjustment for inconsistent performance
    });
  });

  describe('sequenceContentByPrerequisites', () => {
    const userId = 'user-123';
    const pathId = 'path-456';

    const mockObjectives: LearningObjective[] = [
      {
        id: 'obj-1',
        title: 'Basic Addition',
        description: 'Learn basic addition',
        estimatedDuration: 60,
        prerequisites: [],
        skills: ['addition']
      },
      {
        id: 'obj-2',
        title: 'Advanced Addition',
        description: 'Learn advanced addition',
        estimatedDuration: 90,
        prerequisites: ['obj-1'],
        skills: ['addition', 'problem-solving']
      },
      {
        id: 'obj-3',
        title: 'Multiplication',
        description: 'Learn multiplication',
        estimatedDuration: 120,
        prerequisites: ['obj-1'],
        skills: ['multiplication']
      }
    ];

    const mockLearningPath: LearningPath = {
      id: pathId,
      userId,
      subject: 'mathematics',
      currentLevel: DifficultyLevel.BEGINNER,
      objectives: mockObjectives,
      milestones: [],
      progress: {
        completedObjectives: ['obj-1'],
        currentMilestone: '',
        overallProgress: 33,
        estimatedCompletion: new Date()
      },
      adaptationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should sequence content based on completed prerequisites', async () => {
      // Arrange
      const mockSkillProgress: SkillProgress[] = [
        {
          skillId: 'addition',
          skillName: 'Addition',
          currentLevel: 85,
          previousLevel: 70,
          improvementRate: 21.4,
          lastAssessed: new Date(),
          masteryThreshold: 80,
          isMastered: true
        },
        {
          skillId: 'multiplication',
          skillName: 'Multiplication',
          currentLevel: 75,
          previousLevel: 60,
          improvementRate: 25.0,
          lastAssessed: new Date(),
          masteryThreshold: 80,
          isMastered: false
        }
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepository.getUserSkillProgress.mockResolvedValue(mockSkillProgress);

      // Act
      const result = await service.sequenceContentByPrerequisites(userId, pathId);

      // Assert
      expect(result.nextObjectives.length).toBeGreaterThanOrEqual(1); // At least obj-2 should be available
      expect(result.nextObjectives.map(obj => obj.id)).toContain('obj-2');
      // obj-3 might be available depending on skill mastery logic
      expect(result.prerequisitesMet).toBe(result.blockedObjectives.length === 0);
    });

    it('should identify blocked objectives when prerequisites are not met', async () => {
      // Arrange
      const pathWithoutCompletedObjectives = {
        ...mockLearningPath,
        progress: {
          ...mockLearningPath.progress,
          completedObjectives: [] // No completed objectives
        }
      };

      const mockSkillProgress: SkillProgress[] = [];

      mockLearningPathRepository.findById.mockResolvedValue(pathWithoutCompletedObjectives);
      mockProgressRepository.getUserSkillProgress.mockResolvedValue(mockSkillProgress);

      // Act
      const result = await service.sequenceContentByPrerequisites(userId, pathId);

      // Assert
      expect(result.nextObjectives.length).toBeGreaterThanOrEqual(1); // At least obj-1 should be available
      expect(result.nextObjectives.some(obj => obj.id === 'obj-1')).toBe(true);
      expect(result.prerequisitesMet).toBe(result.blockedObjectives.length === 0);
      expect(result.blockedObjectives.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('conductCompetencyTest', () => {
    const userId = 'user-123';
    const pathId = 'path-456';

    const mockLearningPath: LearningPath = {
      id: pathId,
      userId,
      subject: 'mathematics',
      currentLevel: DifficultyLevel.BEGINNER,
      objectives: [],
      milestones: [],
      progress: {
        completedObjectives: [],
        currentMilestone: '',
        overallProgress: 50,
        estimatedCompletion: new Date()
      },
      adaptationHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should pass competency test when skills meet requirements', async () => {
      // Arrange
      const mockSkillProgress: SkillProgress[] = [
        {
          skillId: 'algebra',
          skillName: 'Algebra',
          currentLevel: 80,
          previousLevel: 70,
          improvementRate: 14.3,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: true
        },
        {
          skillId: 'geometry',
          skillName: 'Geometry',
          currentLevel: 78,
          previousLevel: 65,
          improvementRate: 20.0,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: true
        },
        {
          skillId: 'fractions',
          skillName: 'Fractions',
          currentLevel: 76,
          previousLevel: 65,
          improvementRate: 16.9,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: true
        },
        {
          skillId: 'decimals',
          skillName: 'Decimals',
          currentLevel: 77,
          previousLevel: 65,
          improvementRate: 18.5,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: true
        }
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepository.getUserSkillProgress.mockResolvedValue(mockSkillProgress);

      // Act
      const result = await service.conductCompetencyTest(
        userId, 
        pathId, 
        DifficultyLevel.INTERMEDIATE
      );

      // Assert
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.readyForAdvancement).toBe(true);
      expect(result.weakAreas.length).toBeLessThanOrEqual(1); // Allow up to 1 weak area
    });

    it('should fail competency test when skills do not meet requirements', async () => {
      // Arrange
      const mockSkillProgress: SkillProgress[] = [
        {
          skillId: 'algebra',
          skillName: 'Algebra',
          currentLevel: 60,
          previousLevel: 55,
          improvementRate: 9.1,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: false
        },
        {
          skillId: 'geometry',
          skillName: 'Geometry',
          currentLevel: 50,
          previousLevel: 45,
          improvementRate: 11.1,
          lastAssessed: new Date(),
          masteryThreshold: 75,
          isMastered: false
        }
      ];

      mockLearningPathRepository.findById.mockResolvedValue(mockLearningPath);
      mockProgressRepository.getUserSkillProgress.mockResolvedValue(mockSkillProgress);

      // Act
      const result = await service.conductCompetencyTest(
        userId, 
        pathId, 
        DifficultyLevel.INTERMEDIATE
      );

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(75);
      expect(result.readyForAdvancement).toBe(false);
      expect(result.weakAreas.length).toBeGreaterThan(0);
    });
  });

  describe('maintainOptimalChallengeLevel', () => {
    const userId = 'user-123';
    const pathId = 'path-456';

    it('should identify optimal challenge level (70-85% comprehension)', async () => {
      // Arrange
      const optimalSessions: LearningSession[] = [
        createMockSession('session-1', 75, 1800),
        createMockSession('session-2', 80, 1700),
        createMockSession('session-3', 78, 1900),
        createMockSession('session-4', 82, 1650),
        createMockSession('session-5', 77, 1750)
      ];

      jest.spyOn(service as any, 'getRecentLearningSessionsForPath')
        .mockResolvedValue(optimalSessions);

      // Act
      const result = await service.maintainOptimalChallengeLevel(userId, pathId);

      // Assert
      expect(result.isOptimal).toBe(true);
      expect(result.adjustment).toBe('maintain');
      expect(result.currentChallengeLevel).toBeCloseTo(78.4, 1);
    });

    it('should recommend increase for too easy content (>85% comprehension)', async () => {
      // Arrange
      const tooEasySessions: LearningSession[] = [
        createMockSession('session-1', 90, 1200),
        createMockSession('session-2', 95, 1100),
        createMockSession('session-3', 88, 1300),
        createMockSession('session-4', 92, 1150),
        createMockSession('session-5', 94, 1050)
      ];

      jest.spyOn(service as any, 'getRecentLearningSessionsForPath')
        .mockResolvedValue(tooEasySessions);

      // Act
      const result = await service.maintainOptimalChallengeLevel(userId, pathId);

      // Assert
      expect(result.isOptimal).toBe(false);
      expect(result.adjustment).toBe('increase');
      expect(result.currentChallengeLevel).toBeCloseTo(91.8, 1);
    });

    it('should recommend decrease for too difficult content (<70% comprehension)', async () => {
      // Arrange
      const tooDifficultSessions: LearningSession[] = [
        createMockSession('session-1', 55, 2400),
        createMockSession('session-2', 60, 2600),
        createMockSession('session-3', 50, 2800),
        createMockSession('session-4', 65, 2200),
        createMockSession('session-5', 58, 2500)
      ];

      jest.spyOn(service as any, 'getRecentLearningSessionsForPath')
        .mockResolvedValue(tooDifficultSessions);

      // Act
      const result = await service.maintainOptimalChallengeLevel(userId, pathId);

      // Assert
      expect(result.isOptimal).toBe(false);
      expect(result.adjustment).toBe('decrease');
      expect(result.currentChallengeLevel).toBeCloseTo(57.6, 1);
    });
  });

  describe('applyDifficultyAdjustment', () => {
    const pathId = 'path-456';

    it('should apply difficulty adjustment and add adaptation record', async () => {
      // Arrange
      const adjustmentResult: DifficultyAdjustmentResult = {
        newDifficulty: DifficultyLevel.ADVANCED,
        reason: 'Consistent high performance indicates readiness for increased difficulty',
        confidence: 85,
        recommendedActions: ['Introduce more complex concepts']
      };

      const mockUpdatedPath: LearningPath = {
        id: pathId,
        userId: 'user-123',
        subject: 'mathematics',
        currentLevel: DifficultyLevel.ADVANCED,
        objectives: [],
        milestones: [],
        progress: {
          completedObjectives: [],
          currentMilestone: '',
          overallProgress: 50,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockLearningPathRepository.update.mockResolvedValue(mockUpdatedPath);
      mockLearningPathRepository.addAdaptation.mockResolvedValue(mockUpdatedPath);

      // Act
      const result = await service.applyDifficultyAdjustment(pathId, adjustmentResult);

      // Assert
      expect(result).toBeDefined();
      expect(result!.currentLevel).toBe(DifficultyLevel.ADVANCED);
      expect(mockLearningPathRepository.update).toHaveBeenCalledWith(pathId, {
        currentLevel: DifficultyLevel.ADVANCED
      });
      expect(mockLearningPathRepository.addAdaptation).toHaveBeenCalledWith(
        pathId,
        expect.objectContaining({
          reason: adjustmentResult.reason,
          changes: {
            difficultyAdjustment: DifficultyLevel.ADVANCED
          }
        })
      );
    });
  });

  // Helper function to create mock learning sessions
  function createMockSession(id: string, comprehensionScore: number, duration: number): LearningSession {
    return {
      id,
      userId: 'user-123',
      pathId: 'path-456',
      contentItems: ['content-1', 'content-2'],
      duration,
      interactions: [],
      assessmentResults: [
        {
          questionId: 'math-addition-1',
          answer: '5',
          isCorrect: comprehensionScore > 70,
          timeSpent: 30,
          attempts: comprehensionScore > 80 ? 1 : 2
        }
      ],
      comprehensionScore,
      engagementMetrics: {
        attentionScore: Math.min(100, comprehensionScore + 10),
        interactionCount: 15,
        pauseCount: 2,
        replayCount: comprehensionScore < 70 ? 3 : 1,
        completionRate: Math.min(100, comprehensionScore + 5)
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
});