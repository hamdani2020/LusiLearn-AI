import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'video' | 'article' | 'exercise' | 'quiz';
  duration: number;
  difficulty: string;
  source: string;
  thumbnailUrl?: string;
}

// GET /api/v1/content/recommendations/:objectiveId
router.get('/recommendations/:objectiveId', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { objectiveId } = req.params;
    const userId = req.user!.id;

    logger.info(`Fetching content recommendations for objective ${objectiveId}`, { userId });

    // Generate content recommendations based on the objective
    const recommendations = await generateContentRecommendations(objectiveId);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    logger.error('Error fetching content recommendations:', error);
    next(error);
  }
});

// GET /api/v1/content/search
router.get('/search', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { query, type, difficulty, source } = req.query;
    const userId = req.user!.id;

    logger.info(`Searching content`, { userId, query, type, difficulty, source });

    // Search for content based on query parameters
    const results = await searchContent({
      query: query as string,
      type: type as string,
      difficulty: difficulty as string,
      source: source as string
    });

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Error searching content:', error);
    next(error);
  }
});

async function generateContentRecommendations(objectiveId: string, userId?: string): Promise<ContentRecommendation[]> {
  try {
    // Get objective details from database (you'd implement this)
    const objectiveDetails = await getObjectiveDetails(objectiveId);
    
    const recommendations: ContentRecommendation[] = [];
    
    // 1. Try AI service for intelligent recommendations
    try {
      const aiRecommendations = await getAIRecommendations(objectiveDetails, userId);
      recommendations.push(...aiRecommendations);
      logger.info('AI recommendations added', { count: aiRecommendations.length, objectiveId });
    } catch (aiError) {
      logger.warn('AI service failed, continuing with other sources', { error: aiError });
    }
    
    // 2. Get real YouTube content
    try {
      const youtubeRecommendations = await getYouTubeRecommendations(objectiveDetails);
      recommendations.push(...youtubeRecommendations);
      logger.info('YouTube recommendations added', { count: youtubeRecommendations.length, objectiveId });
    } catch (youtubeError) {
      logger.warn('YouTube service failed, continuing with other sources', { error: youtubeError });
    }
    
    // 3. Add curated educational content
    const curatedContent = await getCuratedContent(objectiveDetails);
    recommendations.push(...curatedContent);
    
    // Remove duplicates and sort by relevance
    const uniqueRecommendations = removeDuplicates(recommendations);
    const sortedRecommendations = sortByRelevance(uniqueRecommendations, objectiveDetails);
    
    // Ensure we have at least 3 recommendations
    if (sortedRecommendations.length < 3) {
      const fallbackContent = await generateFallbackContent(objectiveDetails);
      sortedRecommendations.push(...fallbackContent.slice(0, 5 - sortedRecommendations.length));
    }

    logger.info('Content recommendations generated', { 
      total: sortedRecommendations.length,
      objectiveId,
      types: sortedRecommendations.map(r => r.type)
    });

    return sortedRecommendations.slice(0, 8); // Return top 8 recommendations

  } catch (error) {
    logger.error('Error generating content recommendations', { error, objectiveId });
    
    // Final fallback
    const objectiveDetails = await getObjectiveDetails(objectiveId);
    return generateFallbackContent(objectiveDetails);
  }
}

