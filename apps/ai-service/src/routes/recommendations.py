"""
Content recommendation routes for AI service.
"""
from fastapi import APIRouter, Depends, HTTPException
from ..models.ai_models import (
    ContentRecommendationRequest,
    ContentRecommendationResponse,
    EmbeddingRequest
)
from ..services.openai_service import OpenAIService
from ..services.vector_service import VectorService

router = APIRouter()


async def get_openai_service() -> OpenAIService:
    """Dependency to get OpenAI service instance."""
    from ..main import openai_service
    return openai_service


async def get_vector_service() -> VectorService:
    """Dependency to get vector service instance."""
    from ..main import vector_service
    return vector_service


@router.post("/", response_model=ContentRecommendationResponse)
async def get_recommendations(
    request: ContentRecommendationRequest,
    openai_service: OpenAIService = Depends(get_openai_service),
    vector_service: VectorService = Depends(get_vector_service)
):
    """Get content recommendations for a user."""
    try:
        recommendations = await openai_service.get_content_recommendations(request)
        
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
    openai_service: OpenAIService = Depends(get_openai_service)
):
    """Create embeddings for text content."""
    try:
        embeddings = await openai_service.create_embeddings(
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