"""
Content recommendation routes for AI service.
"""
from fastapi import APIRouter, Depends, HTTPException
from ..models.ai_models import (
    ContentRecommendationRequest,
    ContentRecommendationResponse,
    EmbeddingRequest
)
from ..services.ai_service import AIService
from ..services.vector_service import VectorService

router = APIRouter()


async def get_ai_service() -> AIService:
    """Dependency to get AI service instance."""
    from ..main import ai_service
    return ai_service


async def get_vector_service() -> VectorService:
    """Dependency to get vector service instance."""
    from ..main import vector_service
    return vector_service


@router.post("/", response_model=ContentRecommendationResponse)
async def get_recommendations(
    request: ContentRecommendationRequest,
    ai_service: AIService = Depends(get_ai_service),
    vector_service: VectorService = Depends(get_vector_service)
):
    """Get content recommendations for a user."""
    try:
        recommendations = await ai_service.get_content_recommendations(request)
        
        return ContentRecommendationResponse(
            user_id=request.user_id,
            topic=request.current_topic,
            recommendations=recommendations,
            total_count=len(recommendations)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings")
async def create_embeddings(
    request: EmbeddingRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Create embeddings for text content."""
    try:
        embeddings = await ai_service.create_embeddings(
            request.texts, 
            request.model
        )
        
        return {
            "embeddings": embeddings,
            "model": request.model,
            "total_tokens": sum(len(text.split()) for text in request.texts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/provider/{provider}")
async def switch_provider(
    provider: str,
    ai_service: AIService = Depends(get_ai_service)
):
    """Switch AI provider (openai or gemini)."""
    try:
        ai_service.set_provider(provider)
        return {
            "message": f"AI provider switched to {provider}",
            "current_provider": ai_service.get_current_provider()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/provider")
async def get_current_provider(
    ai_service: AIService = Depends(get_ai_service)
):
    """Get current AI provider."""
    try:
        return {
            "current_provider": ai_service.get_current_provider()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/provider/status")
async def get_provider_status(
    ai_service: AIService = Depends(get_ai_service)
):
    """Get status of all AI providers."""
    try:
        return await ai_service.get_provider_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_providers(
    request: ContentRecommendationRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Compare recommendations from both AI providers."""
    try:
        # Get recommendations from both providers
        openai_recommendations = await ai_service.get_content_recommendations(request, provider="openai")
        gemini_recommendations = await ai_service.get_content_recommendations(request, provider="gemini")
        
        return {
            "request": request.dict(),
            "openai_recommendations": openai_recommendations,
            "gemini_recommendations": gemini_recommendations,
            "comparison": {
                "openai_count": len(openai_recommendations),
                "gemini_count": len(gemini_recommendations)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))