// Get AI-powered recommendations
async function getAIRecommendations(objectiveDetails: any, userId?: string): Promise<ContentRecommendation[]> {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  
  const requestBody = {
    user_id: userId || 'anonymous',
    learning_objectives: [objectiveDetails.title, objectiveDetails.description],
    content_preferences: {
      content_types: ['video', 'article', 'exercise'],
      difficulty_levels: [objectiveDetails.difficulty || 'beginner', 'intermediate'],
      max_duration: 45,
      languages: ['en'],
      sources: ['youtube', 'mdn', 'codepen']
    }
  };

  const response = await fetch(`${aiServiceUrl}/api/v1/recommendations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`AI service responded with status: ${response.status}`);
  }

  const aiResult = await response.json();
  
  return (aiResult.recommendations || []).map((rec: any) => ({
    id: rec.content_id,
    title: rec.title,
    description: rec.description,
    url: rec.url,
    type: mapContentType(rec.content_type),
    duration: rec.estimated_duration,
    difficulty: rec.difficulty_level,
    source: rec.source,
    thumbnailUrl: rec.content_type === 'video' ? extractYouTubeThumbnail(rec.url) : undefined
  }));
}

// Get YouTube recommendations using the existing YouTube service
async function getYouTubeRecommendations(objectiveDetails: any): Promise<ContentRecommendation[]> {
  try {
    const { YouTubeService } = await import('../services/external/youtube.service');
    const youtubeService = new YouTubeService();
    
    // Search for educational videos related to the objective
    const searchQuery = `${objectiveDetails.title} tutorial ${objectiveDetails.difficulty || 'beginner'}`;
    
    const videos = await youtubeService.searchVideos({
      query: searchQuery,
      maxResults: 8,
      order: 'relevance',
      duration: 'medium' // 4-20 minutes, good for educational content
    });
    
    logger.info('YouTube videos found', { count: videos.length, query: searchQuery });
    
    return videos.map(video => ({
      id: `youtube-${video.id}`,
      title: video.title,
      description: video.description.length > 200 
        ? video.description.substring(0, 200) + '...' 
        : video.description,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      type: 'video' as const,
      duration: Math.ceil(video.duration / 60), // Convert seconds to minutes
      difficulty: objectiveDetails.difficulty || 'beginner',
      source: `YouTube - ${video.channelTitle}`,
      thumbnailUrl: video.thumbnailUrl
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('YouTube service failed', { error: message });
    return [];
  }
}

// Get curated educational content from known sources
async function getCuratedContent(objectiveDetails: any): Promise<ContentRecommendation[]> {
  const topic = objectiveDetails.title.toLowerCase();
  const curatedSources = [];
  
  // MDN Documentation (for JavaScript topics)
  if (topic.includes('javascript') || topic.includes('js')) {
    curatedSources.push({
      id: `mdn-${Date.now()}`,
      title: `${objectiveDetails.title} - MDN Web Docs`,
      description: `Comprehensive documentation for ${objectiveDetails.title.toLowerCase()} from Mozilla Developer Network`,
      url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(objectiveDetails.title)}`,
      type: 'article' as const,
      duration: 20,
      difficulty: 'intermediate',
      source: 'MDN Web Docs'
    });
  }
  
  // W3Schools (for web development topics)
  if (topic.includes('javascript') || topic.includes('html') || topic.includes('css')) {
    curatedSources.push({
      id: `w3schools-${Date.now()}`,
      title: `${objectiveDetails.title} - W3Schools Tutorial`,
      description: `Interactive tutorial for ${objectiveDetails.title.toLowerCase()} with examples and exercises`,
      url: `https://www.w3schools.com/js/`,
      type: 'article' as const,
      duration: 15,
      difficulty: 'beginner',
      source: 'W3Schools'
    });
  }
  
  // CodePen exercises
  curatedSources.push({
    id: `codepen-${Date.now()}`,
    title: `${objectiveDetails.title} - Interactive Examples`,
    description: `Hands-on coding examples and exercises for ${objectiveDetails.title.toLowerCase()}`,
    url: `https://codepen.io/search/pens?q=${encodeURIComponent(objectiveDetails.title)}`,
    type: 'exercise' as const,
    duration: 30,
    difficulty: objectiveDetails.difficulty || 'beginner',
    source: 'CodePen'
  });
  
  return curatedSources;
}

// Helper function to get objective details
async function getObjectiveDetails(objectiveId: string): Promise<any> {
  // This would typically query the database
  // For now, return mock data based on objective ID patterns
  const topicMap: Record<string, any> = {
    'obj-1': { title: 'JavaScript Variables', description: 'Learn about variables and data types', difficulty: 'beginner' },
    'obj-2': { title: 'JavaScript Functions', description: 'Master function declarations and expressions', difficulty: 'intermediate' },
    'obj-3': { title: 'JavaScript Objects Arrays', description: 'Work with complex data structures', difficulty: 'intermediate' },
    'jsf-1': { title: 'JavaScript Basics', description: 'Introduction to JavaScript syntax', difficulty: 'beginner' },
    'jsf-2': { title: 'JavaScript Control Structures', description: 'Learn conditionals and loops', difficulty: 'beginner' },
    'jsf-3': { title: 'JavaScript Functions Methods', description: 'Understanding functions and methods', difficulty: 'intermediate' },
    'js-1': { title: 'JavaScript Variables Data Types', description: 'Variables, data types, and operators', difficulty: 'beginner' },
    'js-2': { title: 'JavaScript Functions Scope', description: 'Functions, scope, and closures', difficulty: 'intermediate' },
    'js-3': { title: 'JavaScript Objects Arrays', description: 'Objects, arrays, and methods', difficulty: 'intermediate' },
    'js-4': { title: 'JavaScript DOM Manipulation', description: 'Interact with HTML elements', difficulty: 'advanced' }
  };

  return topicMap[objectiveId] || {
    title: 'Programming Fundamentals',
    description: 'Basic programming concepts',
    difficulty: 'beginner'
  };
}

