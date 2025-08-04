"""
Unified AI service that can switch between OpenAI and Gemini providers.
"""
import logging
from typing import List, Dict, Any, Optional
from enum import Enum

from ..config import settings
from ..models.ai_models import (
    LearningPathRequest,
    ContentRecommendationRequest,
    EmbeddingRequest
)
from ..utils.exceptions import AIServiceError, ConfigurationError
from .openai_service import OpenAIService
from .gemini_service import GeminiService
from .learning_path_service import LearningPathAlgorithm
from .content_recommendation_service import ContentRecommendationEngine, RecommendationStrategy
from .peer_matching_service import PeerMatchingEngine, MatchingStrategy

logger = logging.getLogger(__name__)


class AIProvider(str, Enum):
    """AI provider enumeration."""
    OPENAI = "openai"
    GEMINI = "gemini"


class AIService:
    """Unified AI service that can switch between different AI providers."""
    
    def __init__(self):
        self.openai_service = OpenAIService()
        self.gemini_service = GeminiService()
        self.learning_path_algorithm = LearningPathAlgorithm()
        self.content_recommendation_engine = ContentRecommendationEngine()
        self.peer_matching_engine = PeerMatchingEngine()
        self.current_provider = AIProvider(settings.AI_PROVIDER.lower())
        
    async def initialize(self):
        """Initialize all AI services."""
        try:
            # Initialize both AI provider services
            await self.openai_service.initialize()
            await self.gemini_service.initialize()
            
            # Initialize content recommendation engine
            await self.content_recommendation_engine.initialize()
            
            # Initialize peer matching engine
            await self.peer_matching_engine.initialize()
            
            logger.info(f"AI service initialized with provider: {self.current_provider}")
            
        except Exception as e:
            logger.error(f"Failed to initialize AI service: {e}")
            raise AIServiceError(f"AI service initialization failed: {e}")
    
    async def close(self):
        """Close both AI services."""
        await self.openai_service.close()
        await self.gemini_service.close()
    
    def set_provider(self, provider: str):
        """Switch AI provider."""
        try:
            self.current_provider = AIProvider(provider.lower())
            logger.info(f"Switched AI provider to: {self.current_provider}")
        except ValueError:
            raise ConfigurationError(f"Invalid AI provider: {provider}. Must be 'openai' or 'gemini'")
    
    def get_current_provider(self) -> str:
        """Get current AI provider."""
        return self.current_provider.value
    
    async def generate_learning_path(
        self, 
        request: LearningPathRequest,
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate personalized learning path using AI providers with algorithmic enhancement."""
        try:
            # First, try to get AI-enhanced path from providers
            ai_result = await self._get_ai_enhanced_path(request, provider)
            
            # If AI providers are available, enhance with algorithms
            if ai_result and not ai_result.get("fallback_used"):
                logger.info("Enhancing AI-generated path with algorithms")
                return await self._enhance_path_with_algorithms(ai_result, request)
            
            # If AI providers failed, use pure algorithmic approach
            logger.info("Using algorithmic learning path generation")
            return await self.generate_algorithmic_learning_path(request)
            
        except Exception as e:
            logger.error(f"Error in learning path generation: {e}")
            
            # Final fallback to algorithmic approach
            if settings.ENABLE_FALLBACKS:
                logger.info("Using fallback algorithmic path generation")
                return await self.generate_algorithmic_learning_path(request)
            
            raise AIServiceError(f"Failed to generate learning path: {e}")
    
    async def generate_algorithmic_learning_path(
        self, 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Generate learning path using pure algorithmic approach."""
        try:
            # Convert request to user profile format
            user_profile = self._convert_request_to_profile(request)
            
            # Generate path using algorithms
            result = self.learning_path_algorithm.generate_personalized_path(
                user_profile=user_profile,
                subject=request.subject,
                learning_goals=request.learning_goals,
                time_commitment=request.time_commitment
            )
            
            # Add request metadata
            result.update({
                "ai_provider": "algorithmic",
                "generation_method": "pure_algorithm",
                "request_metadata": {
                    "education_level": request.education_level,
                    "learning_style": request.learning_style,
                    "current_level": request.current_level
                }
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Error in algorithmic path generation: {e}")
            
            # Ultimate fallback
            return self.learning_path_algorithm.create_fallback_path(
                education_level=request.education_level,
                subject=request.subject,
                learning_goals=request.learning_goals,
                time_commitment=request.time_commitment
            )
    
    async def adapt_learning_path(
        self,
        current_path: Dict[str, Any],
        performance_data: Dict[str, Any],
        user_profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Adapt learning path based on user performance."""
        try:
            logger.info(f"Adapting learning path for user {user_profile.get('user_id')}")
            
            # Convert user profile to expected format
            profile_obj = self._convert_dict_to_profile(user_profile)
            
            # Use algorithm to adapt the path
            adapted_path = self.learning_path_algorithm.adapt_path_based_on_performance(
                current_path=current_path,
                performance_data=performance_data,
                user_profile=profile_obj
            )
            
            return adapted_path
            
        except Exception as e:
            logger.error(f"Error adapting learning path: {e}")
            raise AIServiceError(f"Failed to adapt learning path: {e}")
    
    async def sequence_learning_objectives(
        self,
        objectives: List[Dict[str, Any]],
        user_completed: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Sequence learning objectives based on prerequisites."""
        try:
            return self.learning_path_algorithm.sequence_with_prerequisites(
                objectives=objectives,
                user_completed=user_completed or []
            )
            
        except Exception as e:
            logger.error(f"Error sequencing objectives: {e}")
            return objectives  # Return original order as fallback
    
    async def create_fallback_learning_path(
        self,
        education_level: str,
        subject: str,
        learning_goals: List[str] = None,
        time_commitment: int = 10
    ) -> Dict[str, Any]:
        """Create fallback learning path when all AI services are unavailable."""
        try:
            from ..models.ai_models import EducationLevel
            
            # Convert string to enum
            level_enum = EducationLevel(education_level.lower())
            
            return self.learning_path_algorithm.create_fallback_path(
                education_level=level_enum,
                subject=subject,
                learning_goals=learning_goals or [],
                time_commitment=time_commitment
            )
            
        except Exception as e:
            logger.error(f"Error creating fallback path: {e}")
            raise AIServiceError(f"Failed to create fallback path: {e}")
    
    async def _get_ai_enhanced_path(
        self, 
        request: LearningPathRequest, 
        provider: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get AI-enhanced path from providers."""
        try:
            # Use specified provider or current default
            active_provider = AIProvider(provider.lower()) if provider else self.current_provider
            
            if active_provider == AIProvider.OPENAI:
                result = await self.openai_service.generate_learning_path(request)
            elif active_provider == AIProvider.GEMINI:
                result = await self.gemini_service.generate_learning_path(request)
            else:
                raise ConfigurationError(f"Unknown AI provider: {active_provider}")
            
            # Add provider info to result
            result["ai_provider"] = active_provider.value
            return result
            
        except Exception as e:
            logger.warning(f"AI provider {active_provider} failed: {e}")
            
            # Try fallback to other provider if current one fails
            if settings.ENABLE_FALLBACKS:
                try:
                    fallback_provider = AIProvider.GEMINI if active_provider == AIProvider.OPENAI else AIProvider.OPENAI
                    logger.info(f"Trying fallback provider: {fallback_provider}")
                    
                    if fallback_provider == AIProvider.OPENAI:
                        result = await self.openai_service.generate_learning_path(request)
                    else:
                        result = await self.gemini_service.generate_learning_path(request)
                    
                    result["ai_provider"] = fallback_provider.value
                    result["fallback_used"] = True
                    return result
                    
                except Exception as fallback_error:
                    logger.warning(f"Fallback provider also failed: {fallback_error}")
            
            return None
    
    async def _enhance_path_with_algorithms(
        self, 
        ai_result: Dict[str, Any], 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Enhance AI-generated path with algorithmic improvements."""
        try:
            # Extract objectives from AI result
            ai_objectives = ai_result.get("objectives", [])
            
            # Convert AI objectives to standard format if needed
            standardized_objectives = self._standardize_objectives(ai_objectives)
            
            # Apply algorithmic sequencing
            sequenced_objectives = await self.sequence_learning_objectives(standardized_objectives)
            
            # Enhance with algorithmic insights
            user_profile = self._convert_request_to_profile(request)
            
            # Create enhanced result
            enhanced_result = ai_result.copy()
            enhanced_result.update({
                "objectives": sequenced_objectives,
                "enhancement_applied": True,
                "enhancement_methods": ["prerequisite_sequencing", "algorithmic_optimization"],
                "original_ai_objectives_count": len(ai_objectives),
                "enhanced_objectives_count": len(sequenced_objectives)
            })
            
            return enhanced_result
            
        except Exception as e:
            logger.warning(f"Error enhancing AI path with algorithms: {e}")
            return ai_result  # Return original AI result as fallback
    
    def _convert_request_to_profile(self, request: LearningPathRequest) -> 'UserProfile':
        """Convert LearningPathRequest to UserProfile format."""
        from ..models.ai_models import UserProfile
        
        return UserProfile(
            user_id=request.user_id,
            education_level=request.education_level,
            subjects=[request.subject],
            skill_levels={request.subject: request.current_level},
            learning_preferences={
                "learning_style": request.learning_style,
                "time_commitment": request.time_commitment,
                "preferred_formats": ["video", "interactive", "article"]  # Default formats
            },
            goals=request.learning_goals,
            interaction_history=[]  # Empty for new users
        )
    
    def _convert_dict_to_profile(self, user_dict: Dict[str, Any]) -> 'UserProfile':
        """Convert dictionary to UserProfile format."""
        from ..models.ai_models import UserProfile, EducationLevel, DifficultyLevel
        
        return UserProfile(
            user_id=user_dict.get("user_id", ""),
            education_level=EducationLevel(user_dict.get("education_level", "k12")),
            subjects=user_dict.get("subjects", []),
            skill_levels=user_dict.get("skill_levels", {}),
            learning_preferences=user_dict.get("learning_preferences", {}),
            goals=user_dict.get("goals", []),
            interaction_history=user_dict.get("interaction_history", [])
        )
    
    def _standardize_objectives(self, objectives: List[Any]) -> List[Dict[str, Any]]:
        """Standardize objectives from different AI providers."""
        standardized = []
        
        for i, obj in enumerate(objectives):
            if isinstance(obj, dict):
                standardized_obj = obj.copy()
            elif isinstance(obj, str):
                # Convert string objectives to dict format
                standardized_obj = {
                    "id": f"obj_{i+1}",
                    "title": obj,
                    "description": f"Learn and understand {obj}",
                    "difficulty": "beginner",
                    "estimated_hours": 2,
                    "skills_gained": [obj.lower().replace(" ", "_")]
                }
            else:
                # Handle other formats
                standardized_obj = {
                    "id": f"obj_{i+1}",
                    "title": str(obj),
                    "description": f"Learning objective {i+1}",
                    "difficulty": "beginner",
                    "estimated_hours": 2
                }
            
            # Ensure required fields exist
            if "id" not in standardized_obj:
                standardized_obj["id"] = f"obj_{i+1}"
            if "title" not in standardized_obj:
                standardized_obj["title"] = f"Learning Objective {i+1}"
            if "difficulty" not in standardized_obj:
                standardized_obj["difficulty"] = "beginner"
            
            standardized.append(standardized_obj)
        
        return standardized
    
    async def get_content_recommendations(
        self, 
        request: ContentRecommendationRequest,
        provider: Optional[str] = None,
        strategy: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get content recommendations using AI providers enhanced with algorithmic recommendations."""
        try:
            # First, try to get AI-enhanced recommendations from providers
            ai_recommendations = await self._get_ai_content_recommendations(request, provider)
            
            # Get algorithmic recommendations using the recommendation engine
            algorithmic_recommendations = await self.get_algorithmic_content_recommendations(
                request, strategy
            )
            
            # If AI providers are available, combine with algorithmic recommendations
            if ai_recommendations and not any(rec.get("fallback_used") for rec in ai_recommendations):
                logger.info("Combining AI and algorithmic recommendations")
                return await self._combine_recommendations(ai_recommendations, algorithmic_recommendations)
            
            # If AI providers failed, use pure algorithmic approach
            logger.info("Using algorithmic content recommendations")
            return [rec.dict() for rec in algorithmic_recommendations]
            
        except Exception as e:
            logger.error(f"Error in content recommendations: {e}")
            
            # Final fallback to algorithmic approach
            if settings.ENABLE_FALLBACKS:
                logger.info("Using fallback algorithmic recommendations")
                algorithmic_recs = await self.get_algorithmic_content_recommendations(request)
                return [rec.dict() for rec in algorithmic_recs]
            
            raise AIServiceError(f"Failed to get recommendations: {e}")
    
    async def get_algorithmic_content_recommendations(
        self,
        request: ContentRecommendationRequest,
        strategy: Optional[str] = None
    ) -> List['ContentRecommendation']:
        """Get content recommendations using pure algorithmic approach."""
        try:
            # Convert request to user profile if needed
            user_profile = self._convert_recommendation_request_to_profile(request)
            
            # Determine strategy
            rec_strategy = RecommendationStrategy.HYBRID
            if strategy:
                try:
                    rec_strategy = RecommendationStrategy(strategy.lower())
                except ValueError:
                    logger.warning(f"Invalid strategy {strategy}, using hybrid")
            
            # Get recommendations from the engine
            recommendations = await self.content_recommendation_engine.get_personalized_recommendations(
                request=request,
                user_profile=user_profile,
                strategy=rec_strategy,
                max_recommendations=10
            )
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error in algorithmic recommendations: {e}")
            # Return empty list as fallback
            return []
    
    async def update_content_interaction(
        self,
        user_id: str,
        content_id: str,
        interaction_score: float
    ):
        """Update user interaction data for collaborative filtering."""
        try:
            await self.content_recommendation_engine.update_user_interaction(
                user_id=user_id,
                content_id=content_id,
                interaction_score=interaction_score
            )
            
        except Exception as e:
            logger.error(f"Error updating content interaction: {e}")
    
    async def update_content_success_rate(
        self,
        content_id: str,
        success_rate: float
    ):
        """Update peer success rate for content."""
        try:
            await self.content_recommendation_engine.update_peer_success_rate(
                content_id=content_id,
                success_rate=success_rate
            )
            
        except Exception as e:
            logger.error(f"Error updating content success rate: {e}")
    
    async def get_recommendation_analytics(
        self,
        user_id: str,
        time_period: int = 30
    ) -> Dict[str, Any]:
        """Get analytics about recommendations for a user."""
        try:
            return await self.content_recommendation_engine.get_recommendation_analytics(
                user_id=user_id,
                time_period=time_period
            )
            
        except Exception as e:
            logger.error(f"Error getting recommendation analytics: {e}")
            return {}
    
    async def _get_ai_content_recommendations(
        self, 
        request: ContentRecommendationRequest,
        provider: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Get AI-enhanced recommendations from providers."""
        try:
            # Use specified provider or current default
            active_provider = AIProvider(provider.lower()) if provider else self.current_provider
            
            if active_provider == AIProvider.OPENAI:
                result = await self.openai_service.get_content_recommendations(request)
            elif active_provider == AIProvider.GEMINI:
                result = await self.gemini_service.get_content_recommendations(request)
            else:
                raise ConfigurationError(f"Unknown AI provider: {active_provider}")
            
            # Add provider info to each recommendation
            for item in result:
                item["ai_provider"] = active_provider.value
            
            return result
            
        except Exception as e:
            logger.warning(f"AI provider {active_provider} failed for recommendations: {e}")
            
            # Try fallback to other provider if current one fails
            if settings.ENABLE_FALLBACKS:
                try:
                    fallback_provider = AIProvider.GEMINI if active_provider == AIProvider.OPENAI else AIProvider.OPENAI
                    logger.info(f"Trying fallback provider for recommendations: {fallback_provider}")
                    
                    if fallback_provider == AIProvider.OPENAI:
                        result = await self.openai_service.get_content_recommendations(request)
                    else:
                        result = await self.gemini_service.get_content_recommendations(request)
                    
                    # Add provider info to each recommendation
                    for item in result:
                        item["ai_provider"] = fallback_provider.value
                        item["fallback_used"] = True
                    
                    return result
                    
                except Exception as fallback_error:
                    logger.warning(f"Fallback provider also failed for recommendations: {fallback_error}")
            
            return None
    
    async def _combine_recommendations(
        self,
        ai_recommendations: List[Dict[str, Any]],
        algorithmic_recommendations: List['ContentRecommendation']
    ) -> List[Dict[str, Any]]:
        """Combine AI and algorithmic recommendations."""
        try:
            # Convert algorithmic recommendations to dict format
            algo_recs_dict = [rec.dict() for rec in algorithmic_recommendations]
            
            # Create a combined list, giving priority to AI recommendations
            combined = []
            
            # Add AI recommendations first (up to 60% of total)
            ai_count = min(len(ai_recommendations), 6)
            combined.extend(ai_recommendations[:ai_count])
            
            # Add algorithmic recommendations to fill remaining slots
            algo_count = min(len(algo_recs_dict), 10 - ai_count)
            
            # Avoid duplicates by checking content IDs
            ai_content_ids = {rec.get("content_id") for rec in combined}
            
            for rec in algo_recs_dict:
                if len(combined) >= 10:
                    break
                if rec.get("content_id") not in ai_content_ids:
                    rec["source"] = "algorithmic_enhanced"
                    combined.append(rec)
            
            return combined
            
        except Exception as e:
            logger.error(f"Error combining recommendations: {e}")
            return ai_recommendations  # Return AI recommendations as fallback
    
    def _convert_recommendation_request_to_profile(
        self, 
        request: ContentRecommendationRequest
    ) -> Optional['UserProfile']:
        """Convert ContentRecommendationRequest to UserProfile format."""
        try:
            from ..models.ai_models import UserProfile
            
            return UserProfile(
                user_id=request.user_id,
                education_level=request.education_level,
                subjects=[request.current_topic],
                skill_levels={request.current_topic: request.skill_level},
                learning_preferences={
                    "learning_context": request.learning_context,
                    "preferred_formats": [fmt.value for fmt in request.preferred_formats],
                    "max_duration": request.max_duration
                },
                goals=[f"learn {request.current_topic}"],
                interaction_history=[]  # Empty for new users
            )
            
        except Exception as e:
            logger.error(f"Error converting request to profile: {e}")
            return None
    
    async def create_embeddings(
        self, 
        texts: List[str], 
        model: Optional[str] = None,
        provider: Optional[str] = None
    ) -> List[List[float]]:
        """Create embeddings using specified or current provider."""
        try:
            # Use specified provider or current default
            active_provider = AIProvider(provider.lower()) if provider else self.current_provider
            
            if active_provider == AIProvider.OPENAI:
                # Use OpenAI embedding model if not specified
                embedding_model = model or "text-embedding-ada-002"
                result = await self.openai_service.create_embeddings(texts, embedding_model)
            elif active_provider == AIProvider.GEMINI:
                # Use Gemini embedding model if not specified
                embedding_model = model or "models/embedding-001"
                result = await self.gemini_service.create_embeddings(texts, embedding_model)
            else:
                raise ConfigurationError(f"Unknown AI provider: {active_provider}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating embeddings with {active_provider}: {e}")
            
            # Try fallback to other provider if current one fails
            if settings.ENABLE_FALLBACKS:
                try:
                    fallback_provider = AIProvider.GEMINI if active_provider == AIProvider.OPENAI else AIProvider.OPENAI
                    logger.info(f"Trying fallback provider for embeddings: {fallback_provider}")
                    
                    if fallback_provider == AIProvider.OPENAI:
                        embedding_model = model or "text-embedding-ada-002"
                        result = await self.openai_service.create_embeddings(texts, embedding_model)
                    else:
                        embedding_model = model or "models/embedding-001"
                        result = await self.gemini_service.create_embeddings(texts, embedding_model)
                    
                    return result
                    
                except Exception as fallback_error:
                    logger.error(f"Fallback provider also failed for embeddings: {fallback_error}")
            
            raise AIServiceError(f"Failed to create embeddings: {e}")
    
    async def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all AI providers."""
        status = {
            "current_provider": self.current_provider.value,
            "providers": {}
        }
        
        # Check OpenAI status
        try:
            if settings.OPENAI_API_KEY:
                # Simple test to check if OpenAI is working
                test_response = await self.openai_service._make_openai_request(
                    [{"role": "user", "content": "Test"}],
                    max_tokens=5,
                    temperature=0
                )
                status["providers"]["openai"] = {
                    "available": True,
                    "configured": True,
                    "status": "healthy"
                }
            else:
                status["providers"]["openai"] = {
                    "available": False,
                    "configured": False,
                    "status": "not_configured"
                }
        except Exception as e:
            status["providers"]["openai"] = {
                "available": False,
                "configured": bool(settings.OPENAI_API_KEY),
                "status": "error",
                "error": str(e)
            }
        
        # Check Gemini status
        try:
            if settings.GEMINI_API_KEY and self.gemini_service.model:
                # Simple test to check if Gemini is working
                test_response = await self.gemini_service._make_gemini_request("Test")
                status["providers"]["gemini"] = {
                    "available": True,
                    "configured": True,
                    "status": "healthy"
                }
            else:
                status["providers"]["gemini"] = {
                    "available": False,
                    "configured": bool(settings.GEMINI_API_KEY),
                    "status": "not_configured"
                }
        except Exception as e:
            status["providers"]["gemini"] = {
                "available": False,
                "configured": bool(settings.GEMINI_API_KEY),
                "status": "error",
                "error": str(e)
            }
        
        return status
    
    async def compare_providers(
        self, 
        request: LearningPathRequest
    ) -> Dict[str, Any]:
        """Compare responses from both providers for the same request."""
        results = {
            "request": request.dict(),
            "responses": {},
            "comparison": {}
        }
        
        # Get response from OpenAI
        try:
            openai_result = await self.openai_service.generate_learning_path(request)
            results["responses"]["openai"] = openai_result
        except Exception as e:
            results["responses"]["openai"] = {"error": str(e)}
        
        # Get response from Gemini
        try:
            gemini_result = await self.gemini_service.generate_learning_path(request)
            results["responses"]["gemini"] = gemini_result
        except Exception as e:
            results["responses"]["gemini"] = {"error": str(e)}
        
        # Basic comparison
        if "error" not in results["responses"]["openai"] and "error" not in results["responses"]["gemini"]:
            openai_objectives = len(results["responses"]["openai"].get("objectives", []))
            gemini_objectives = len(results["responses"]["gemini"].get("objectives", []))
            
            results["comparison"] = {
                "openai_objectives_count": openai_objectives,
                "gemini_objectives_count": gemini_objectives,
                "both_successful": True
            }
        else:
            results["comparison"] = {
                "both_successful": False,
                "openai_success": "error" not in results["responses"]["openai"],
                "gemini_success": "error" not in results["responses"]["gemini"]
            }
        
        return results  
  
    # Peer Matching Methods
    async def find_peer_matches(
        self,
        request: 'PeerMatchingRequest',
        strategy: Optional[str] = None,
        max_matches: int = 10
    ) -> List['PeerMatch']:
        """Find peer matches using the peer matching engine."""
        try:
            from ..models.ai_models import PeerMatchingRequest
            
            # Determine strategy
            matching_strategy = MatchingStrategy.COMPREHENSIVE
            if strategy:
                try:
                    matching_strategy = MatchingStrategy(strategy.lower())
                except ValueError:
                    logger.warning(f"Invalid matching strategy {strategy}, using comprehensive")
            
            # Get matches from the engine
            matches = await self.peer_matching_engine.find_peer_matches(
                request=request,
                strategy=matching_strategy,
                max_matches=max_matches
            )
            
            return matches
            
        except Exception as e:
            logger.error(f"Error finding peer matches: {e}")
            return []
    
    async def update_peer_match_feedback(
        self,
        user_id: str,
        peer_id: str,
        feedback_score: float,
        feedback_type: str
    ):
        """Update peer match feedback for improving future recommendations."""
        try:
            await self.peer_matching_engine.update_match_feedback(
                user_id=user_id,
                peer_id=peer_id,
                feedback_score=feedback_score,
                feedback_type=feedback_type
            )
            
        except Exception as e:
            logger.error(f"Error updating peer match feedback: {e}")
    
    async def get_peer_matching_analytics(
        self,
        user_id: str,
        time_period: int = 30
    ) -> Dict[str, Any]:
        """Get analytics about peer matching for a user."""
        try:
            return await self.peer_matching_engine.get_matching_analytics(
                user_id=user_id,
                time_period=time_period
            )
            
        except Exception as e:
            logger.error(f"Error getting peer matching analytics: {e}")
            return {}