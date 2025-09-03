import { Pool } from 'pg';
import { LearningPathService } from '../learning-path.service';
import { UserService } from '../user.service';
import { AdaptiveDifficultyService } from '../adaptive-difficulty.service';
import { LearningPathRepository, CreateLearningPathRequest, UpdateLearningPathRequest, ShareLearningPathRequest } from '../../repositories/learning-path.repository';
import {
  LearningPath,
  LearningGoal,
  DifficultyLevel,
  LearningObjective,
  Milestone,
  PathAdaptation,
  PerformanceData,
  UserProfile,
  EducationLevel,
  AgeRange,
  LearningSession,
  DifficultyAdjustmentResult
} from '@lusilearn/shared-types';

// Mock the dependencies
jest.mock('../user.service');
jest.mock('../adaptive-difficulty.service');
jest.mock('../../repositories/learning-path.repository');
jest.mock('../../utils/logger');

// Mock fetch for AI service calls
global.fetch = jest.fn();

// Create mock instances
const mockUserService = {
  getProfile: jest.fn(),
} as jest.Mocked<Partial<UserService>>;

const mockAdaptiveDifficultyService = {
  analyzePerformanceForDifficultyAdjustment: jest.fn(),
  applyDifficultyAdjustment: jest.fn(),
  sequenceContentByPrerequisites: jest.fn(),
  conductCompetencyTest: jest.fn(),
  maintainOptimalChallengeLevel: jest.fn(),
} as jest.Mocked<Partial<AdaptiveDifficultyService>>;

const mockLearningPathRepository = {
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByUserIdAndSubject: jest.fn(),
  getSharedPaths: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  sharePath: jest.fn(),
  addAdaptation: jest.fn(),
} as jest.Mocked<Partial<LearningPathRepository>>;

