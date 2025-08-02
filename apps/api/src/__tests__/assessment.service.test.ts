import { AssessmentService } from '../services/assessment.service';
import { UserRepository } from '../repositories/user.repository';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import {
  EducationLevel,
  AgeRange,
  LearningStyle,
  ContentType,
  DifficultyPreference,
  UserProfile
} from '@lusilearn/shared-types';

// Mock dependencies
jest.mock('../repositories/user.repository');

const MockedUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('AssessmentService', () => {
  let assessmentService: AssessmentService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: UserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    demographics: {
      ageRange: AgeRange.YOUNG_ADULT,
      educationLevel: EducationLevel.COLLEGE,
      timezone: 'UTC',
      preferredLanguage: 'en'
    },
    learningPreferences: {
      learningStyle: [LearningStyle.VISUAL],
      preferredContentTypes: [ContentType.VIDEO],
      sessionDuration: 60,
      difficultyPreference: DifficultyPreference.MODERATE
    },
    skillProfile: [
      {
        subject: 'mathematics',
        level: 6,
        confidence: 7,
        lastAssessed: new Date('2024-01-01')
      }
    ],
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockedUserRepository() as jest.Mocked<UserRepository>;
    assessmentService = new AssessmentService();
    (assessmentService as any).userRepository = mockUserRepository;
  });

  describe('getAssessmentQuestions', () => {
    it('should generate assessment questions for mathematics', async () => {
      // Act
      const questions = await assessmentService.getAssessmentQuestions(
        'mathematics',
        EducationLevel.COLLEGE,
        15
      );

      // Assert
      expect(questions).toHaveLength(15);
      expect(questions[0]).toHaveProperty('id');
      expect(questions[0]).toHaveProperty('question');
      expect(questions[0]).toHaveProperty('options');
      expect(questions[0]).toHaveProperty('correctAnswer');
      expect(questions[0]).toHaveProperty('difficulty');
      expect(questions[0]).toHaveProperty('skillArea');
      expect(questions[0].subject).toBe('mathematics');
    });

    it('should generate questions with balanced difficulty levels', async () => {
      // Act
      const questions = await assessmentService.getAssessmentQuestions(
        'mathematics',
        EducationLevel.COLLEGE,
        10
      );

      // Assert
      const difficulties = questions.map(q => q.difficulty);
      expect(difficulties).toContain('beginner');
      expect(difficulties).toContain('intermediate');
      // Advanced questions might not always be present in small sets
    });

    it('should generate questions for programming subject', async () => {
      // Act
      const questions = await assessmentService.getAssessmentQuestions(
        'programming',
        EducationLevel.COLLEGE,
        5
      );

      // Assert
      expect(questions).toHaveLength(5);
      expect(questions[0].subject).toBe('programming');
    });
  });

  describe('submitAssessment', () => {
    it('should score assessment and update user skill profile', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateSkillProfile.mockResolvedValue();

      // First get the actual questions to know the correct answers
      const questions = await assessmentService.getAssessmentQuestions('mathematics', EducationLevel.COLLEGE, 3);

      const responses = questions.map(q => ({
        questionId: q.id,
        selectedAnswer: q.correctAnswer, // Use the actual correct answer
        timeSpent: 30
      }));

      // Act
      const result = await assessmentService.submitAssessment(
        'user-123',
        'mathematics',
        responses
      );

      // Assert
      expect(result).toHaveProperty('subject', 'mathematics');
      expect(result).toHaveProperty('totalQuestions', 3);
      expect(result).toHaveProperty('correctAnswers', 3);
      expect(result).toHaveProperty('score', 100);
      expect(result).toHaveProperty('level', 10);
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('skillAreas');
      expect(result).toHaveProperty('recommendations');
      expect(result.skillAreas).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.updateSkillProfile).toHaveBeenCalled();
    });

    it('should handle partial correct answers', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateSkillProfile.mockResolvedValue();

      // Get actual questions to know the correct answers
      const questions = await assessmentService.getAssessmentQuestions('mathematics', EducationLevel.COLLEGE, 3);

      const responses = [
        { questionId: questions[0].id, selectedAnswer: questions[0].correctAnswer, timeSpent: 15 }, // Correct
        { questionId: questions[1].id, selectedAnswer: 'wrong-answer', timeSpent: 30 }, // Incorrect
        { questionId: questions[2].id, selectedAnswer: questions[2].correctAnswer, timeSpent: 45 } // Correct
      ];

      // Act
      const result = await assessmentService.submitAssessment(
        'user-123',
        'mathematics',
        responses
      );

      // Assert
      expect(result.totalQuestions).toBe(3);
      expect(result.correctAnswers).toBe(2);
      expect(result.score).toBeCloseTo(66.67, 1);
      expect(result.level).toBe(7); // Should be around level 7 for ~67% score
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      const responses = [
        { questionId: 'mathematics-0', selectedAnswer: '4', timeSpent: 15 }
      ];

      // Act & Assert
      await expect(assessmentService.submitAssessment(
        'non-existent-user',
        'mathematics',
        responses
      )).rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserSkillProfile', () => {
    it('should return user skill profile', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const skillProfile = await assessmentService.getUserSkillProfile('user-123');

      // Assert
      expect(skillProfile).toEqual(mockUser.skillProfile);
      expect(skillProfile).toHaveLength(1);
      expect(skillProfile[0].subject).toBe('mathematics');
      expect(skillProfile[0].level).toBe(mockUser.skillProfile[0].level);
    });

    it('should throw NotFoundError if user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(assessmentService.getUserSkillProfile('non-existent-user'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('identifySkillGaps', () => {
    it('should identify skill gaps correctly', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const targetLevels = {
        mathematics: 8, // Current is 6, gap of 2
        programming: 5, // Current is 1 (default), gap of 4
        science: 3      // Current is 1 (default), gap of 2
      };

      // Act
      const skillGaps = await assessmentService.identifySkillGaps('user-123', targetLevels);

      // Assert
      expect(skillGaps).toHaveLength(3);

      // Check mathematics gap
      const mathGap = skillGaps.find(gap => gap.subject === 'mathematics');
      expect(mathGap).toBeDefined();
      expect(mathGap!.currentLevel).toBe(mockUser.skillProfile[0].level);
      expect(mathGap!.targetLevel).toBe(8);
      expect(mathGap!.gap).toBe(8 - mockUser.skillProfile[0].level);
      expect(mathGap!.priority).toBe('low'); // Core subject with gap of 2

      // Check programming gap
      const progGap = skillGaps.find(gap => gap.subject === 'programming');
      expect(progGap).toBeDefined();
      expect(progGap!.currentLevel).toBe(1);
      expect(progGap!.targetLevel).toBe(5);
      expect(progGap!.gap).toBe(4);
      expect(progGap!.priority).toBe('high'); // Core subject with gap >= 3

      // Verify gaps are sorted by priority
      expect(skillGaps[0].priority).toBe('high');
    });

    it('should not return gaps for subjects already at target level', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const targetLevels = {
        mathematics: 6 // Current is 6, no gap needed
      };

      // Act
      const skillGaps = await assessmentService.identifySkillGaps('user-123', targetLevels);

      // Assert
      expect(skillGaps).toHaveLength(0);
    });

    it('should generate appropriate recommendations for different gap sizes', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const targetLevels = {
        mathematics: 8, // Gap of 2
        programming: 6  // Gap of 5
      };

      // Act
      const skillGaps = await assessmentService.identifySkillGaps('user-123', targetLevels);

      // Assert
      const mathGap = skillGaps.find(gap => gap.subject === 'mathematics');
      const progGap = skillGaps.find(gap => gap.subject === 'programming');

      expect(mathGap!.recommendations).toContain('Review and practice mathematics concepts at your current level');
      expect(progGap!.recommendations).toContain('Consider intensive study or formal education in programming');
    });
  });

  describe('retakeAssessment', () => {
    it('should allow retake after 24 hours', async () => {
      // Arrange
      const userWithOldAssessment = {
        ...mockUser,
        skillProfile: [
          {
            subject: 'mathematics',
            level: 6,
            confidence: 7,
            lastAssessed: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
          }
        ]
      };
      mockUserRepository.findById.mockResolvedValue(userWithOldAssessment);

      // Act
      const questions = await assessmentService.retakeAssessment('user-123', 'mathematics');

      // Assert
      expect(questions).toBeInstanceOf(Array);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0].subject).toBe('mathematics');
    });

    it('should prevent retake within 24 hours', async () => {
      // Arrange
      const userWithRecentAssessment = {
        ...mockUser,
        skillProfile: [
          {
            subject: 'mathematics',
            level: 6,
            confidence: 7,
            lastAssessed: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
          }
        ]
      };
      mockUserRepository.findById.mockResolvedValue(userWithRecentAssessment);

      // Act & Assert
      await expect(assessmentService.retakeAssessment('user-123', 'mathematics'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if no previous assessment exists', async () => {
      // Arrange
      const userWithoutAssessment = {
        ...mockUser,
        skillProfile: []
      };
      mockUserRepository.findById.mockResolvedValue(userWithoutAssessment);

      // Act & Assert
      await expect(assessmentService.retakeAssessment('user-123', 'mathematics'))
        .rejects.toThrow(ValidationError);
    });

    it('should generate adaptive questions based on current level', async () => {
      // Arrange
      const userWithHighLevel = {
        ...mockUser,
        skillProfile: [
          {
            subject: 'mathematics',
            level: 9, // High level
            confidence: 8,
            lastAssessed: new Date(Date.now() - 25 * 60 * 60 * 1000)
          }
        ]
      };
      mockUserRepository.findById.mockResolvedValue(userWithHighLevel);

      // Act
      const questions = await assessmentService.retakeAssessment('user-123', 'mathematics');

      // Assert
      expect(questions).toBeInstanceOf(Array);
      // For high level (9), should get advanced questions
      const difficulties = questions.map(q => q.difficulty);
      expect(difficulties.every(d => d === 'advanced')).toBe(true);
    });
  });

  describe('scoring and level calculation', () => {
    it('should calculate correct skill levels for different scores', () => {
      // Access private method for testing
      const calculateSkillLevel = (assessmentService as any).calculateSkillLevel;

      expect(calculateSkillLevel(95)).toBe(10);
      expect(calculateSkillLevel(85)).toBe(9);
      expect(calculateSkillLevel(75)).toBe(8);
      expect(calculateSkillLevel(65)).toBe(7);
      expect(calculateSkillLevel(55)).toBe(6);
      expect(calculateSkillLevel(45)).toBe(5);
      expect(calculateSkillLevel(35)).toBe(4);
      expect(calculateSkillLevel(25)).toBe(3);
      expect(calculateSkillLevel(15)).toBe(2);
      expect(calculateSkillLevel(5)).toBe(1);
    });

    it('should calculate confidence based on score and response time', () => {
      // Access private method for testing
      const calculateConfidence = (assessmentService as any).calculateConfidence;

      const fastResponses = [
        { questionId: '1', selectedAnswer: 'a', timeSpent: 20 },
        { questionId: '2', selectedAnswer: 'b', timeSpent: 25 }
      ];

      const slowResponses = [
        { questionId: '1', selectedAnswer: 'a', timeSpent: 150 },
        { questionId: '2', selectedAnswer: 'b', timeSpent: 180 }
      ];

      const highScoreConfidence = calculateConfidence(fastResponses, 85);
      const lowScoreConfidence = calculateConfidence(slowResponses, 45);

      expect(highScoreConfidence).toBeGreaterThan(lowScoreConfidence);
      expect(highScoreConfidence).toBeGreaterThanOrEqual(1);
      expect(highScoreConfidence).toBeLessThanOrEqual(10);
    });
  });

  describe('recommendation generation', () => {
    it('should generate appropriate recommendations for different skill levels', () => {
      // Access private method for testing
      const generateRecommendations = (assessmentService as any).generateRecommendations;

      const beginnerRecs = generateRecommendations(2, [], 'mathematics');
      const intermediateRecs = generateRecommendations(5, [], 'mathematics');
      const advancedRecs = generateRecommendations(9, [], 'mathematics');

      expect(beginnerRecs).toContain('Focus on fundamental concepts in mathematics');
      expect(intermediateRecs).toContain('Build on your foundation with intermediate mathematics topics');
      expect(advancedRecs).toContain('Consider teaching or mentoring others in mathematics');
    });

    it('should include skill area specific recommendations', () => {
      // Access private method for testing
      const generateRecommendations = (assessmentService as any).generateRecommendations;

      const skillAreas = [
        {
          area: 'algebra',
          score: 45,
          level: 4,
          strengths: [],
          weaknesses: ['Needs improvement in algebra']
        }
      ];

      const recommendations = generateRecommendations(6, skillAreas, 'mathematics');
      expect(recommendations).toContain('Focus on improving algebra skills');
    });
  });
});