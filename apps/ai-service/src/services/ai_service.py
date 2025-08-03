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
        self.current_provider = AIProvider(settings.AI_PROVIDER.lower())
        
    async def initialize(self):
        """Initialize both AI services."""
        try:
            # Initialize both services
            await self.openai_service.initialize()
            await self.gemini_service.initialize()
            
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
        """Generate personalized learning path using specified or current provider."""
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
            logger.error(f"Error generating learning path with {active_provider}: {e}")
            
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
                    logger.error(f"Fallback provider also failed: {fallback_error}")
            
            raise AIServiceError(f"Failed to generate learning path: {e}")
    
    async def get_content_recommendations(
        self, 
        request: ContentRecommendationRequest,
        provider: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get content recommendations using specified or current provider."""
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
            logger.error(f"Error getting recommendations with {active_provider}: {e}")
            
            # Try fallback to other provider if current one fails
            if settings.ENABLE_FALLBACKS:
                try:
                    fallback_provider = AIProvider.GEMINI if active_provider == AIProvider.OPENAI else AIProvider.OPENAI
                    logger.info(f"Trying fallback provider: {fallback_provider}")
                    
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
                    logger.error(f"Fallback provider also failed: {fallback_error}")
            
            raise AIServiceError(f"Failed to get recommendations: {e}")
    
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