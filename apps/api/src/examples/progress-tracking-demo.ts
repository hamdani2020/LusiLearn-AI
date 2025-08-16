/**
 * Progress Tracking System Demo
 * 
 * This file demonstrates how to use the progress tracking system
 * in a real learning session scenario.
 */

import { Pool } from 'pg';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { 
  LearningSession, 
  UserInteraction, 
  AssessmentResult, 
  EngagementMetrics,
  DifficultyLevel
} from '@lusilearn/shared-types';

// Mock database pool for demo purposes
const mockPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/lusilearn_dev'
});

const progressService = new ProgressTrackingService(mockPool);

/**
 * Demo: Complete Learning Session with Progress Tracking
 */
async function demoLearningSession() {
  console.log('🎓 Starting Learning Session Demo...\n');

  // Simulate a learning session for a mathematics lesson
  const learningSession: LearningSession = {
    id: 'session-demo-123',
    userId: 'user-demo-456',
    pathId: 'path-math-101',
    contentItems: [
      'video-algebra-basics',
      'quiz-linear-equations',
      'practice-word-problems'
    ],
    duration: 2700, // 45 minutes in seconds
    interactions: [
      {
        type: 'click',
        timestamp: new Date(Date.now() - 2700000), // 45 minutes ago
        duration: 5,
        metadata: { element: 'play-button', contentId: 'video-algebra-basics' }
      },
      {
        type: 'pause',
        timestamp: new Date(Date.now() - 2400000), // 40 minutes ago
        duration: 30,
        metadata: { position: 180, contentId: 'video-algebra-basics' }
      },
      {
        type: 'replay',
        timestamp: new Date(Date.now() - 2100000), // 35 minutes ago
        duration: 60,
        metadata: { startPosition: 150, endPosition: 210 }
      },
      {
        type: 'click',
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        duration: 2,
        metadata: { element: 'next-button' }
      }
    ],
    assessmentResults: [
      {
        questionId: 'algebra-q1',
        answer: '2x + 5 = 13, x = 4',
        isCorrect: true,
        timeSpent: 45,
        attempts: 1
      },
      {
        questionId: 'algebra-q2',
        answer: '3y - 7 = 14, y = 7',
        isCorrect: true,
        timeSpent: 60,
        attempts: 1
      },
      {
        questionId: 'algebra-q3',
        answer: '4z + 2 = 18, z = 4',
        isCorrect: false,
        timeSpent: 90,
        attempts: 2
      },
      {
        questionId: 'algebra-q4',
        answer: '5a - 3 = 22, a = 5',
        isCorrect: true,
        timeSpent: 30,
        attempts: 1
      },
      {
        questionId: 'word-problem-1',
        answer: 'x = 12',
        isCorrect: true,
        timeSpent: 120,
        attempts: 1
      }
    ],
    comprehensionScore: 80, // 4 out of 5 correct
    engagementMetrics: {
      attentionScore: 85,
      interactionCount: 4,
      pauseCount: 1,
      replayCount: 1,
      completionRate: 100
    },
    createdAt: new Date(Date.now() - 2700000),
    updatedAt: new Date()
  };

  try {
    // Step 1: Update progress based on learning session
    console.log('📊 Updating progress based on learning session...');
    const progressUpdate = await progressService.updateProgress(learningSession);
    
    console.log('✅ Progress Update Created:');
    console.log(`   - Session ID: ${progressUpdate.sessionId}`);
    console.log(`   - Time Spent: ${progressUpdate.progressData.timeSpent / 60} minutes`);
    console.log(`   - Comprehension Score: ${progressUpdate.progressData.comprehensionScore}%`);
    console.log(`   - Engagement Level: ${progressUpdate.progressData.engagementLevel}%`);
    console.log(`   - Skills Improved: ${progressUpdate.progressData.skillsImproved.join(', ')}`);
    console.log('');

    // Step 2: Calculate analytics
    console.log('📈 Calculating weekly analytics...');
    const analytics = await progressService.calculateAnalytics(learningSession.userId, 'weekly');
    
    console.log('✅ Analytics Generated:');
    console.log(`   - Total Time Spent: ${analytics.metrics.totalTimeSpent} minutes`);
    console.log(`   - Sessions Completed: ${analytics.metrics.sessionsCompleted}`);
    console.log(`   - Average Session Duration: ${analytics.metrics.averageSessionDuration} minutes`);
    console.log(`   - Objectives Completed: ${analytics.metrics.objectivesCompleted}`);
    console.log(`   - Milestones Reached: ${analytics.metrics.milestonesReached}`);
    console.log(`   - Consistency Score: ${analytics.metrics.consistencyScore}%`);
    console.log('');

    console.log('🎯 Learning Insights:');
    console.log(`   - Strongest Subjects: ${analytics.insights.strongestSubjects.join(', ')}`);
    console.log(`   - Improvement Areas: ${analytics.insights.improvementAreas.join(', ')}`);
    console.log(`   - Learning Velocity: ${analytics.insights.learningVelocity} objectives/week`);
    console.log(`   - Retention Rate: ${analytics.insights.retentionRate}%`);
    console.log('');

    console.log('🔮 Predictions:');
    console.log(`   - Goal Completion Probability: ${analytics.predictions.goalCompletionProbability}%`);
    console.log(`   - Suggested Focus Areas: ${analytics.predictions.suggestedFocusAreas.join(', ')}`);
    console.log(`   - Risk Factors: ${analytics.predictions.riskFactors.join(', ') || 'None'}`);
    console.log('');

    // Step 3: Check milestone completion
    console.log('🏆 Checking milestone completion...');
    const milestoneAchievement = await progressService.trackMilestone(
      learningSession.userId, 
      learningSession.pathId, 
      'milestone-algebra-basics'
    );

    if (milestoneAchievement) {
      console.log('🎉 Milestone Achievement Awarded!');
      console.log(`   - Title: ${milestoneAchievement.title}`);
      console.log(`   - Description: ${milestoneAchievement.description}`);
      console.log(`   - Points: ${milestoneAchievement.points}`);
      console.log(`   - Type: ${milestoneAchievement.type}`);
    } else {
      console.log('⏳ Milestone not yet completed');
    }
    console.log('');

    // Step 4: Get visualization data
    console.log('📊 Generating progress visualization data...');
    const visualizationData = await progressService.getProgressVisualizationData(
      learningSession.userId, 
      learningSession.pathId
    );

    console.log('✅ Visualization Data Generated:');
    console.log(`   - Overall Progress: ${visualizationData.overallProgress.percentage}%`);
    console.log(`   - Completed Objectives: ${visualizationData.overallProgress.completedObjectives}/${visualizationData.overallProgress.totalObjectives}`);
    console.log(`   - Milestones: ${visualizationData.milestoneProgress.length} total`);
    console.log(`   - Skills Tracked: ${visualizationData.skillProgression.length}`);
    console.log(`   - Time Series Data Points: ${visualizationData.timeSeriesData.length}`);
    console.log(`   - Total Achievements: ${visualizationData.achievements.length}`);
    console.log(`   - Active Streaks: ${visualizationData.streaks.length}`);
    console.log('');

    // Step 5: Get user achievements
    console.log('🏅 Retrieving user achievements...');
    const achievements = await progressService.getUserAchievements(learningSession.userId);

    console.log('✅ User Achievements:');
    achievements.forEach((achievement, index) => {
      console.log(`   ${index + 1}. ${achievement.title} (${achievement.points} points)`);
      console.log(`      Type: ${achievement.type}`);
      console.log(`      Earned: ${achievement.earnedAt.toLocaleDateString()}`);
    });

    if (achievements.length === 0) {
      console.log('   No achievements yet - keep learning!');
    }

    console.log('\n🎓 Learning Session Demo Completed Successfully! 🎉');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Demo: Real-time Progress Updates
 */
async function demoRealTimeUpdates() {
  console.log('\n⚡ Real-time Progress Updates Demo...\n');

  const userId = 'user-realtime-789';
  const pathId = 'path-science-101';

  // Simulate multiple quick learning interactions
  const quickSessions = [
    {
      duration: 300, // 5 minutes
      comprehensionScore: 75,
      engagementLevel: 80,
      skillsImproved: ['chemistry-basics']
    },
    {
      duration: 450, // 7.5 minutes
      comprehensionScore: 85,
      engagementLevel: 90,
      skillsImproved: ['chemistry-basics', 'periodic-table']
    },
    {
      duration: 600, // 10 minutes
      comprehensionScore: 90,
      engagementLevel: 95,
      skillsImproved: ['periodic-table', 'chemical-bonds']
    }
  ];

  for (let i = 0; i < quickSessions.length; i++) {
    const sessionData = quickSessions[i];
    console.log(`📚 Processing learning session ${i + 1}/3...`);
    
    const mockSession: LearningSession = {
      id: `quick-session-${i + 1}`,
      userId,
      pathId,
      contentItems: [`content-${i + 1}`],
      duration: sessionData.duration,
      interactions: [],
      assessmentResults: [],
      comprehensionScore: sessionData.comprehensionScore,
      engagementMetrics: {
        attentionScore: sessionData.engagementLevel,
        interactionCount: 5,
        pauseCount: 0,
        replayCount: 0,
        completionRate: 100
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const progressUpdate = await progressService.updateProgress(mockSession);
      console.log(`   ✅ Session ${i + 1}: ${sessionData.comprehensionScore}% comprehension, ${sessionData.duration/60}min`);
      
      // Simulate real-time delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`   ❌ Session ${i + 1} failed:`, error);
    }
  }

  console.log('\n📊 Final analytics after all sessions...');
  try {
    const finalAnalytics = await progressService.calculateAnalytics(userId, 'daily');
    console.log(`   - Total Time: ${finalAnalytics.metrics.totalTimeSpent} minutes`);
    console.log(`   - Average Comprehension: ${finalAnalytics.metrics.comprehensionTrend.reduce((a, b) => a + b, 0) / finalAnalytics.metrics.comprehensionTrend.length}%`);
    console.log(`   - Skills Improved: ${finalAnalytics.metrics.skillsImproved}`);
  } catch (error) {
    console.log('   ❌ Analytics calculation failed:', error);
  }

  console.log('\n⚡ Real-time Updates Demo Completed!\n');
}

// Run the demos
async function runDemos() {
  console.log('🚀 Progress Tracking System Demonstration\n');
  console.log('=' .repeat(50));
  
  await demoLearningSession();
  await demoRealTimeUpdates();
  
  console.log('=' .repeat(50));
  console.log('✨ All demos completed successfully!');
  
  // Close database connection
  await mockPool.end();
}

// Export for use in other files or run directly
if (require.main === module) {
  runDemos().catch(console.error);
}

export { demoLearningSession, demoRealTimeUpdates };