"""
Unified AI service that orchestrates calls to different AI providers.
"""
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum

from .openai_service import OpenAIService
from .gemini_service import GeminiService
from .nvidia_service import NVIDIAService
from .content_recommendation_service import ContentRecommendationEngine
from .peer_matching_service import PeerMatchingEngine
from ..config import settings
from ..utils.exceptions import AIServiceError

logger = logging.getLogger(__name__)


class AIProvider(Enum):
    """Available AI providers."""
    NVIDIA = "nvidia"
    OPENAI = "openai"
    GEMINI = "gemini"


class AIService:
    """Unified AI service that manages multiple AI providers."""
    
    def __init__(self):
        self.current_provider = AIProvider.NVIDIA  # Default to NVIDIA
        self.nvidia_service = NVIDIAService()
        self.openai_service = OpenAIService()
        self.gemini_service = GeminiService()
        self.content_recommendation_engine = ContentRecommendationEngine()
        self.peer_matching_engine = PeerMatchingEngine()
        
    async def initialize(self):
        """Initialize all AI services."""
        try:
            # Check NVIDIA API key validity and test connection
            nvidia_available = False
            if settings.NVIDIA_API_KEY and settings.NVIDIA_API_KEY != "your-nvidia-api-key":
                try:
                    await self.nvidia_service.initialize()
                    # Test NVIDIA with a simple request
                    test_response = await self.nvidia_service._test_api_connection()
                    if test_response:
                        nvidia_available = True
                        logger.info("NVIDIA service is available and working")
                    else:
                        logger.warning("NVIDIA service failed API test")
                except Exception as e:
                    logger.warning(f"NVIDIA service not available: {e}")
            else:
                logger.warning("NVIDIA API key not configured or invalid")
            
            # Check OpenAI API key validity and test connection
            openai_available = False
            if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your-openai-api-key":
                try:
                    await self.openai_service.initialize()
                    # Test OpenAI with a simple request
                    test_response = await self.openai_service._test_api_connection()
                    if test_response:
                        openai_available = True
                        logger.info("OpenAI service is available and working")
                    else:
                        logger.warning("OpenAI service failed API test")
                except Exception as e:
                    logger.warning(f"OpenAI service not available: {e}")
            else:
                logger.warning("OpenAI API key not configured or invalid")
            
            # Initialize Gemini service
            gemini_available = False
            if settings.GEMINI_API_KEY:
                try:
                    await self.gemini_service.initialize()
                    # Test Gemini with a simple request
                    test_response = await self.gemini_service._test_api_connection()
                    if test_response:
                        gemini_available = True
                        logger.info("Gemini service is available and working")
                    else:
                        logger.warning("Gemini service failed API test")
                except Exception as e:
                    logger.warning(f"Gemini service not available: {e}")
            else:
                logger.warning("Gemini API key not configured")
            
            # Set the best available provider (prioritize NVIDIA)
            if nvidia_available:
                self.current_provider = AIProvider.NVIDIA
                logger.info("Setting NVIDIA as primary AI provider")
            elif openai_available:
                self.current_provider = AIProvider.OPENAI
                logger.info("Setting OpenAI as primary AI provider")
            elif gemini_available:
                self.current_provider = AIProvider.GEMINI
                logger.info("Setting Gemini as primary AI provider")
            else:
                logger.warning("No AI providers available, using algorithmic fallback only")
                self.current_provider = AIProvider.NVIDIA  # Default to NVIDIA for consistency
            
            # Initialize content recommendation engine
            await self.content_recommendation_engine.initialize()
            
            # Initialize peer matching engine
            await self.peer_matching_engine.initialize()
            
            logger.info(f"AI service initialized with provider: {self.current_provider}")
            
        except Exception as e:
            logger.error(f"Failed to initialize AI service: {e}")
            raise AIServiceError(f"AI service initialization failed: {e}")
    
    async def close(self):
        """Close all AI services."""
        await asyncio.gather(
            self.nvidia_service.close(),
            self.openai_service.close(),
            self.gemini_service.close(),
            return_exceptions=True
        )
    
    async def generate_learning_path(self, request: Any) -> Dict[str, Any]:
        """Generate learning path using the current AI provider."""
        try:
            if self.current_provider == AIProvider.NVIDIA:
                return await self.nvidia_service.generate_learning_path(request)
            elif self.current_provider == AIProvider.OPENAI:
                return await self.openai_service.generate_learning_path(request)
            elif self.current_provider == AIProvider.GEMINI:
                return await self.gemini_service.generate_learning_path(request)
            else:
                # Fallback to algorithmic generation
                return await self._generate_fallback_learning_path(request)
        except Exception as e:
            logger.error(f"Learning path generation failed with {self.current_provider}: {e}")
            # Try fallback
            return await self._generate_fallback_learning_path(request)
    
    async def generate_content_recommendations(self, request: Any) -> List[Dict[str, Any]]:
        """Generate content recommendations using the current AI provider."""
        try:
            if self.current_provider == AIProvider.NVIDIA:
                return await self.nvidia_service.generate_content_recommendations(request)
            elif self.current_provider == AIProvider.OPENAI:
                return await self.openai_service.generate_content_recommendations(request)
            elif self.current_provider == AIProvider.GEMINI:
                return await self.gemini_service.generate_content_recommendations(request)
            else:
                # Fallback to algorithmic generation
                return await self._generate_fallback_content_recommendations(request)
        except Exception as e:
            logger.error(f"Content recommendations failed with {self.current_provider}: {e}")
            # Try fallback
            return await self._generate_fallback_content_recommendations(request)
    
    async def generate_peer_matches(self, user_profile: Dict[str, Any], criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate peer matches using the current AI provider."""
        try:
            if self.current_provider == AIProvider.NVIDIA:
                return await self.nvidia_service.generate_peer_matches(user_profile, criteria)
            elif self.current_provider == AIProvider.OPENAI:
                return await self.openai_service.generate_peer_matches(user_profile, criteria)
            elif self.current_provider == AIProvider.GEMINI:
                return await self.gemini_service.generate_peer_matches(user_profile, criteria)
            else:
                # Fallback to algorithmic generation
                return await self._generate_fallback_peer_matches(user_profile, criteria)
        except Exception as e:
            logger.error(f"Peer matching failed with {self.current_provider}: {e}")
            # Try fallback
            return await self._generate_fallback_peer_matches(user_profile, criteria)
    
    async def generate_skill_assessment_questions(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate skill assessment questions using the current AI provider."""
        try:
            if self.current_provider == AIProvider.NVIDIA:
                return await self.nvidia_service.generate_skill_assessment_questions(request)
            elif self.current_provider == AIProvider.OPENAI:
                return await self.openai_service.generate_skill_assessment_questions(request)
            elif self.current_provider == AIProvider.GEMINI:
                return await self.gemini_service.generate_skill_assessment_questions(request)
            else:
                # Fallback to algorithmic generation
                return await self._generate_fallback_skill_assessment_questions(request)
        except Exception as e:
            logger.error(f"Skill assessment generation failed with {self.current_provider}: {e}")
            # Try fallback
            return await self._generate_fallback_skill_assessment_questions(request)
    
    async def evaluate_skill_assessment(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate skill assessment answers using the current AI provider."""
        try:
            if self.current_provider == AIProvider.NVIDIA:
                return await self.nvidia_service.evaluate_skill_assessment(request)
            elif self.current_provider == AIProvider.OPENAI:
                return await self.openai_service.evaluate_skill_assessment(request)
            elif self.current_provider == AIProvider.GEMINI:
                return await self.gemini_service.evaluate_skill_assessment(request)
            else:
                # Fallback to algorithmic evaluation
                return await self._evaluate_fallback_skill_assessment(request)
        except Exception as e:
            logger.error(f"Skill assessment evaluation failed with {self.current_provider}: {e}")
            # Try fallback
            return await self._evaluate_fallback_skill_assessment(request)
    
    async def _generate_fallback_learning_path(self, request: Any) -> Dict[str, Any]:
        """Generate fallback learning path using algorithmic approach."""
        logger.info("Using algorithmic fallback for learning path generation")
        # Implementation would go here
        return {"objectives": [], "difficulty_progression": "beginner", "total_estimated_time": "60"}
    
    async def _generate_fallback_content_recommendations(self, request: Any) -> List[Dict[str, Any]]:
        """Generate fallback content recommendations when AI providers fail."""
        logger.warning("AI provider failed, returning empty recommendations to maintain data integrity")
        
        # Return empty list instead of mock data
        # This ensures AI Picks only shows genuine AI-generated content
        return []
    
    async def _generate_fallback_peer_matches(self, user_profile: Dict[str, Any], criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate fallback peer matches using algorithmic approach."""
        logger.info("Using algorithmic fallback for peer matching")
        # Implementation would go here
        return []
    
    async def _generate_fallback_skill_assessment_questions(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback skill assessment questions using algorithmic approach."""
        logger.info("Using algorithmic fallback for skill assessment questions")
        
        # Generate basic questions based on subject
        subject = request.get('subject', 'general')
        num_questions = request.get('num_questions', 10)
        
        questions = []
        if subject.lower() == 'mathematics':
            questions = [
                {
                    "question": "How comfortable are you with solving algebraic equations?",
                    "type": "rating",
                    "category": "algebra",
                    "difficulty": "beginner"
                },
                {
                    "question": "Can you solve quadratic equations?",
                    "type": "multiple_choice",
                    "category": "algebra",
                    "difficulty": "intermediate",
                    "options": ["Very comfortable", "Somewhat comfortable", "Not comfortable", "Never tried"]
                },
                {
                    "question": "Are you familiar with calculus concepts?",
                    "type": "true_false",
                    "category": "calculus",
                    "difficulty": "advanced"
                }
            ]
        elif subject.lower() == 'science':
            questions = [
                {
                    "question": "How would you describe your understanding of basic physics?",
                    "type": "rating",
                    "category": "physics",
                    "difficulty": "beginner"
                },
                {
                    "question": "Are you comfortable with laboratory experiments?",
                    "type": "multiple_choice",
                    "category": "experimental",
                    "difficulty": "intermediate",
                    "options": ["Very comfortable", "Somewhat comfortable", "Not comfortable", "Never tried"]
                }
            ]
        else:
            questions = [
                {
                    "question": "How do you prefer to learn new concepts?",
                    "type": "multiple_choice",
                    "category": "learning_style",
                    "difficulty": "beginner",
                    "options": ["Reading", "Watching videos", "Hands-on practice", "Group discussion"]
                },
                {
                    "question": "How much time can you dedicate to learning each day?",
                    "type": "multiple_choice",
                    "category": "time_commitment",
                    "difficulty": "beginner",
                    "options": ["Less than 30 minutes", "30-60 minutes", "1-2 hours", "More than 2 hours"]
                },
                {
                    "question": "Are you comfortable with online learning platforms?",
                    "type": "true_false",
                    "category": "technology",
                    "difficulty": "beginner"
                }
            ]
        
        # Return only the requested number of questions
        return {"questions": questions[:num_questions]}
    
    async def _evaluate_fallback_skill_assessment(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate fallback skill assessment answers using algorithmic approach."""
        logger.info("Using algorithmic fallback for skill assessment evaluation")
        
        answers = request.get('answers', {})
        total_questions = len(answers)
        
        if total_questions == 0:
            return {
                "overall_score": 0,
                "category_scores": {},
                "recommended_level": "beginner",
                "strengths": [],
                "areas_for_improvement": ["Complete the assessment to get personalized recommendations"],
                "confidence": 0.0,
                "completed_at": "2025-08-19T02:34:00.868Z"
            }
        
        # Calculate basic scores
        scores = []
        for answer in answers.values():
            if isinstance(answer, (int, float)):
                scores.append(answer)
            elif isinstance(answer, str):
                # Convert text answers to numeric scores
                if answer.lower() in ["very comfortable", "excellent", "advanced", "true"]:
                    scores.append(5)
                elif answer.lower() in ["comfortable", "good", "intermediate"]:
                    scores.append(4)
                elif answer.lower() in ["somewhat comfortable", "fair", "beginner"]:
                    scores.append(3)
                elif answer.lower() in ["not comfortable", "poor", "novice", "false"]:
                    scores.append(2)
                else:
                    scores.append(1)
            else:
                scores.append(1)
        
        overall_score = (sum(scores) / len(scores)) * 20  # Convert to percentage
        
        # Determine level
        if overall_score >= 80:
            recommended_level = "advanced"
            strengths = ["Strong foundational knowledge", "High confidence in learning"]
            areas_for_improvement = ["Consider advanced topics", "Explore specialized areas"]
        elif overall_score >= 60:
            recommended_level = "intermediate"
            strengths = ["Good understanding of basics", "Ready for intermediate topics"]
            areas_for_improvement = ["Practice application", "Build on fundamentals"]
        else:
            recommended_level = "beginner"
            strengths = ["Willingness to learn", "Open to new concepts"]
            areas_for_improvement = ["Build foundational knowledge", "Start with basics"]
        
        return {
            "overall_score": round(overall_score, 1),
            "category_scores": {"general": overall_score},
            "recommended_level": recommended_level,
            "strengths": strengths,
            "areas_for_improvement": areas_for_improvement,
            "confidence": 0.7,
            "completed_at": "2025-08-19T02:34:00.868Z"
        }
    
    def get_current_provider(self) -> str:
        """Get the current AI provider name."""
        return self.current_provider.value
    
    def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all AI providers."""
        return {
            "current_provider": self.current_provider.value,
            "nvidia_available": hasattr(self.nvidia_service, 'client') and self.nvidia_service.client is not None,
            "openai_available": hasattr(self.openai_service, 'client') and self.openai_service.client is not None,
            "gemini_available": hasattr(self.gemini_service, 'client') and self.gemini_service.client is not None,
            "timestamp": datetime.now().isoformat()
        }