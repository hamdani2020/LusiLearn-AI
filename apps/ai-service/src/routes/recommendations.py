"""
Content recommendation routes for AI service.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from ..models.ai_models import (
    ContentRecommendationRequest,
    ContentRecommendationResponse,
    EmbeddingRequest
)
from ..services.ai_service import AIService
from ..services.vector_service import VectorService

router = APIRouter()


class InteractionUpdateRequest(BaseModel):
    """Request model for updating user interactions."""
    user_id: str = Field(..., description="User identifier")
    content_id: str = Field(..., description="Content identifier")
    interaction_score: float = Field(..., description="Interaction score (0-1)")


class SuccessRateUpdateRequest(BaseModel):
    """Request model for updating content success rates."""
    content_id: str = Field(..., description="Content identifier")
    success_rate: float = Field(..., description="Success rate (0-1)")


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
    strategy: Optional[str] = Query(None, description="Recommendation strategy: vector_similarity, collaborative_filtering, learning_style_based, hybrid"),
    ai_service: AIService = Depends(get_ai_service),
    vector_service: VectorService = Depends(get_vector_service)
):
    """Get content recommendations using AI and algorithmic enhancement."""
    try:
        recommendations = await ai_service.get_content_recommendations(request, strategy=strategy)
        
        return ContentRecommendationResponse(
            user_id=request.user_id,
            topic=request.current_topic,
            recommendations=recommendations,
            total_count=len(recommendations)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/algorithmic", response_model=ContentRecommendationResponse)
async def get_algorithmic_recommendations(
    request: ContentRecommendationRequest,
    strategy: Optional[str] = Query("hybrid", description="Recommendation strategy: vector_similarity, collaborative_filtering, learning_style_based, hybrid"),
    ai_service: AIService = Depends(get_ai_service)
):
    """Get content recommendations using pure algorithmic approach."""
    try:
        algorithmic_recs = await ai_service.get_algorithmic_content_recommendations(request, strategy)
        
        # Convert to dict format for response
        recommendations = [rec.dict() for rec in algorithmic_recs]
        
        return ContentRecommendationResponse(
            user_id=request.user_id,
            topic=request.current_topic,
            recommendations=recommendations,
            total_count=len(recommendations),
            source="algorithmic"
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


@router.post("/interaction/update")
async def update_user_interaction(
    request: InteractionUpdateRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Update user interaction data for collaborative filtering."""
    try:
        await ai_service.update_content_interaction(
            user_id=request.user_id,
            content_id=request.content_id,
            interaction_score=request.interaction_score
        )
        
        return {
            "success": True,
            "message": f"Updated interaction for user {request.user_id} with content {request.content_id}",
            "interaction_score": request.interaction_score
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/success-rate/update")
async def update_content_success_rate(
    request: SuccessRateUpdateRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Update peer success rate for content."""
    try:
        await ai_service.update_content_success_rate(
            content_id=request.content_id,
            success_rate=request.success_rate
        )
        
        return {
            "success": True,
            "message": f"Updated success rate for content {request.content_id}",
            "success_rate": request.success_rate
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/{user_id}")
async def get_recommendation_analytics(
    user_id: str,
    time_period: int = Query(30, description="Time period in days"),
    ai_service: AIService = Depends(get_ai_service)
):
    """Get recommendation analytics for a user."""
    try:
        analytics = await ai_service.get_recommendation_analytics(
            user_id=user_id,
            time_period=time_period
        )
        
        return {
            "success": True,
            "analytics": analytics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strategies")
async def get_available_strategies():
    """Get available recommendation strategies."""
    try:
        return {
            "strategies": [
                {
                    "name": "vector_similarity",
                    "description": "Uses vector embeddings to find similar content",
                    "best_for": "Content discovery based on semantic similarity"
                },
                {
                    "name": "collaborative_filtering",
                    "description": "Recommends based on what similar users liked",
                    "best_for": "Leveraging peer success and preferences"
                },
                {
                    "name": "learning_style_based",
                    "description": "Matches content to user's learning style preferences",
                    "best_for": "Personalized learning format preferences"
                },
                {
                    "name": "hybrid",
                    "description": "Combines multiple strategies for optimal results",
                    "best_for": "Balanced recommendations with multiple factors"
                }
            ],
            "default_strategy": "hybrid"
        }
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


@router.get("/engine/status")
async def get_recommendation_engine_status():
    """Get status of the recommendation engine."""
    try:
        return {
            "status": "operational",
            "algorithms_available": [
                "vector_similarity_search",
                "collaborative_filtering",
                "learning_style_matching",
                "hybrid_recommendations"
            ],
            "features": {
                "vector_similarity": True,
                "collaborative_filtering": True,
                "learning_style_adaptation": True,
                "recommendation_ranking": True,
                "diversity_filtering": True,
                "age_appropriate_filtering": True,
                "quality_scoring": True,
                "real_time_updates": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))