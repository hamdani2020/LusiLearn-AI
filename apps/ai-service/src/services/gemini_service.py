"""
Google Gemini service with error handling and fallback mechanisms.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import redis.asyncio as redis

try:
    import google.generativeai as genai
    from google.generativeai.types import HarmCategory, HarmBlockThreshold
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    genai = None

from ..config import settings
from ..models.ai_models import (
    LearningPathRequest,
    ContentRecommendationRequest,
    AIResponse,
    EmbeddingRequest
)
from ..utils.exceptions import AIServiceError, RateLimitError

logger = logging.getLogger(__name__)


class GeminiService:
    """Service for Google Gemini AI interactions with error handling and fallbacks."""
    
    def __init__(self):
        self.client = None
        self.model = None
        self.redis_client = None
        self._rate_limit_tracker = {}
        
    async def initialize(self):
        """Initialize Gemini client and Redis connection."""
        try:
            if not GEMINI_AVAILABLE:
                logger.warning("Gemini not available - service will run in fallback mode")
                return
                
            if not settings.GEMINI_API_KEY:
                logger.warning("Gemini API key not configured - service will run in fallback mode")
                return
            
            # Configure Gemini
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            # Initialize model with safety settings
            self.model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                safety_settings={
                    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                }
            )
            
            # Initialize Redis for caching
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                db=settings.REDIS_DB,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                socket_timeout=settings.REDIS_TIMEOUT
            )
            await self.redis_client.ping()
            
            logger.info("Gemini service initialized successfully")
            
        except Exception as e:
            logger.warning(f"Failed to initialize Gemini service: {e} - running in fallback mode")
    
    async def close(self):
        """Close connections."""
        if self.redis_client:
            await self.redis_client.close()
    
    async def generate_learning_path(
        self, 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Generate personalized learning path using Gemini."""
        cache_key = f"gemini_learning_path:{request.user_id}:{hash(str(request.dict()))}"
        
        try:
            # Check if Gemini is available
            if not self.model:
                logger.warning("Gemini not available, using fallback")
                return await self._get_fallback_learning_path(request)
            
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached learning path for user {request.user_id}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("learning_path")
            
            # Prepare prompt
            prompt = self._build_learning_path_prompt(request)
            
            # Make Gemini request
            response = await self._make_gemini_request(prompt)
            
            result = self._parse_learning_path_response(response)
            
            # Cache result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result, settings.FALLBACK_CACHE_TTL)
            
            return result
            
        except RateLimitError:
            logger.warning("Rate limit exceeded, using fallback")
            return await self._get_fallback_learning_path(request)
        except Exception as e:
            logger.error(f"Error generating learning path with Gemini: {e}")
            if settings.ENABLE_FALLBACKS:
                return await self._get_fallback_learning_path(request)
            raise AIServiceError(f"Failed to generate learning path: {e}")
    
    async def get_content_recommendations(
        self, 
        request: ContentRecommendationRequest
    ) -> List[Dict[str, Any]]:
        """Get content recommendations using Gemini."""
        cache_key = f"gemini_recommendations:{request.user_id}:{hash(str(request.dict()))}"
        
        try:
            # Check if Gemini is available
            if not self.model:
                logger.warning("Gemini not available, using fallback")
                return await self._get_fallback_recommendations(request)
            
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached recommendations for user {request.user_id}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("recommendations")
            
            # Prepare prompt
            prompt = self._build_recommendation_prompt(request)
            
            # Make Gemini request
            response = await self._make_gemini_request(prompt)
            
            result = self._parse_recommendation_response(response)
            
            # Cache result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result, settings.FALLBACK_CACHE_TTL)
            
            return result
            
        except RateLimitError:
            logger.warning("Rate limit exceeded, using fallback recommendations")
            return await self._get_fallback_recommendations(request)
        except Exception as e:
            logger.error(f"Error getting recommendations with Gemini: {e}")
            if settings.ENABLE_FALLBACKS:
                return await self._get_fallback_recommendations(request)
            raise AIServiceError(f"Failed to get recommendations: {e}")
    
    async def create_embeddings(
        self, 
        texts: List[str], 
        model: str = "models/embedding-001"
    ) -> List[List[float]]:
        """Create embeddings for text content using Gemini."""
        try:
            if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
                logger.warning("Gemini not available for embeddings")
                # Return zero embeddings as fallback
                return [[0.0] * 768 for _ in texts]  # Gemini embeddings are 768-dimensional
            
            # Check rate limits
            await self._check_rate_limits("embeddings")
            
            # Process in batches
            embeddings = []
            for i in range(0, len(texts), settings.EMBEDDING_BATCH_SIZE):
                batch = texts[i:i + settings.EMBEDDING_BATCH_SIZE]
                
                batch_embeddings = []
                for text in batch:
                    try:
                        # Use Gemini's embedding model
                        result = genai.embed_content(
                            model=model,
                            content=text,
                            task_type="retrieval_document"
                        )
                        batch_embeddings.append(result['embedding'])
                    except Exception as e:
                        logger.warning(f"Failed to create embedding for text: {e}")
                        # Use zero vector as fallback
                        batch_embeddings.append([0.0] * 768)
                
                embeddings.extend(batch_embeddings)
                
                # Small delay to avoid rate limits
                if len(texts) > settings.EMBEDDING_BATCH_SIZE:
                    await asyncio.sleep(0.1)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Error creating embeddings with Gemini: {e}")
            # Return zero embeddings as fallback
            return [[0.0] * 768 for _ in texts]
    
    async def _make_gemini_request(self, prompt: str) -> str:
        """Make request to Gemini with error handling."""
        try:
            if not self.model:
                raise AIServiceError("Gemini model not initialized")
            
            # Generate content with Gemini
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=settings.GEMINI_MAX_TOKENS,
                        temperature=settings.GEMINI_TEMPERATURE,
                    )
                )
            )
            
            if not response.text:
                raise AIServiceError("Empty response from Gemini")
            
            return response.text
            
        except Exception as e:
            if "quota" in str(e).lower() or "rate" in str(e).lower():
                logger.warning(f"Gemini rate limit or quota exceeded: {e}")
                raise RateLimitError("Gemini rate limit exceeded")
            else:
                logger.error(f"Gemini API error: {e}")
                raise AIServiceError(f"Gemini API error: {e}")
    
    async def _check_rate_limits(self, operation: str):
        """Check and enforce rate limits."""
        now = datetime.now()
        key = f"gemini_{operation}_{now.minute}"
        
        if key not in self._rate_limit_tracker:
            self._rate_limit_tracker[key] = 0
        
        # Gemini rate limits (adjust based on your plan)
        limits = {
            "learning_path": 15,  # per minute
            "recommendations": 30,  # per minute
            "embeddings": 60,  # per minute
        }
        
        if self._rate_limit_tracker[key] >= limits.get(operation, 15):
            raise RateLimitError(f"Rate limit exceeded for {operation}")
        
        self._rate_limit_tracker[key] += 1
        
        # Clean old entries
        cutoff = now - timedelta(minutes=2)
        keys_to_remove = [k for k in self._rate_limit_tracker.keys() 
                         if datetime.strptime(k.split('_')[-1], "%M") < cutoff]
        for k in keys_to_remove:
            del self._rate_limit_tracker[k]
    
    def _build_learning_path_prompt(self, request: LearningPathRequest) -> str:
        """Build prompt for learning path generation."""
        return f"""
        Create a personalized learning path for a {request.education_level} student with the following profile:
        
        Subject: {request.subject}
        Current Skill Level: {request.current_level}
        Learning Goals: {', '.join(request.learning_goals)}
        Available Time: {request.time_commitment} hours per week
        Learning Style: {request.learning_style}
        
        Please provide a structured learning path with:
        1. 5-7 main learning objectives
        2. Estimated timeline for each objective
        3. Prerequisite skills needed
        4. Recommended content types
        5. Assessment milestones
        
        Format the response as JSON with clear structure. Make sure the content is age-appropriate and educationally sound.
        """
    
    def _build_recommendation_prompt(self, request: ContentRecommendationRequest) -> str:
        """Build prompt for content recommendations."""
        return f"""
        Recommend educational content for a {request.education_level} learner with:
        
        Current Topic: {request.current_topic}
        Skill Level: {request.skill_level}
        Learning Context: {request.learning_context}
        Preferred Formats: {', '.join(request.preferred_formats)}
        
        Provide 5-10 specific content recommendations including:
        1. Content title and description
        2. Difficulty level
        3. Estimated duration
        4. Learning objectives covered
        5. Content format (video, article, interactive, etc.)
        
        Focus on high-quality, age-appropriate content that builds on current knowledge.
        Format as JSON array. Ensure all recommendations are educationally valuable and safe.
        """
    
    def _parse_learning_path_response(self, response: str) -> Dict[str, Any]:
        """Parse Gemini response for learning path."""
        try:
            import json
            # Try to extract JSON from response
            start = response.find('{')
            end = response.rfind('}') + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                result = json.loads(json_str)
                result["source"] = "gemini"
                return result
            else:
                # Fallback: create structured response from text
                return {
                    "objectives": ["Parse and structure the learning content"],
                    "timeline": "4-6 weeks",
                    "content": response,
                    "source": "gemini_text_fallback"
                }
        except Exception as e:
            logger.error(f"Error parsing Gemini learning path response: {e}")
            return {
                "objectives": ["Review learning materials"],
                "timeline": "4-6 weeks", 
                "content": response,
                "source": "gemini_parse_error"
            }
    
    def _parse_recommendation_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse Gemini response for recommendations."""
        try:
            import json
            # Try to extract JSON from response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                result = json.loads(json_str)
                # Add source to each recommendation
                for item in result:
                    item["source"] = "gemini"
                return result
            else:
                # Fallback: create basic recommendation structure
                return [{
                    "title": "Educational Content",
                    "description": response[:200] + "...",
                    "difficulty": "intermediate",
                    "duration": "30 minutes",
                    "format": "mixed",
                    "source": "gemini_text_fallback"
                }]
        except Exception as e:
            logger.error(f"Error parsing Gemini recommendation response: {e}")
            return [{
                "title": "Learning Resource",
                "description": "Educational content recommendation",
                "difficulty": "intermediate",
                "duration": "30 minutes",
                "format": "mixed",
                "source": "gemini_parse_error"
            }]
    
    async def _get_cached_result(self, cache_key: str) -> Optional[Any]:
        """Get cached result from Redis."""
        try:
            if self.redis_client:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    import json
                    return json.loads(cached)
        except Exception as e:
            logger.error(f"Error getting cached result: {e}")
        return None
    
    async def _cache_result(self, cache_key: str, result: Any, ttl: int):
        """Cache result in Redis."""
        try:
            if self.redis_client:
                import json
                await self.redis_client.setex(
                    cache_key, 
                    ttl, 
                    json.dumps(result, default=str)
                )
        except Exception as e:
            logger.error(f"Error caching result: {e}")
    
    async def _get_fallback_learning_path(self, request: LearningPathRequest) -> Dict[str, Any]:
        """Provide fallback learning path when Gemini is unavailable."""
        logger.info(f"Using fallback learning path for {request.education_level} - {request.subject}")
        
        # Basic fallback structure based on education level and subject
        fallback_paths = {
            "k12": {
                "mathematics": {
                    "objectives": [
                        "Master basic arithmetic operations",
                        "Understand fractions and decimals", 
                        "Learn algebraic concepts",
                        "Practice problem-solving skills"
                    ],
                    "timeline": "8-12 weeks",
                    "difficulty_progression": "beginner -> intermediate"
                },
                "science": {
                    "objectives": [
                        "Learn scientific method",
                        "Understand basic physics concepts",
                        "Explore chemistry fundamentals",
                        "Study biology basics"
                    ],
                    "timeline": "10-14 weeks",
                    "difficulty_progression": "beginner -> intermediate"
                }
            },
            "college": {
                "computer_science": {
                    "objectives": [
                        "Learn programming fundamentals",
                        "Understand data structures",
                        "Master algorithms",
                        "Build practical projects"
                    ],
                    "timeline": "12-16 weeks", 
                    "difficulty_progression": "intermediate -> advanced"
                }
            }
        }
        
        level = request.education_level.lower()
        subject = request.subject.lower().replace(" ", "_")
        
        path = fallback_paths.get(level, {}).get(subject, {
            "objectives": [
                f"Learn {request.subject} fundamentals",
                f"Practice {request.subject} skills",
                f"Apply {request.subject} knowledge",
                f"Master {request.subject} concepts"
            ],
            "timeline": "8-12 weeks",
            "difficulty_progression": "beginner -> intermediate"
        })
        
        path["source"] = "gemini_fallback"
        path["user_id"] = request.user_id
        path["subject"] = request.subject
        
        return path
    
    async def _get_fallback_recommendations(self, request: ContentRecommendationRequest) -> List[Dict[str, Any]]:
        """Provide fallback recommendations when Gemini is unavailable."""
        logger.info(f"Using fallback recommendations for {request.current_topic}")
        
        # Basic fallback recommendations
        return [
            {
                "title": f"Introduction to {request.current_topic}",
                "description": f"Foundational concepts in {request.current_topic}",
                "difficulty": request.skill_level,
                "duration": "30 minutes",
                "format": "video",
                "source": "gemini_fallback"
            },
            {
                "title": f"{request.current_topic} Practice Exercises",
                "description": f"Hands-on practice with {request.current_topic}",
                "difficulty": request.skill_level,
                "duration": "45 minutes", 
                "format": "interactive",
                "source": "gemini_fallback"
            },
            {
                "title": f"Advanced {request.current_topic} Concepts",
                "description": f"Deep dive into {request.current_topic}",
                "difficulty": "intermediate",
                "duration": "60 minutes",
                "format": "article",
                "source": "gemini_fallback"
            }
        ]