// Helper function to map AI service content types to our types
function mapContentType(aiType: string): 'video' | 'article' | 'exercise' | 'quiz' {
  const typeMap: Record<string, 'video' | 'article' | 'exercise' | 'quiz'> = {
    'video': 'video',
    'article': 'article',
    'tutorial': 'article',
    'exercise': 'exercise',
    'interactive': 'exercise',
    'quiz': 'quiz',
    'assessment': 'quiz'
  };
  
  return typeMap[aiType] || 'article';
}

// Helper function to extract YouTube thumbnail
function extractYouTubeThumbnail(url: string): string | undefined {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(youtubeRegex);
  
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
  }
  
  return undefined;
}

// Remove duplicate recommendations
function removeDuplicates(recommendations: ContentRecommendation[]): ContentRecommendation[] {
  const seen = new Set();
  return recommendations.filter(rec => {
    const key = `${rec.title}-${rec.source}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Sort recommendations by relevance and quality
function sortByRelevance(recommendations: ContentRecommendation[], objectiveDetails: any): ContentRecommendation[] {
  return recommendations.sort((a, b) => {
    // Prioritize by type: video > exercise > article > quiz
    const typeOrder = { video: 4, exercise: 3, article: 2, quiz: 1 };
    const aTypeScore = typeOrder[a.type] || 0;
    const bTypeScore = typeOrder[b.type] || 0;
    
    if (aTypeScore !== bTypeScore) {
      return bTypeScore - aTypeScore;
    }
    
    // Prioritize educational sources
    const educationalSources = ['YouTube - freeCodeCamp.org', 'MDN Web Docs', 'YouTube - Traversy Media'];
    const aIsEducational = educationalSources.some(source => a.source.includes(source));
    const bIsEducational = educationalSources.some(source => b.source.includes(source));
    
    if (aIsEducational && !bIsEducational) return -1;
    if (!aIsEducational && bIsEducational) return 1;
    
    // Prefer appropriate duration (10-30 minutes for most content)
    const aGoodDuration = a.duration >= 10 && a.duration <= 30;
    const bGoodDuration = b.duration >= 10 && b.duration <= 30;
    
    if (aGoodDuration && !bGoodDuration) return -1;
    if (!aGoodDuration && bGoodDuration) return 1;
    
    return 0;
  });
}

// Fallback content generation
async function generateFallbackContent(objectiveDetails: any): Promise<ContentRecommendation[]> {
  const topic = objectiveDetails.title;
  
  return [
    {
      id: `fallback-video-${Date.now()}`,
      title: `${topic} - Complete Tutorial`,
      description: `Comprehensive video tutorial covering ${topic.toLowerCase()} with practical examples`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial')}`,
      type: 'video',
      duration: 25,
      difficulty: objectiveDetails.difficulty || 'beginner',
      source: 'YouTube'
    },
    {
      id: `fallback-article-${Date.now()}`,
      title: `${topic} - MDN Documentation`,
      description: `Official documentation and examples for ${topic.toLowerCase()}`,
      url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}`,
      type: 'article',
      duration: 15,
      difficulty: 'intermediate',
      source: 'MDN Web Docs'
    },
    {
      id: `fallback-exercise-${Date.now()}`,
      title: `${topic} - Practice Exercises`,
      description: `Hands-on coding exercises to practice ${topic.toLowerCase()}`,
      url: `https://codepen.io/search/pens?q=${encodeURIComponent(topic)}`,
      type: 'exercise',
      duration: 30,
      difficulty: objectiveDetails.difficulty || 'beginner',
      source: 'CodePen'
    }
  ];
}

async function searchContent(params: {
  query?: string;
  type?: string;
  difficulty?: string;
  source?: string;
}): Promise<ContentRecommendation[]> {
  // Mock search implementation
  const allContent = await generateContentRecommendations('general');

  let results = allContent;

  if (params.type) {
    results = results.filter(item => item.type === params.type);
  }

  if (params.difficulty) {
    results = results.filter(item => item.difficulty === params.difficulty);
  }

  if (params.source) {
    results = results.filter(item => item.source.toLowerCase().includes(params.source!.toLowerCase()));
  }

  if (params.query) {
    results = results.filter(item =>
      item.title.toLowerCase().includes(params.query!.toLowerCase()) ||
      item.description.toLowerCase().includes(params.query!.toLowerCase())
    );
  }

  return results;
}

export { router as contentRecommendationsRouter };