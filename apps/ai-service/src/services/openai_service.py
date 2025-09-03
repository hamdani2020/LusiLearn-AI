"""
OpenAI service with error handling and fallback mechanisms.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import openai
from openai import AsyncOpenAI
import redis.asyncio as redis

from ..config import settings
from ..models.ai_models import (
    LearningPathRequest,
    ContentRecommendationRequest,
    AIResponse,
    EmbeddingRequest
)
from ..utils.exceptions import AIServiceError, OpenAIError, RateLimitError

logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for OpenAI API interactions with error handling and fallbacks."""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            timeout=settings.OPENAI_TIMEOUT,
            max_retries=settings.OPENAI_MAX_RETRIES
        )
        self.redis_client = None
        self._rate_limit_tracker = {}
        
    async def initialize(self):
        """Initialize Redis connection for caching."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                db=settings.REDIS_DB,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                socket_timeout=settings.REDIS_TIMEOUT
            )
            await self.redis_client.ping()
            logger.info("OpenAI service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI service: {e}")
            raise AIServiceError(f"OpenAI service initialization failed: {e}")
    
    async def close(self):
        """Close connections."""
        if self.redis_client:
            await self.redis_client.close()
    
    async def _test_api_connection(self) -> bool:
        """Test OpenAI API connection with a simple request."""
        try:
            # Make a simple test request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello"}
                ],
                max_tokens=10,
                temperature=0.1
            )
            return bool(response and response.get("content"))
        except Exception as e:
            logger.warning(f"OpenAI API test failed: {e}")
            return False
    
    async def generate_learning_path(
        self, 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Generate personalized learning path using OpenAI."""
        cache_key = f"learning_path:{request.user_id}:{hash(str(request.dict()))}"
        
        try:
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
            
            # Make OpenAI request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational AI that creates personalized learning paths."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )
            
            result = self._parse_learning_path_response(response)
            
            # Cache result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result, settings.FALLBACK_CACHE_TTL)
            
            return result
            
        except RateLimitError:
            logger.warning("Rate limit exceeded, using fallback")
            return await self._get_fallback_learning_path(request)
        except Exception as e:
            logger.error(f"Error generating learning path: {e}")
            if settings.ENABLE_FALLBACKS:
                return await self._get_fallback_learning_path(request)
            raise OpenAIError(f"Failed to generate learning path: {e}")
    
    async def get_content_recommendations(
        self, 
        request: ContentRecommendationRequest
    ) -> List[Dict[str, Any]]:
        """Get content recommendations using OpenAI."""
        cache_key = f"recommendations:{request.user_id}:{hash(str(request.dict()))}"
        
        try:
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
            
            # Make OpenAI request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational content curator that recommends learning materials."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.5
            )
            
            result = self._parse_recommendation_response(response)
            
            # Cache result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result, settings.FALLBACK_CACHE_TTL)
            
            return result
            
        except RateLimitError:
            logger.warning("Rate limit exceeded, using fallback recommendations")
            return await self._get_fallback_recommendations(request)
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            if settings.ENABLE_FALLBACKS:
                return await self._get_fallback_recommendations(request)
            raise OpenAIError(f"Failed to get recommendations: {e}")
    
    async def create_embeddings(
        self, 
        texts: List[str], 
        model: str = "text-embedding-ada-002"
    ) -> List[List[float]]:
        """Create embeddings for text content."""
        try:
            # Check rate limits
            await self._check_rate_limits("embeddings")
            
            # Process in batches
            embeddings = []
            for i in range(0, len(texts), settings.EMBEDDING_BATCH_SIZE):
                batch = texts[i:i + settings.EMBEDDING_BATCH_SIZE]
                
                response = await self.client.embeddings.create(
                    input=batch,
                    model=model
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                embeddings.extend(batch_embeddings)
                
                # Small delay to avoid rate limits
                if len(texts) > settings.EMBEDDING_BATCH_SIZE:
                    await asyncio.sleep(0.1)
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Error creating embeddings: {e}")
            raise OpenAIError(f"Failed to create embeddings: {e}")
    
    async def _make_openai_request(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> str:
        """Make request to OpenAI with error handling."""
        try:
            response = await self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response.choices[0].message.content
            
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit exceeded: {e}")
            raise RateLimitError("OpenAI rate limit exceeded")
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise OpenAIError(f"OpenAI API error: {e}")
        except Exception as e:
            logger.error(f"Unexpected OpenAI error: {e}")
            raise OpenAIError(f"Unexpected error: {e}")
    
    async def _check_rate_limits(self, operation: str):
        """Check and enforce rate limits."""
        now = datetime.now()
        key = f"{operation}_{now.minute}"
        
        if key not in self._rate_limit_tracker:
            self._rate_limit_tracker[key] = 0
        
        # Simple rate limiting (adjust based on your OpenAI plan)
        limits = {
            "learning_path": 10,  # per minute
            "recommendations": 20,  # per minute
            "embeddings": 100,  # per minute
        }
        
        if self._rate_limit_tracker[key] >= limits.get(operation, 10):
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
        
        Format the response as JSON with clear structure.
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
        Format as JSON array.
        """
    
    def _parse_learning_path_response(self, response: str) -> Dict[str, Any]:
        """Parse OpenAI response for learning path."""
        try:
            import json
            # Try to extract JSON from response
            start = response.find('{')
            end = response.rfind('}') + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                return json.loads(json_str)
            else:
                # Fallback: create structured response from text
                return {
                    "objectives": ["Parse and structure the learning content"],
                    "timeline": "4-6 weeks",
                    "content": response,
                    "source": "openai_text_fallback"
                }
        except Exception as e:
            logger.error(f"Error parsing learning path response: {e}")
            return {
                "objectives": ["Review learning materials"],
                "timeline": "4-6 weeks", 
                "content": response,
                "source": "openai_parse_error"
            }
    
    def _parse_recommendation_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse OpenAI response for recommendations."""
        try:
            import json
            # Try to extract JSON from response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start != -1 and end != 0:
                json_str = response[start:end]
                return json.loads(json_str)
            else:
                # Fallback: create basic recommendation structure
                return [{
                    "title": "Educational Content",
                    "description": response[:200] + "...",
                    "difficulty": "intermediate",
                    "duration": "30 minutes",
                    "format": "mixed",
                    "source": "openai_text_fallback"
                }]
        except Exception as e:
            logger.error(f"Error parsing recommendation response: {e}")
            return [{
                "title": "Learning Resource",
                "description": "Educational content recommendation",
                "difficulty": "intermediate",
                "duration": "30 minutes",
                "format": "mixed",
                "source": "openai_parse_error"
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
        """Provide fallback learning path when OpenAI is unavailable."""
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
        
        path["source"] = "fallback"
        path["user_id"] = request.user_id
        path["subject"] = request.subject
        
        return path
    
    async def _get_fallback_recommendations(self, request: ContentRecommendationRequest) -> List[Dict[str, Any]]:
        """Provide fallback recommendations when OpenAI is unavailable."""
        logger.info(f"Using fallback recommendations for {request.current_topic}")
        
        # Basic fallback recommendations
        return [
            {
                "title": f"Introduction to {request.current_topic}",
                "description": f"Foundational concepts in {request.current_topic}",
                "difficulty": request.skill_level,
                "duration": "30 minutes",
                "format": "video",
                "source": "fallback"
            },
            {
                "title": f"{request.current_topic} Practice Exercises",
                "description": f"Hands-on practice with {request.current_topic}",
                "difficulty": request.skill_level,
                "duration": "45 minutes", 
                "format": "interactive",
                "source": "fallback"
            },
            {
                "title": f"Advanced {request.current_topic} Concepts",
                "description": f"Deep dive into {request.current_topic}",
                "difficulty": "intermediate",
                "duration": "60 minutes",
                "format": "article",
                "source": "fallback"
            }
        ]

    async def generate_peer_matches(
        self, 
        user_profile: Dict[str, Any], 
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate peer matches using OpenAI."""
        cache_key = f"peer_matches:{user_profile.get('id', 'unknown')}:{hash(str(criteria))}"
        
        try:
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached peer matches for user {user_profile.get('id', 'unknown')}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("peer_matching")
            
            # Prepare prompt
            prompt = self._build_peer_matching_prompt(user_profile, criteria)
            
            # Make OpenAI request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are an expert at matching learners with compatible study partners."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )
            
            if not response or not response.get("content"):
                raise AIServiceError("Empty response from OpenAI API")
            
            # Parse and structure the response
            result = self._parse_peer_matches_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated peer matches for user {user_profile.get('id', 'unknown')} using OpenAI")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate peer matches with OpenAI: {e}")
            raise AIServiceError(f"Peer matching failed: {e}")
    
    async def generate_skill_assessment_questions(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate skill assessment questions using OpenAI."""
        cache_key = f"skill_assessment:{request.get('user_id', 'unknown')}:{hash(str(request))}"
        
        try:
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached skill assessment questions for user {request.get('user_id', 'unknown')}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("skill_assessment")
            
            # Prepare prompt
            prompt = self._build_skill_assessment_prompt(request)
            
            # Make OpenAI request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational assessment designer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )
            
            if not response or not response.get("content"):
                raise AIServiceError("Empty response from OpenAI API")
            
            # Parse and structure the response
            result = self._parse_skill_assessment_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated skill assessment questions for user {request.get('user_id', 'unknown')} using OpenAI")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate skill assessment questions with OpenAI: {e}")
            raise AIServiceError(f"Skill assessment generation failed: {e}")
    
    async def evaluate_skill_assessment(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate skill assessment answers using OpenAI."""
        cache_key = f"skill_evaluation:{request.get('user_id', 'unknown')}:{hash(str(request))}"
        
        try:
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached skill assessment evaluation for user {request.get('user_id', 'unknown')}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("skill_evaluation")
            
            # Prepare prompt
            prompt = self._build_skill_evaluation_prompt(request)
            
            # Make OpenAI request
            response = await self._make_openai_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational assessment evaluator."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )
            
            if not response or not response.get("content"):
                raise AIServiceError("Empty response from OpenAI API")
            
            # Parse and structure the response
            result = self._parse_skill_evaluation_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Evaluated skill assessment for user {request.get('user_id', 'unknown')} using OpenAI")
            return result
            
        except Exception as e:
            logger.error(f"Failed to evaluate skill assessment with OpenAI: {e}")
            raise AIServiceError(f"Skill assessment evaluation failed: {e}")
    
    def _build_peer_matching_prompt(self, user_profile: Dict[str, Any], criteria: Dict[str, Any]) -> str:
        """Build prompt for peer matching."""
        return f"""
        Find compatible study partners for a student with the following profile:
        
        User Profile:
        - Age: {user_profile.get('demographics', {}).get('ageRange', 'Unknown')}
        - Education Level: {user_profile.get('demographics', {}).get('educationLevel', 'Unknown')}
        - Learning Style: {', '.join(user_profile.get('learningPreferences', {}).get('learningStyle', []))}
        - Subjects: {', '.join(criteria.get('subjects', []))}
        - Goals: {', '.join(criteria.get('goals', []))}
        
        Please provide:
        1. A list of compatible study partners
        2. Compatibility score and reasoning
        3. Suggested collaboration activities
        
        Format the response as JSON with the following structure:
        {{
            "matches": [
                {{
                    "compatibility_score": "Score from 1-10",
                    "reasoning": "Why this match is good",
                    "suggested_activities": ["activity1", "activity2"],
                    "common_interests": ["interest1", "interest2"]
                }}
            ]
        }}
        """
    
    def _build_skill_assessment_prompt(self, request: Dict[str, Any]) -> str:
        """Build prompt for skill assessment question generation."""
        return f"""
        Create skill assessment questions for a student with the following profile:
        
        User ID: {request.get('user_id', 'unknown')}
        Subject: {request.get('subject', 'general')}
        Education Level: {request.get('education_level', 'high_school')}
        Learning Style: {', '.join(request.get('learning_style', ['visual', 'auditory']))}
        Current Level: {request.get('current_level', 'beginner')}
        Number of Questions: {request.get('num_questions', 10)}
        
        Please create a variety of question types:
        1. Multiple choice questions
        2. True/false questions
        3. Rating scale questions (1-5)
        4. Open-ended questions
        
        Format the response as JSON with the following structure:
        {{
            "questions": [
                {{
                    "question": "Question text",
                    "type": "multiple_choice/true_false/rating/text",
                    "category": "subject category",
                    "difficulty": "beginner/intermediate/advanced",
                    "options": ["option1", "option2", "option3", "option4"],
                    "correct_answer": "correct option or answer"
                }}
            ]
        }}
        """
    
    def _build_skill_evaluation_prompt(self, request: Dict[str, Any]) -> str:
        """Build prompt for skill assessment evaluation."""
        return f"""
        Evaluate the skill assessment answers for a student:
        
        User ID: {request.get('user_id', 'unknown')}
        Answers: {request.get('answers', {})}
        
        Please analyze the responses and provide:
        1. Overall skill level assessment
        2. Strengths and areas for improvement
        3. Personalized recommendations
        
        Format the response as JSON with the following structure:
        {{
            "overall_score": "Percentage score (0-100)",
            "category_scores": {{
                "category1": "score1",
                "category2": "score2"
            }},
            "recommended_level": "beginner/intermediate/advanced",
            "strengths": ["strength1", "strength2"],
            "areas_for_improvement": ["area1", "area2"],
            "confidence": "confidence score (0-1)",
            "completed_at": "timestamp"
        }}
        """
    
    def _parse_peer_matches_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse the peer matches response from OpenAI."""
        try:
            import json
            import re
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data.get("matches", [])
            else:
                return [{"compatibility_score": "5", "reasoning": content}]
        except Exception as e:
            logger.warning(f"Failed to parse peer matches response: {e}")
            return [{"compatibility_score": "5", "reasoning": content}]
    
    def _parse_skill_assessment_response(self, content: str) -> Dict[str, Any]:
        """Parse the skill assessment response from OpenAI."""
        try:
            import json
            import re
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return data
            else:
                # Fallback: return basic structure
                return {
                    "questions": [
                        {
                            "question": "How would you rate your comfort level with this subject?",
                            "type": "rating",
                            "category": "general",
                            "difficulty": "beginner"
                        }
                    ]
                }
        except Exception as e:
            logger.warning(f"Failed to parse skill assessment response: {e}")
            return {
                "questions": [
                    {
                        "question": "How would you rate your comfort level with this subject?",
                        "type": "rating",
                        "category": "general",
                        "difficulty": "beginner"
                    }
                ]
            }
    
    def _parse_skill_evaluation_response(self, content: str) -> Dict[str, Any]:
        """Parse the skill evaluation response from OpenAI."""
        try:
            import json
            import re
            from datetime import datetime
            
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                # Ensure required fields are present
                data.setdefault("overall_score", 50)
                data.setdefault("category_scores", {})
                data.setdefault("recommended_level", "beginner")
                data.setdefault("strengths", [])
                data.setdefault("areas_for_improvement", [])
                data.setdefault("confidence", 0.7)
                data.setdefault("completed_at", datetime.now().isoformat())
                return data
            else:
                # Fallback: return basic evaluation
                return {
                    "overall_score": 50,
                    "category_scores": {"general": 50},
                    "recommended_level": "beginner",
                    "strengths": ["Willingness to learn"],
                    "areas_for_improvement": ["Complete the assessment for better recommendations"],
                    "confidence": 0.5,
                    "completed_at": datetime.now().isoformat()
                }
        except Exception as e:
            logger.warning(f"Failed to parse skill evaluation response: {e}")
            return {
                "overall_score": 50,
                "category_scores": {"general": 50},
                "recommended_level": "beginner",
                "strengths": ["Willingness to learn"],
                "areas_for_improvement": ["Complete the assessment for better recommendations"],
                "confidence": 0.5,
                "completed_at": datetime.now().isoformat()
            }