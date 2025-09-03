/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  k12Student: {
    email: 'emma.student@test.com',
    password: 'TestPassword123!',
    firstName: 'Emma',
    lastName: 'Student',
    ageRange: '10-12',
    educationLevel: 'elementary',
    learningGoals: ['mathematics', 'science'],
    preferredLanguage: 'en',
    timezone: 'America/New_York'
  },
  highSchoolStudent: {
    email: 'alex.highschool@test.com',
    password: 'TestPassword123!',
    firstName: 'Alex',
    lastName: 'Johnson',
    ageRange: '16-18',
    educationLevel: 'high_school',
    learningGoals: ['programming', 'computer_science'],
    preferredLanguage: 'en',
    timezone: 'America/New_York'
  },
  collegeStudent: {
    email: 'sam.college@test.com',
    password: 'TestPassword123!',
    firstName: 'Sam',
    lastName: 'Wilson',
    ageRange: '18-22',
    educationLevel: 'college',
    learningGoals: ['web_development', 'data_science'],
    preferredLanguage: 'en',
    timezone: 'America/New_York'
  },
  professional: {
    email: 'jordan.dev@test.com',
    password: 'TestPassword123!',
    firstName: 'Jordan',
    lastName: 'Developer',
    ageRange: '25-35',
    educationLevel: 'professional',
    learningGoals: ['machine_learning', 'cloud_computing'],
    preferredLanguage: 'en',
    timezone: 'America/New_York'
  }
};

export const testContent = {
  mathVideo: {
    title: 'Introduction to Algebra',
    source: 'youtube',
    difficulty: 'beginner',
    subject: 'mathematics',
    duration: 600, // 10 minutes
    ageRating: 'all_ages'
  },
  programmingTutorial: {
    title: 'JavaScript Basics',
    source: 'youtube',
    difficulty: 'beginner',
    subject: 'programming',
    duration: 1200, // 20 minutes
    ageRating: 'teen_plus'
  },
  advancedCourse: {
    title: 'Machine Learning Fundamentals',
    source: 'coursera',
    difficulty: 'advanced',
    subject: 'data_science',
    duration: 3600, // 1 hour
    ageRating: 'adult'
  }
};

export const testStudyGroups = {
  mathStudyGroup: {
    name: 'Algebra Study Group',
    topic: 'mathematics',
    maxSize: 6,
    ageRestrictions: '10-18',
    description: 'A group for students learning algebra together'
  },
  codingBootcamp: {
    name: 'JavaScript Beginners',
    topic: 'programming',
    maxSize: 8,
    ageRestrictions: '16+',
    description: 'Learn JavaScript fundamentals with peers'
  }
};

export const testAssessments = {
  mathBasics: {
    subject: 'mathematics',
    questions: [
      {
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1
      },
      {
        question: 'What is 5 × 3?',
        options: ['12', '15', '18', '20'],
        correctAnswer: 1
      }
    ]
  },
  programmingBasics: {
    subject: 'programming',
    questions: [
      {
        question: 'What does HTML stand for?',
        options: [
          'Hyper Text Markup Language',
          'High Tech Modern Language',
          'Home Tool Markup Language',
          'Hyperlink and Text Markup Language'
        ],
        correctAnswer: 0
      }
    ]
  }
};