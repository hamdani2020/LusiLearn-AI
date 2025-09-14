"""
NVIDIA service with GPT-OSS model support.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from openai import AsyncOpenAI
import redis.asyncio as redis

from ..config import settings
from ..models.ai_models import (
    LearningPathRequest,
    ContentRecommendationRequest,
    AIResponse,
    EmbeddingRequest
)
from ..utils.exceptions import AIServiceError, RateLimitError

logger = logging.getLogger(__name__)


class NVIDIAService:
    """Service for NVIDIA API interactions with GPT-OSS model."""
    
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.NVIDIA_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
            timeout=settings.NVIDIA_TIMEOUT,
            max_retries=settings.NVIDIA_MAX_RETRIES
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
            logger.info("NVIDIA service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize NVIDIA service: {e}")
            raise AIServiceError(f"NVIDIA service initialization failed: {e}")
    
    async def close(self):
        """Close connections."""
        if self.redis_client:
            await self.redis_client.close()
    
    async def _test_api_connection(self) -> bool:
        """Test NVIDIA API connection with a simple request."""
        try:
            # Make a simple test request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello"}
                ],
                max_tokens=10,
                temperature=0.1
            )
            # Check for either content or reasoning (GPT-OSS models may return empty content)
            return bool(response and (response.get("content") or response.get("reasoning")))
        except Exception as e:
            logger.warning(f"NVIDIA API test failed: {e}")
            return False
    
    async def generate_learning_path(
        self, 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Generate personalized learning path using NVIDIA GPT-OSS."""
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
            
            # Make NVIDIA request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational AI that creates personalized learning paths."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.NVIDIA_MAX_TOKENS,
                temperature=settings.NVIDIA_TEMPERATURE,
                top_p=settings.NVIDIA_TOP_P
            )
            
            if not response or not response.get("content"):
                raise AIServiceError("Empty response from NVIDIA API")
            
            # Parse and structure the response
            result = self._parse_learning_path_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated learning path for user {request.user_id} using NVIDIA GPT-OSS")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate learning path with NVIDIA: {e}")
            raise AIServiceError(f"Learning path generation failed: {e}")
    
    async def generate_content_recommendations(
        self, 
        request: ContentRecommendationRequest
    ) -> List[Dict[str, Any]]:
        """Generate content recommendations using NVIDIA GPT-OSS."""
        cache_key = f"content_recs:{request.user_id}:{hash(str(request.dict()))}"
        
        try:
            # Check cache first
            if settings.ENABLE_FALLBACKS and self.redis_client:
                cached_result = await self._get_cached_result(cache_key)
                if cached_result:
                    logger.info(f"Returning cached content recommendations for user {request.user_id}")
                    return cached_result
            
            # Check rate limits
            await self._check_rate_limits("content_recommendations")
            
            # Prepare prompt
            prompt = self._build_content_recommendation_prompt(request)
            
            # Make NVIDIA request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational content curator."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.NVIDIA_MAX_TOKENS,
                temperature=settings.NVIDIA_TEMPERATURE,
                top_p=settings.NVIDIA_TOP_P
            )
            
            if not response:
                raise AIServiceError("No response from NVIDIA API")
            
            # Debug logging to see what we're getting
            logger.info(f"NVIDIA API response for content recommendations: {response}")
            
            # Check for content field
            if not response.get("content"):
                logger.warning(f"NVIDIA API returned no content. Full response: {response}")
                raise AIServiceError("Empty response from NVIDIA API")
            
            # Parse and structure the response
            result = self._parse_content_recommendations_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated content recommendations for user {request.user_id} using NVIDIA GPT-OSS")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate content recommendations with NVIDIA: {e}")
            raise AIServiceError(f"Content recommendation generation failed: {e}")
    
    async def generate_peer_matches(
        self, 
        user_profile: Dict[str, Any], 
        criteria: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate peer matches using NVIDIA GPT-OSS."""
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
            
            # Make NVIDIA request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are an expert at matching learners with compatible study partners."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.NVIDIA_MAX_TOKENS,
                temperature=settings.NVIDIA_TEMPERATURE,
                top_p=settings.NVIDIA_TOP_P
            )
            
            if not response or not response.get("content"):
                raise AIServiceError("Empty response from NVIDIA API")
            
            # Parse and structure the response
            result = self._parse_peer_matches_response(response["content"])
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated peer matches for user {user_profile.get('id', 'unknown')} using NVIDIA GPT-OSS")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate peer matches with NVIDIA: {e}")
            raise AIServiceError(f"Peer matching failed: {e}")
    
    async def generate_skill_assessment_questions(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate skill assessment questions using NVIDIA GPT-OSS."""
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
            
            # Make NVIDIA request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational assessment designer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.NVIDIA_MAX_TOKENS,
                temperature=settings.NVIDIA_TEMPERATURE,
                top_p=settings.NVIDIA_TOP_P
            )
            
            if not response or not (response.get("content") or response.get("reasoning")):
                raise AIServiceError("Empty response from NVIDIA API")
            
            # Parse and structure the response
            result = self._parse_skill_assessment_response(response.get("content") or response.get("reasoning") or "")
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Generated skill assessment questions for user {request.get('user_id', 'unknown')} using NVIDIA GPT-OSS")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate skill assessment questions with NVIDIA: {e}")
            raise AIServiceError(f"Skill assessment generation failed: {e}")
    
    async def evaluate_skill_assessment(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate skill assessment answers using NVIDIA GPT-OSS."""
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
            
            # Make NVIDIA request
            response = await self._make_nvidia_request(
                messages=[
                    {"role": "system", "content": "You are an expert educational assessment evaluator."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=settings.NVIDIA_MAX_TOKENS,
                temperature=settings.NVIDIA_TEMPERATURE,
                top_p=settings.NVIDIA_TOP_P
            )
            
            if not response or not (response.get("content") or response.get("reasoning")):
                raise AIServiceError("Empty response from NVIDIA API")
            
            # Parse and structure the response
            result = self._parse_skill_evaluation_response(response.get("content") or response.get("reasoning") or "")
            
            # Cache the result
            if settings.ENABLE_FALLBACKS and self.redis_client:
                await self._cache_result(cache_key, result)
            
            logger.info(f"Evaluated skill assessment for user {request.get('user_id', 'unknown')} using NVIDIA GPT-OSS")
            return result
            
        except Exception as e:
            logger.error(f"Failed to evaluate skill assessment with NVIDIA: {e}")
            raise AIServiceError(f"Skill assessment evaluation failed: {e}")
    
    async def _make_nvidia_request(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: int = None, 
        temperature: float = None,
        top_p: float = None
    ) -> Dict[str, Any]:
        """Make a request to NVIDIA API."""
        try:
            completion = await self.client.chat.completions.create(
                model=settings.NVIDIA_MODEL,
                messages=messages,
                temperature=temperature or settings.NVIDIA_TEMPERATURE,
                top_p=top_p or settings.NVIDIA_TOP_P,
                max_tokens=max_tokens or settings.NVIDIA_MAX_TOKENS,
                stream=False,
                extra_body={"reasoning": False}  # Turn off reasoning as requested
            )
            
            # Use standard content field (OpenAI compatible)
            content = completion.choices[0].message.content
            
            # Debug logging to see what we're getting from NVIDIA
            logger.info(f"NVIDIA raw response - content: '{content}'")
            logger.info(f"NVIDIA raw response - content length: {len(content) if content else 0}")
            
            return {
                "content": content,
                "model": completion.model,
                "usage": completion.usage.dict() if completion.usage else None
            }
            
        except Exception as e:
            logger.error(f"NVIDIA API request failed: {e}")
            raise AIServiceError(f"NVIDIA API request failed: {e}")
    
    def _build_learning_path_prompt(self, request: LearningPathRequest) -> str:
        """Build prompt for learning path generation."""
        return f"""
        Create a personalized learning path for a student with the following requirements:
        
        Subject: {request.subject}
        Education Level: {request.education_level}
        Learning Goals: {', '.join(request.learning_goals)}
        Time Commitment: {request.time_commitment} minutes per session
        Learning Style: {', '.join(request.learning_style)}
        Current Level: {request.current_level}
        
        Please provide:
        1. A structured learning path with clear objectives
        2. Estimated time for each objective
        3. Difficulty progression
        4. Recommended resources and activities
        
        Format the response as JSON with the following structure:
        {{
            "objectives": [
                {{
                    "title": "Objective title",
                    "description": "Detailed description",
                    "estimated_duration": "Duration in minutes",
                    "difficulty": "beginner/intermediate/advanced",
                    "prerequisites": ["list", "of", "prerequisites"],
                    "resources": ["list", "of", "resources"]
                }}
            ],
            "difficulty_progression": "beginner -> intermediate -> advanced",
            "total_estimated_time": "Total time in minutes"
        }}
        """
    
    def _build_content_recommendation_prompt(self, request: ContentRecommendationRequest) -> str:
        """Build prompt for content recommendation generation."""
        return f"""
        You are an expert educational content curator. Recommend 3-5 educational content items for a student with this profile:
        
        Subject: {request.current_topic}
        Education Level: {request.education_level}
        Skill Level: {request.skill_level}
        Learning Context: {request.learning_context}
        Preferred Formats: {', '.join(request.preferred_formats)}
        
        Generate 3 programming content recommendations in JSON format:
        {{
            "recommendations": [
                {{
                    "content_id": "ai-rec-{request.current_topic}-001",
                    "title": "Intermediate {request.current_topic}",
                    "description": "Learn {request.current_topic} at intermediate level",
                    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "difficulty": "intermediate",
                    "format": "video",
                    "duration_minutes": 45,
                    "topics": ["{request.current_topic}"],
                    "source": "ai_generated",
                    "relevance_score": 0.9,
                    "quality_score": 0.85
                }}
            ]
        }}
        """
    
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
    
    def _parse_learning_path_response(self, content: str) -> Dict[str, Any]:
        """Parse the learning path response from NVIDIA."""
        try:
            # Try to extract JSON from the response
            import json
            import re
            
            # Find JSON in the response
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                # Fallback: return structured text
                return {
                    "objectives": [{"title": "Learning Path", "description": content}],
                    "difficulty_progression": "beginner",
                    "total_estimated_time": "60"
                }
        except Exception as e:
            logger.warning(f"Failed to parse learning path response: {e}")
            return {
                "objectives": [{"title": "Learning Path", "description": content}],
                "difficulty_progression": "beginner",
                "total_estimated_time": "60"
            }
    
    def _parse_content_recommendations_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse the content recommendations response from NVIDIA."""
        try:
            import json
            import re
            
            # First try to parse the entire content as JSON
            try:
                data = json.loads(content.strip())
                if isinstance(data, dict) and "recommendations" in data:
                    return data["recommendations"]
            except json.JSONDecodeError:
                pass
            
            # If that fails, try to extract JSON using regex
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                    if isinstance(data, dict) and "recommendations" in data:
                        return data["recommendations"]
                except json.JSONDecodeError:
                    pass
            
            # If all parsing fails, log the content and return a fallback
            logger.warning(f"Failed to parse content recommendations response. Raw content: {content[:200]}...")
            
            # Return a meaningful fallback based on the content
            if "programming" in content.lower():
                return [
                    {
                        "content_id": "fallback-prog-001",
                        "title": "Programming Fundamentals",
                        "description": "Essential programming concepts and best practices",
                        "url": None,
                        "difficulty": "beginner",
                        "format": "video",
                        "duration_minutes": 45,
                        "topics": ["programming", "basics"],
                        "source": "ai_generated",
                        "relevance_score": 0.85,
                        "quality_score": 0.8
                    }
                ]
            else:
                return [
                    {
                        "content_id": "fallback-edu-001",
                        "title": "Educational Content",
                        "description": "Personalized learning content based on your profile",
                        "url": None,
                        "difficulty": "beginner",
                        "format": "video",
                        "duration_minutes": 30,
                        "topics": ["education", "learning"],
                        "source": "ai_generated",
                        "relevance_score": 0.8,
                        "quality_score": 0.75
                    }
                ]
                
        except Exception as e:
            logger.error(f"Failed to parse content recommendations response: {e}")
            return []
    
    def _parse_peer_matches_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse the peer matches response from NVIDIA."""
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
        """Parse the skill assessment response from NVIDIA."""
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
        """Parse the skill evaluation response from NVIDIA."""
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
    
    async def _check_rate_limits(self, operation: str):
        """Check rate limits for the operation."""
        if not self._rate_limit_tracker:
            self._rate_limit_tracker = {}
        
        current_time = datetime.now()
        if operation in self._rate_limit_tracker:
            last_request = self._rate_limit_tracker[operation]
            if (current_time - last_request).seconds < 1:  # 1 second between requests
                await asyncio.sleep(1)
        
        self._rate_limit_tracker[operation] = current_time
    
    async def _get_cached_result(self, cache_key: str) -> Optional[Any]:
        """Get cached result from Redis."""
        try:
            if self.redis_client:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    import json
                    return json.loads(cached)
        except Exception as e:
            logger.warning(f"Failed to get cached result: {e}")
        return None
    
    async def _cache_result(self, cache_key: str, result: Any):
        """Cache result in Redis."""
        try:
            if self.redis_client:
                import json
                await self.redis_client.setex(
                    cache_key,
                    settings.FALLBACK_CACHE_TTL,
                    json.dumps(result)
                )
        except Exception as e:
            logger.warning(f"Failed to cache result: {e}") 