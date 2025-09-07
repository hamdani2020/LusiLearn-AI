import { faker } from '@faker-js/faker';

export interface MockDataGeneratorConfig {
  seed?: number;
  locale?: string;
  defaultCount?: number;
}

export interface MockScenario {
  name: string;
  description: string;
  data: any;
  metadata?: {
    responseTime?: number;
    status?: number;
    error?: boolean;
    cacheHit?: boolean;
  };
}

export class MockDataGenerator {
  private config: MockDataGeneratorConfig;

  constructor(config: MockDataGeneratorConfig = {}) {
    this.config = {
      seed: 12345,
      locale: 'en',
      defaultCount: 10,
      ...config
    };

    if (this.config.seed) {
      faker.seed(this.config.seed);
    }
  }

  // User-related mock data
  generateUser(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement(['student', 'educator', 'admin']),
      educationLevel: faker.helpers.arrayElement(['k12', 'college', 'professional']),
      subjects: faker.helpers.arrayElements(['math', 'science', 'programming', 'language'], { min: 1, max: 3 }),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      isActive: faker.datatype.boolean(0.9),
      preferences: {
        theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
        notifications: faker.datatype.boolean(0.8),
        language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de'])
      },
      ...overrides
    };
  }

  generateUsers(count: number = this.config.defaultCount): any[] {
    return Array.from({ length: count }, () => this.generateUser());
  }

  // Learning path mock data
  generateLearningPath(overrides: Partial<any> = {}): any {
    const subjects = ['Mathematics', 'Science', 'Programming', 'Language Arts', 'History'];
    const levels = ['Beginner', 'Intermediate', 'Advanced'];
    
    return {
      id: faker.string.uuid(),
      title: `${faker.helpers.arrayElement(subjects)} - ${faker.helpers.arrayElement(levels)}`,
      description: faker.lorem.paragraph(),
      subject: faker.helpers.arrayElement(subjects.map(s => s.toLowerCase())),
      currentLevel: faker.helpers.arrayElement(levels.map(l => l.toLowerCase())),
      targetLevel: faker.helpers.arrayElement(levels.map(l => l.toLowerCase())),
      objectives: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => faker.lorem.sentence()),
      milestones: this.generateMilestones(faker.number.int({ min: 5, max: 15 })),
      estimatedDuration: faker.number.int({ min: 30, max: 300 }), // hours
      difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
      tags: faker.helpers.arrayElements(['interactive', 'video', 'quiz', 'project', 'collaborative'], { min: 1, max: 4 }),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      isPublic: faker.datatype.boolean(0.7),
      enrollmentCount: faker.number.int({ min: 0, max: 1000 }),
      rating: faker.number.float({ min: 1, max: 5, precision: 0.1 }),
      ...overrides
    };
  }

  generateLearningPaths(count: number = this.config.defaultCount): any[] {
    return Array.from({ length: count }, () => this.generateLearningPath());
  }

  private generateMilestones(count: number): any[] {
    return Array.from({ length: count }, (_, index) => ({
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      order: index + 1,
      isCompleted: faker.datatype.boolean(0.3),
      completedAt: faker.datatype.boolean(0.3) ? faker.date.recent().toISOString() : null,
      estimatedTime: faker.number.int({ min: 30, max: 180 }), // minutes
      resources: this.generateResources(faker.number.int({ min: 1, max: 5 }))
    }));
  }

  private generateResources(count: number): any[] {
    const types = ['video', 'article', 'quiz', 'exercise', 'project'];
    
    return Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.words(4),
      type: faker.helpers.arrayElement(types),
      url: faker.internet.url(),
      duration: faker.number.int({ min: 5, max: 60 }), // minutes
      difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
      isRequired: faker.datatype.boolean(0.7)
    }));
  }

  // Progress tracking mock data
  generateProgressData(overrides: Partial<any> = {}): any {
    return {
      userId: faker.string.uuid(),
      learningPathId: faker.string.uuid(),
      overallProgress: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
      completedMilestones: faker.number.int({ min: 0, max: 20 }),
      totalMilestones: faker.number.int({ min: 10, max: 30 }),
      timeSpent: faker.number.int({ min: 60, max: 10800 }), // seconds
      lastActivity: faker.date.recent().toISOString(),
      streak: faker.number.int({ min: 0, max: 30 }),
      achievements: this.generateAchievements(faker.number.int({ min: 0, max: 10 })),
      weeklyProgress: this.generateWeeklyProgress(),
      skillLevels: this.generateSkillLevels(),
      ...overrides
    };
  }

  private generateAchievements(count: number): any[] {
    const achievements = [
      'First Steps', 'Quick Learner', 'Consistent', 'Problem Solver',
      'Collaborator', 'Mentor', 'Explorer', 'Perfectionist'
    ];
    
    return faker.helpers.arrayElements(achievements, count).map(name => ({
      id: faker.string.uuid(),
      name,
      description: faker.lorem.sentence(),
      earnedAt: faker.date.recent().toISOString(),
      icon: faker.helpers.arrayElement(['🏆', '🎯', '🚀', '⭐', '🔥', '💎'])
    }));
  }

  private generateWeeklyProgress(): any[] {
    return Array.from({ length: 7 }, (_, index) => ({
      day: faker.date.recent({ days: 7 - index }).toISOString().split('T')[0],
      timeSpent: faker.number.int({ min: 0, max: 300 }), // minutes
      milestonesCompleted: faker.number.int({ min: 0, max: 5 }),
      score: faker.number.float({ min: 0, max: 100, precision: 0.1 })
    }));
  }

  private generateSkillLevels(): Record<string, number> {
    const skills = ['problem-solving', 'critical-thinking', 'creativity', 'collaboration', 'communication'];
    const levels: Record<string, number> = {};
    
    skills.forEach(skill => {
      levels[skill] = faker.number.float({ min: 0, max: 100, precision: 0.1 });
    });
    
    return levels;
  }

  // Collaboration mock data
  generateStudyGroup(overrides: Partial<any> = {}): any {
    return {
      id: faker.string.uuid(),
      name: faker.company.name() + ' Study Group',
      description: faker.lorem.paragraph(),
      subject: faker.helpers.arrayElement(['math', 'science', 'programming', 'language']),
      maxMembers: faker.number.int({ min: 5, max: 20 }),
      currentMembers: faker.number.int({ min: 1, max: 15 }),
      isPublic: faker.datatype.boolean(0.6),
      meetingSchedule: {
        frequency: faker.helpers.arrayElement(['daily', 'weekly', 'biweekly']),
        dayOfWeek: faker.helpers.arrayElement(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
        time: faker.date.recent().toTimeString().split(' ')[0]
      },
      createdAt: faker.date.past().toISOString(),
      tags: faker.helpers.arrayElements(['beginner-friendly', 'advanced', 'project-based', 'exam-prep'], { min: 1, max: 3 }),
      ...overrides
    };
  }

  generateStudyGroups(count: number = this.config.defaultCount): any[] {
    return Array.from({ length: count }, () => this.generateStudyGroup());
  }

  // API response scenarios
  generateApiScenarios(): MockScenario[] {
    return [
      // Success scenarios
      {
        name: 'successful-response',
        description: 'Normal successful API response',
        data: {
          success: true,
          data: this.generateLearningPaths(5),
          message: 'Data retrieved successfully'
        },
        metadata: {
          responseTime: faker.number.int({ min: 100, max: 500 }),
          status: 200,
          cacheHit: false
        }
      },
      {
        name: 'cached-response',
        description: 'Fast cached response',
        data: {
          success: true,
          data: this.generateLearningPaths(5),
          message: 'Data retrieved from cache'
        },
        metadata: {
          responseTime: faker.number.int({ min: 10, max: 50 }),
          status: 200,
          cacheHit: true
        }
      },
      {
        name: 'empty-response',
        description: 'Successful response with no data',
        data: {
          success: true,
          data: [],
          message: 'No data found'
        },
        metadata: {
          responseTime: faker.number.int({ min: 100, max: 300 }),
          status: 200
        }
      },

      // Error scenarios
      {
        name: 'network-error',
        description: 'Network connectivity error',
        data: {
          success: false,
          error: 'Network error: Unable to connect to server'
        },
        metadata: {
          responseTime: faker.number.int({ min: 5000, max: 10000 }),
          status: 0,
          error: true
        }
      },
      {
        name: 'server-error',
        description: 'Internal server error',
        data: {
          success: false,
          error: 'Internal server error'
        },
        metadata: {
          responseTime: faker.number.int({ min: 1000, max: 3000 }),
          status: 500,
          error: true
        }
      },
      {
        name: 'authentication-error',
        description: 'Authentication required',
        data: {
          success: false,
          error: 'Authentication required'
        },
        metadata: {
          responseTime: faker.number.int({ min: 200, max: 500 }),
          status: 401,
          error: true
        }
      },
      {
        name: 'rate-limit-error',
        description: 'Rate limit exceeded',
        data: {
          success: false,
          error: 'Rate limit exceeded. Please try again later.'
        },
        metadata: {
          responseTime: faker.number.int({ min: 100, max: 300 }),
          status: 429,
          error: true
        }
      },
      {
        name: 'validation-error',
        description: 'Request validation failed',
        data: {
          success: false,
          error: 'Validation failed',
          details: {
            field: 'email',
            message: 'Invalid email format'
          }
        },
        metadata: {
          responseTime: faker.number.int({ min: 100, max: 300 }),
          status: 400,
          error: true
        }
      },

      // Performance scenarios
      {
        name: 'slow-response',
        description: 'Slow but successful response',
        data: {
          success: true,
          data: this.generateLearningPaths(20),
          message: 'Large dataset retrieved'
        },
        metadata: {
          responseTime: faker.number.int({ min: 3000, max: 8000 }),
          status: 200
        }
      },
      {
        name: 'timeout-error',
        description: 'Request timeout',
        data: {
          success: false,
          error: 'Request timeout'
        },
        metadata: {
          responseTime: 30000,
          status: 0,
          error: true
        }
      }
    ];
  }

  // Specialized generators for different data types
  generateAnalyticsData(): any {
    return {
      userId: faker.string.uuid(),
      sessionId: faker.string.uuid(),
      events: Array.from({ length: faker.number.int({ min: 10, max: 50 }) }, () => ({
        type: faker.helpers.arrayElement(['page_view', 'click', 'scroll', 'video_play', 'quiz_complete']),
        timestamp: faker.date.recent().toISOString(),
        data: {
          element: faker.lorem.word(),
          value: faker.number.float({ min: 0, max: 100, precision: 0.1 })
        }
      })),
      metrics: {
        sessionDuration: faker.number.int({ min: 300, max: 7200 }), // seconds
        pageViews: faker.number.int({ min: 5, max: 50 }),
        interactions: faker.number.int({ min: 10, max: 100 }),
        completionRate: faker.number.float({ min: 0, max: 100, precision: 0.1 })
      }
    };
  }

  generateNotifications(count: number = 5): any[] {
    const types = ['info', 'success', 'warning', 'error'];
    const categories = ['system', 'learning', 'social', 'achievement'];
    
    return Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      type: faker.helpers.arrayElement(types),
      category: faker.helpers.arrayElement(categories),
      title: faker.lorem.words(3),
      message: faker.lorem.sentence(),
      isRead: faker.datatype.boolean(0.3),
      createdAt: faker.date.recent().toISOString(),
      actionUrl: faker.datatype.boolean(0.5) ? faker.internet.url() : null
    }));
  }

  // Utility methods
  generatePaginatedResponse<T>(
    data: T[],
    page: number = 1,
    limit: number = 10
  ): {
    success: boolean;
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  } {
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Configuration methods
  setSeed(seed: number): void {
    this.config.seed = seed;
    faker.seed(seed);
  }

  setLocale(locale: string): void {
    this.config.locale = locale;
    faker.setLocale(locale);
  }

  resetToDefaults(): void {
    if (this.config.seed) {
      faker.seed(this.config.seed);
    }
  }
}

// Singleton instance for development
export const mockDataGenerator = new MockDataGenerator();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__MOCK_DATA_GENERATOR__ = mockDataGenerator;
}