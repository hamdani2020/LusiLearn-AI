// Export all custom hooks
export { useLearningPaths } from './use-learning-paths';
export { useProgressTracking } from './use-progress-tracking';
export { useAssessments } from './use-assessments';
export { useCollaboration } from './use-collaboration';
export { useAdaptiveDifficulty } from './use-adaptive-difficulty';
export { useSafetyModeration } from './use-safety-moderation';
export { useMonitoring } from './use-monitoring';

// Re-export existing hooks (excluding duplicates)
export { 
  useLearningPath, 
  useCreateLearningPath, 
  useUpdateProgress, 
  useContentRecommendations 
} from './use-learning-data'; 