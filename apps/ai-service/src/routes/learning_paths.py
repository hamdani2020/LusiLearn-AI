"""
Learning path routes for AI service.
"""
from fastapi import APIRouter, Depends, HTTPException
from ..models.ai_models import (
    LearningPathRequest,
    LearningPathResponse
)
from ..services.ai_service import AIService

router = APIRouter()


async def get_ai_service() -> AIService:
    """Dependency to get AI service instance."""
    from ..main import ai_service
    return ai_service


@router.post("/", response_model=LearningPathResponse)
async def generate_learning_path(
    request: LearningPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Generate a personalized learning path."""
    try:
        path_data = await ai_service.generate_learning_path(request)
        
        # Convert to response format
        return LearningPathResponse(
            path_id=f"path_{request.user_id}_{hash(str(request.dict()))}",
            user_id=request.user_id,
            subject=request.subject,
            objectives=path_data.get("objectives", []),
            total_estimated_hours=path_data.get("total_hours", request.time_commitment * 8),
            difficulty_progression=path_data.get("difficulty_progression", "beginner -> intermediate"),
            source=path_data.get("source", "ai_generated")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/provider/{provider}")
async def generate_learning_path_with_provider(
    provider: str,
    request: LearningPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Generate a personalized learning path using specific AI provider."""
    try:
        path_data = await ai_service.generate_learning_path(request, provider=provider)
        
        # Convert to response format
        return LearningPathResponse(
            path_id=f"path_{request.user_id}_{hash(str(request.dict()))}_{provider}",
            user_id=request.user_id,
            subject=request.subject,
            objectives=path_data.get("objectives", []),
            total_estimated_hours=path_data.get("total_hours", request.time_commitment * 8),
            difficulty_progression=path_data.get("difficulty_progression", "beginner -> intermediate"),
            source=path_data.get("source", f"ai_generated_{provider}")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compare")
async def compare_learning_paths(
    request: LearningPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Compare learning paths from both AI providers."""
    try:
        return await ai_service.compare_providers(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))