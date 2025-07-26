import { UserRepository } from '../repositories/user.repository';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { SkillAssessment, EducationLevel } from '@lusilearn/shared-types';

export interface AssessmentQuestion {
  id: string;
  subject: string;
  question: string;
  options: AssessmentOption[];
  correctAnswer: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  skillArea: string;
}

export interface AssessmentOption {
  id: string;
  text: string;
  value: string;
}

export interface AssessmentResponse {
  questionId: string;
  selectedAnswer: string;
  timeSpent: number; // in seconds
}

export interface AssessmentResult {
  subject: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number; // percentage
  level: number; // 1-10 scale
  confidence: number; // 1-10 scale
  skillAreas: SkillAreaResult[];
  recommendations: string[];
}

export interface SkillAreaResult {
  area: string;
  score: number;
  level: number;
  strengths: string[];
  weaknesses: string[];
}

export interface SkillGap {
  subject: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  recommendations: string[];
}

export class AssessmentService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getAssessmentQuestions(
    subject: string, 
    educationLevel: EducationLevel,
    count: number = 20
  ): Promise<AssessmentQuestion[]> {
    try {
      // Generate assessment questions based on subject and education level
      const questions = this.generateQuestions(subject, educationLevel, count);
      
      logger.info('Assessment questions generated:', { 
        subject, 
        educationLevel, 
        questionCount: questions.length 
      });

      return questions;
    } catch (error) {
      logger.error('Error generating assessment questions:', error);
      throw error;
    }
  }

  async submitAssessment(
    userId: string,
    subject: string,
    responses: AssessmentResponse[]
  ): Promise<AssessmentResult> {
    try {
      // Get user profile to understand education level
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get the original questions to score the assessment
      const questions = this.generateQuestions(
        subject, 
        user.demographics.educationLevel, 
        responses.length
      );

      // Score the assessment
      const result = this.scoreAssessment(questions, responses, subject);

      // Update user's skill profile
      await this.updateUserSkillProfile(userId, result);

      logger.info('Assessment completed:', { 
        userId, 
        subject, 
        score: result.score,
        level: result.level
      });

      return result;
    } catch (error) {
      logger.error('Error submitting assessment:', error);
      throw error;
    }
  }

  async getUserSkillProfile(userId: string): Promise<SkillAssessment[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return user.skillProfile;
    } catch (error) {
      logger.error('Error retrieving skill profile:', error);
      throw error;
    }
  }

  async identifySkillGaps(
    userId: string,
    targetLevels: { [subject: string]: number }
  ): Promise<SkillGap[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const skillGaps: SkillGap[] = [];

      for (const [subject, targetLevel] of Object.entries(targetLevels)) {
        const currentSkill = user.skillProfile.find(skill => skill.subject === subject);
        const currentLevel = currentSkill ? currentSkill.level : 1;
        
        if (currentLevel < targetLevel) {
          const gap = targetLevel - currentLevel;
          const priority = this.calculateGapPriority(gap, subject, user.demographics.educationLevel);
          
          skillGaps.push({
            subject,
            currentLevel,
            targetLevel,
            gap,
            priority,
            recommendations: this.generateGapRecommendations(subject, currentLevel, targetLevel)
          });
        }
      }

      // Sort by priority (high first)
      skillGaps.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      logger.info('Skill gaps identified:', { 
        userId, 
        gapCount: skillGaps.length,
        highPriorityGaps: skillGaps.filter(g => g.priority === 'high').length
      });

      return skillGaps;
    } catch (error) {
      logger.error('Error identifying skill gaps:', error);
      throw error;
    }
  }

  async retakeAssessment(userId: string, subject: string): Promise<AssessmentQuestion[]> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user has taken this assessment before
      const existingSkill = user.skillProfile.find(skill => skill.subject === subject);
      if (!existingSkill) {
        throw new ValidationError('No previous assessment found for this subject');
      }

      // Check if enough time has passed (e.g., 24 hours)
      const timeSinceLastAssessment = Date.now() - existingSkill.lastAssessed.getTime();
      const minRetakeInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (timeSinceLastAssessment < minRetakeInterval) {
        throw new ValidationError('Assessment can only be retaken after 24 hours');
      }

      // Generate new questions (potentially harder based on previous performance)
      const questions = this.generateAdaptiveQuestions(
        subject, 
        user.demographics.educationLevel,
        existingSkill.level
      );

      logger.info('Assessment retake initiated:', { userId, subject });

      return questions;
    } catch (error) {
      logger.error('Error initiating assessment retake:', error);
      throw error;
    }
  }

  private generateQuestions(
    subject: string, 
    educationLevel: EducationLevel, 
    count: number
  ): AssessmentQuestion[] {
    // This is a simplified implementation. In a real system, questions would come from a database
    const questionBank = this.getQuestionBank(subject, educationLevel);
    
    // Randomly select questions with balanced difficulty
    const beginnerCount = Math.floor(count * 0.4);
    const intermediateCount = Math.floor(count * 0.4);
    const advancedCount = count - beginnerCount - intermediateCount;

    const beginnerQuestions = questionBank.filter(q => q.difficulty === 'beginner').slice(0, beginnerCount);
    const intermediateQuestions = questionBank.filter(q => q.difficulty === 'intermediate').slice(0, intermediateCount);
    const advancedQuestions = questionBank.filter(q => q.difficulty === 'advanced').slice(0, advancedCount);

    return [...beginnerQuestions, ...intermediateQuestions, ...advancedQuestions];
  }

  private generateAdaptiveQuestions(
    subject: string,
    educationLevel: EducationLevel,
    currentLevel: number
  ): AssessmentQuestion[] {
    // Generate questions slightly above current level for growth assessment
    const questionBank = this.getQuestionBank(subject, educationLevel);
    
    let targetDifficulty: 'beginner' | 'intermediate' | 'advanced';
    if (currentLevel <= 3) {
      targetDifficulty = 'beginner';
    } else if (currentLevel <= 7) {
      targetDifficulty = 'intermediate';
    } else {
      targetDifficulty = 'advanced';
    }

    return questionBank.filter(q => q.difficulty === targetDifficulty).slice(0, 15);
  }

  private getQuestionBank(subject: string, educationLevel: EducationLevel): AssessmentQuestion[] {
    // This is a mock implementation. In a real system, this would query a database
    const baseQuestions: Partial<AssessmentQuestion>[] = [];

    if (subject === 'mathematics') {
      // Beginner questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'mathematics',
          question: `What is ${i + 1} + ${i + 2}?`,
          options: [
            { id: 'a', text: `${i + 1}`, value: `${i + 1}` },
            { id: 'b', text: `${i + 3}`, value: `${i + 3}` },
            { id: 'c', text: `${i + 4}`, value: `${i + 4}` },
            { id: 'd', text: `${i + 5}`, value: `${i + 5}` }
          ],
          correctAnswer: `${i + 3}`,
          difficulty: 'beginner',
          skillArea: 'basic_arithmetic'
        });
      }

      // Intermediate questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'mathematics',
          question: `Solve for x: ${i + 2}x + ${i + 5} = ${(i + 2) * 4 + (i + 5)}`,
          options: [
            { id: 'a', text: '3', value: '3' },
            { id: 'b', text: '4', value: '4' },
            { id: 'c', text: '5', value: '5' },
            { id: 'd', text: '6', value: '6' }
          ],
          correctAnswer: '4',
          difficulty: 'intermediate',
          skillArea: 'algebra'
        });
      }

      // Advanced questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'mathematics',
          question: `What is the derivative of x^${i + 2}?`,
          options: [
            { id: 'a', text: `x^${i + 1}`, value: `x^${i + 1}` },
            { id: 'b', text: `${i + 2}x^${i + 1}`, value: `${i + 2}x^${i + 1}` },
            { id: 'c', text: `x^${i + 2}`, value: `x^${i + 2}` },
            { id: 'd', text: `${i + 2}x^${i + 2}`, value: `${i + 2}x^${i + 2}` }
          ],
          correctAnswer: `${i + 2}x^${i + 1}`,
          difficulty: 'advanced',
          skillArea: 'calculus'
        });
      }
    }

    // Add more subjects as needed
    if (subject === 'programming') {
      // Beginner questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'programming',
          question: `Which of the following is a programming language? (${i + 1})`,
          options: [
            { id: 'a', text: 'HTML', value: 'HTML' },
            { id: 'b', text: 'CSS', value: 'CSS' },
            { id: 'c', text: 'JavaScript', value: 'JavaScript' },
            { id: 'd', text: 'JSON', value: 'JSON' }
          ],
          correctAnswer: 'JavaScript',
          difficulty: 'beginner',
          skillArea: 'fundamentals'
        });
      }

      // Intermediate questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'programming',
          question: `What is the time complexity of binary search? (${i + 1})`,
          options: [
            { id: 'a', text: 'O(n)', value: 'O(n)' },
            { id: 'b', text: 'O(log n)', value: 'O(log n)' },
            { id: 'c', text: 'O(n²)', value: 'O(n²)' },
            { id: 'd', text: 'O(1)', value: 'O(1)' }
          ],
          correctAnswer: 'O(log n)',
          difficulty: 'intermediate',
          skillArea: 'algorithms'
        });
      }

      // Advanced questions
      for (let i = 0; i < 10; i++) {
        baseQuestions.push({
          subject: 'programming',
          question: `Which design pattern is used for creating objects? (${i + 1})`,
          options: [
            { id: 'a', text: 'Observer', value: 'Observer' },
            { id: 'b', text: 'Factory', value: 'Factory' },
            { id: 'c', text: 'Strategy', value: 'Strategy' },
            { id: 'd', text: 'Decorator', value: 'Decorator' }
          ],
          correctAnswer: 'Factory',
          difficulty: 'advanced',
          skillArea: 'design_patterns'
        });
      }
    }

    return baseQuestions.map((q, index) => ({
      id: `${subject}-${index}`,
      ...q
    })) as AssessmentQuestion[];
  }

  private scoreAssessment(
    questions: AssessmentQuestion[],
    responses: AssessmentResponse[],
    subject: string
  ): AssessmentResult {
    let correctAnswers = 0;
    const skillAreaScores: { [area: string]: { correct: number; total: number } } = {};

    // Score each response
    responses.forEach(response => {
      const question = questions.find(q => q.id === response.questionId);
      if (question) {
        const isCorrect = question.correctAnswer === response.selectedAnswer;
        if (isCorrect) correctAnswers++;

        // Track skill area performance
        if (!skillAreaScores[question.skillArea]) {
          skillAreaScores[question.skillArea] = { correct: 0, total: 0 };
        }
        skillAreaScores[question.skillArea].total++;
        if (isCorrect) {
          skillAreaScores[question.skillArea].correct++;
        }
      }
    });

    const score = (correctAnswers / questions.length) * 100;
    const level = this.calculateSkillLevel(score);
    const confidence = this.calculateConfidence(responses, score);

    // Generate skill area results
    const skillAreas: SkillAreaResult[] = Object.entries(skillAreaScores).map(([area, scores]) => {
      const areaScore = (scores.correct / scores.total) * 100;
      const areaLevel = this.calculateSkillLevel(areaScore);
      
      return {
        area,
        score: areaScore,
        level: areaLevel,
        strengths: areaScore >= 80 ? [`Strong in ${area}`] : [],
        weaknesses: areaScore < 60 ? [`Needs improvement in ${area}`] : []
      };
    });

    const recommendations = this.generateRecommendations(level, skillAreas, subject);

    return {
      subject,
      totalQuestions: questions.length,
      correctAnswers,
      score,
      level,
      confidence,
      skillAreas,
      recommendations
    };
  }

  private calculateSkillLevel(score: number): number {
    // Convert percentage score to 1-10 scale
    if (score >= 90) return 10;
    if (score >= 80) return 9;
    if (score >= 70) return 8;
    if (score >= 60) return 7;
    if (score >= 50) return 6;
    if (score >= 40) return 5;
    if (score >= 30) return 4;
    if (score >= 20) return 3;
    if (score >= 10) return 2;
    return 1;
  }

  private calculateConfidence(responses: AssessmentResponse[], score: number): number {
    // Calculate confidence based on response time and score
    const avgResponseTime = responses.reduce((sum, r) => sum + r.timeSpent, 0) / responses.length;
    
    // Base confidence on score
    let confidence = Math.floor(score / 10);
    
    // Adjust based on response time (faster responses with high score = higher confidence)
    if (avgResponseTime < 30 && score > 70) {
      confidence = Math.min(10, confidence + 1);
    } else if (avgResponseTime > 120) {
      confidence = Math.max(1, confidence - 1);
    }

    return confidence;
  }

  private generateRecommendations(
    level: number,
    skillAreas: SkillAreaResult[],
    subject: string
  ): string[] {
    const recommendations: string[] = [];

    if (level <= 3) {
      recommendations.push(`Focus on fundamental concepts in ${subject}`);
      recommendations.push('Start with beginner-level content and practice regularly');
    } else if (level <= 6) {
      recommendations.push(`Build on your foundation with intermediate ${subject} topics`);
      recommendations.push('Practice problem-solving with guided examples');
    } else if (level <= 8) {
      recommendations.push(`Challenge yourself with advanced ${subject} concepts`);
      recommendations.push('Work on real-world applications and projects');
    } else {
      recommendations.push(`Consider teaching or mentoring others in ${subject}`);
      recommendations.push('Explore cutting-edge topics and research in the field');
    }

    // Add skill area specific recommendations
    skillAreas.forEach(area => {
      if (area.weaknesses.length > 0) {
        recommendations.push(`Focus on improving ${area.area} skills`);
      }
    });

    return recommendations;
  }

  private generateGapRecommendations(
    subject: string,
    currentLevel: number,
    targetLevel: number
  ): string[] {
    const gap = targetLevel - currentLevel;
    const recommendations: string[] = [];

    if (gap <= 2) {
      recommendations.push(`Review and practice ${subject} concepts at your current level`);
      recommendations.push('Take on slightly more challenging problems');
    } else if (gap <= 4) {
      recommendations.push(`Dedicate focused study time to ${subject}`);
      recommendations.push('Consider taking a structured course or tutorial');
      recommendations.push('Practice regularly with progressively harder problems');
    } else {
      recommendations.push(`Consider intensive study or formal education in ${subject}`);
      recommendations.push('Start with foundational concepts and build systematically');
      recommendations.push('Seek mentorship or tutoring support');
    }

    return recommendations;
  }

  private calculateGapPriority(
    gap: number,
    subject: string,
    educationLevel: EducationLevel
  ): 'high' | 'medium' | 'low' {
    // Core subjects get higher priority
    const coreSubjects = ['mathematics', 'programming', 'science', 'english'];
    const isCore = coreSubjects.includes(subject.toLowerCase());

    if (gap >= 5 || (gap >= 3 && isCore)) {
      return 'high';
    } else if (gap >= 3 || (gap >= 2 && isCore)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async updateUserSkillProfile(userId: string, result: AssessmentResult): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update or add skill assessment
      const existingSkillIndex = user.skillProfile.findIndex(
        skill => skill.subject === result.subject
      );

      const newSkillAssessment: SkillAssessment = {
        subject: result.subject,
        level: result.level,
        confidence: result.confidence,
        lastAssessed: new Date()
      };

      if (existingSkillIndex >= 0) {
        user.skillProfile[existingSkillIndex] = newSkillAssessment;
      } else {
        user.skillProfile.push(newSkillAssessment);
      }

      await this.userRepository.updateSkillProfile(userId, user.skillProfile);

      logger.info('User skill profile updated:', { 
        userId, 
        subject: result.subject,
        level: result.level,
        confidence: result.confidence
      });
    } catch (error) {
      logger.error('Error updating user skill profile:', error);
      throw error;
    }
  }
}