describe('LearningPathService', () => {
  let learningPathService: LearningPathService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
    } as any;

    learningPathService = new LearningPathService(mockPool);
    
    // Replace the dependencies with mocks
    (learningPathService as any).userService = mockUserService;
    (learningPathService as any).adaptiveDifficultyService = mockAdaptiveDifficultyService;
    (learningPathService as any).learningPathRepository = mockLearningPathRepository;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePath', () => {
    const userId = 'user-123';
    const subject = 'mathematics';
    const goals: LearningGoal[] = [
      {
        id: 'goal-1',
        title: 'Master Algebra',
        description: 'Learn algebraic concepts',
        targetDate: new Date(),
        priority: 'high',
        isCompleted: false
      }
    ];

    it('should generate a new learning path successfully', async () => {
      // Arrange
      const mockUserProfile = createMockUserProfile(userId);
      const mockLearningPath = createMockLearningPath(userId, subject);

      mockUserService.getProfile!.mockResolvedValue(mockUserProfile);
      mockLearningPathRepository.findByUserIdAndSubject!.mockResolvedValue(null);
      mockLearningPathRepository.create!.mockResolvedValue(mockLearningPath);

      // Mock AI service failure to test fallback
      (global.fetch as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(result).toEqual(mockLearningPath);
      expect(mockUserService.getProfile).toHaveBeenCalledWith(userId);
      expect(mockLearningPathRepository.findByUserIdAndSubject).toHaveBeenCalledWith(userId, subject);
      expect(mockLearningPathRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          subject,
          goals,
          currentLevel: DifficultyLevel.INTERMEDIATE
        })
      );
    });

    it('should return existing path if user already has one for the subject', async () => {
      // Arrange
      const mockUserProfile = createMockUserProfile(userId);
      const existingPath = createMockLearningPath(userId, subject);

      mockUserService.getProfile!.mockResolvedValue(mockUserProfile);
      mockLearningPathRepository.findByUserIdAndSubject!.mockResolvedValue(existingPath);

      // Act
      const result = await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(result).toEqual(existingPath);
      expect(mockLearningPathRepository.create).not.toHaveBeenCalled();
    });

    it('should use AI service for enhanced path generation when available', async () => {
      // Arrange
      const mockUserProfile = createMockUserProfile(userId);
      const mockLearningPath = createMockLearningPath(userId, subject);
      const aiResponse = {
        path_id: 'ai-path-123',
        objectives: [
          {
            id: 'ai-obj-1',
            title: 'AI Enhanced Objective',
            description: 'AI generated objective',
            estimated_hours: 2,
            prerequisites: [],
            skills_gained: ['ai-skill']
          }
        ],
        difficulty_progression: 'intermediate'
      };

      mockUserService.getProfile!.mockResolvedValue(mockUserProfile);
      mockLearningPathRepository.findByUserIdAndSubject!.mockResolvedValue(null);
      mockLearningPathRepository.create!.mockResolvedValue(mockLearningPath);

      // Mock successful AI service response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse)
      });

      // Act
      const result = await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(result).toEqual(mockLearningPath);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/learning-paths/'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(subject)
        })
      );
    });

    it('should determine correct initial difficulty based on education level', async () => {
      // Arrange
      const k12UserProfile = {
        ...createMockUserProfile(userId),
        demographics: {
          ...createMockUserProfile(userId).demographics,
          educationLevel: 'high_school' // Use string value that maps to intermediate
        }
      };
      const mockLearningPath = createMockLearningPath(userId, subject);

      mockUserService.getProfile!.mockResolvedValue(k12UserProfile);
      mockLearningPathRepository.findByUserIdAndSubject!.mockResolvedValue(null);
      mockLearningPathRepository.create!.mockResolvedValue(mockLearningPath);

      // Mock AI service failure to test fallback
      (global.fetch as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      // Act
      await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(mockLearningPathRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLevel: DifficultyLevel.INTERMEDIATE // high_school should be intermediate
        })
      );
    });

    it('should handle errors during path generation', async () => {
      // Arrange
      const error = new Error('Database error');
      mockUserService.getProfile!.mockRejectedValue(error);

      // Act & Assert
      await expect(learningPathService.generatePath(userId, subject, goals)).rejects.toThrow(error);
    });
  });

  describe('getPath', () => {
    it('should return learning path when it exists', async () => {
      // Arrange
      const pathId = 'path-123';
      const mockPath = createMockLearningPath('user-123', 'mathematics');
      mockLearningPathRepository.findById!.mockResolvedValue(mockPath);

      // Act
      const result = await learningPathService.getPath(pathId);

      // Assert
      expect(result).toEqual(mockPath);
      expect(mockLearningPathRepository.findById).toHaveBeenCalledWith(pathId);
    });

    it('should return null when path does not exist', async () => {
      // Arrange
      const pathId = 'non-existent-path';
      mockLearningPathRepository.findById!.mockResolvedValue(null);

      // Act
      const result = await learningPathService.getPath(pathId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getUserPaths', () => {
    it('should return both owned and shared paths', async () => {
      // Arrange
      const userId = 'user-123';
      const ownPaths = [createMockLearningPath(userId, 'mathematics')];
      const sharedPaths = [createMockLearningPath('other-user', 'science')];

      mockLearningPathRepository.findByUserId!.mockResolvedValue(ownPaths);
      mockLearningPathRepository.getSharedPaths!.mockResolvedValue(sharedPaths);

      // Act
      const result = await learningPathService.getUserPaths(userId);

      // Assert
      expect(result).toEqual([...ownPaths, ...sharedPaths]);
      expect(mockLearningPathRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockLearningPathRepository.getSharedPaths).toHaveBeenCalledWith(userId);
    });
  });

  describe('updatePath', () => {
    it('should update learning path successfully', async () => {
      // Arrange
      const pathId = 'path-123';
      const updates: UpdateLearningPathRequest = {
        progress: {
          completedObjectives: ['obj-1', 'obj-2'],
          currentMilestone: 'milestone-2',
          overallProgress: 50,
          estimatedCompletion: new Date()
        }
      };
      const updatedPath = createMockLearningPath('user-123', 'mathematics');
      updatedPath.progress = updates.progress!;

      mockLearningPathRepository.update!.mockResolvedValue(updatedPath);

      // Act
      const result = await learningPathService.updatePath(pathId, updates);

      // Assert
      expect(result).toEqual(updatedPath);
      expect(mockLearningPathRepository.update).toHaveBeenCalledWith(pathId, updates);
    });

    it('should return null when path does not exist', async () => {
      // Arrange
      const pathId = 'non-existent-path';
      const updates: UpdateLearningPathRequest = {};
      mockLearningPathRepository.update!.mockResolvedValue(null);

      // Act
      const result = await learningPathService.updatePath(pathId, updates);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateProgress', () => {
    const pathId = 'path-123';
    const performanceData: PerformanceData = {
      comprehensionScore: 85,
      timeSpent: 1800,
      masteredConcepts: ['algebra-basics', 'linear-equations'],
      strugglingConcepts: [],
      engagementLevel: 90
    };

    it('should update progress without difficulty adjustment', async () => {
      // Arrange
      const currentPath = createMockLearningPath('user-123', 'mathematics');
      const updatedPath = { ...currentPath };
      updatedPath.progress.completedObjectives = ['algebra-basics', 'linear-equations'];
      updatedPath.progress.overallProgress = 40;

      mockLearningPathRepository.findById.mockResolvedValue(currentPath);
      mockLearningPathRepository.update.mockResolvedValue(updatedPath);

      // Act
      const result = await learningPathService.updateProgress(pathId, performanceData);

      // Assert
      expect(result).toEqual(updatedPath);
      expect(mockLearningPathRepository.update).toHaveBeenCalledWith(
        pathId,
        expect.objectContaining({
          progress: expect.objectContaining({
            completedObjectives: expect.arrayContaining(['algebra-basics', 'linear-equations'])
          })
        })
      );
    });

    it('should adjust difficulty when performance indicates need', async () => {
      // Arrange
      const highPerformanceData: PerformanceData = {
        ...performanceData,
        comprehensionScore: 95
      };
      const currentPath = createMockLearningPath('user-123', 'mathematics');
      const updatedPath = { ...currentPath, currentLevel: DifficultyLevel.ADVANCED };

      mockLearningPathRepository.findById.mockResolvedValue(currentPath);
      mockLearningPathRepository.update.mockResolvedValue(updatedPath);
      mockLearningPathRepository.addAdaptation.mockResolvedValue(updatedPath);

      // Act
      const result = await learningPathService.updateProgress(pathId, highPerformanceData);

      // Assert
      expect(result).toEqual(updatedPath);
      expect(mockLearningPathRepository.addAdaptation).toHaveBeenCalledWith(
        pathId,
        expect.objectContaining({
          reason: expect.stringContaining('95% comprehension'),
          changes: {
            difficultyAdjustment: DifficultyLevel.ADVANCED
          }
        })
      );
    });

    it('should return null when path does not exist', async () => {
      // Arrange
      mockLearningPathRepository.findById.mockResolvedValue(null);

      // Act
      const result = await learningPathService.updateProgress(pathId, performanceData);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('sharePath', () => {
    it('should share learning path successfully', async () => {
      // Arrange
      const pathId = 'path-123';
      const shareData: ShareLearningPathRequest = {
        sharedWithUserId: 'user-456',
        permissions: ['view', 'comment']
      };
      const mockPath = createMockLearningPath('user-123', 'mathematics');

      mockLearningPathRepository.findById.mockResolvedValue(mockPath);
      mockLearningPathRepository.sharePath.mockResolvedValue();

      // Act
      await learningPathService.sharePath(pathId, shareData);

      // Assert
      expect(mockLearningPathRepository.sharePath).toHaveBeenCalledWith(pathId, shareData);
    });

    it('should throw error when path does not exist', async () => {
      // Arrange
      const pathId = 'non-existent-path';
      const shareData: ShareLearningPathRequest = {
        sharedWithUserId: 'user-456',
        permissions: ['view']
      };

      mockLearningPathRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(learningPathService.sharePath(pathId, shareData)).rejects.toThrow('Learning path not found');
    });
  });

  describe('deletePath', () => {
    it('should deactivate learning path successfully', async () => {
      // Arrange
      const pathId = 'path-123';
      mockLearningPathRepository.deactivate.mockResolvedValue(true);

      // Act
      const result = await learningPathService.deletePath(pathId);

      // Assert
      expect(result).toBe(true);
      expect(mockLearningPathRepository.deactivate).toHaveBeenCalledWith(pathId);
    });

    it('should return false when path does not exist', async () => {
      // Arrange
      const pathId = 'non-existent-path';
      mockLearningPathRepository.deactivate.mockResolvedValue(false);

      // Act
      const result = await learningPathService.deletePath(pathId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('adaptDifficulty', () => {
    it('should adapt difficulty based on recent sessions', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const recentSessions: LearningSession[] = [createMockLearningSession()];
      const adjustmentResult: DifficultyAdjustmentResult = {
        newDifficulty: DifficultyLevel.ADVANCED,
        reason: 'High performance detected',
        confidence: 85,
        recommendedActions: ['Introduce advanced concepts']
      };

      mockAdaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment.mockResolvedValue(adjustmentResult);
      mockAdaptiveDifficultyService.applyDifficultyAdjustment.mockResolvedValue(createMockLearningPath(userId, 'mathematics'));

      // Act
      const result = await learningPathService.adaptDifficulty(userId, pathId, recentSessions);

      // Assert
      expect(result).toEqual(adjustmentResult);
      expect(mockAdaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment).toHaveBeenCalledWith(userId, pathId, recentSessions);
      expect(mockAdaptiveDifficultyService.applyDifficultyAdjustment).toHaveBeenCalledWith(pathId, adjustmentResult);
    });

    it('should return null when no adjustment is needed', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const recentSessions: LearningSession[] = [createMockLearningSession()];

      mockAdaptiveDifficultyService.analyzePerformanceForDifficultyAdjustment.mockResolvedValue(null);

      // Act
      const result = await learningPathService.adaptDifficulty(userId, pathId, recentSessions);

      // Assert
      expect(result).toBeNull();
      expect(mockAdaptiveDifficultyService.applyDifficultyAdjustment).not.toHaveBeenCalled();
    });
  });

  describe('getNextContent', () => {
    it('should get next content based on prerequisites', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const contentSequenceResult = {
        nextObjectives: [createMockLearningObjective()],
        prerequisitesMet: true,
        blockedObjectives: []
      };

      mockAdaptiveDifficultyService.sequenceContentByPrerequisites.mockResolvedValue(contentSequenceResult);

      // Act
      const result = await learningPathService.getNextContent(userId, pathId);

      // Assert
      expect(result).toEqual(contentSequenceResult);
      expect(mockAdaptiveDifficultyService.sequenceContentByPrerequisites).toHaveBeenCalledWith(userId, pathId);
    });
  });

  describe('requestAdvancement', () => {
    it('should approve advancement when competency test passes', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const requestedLevel = DifficultyLevel.ADVANCED;
      const testResult = {
        passed: true,
        score: 85,
        readyForAdvancement: true,
        weakAreas: []
      };
      const updatedPath = createMockLearningPath(userId, 'mathematics');

      mockAdaptiveDifficultyService.conductCompetencyTest.mockResolvedValue(testResult);
      mockLearningPathRepository.update.mockResolvedValue(updatedPath);
      mockLearningPathRepository.addAdaptation.mockResolvedValue(updatedPath);

      // Act
      const result = await learningPathService.requestAdvancement(userId, pathId, requestedLevel);

      // Assert
      expect(result).toEqual(testResult);
      expect(mockLearningPathRepository.update).toHaveBeenCalledWith(pathId, {
        currentLevel: requestedLevel
      });
      expect(mockLearningPathRepository.addAdaptation).toHaveBeenCalledWith(
        pathId,
        expect.objectContaining({
          reason: expect.stringContaining('competency test'),
          changes: {
            difficultyAdjustment: requestedLevel
          }
        })
      );
    });

    it('should reject advancement when competency test fails', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const requestedLevel = DifficultyLevel.ADVANCED;
      const testResult = {
        passed: false,
        score: 65,
        readyForAdvancement: false,
        weakAreas: ['algebra', 'geometry']
      };

      mockAdaptiveDifficultyService.conductCompetencyTest.mockResolvedValue(testResult);

      // Act
      const result = await learningPathService.requestAdvancement(userId, pathId, requestedLevel);

      // Assert
      expect(result).toEqual(testResult);
      expect(mockLearningPathRepository.update).not.toHaveBeenCalled();
      expect(mockLearningPathRepository.addAdaptation).not.toHaveBeenCalled();
    });
  });

  describe('maintainOptimalChallenge', () => {
    it('should analyze and maintain optimal challenge level', async () => {
      // Arrange
      const userId = 'user-123';
      const pathId = 'path-123';
      const analysis = {
        currentChallengeLevel: 78,
        isOptimal: true,
        adjustment: 'maintain' as const,
        recommendedActions: []
      };

      mockAdaptiveDifficultyService.maintainOptimalChallengeLevel.mockResolvedValue(analysis);

      // Act
      const result = await learningPathService.maintainOptimalChallenge(userId, pathId);

      // Assert
      expect(result).toEqual(analysis);
      expect(mockAdaptiveDifficultyService.maintainOptimalChallengeLevel).toHaveBeenCalledWith(userId, pathId);
    });
  });

  // Helper functions
  function createMockUserProfile(userId: string): UserProfile {
    return {
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      demographics: {
        ageRange: AgeRange.ADULT,
        educationLevel: EducationLevel.COLLEGE,
        timezone: 'UTC',
        preferredLanguage: 'en'
      },
      learningPreferences: {
        learningStyle: [],
        preferredContentTypes: [],
        sessionDuration: 30,
        difficultyPreference: 'adaptive'
      },
      skillProfile: [],
      privacySettings: {
        profileVisibility: 'friends',
        allowPeerMatching: true,
        shareProgressData: false,
        allowDataCollection: false
      },
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  function createMockLearningPath(userId: string, subject: string): LearningPath {
    return {
      id: 'path-123',
      userId,
      subject,
      currentLevel: DifficultyLevel.INTERMEDIATE,
      objectives: [createMockLearningObjective()],
      milestones: [createMockMilestone()],
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
  }

  function createMockLearningObjective(): LearningObjective {
    return {
      id: 'obj-1',
      title: 'Basic Algebra',
      description: 'Learn basic algebraic concepts',
      estimatedDuration: 120,
      prerequisites: [],
      skills: ['algebra']
    };
  }

  function createMockMilestone(): Milestone {
    return {
      id: 'milestone-1',
      title: 'First Milestone',
      description: 'Complete basic objectives',
      objectives: ['obj-1'],
      completionCriteria: ['Complete all objectives'],
      isCompleted: false
    };
  }

  function createMockLearningSession(): LearningSession {
    return {
      id: 'session-1',
      userId: 'user-123',
      pathId: 'path-123',
      contentItems: ['content-1'],
      duration: 1800,
      interactions: [],
      assessmentResults: [],
      comprehensionScore: 80,
      engagementMetrics: {
        attentionScore: 85,
        interactionCount: 10,
        pauseCount: 2,
        replayCount: 1,
        completionRate: 95
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
});