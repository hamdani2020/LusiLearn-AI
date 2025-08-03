"""
Learning path routes for AI service.
"""
from fastapi import APIRouter, Depends, HTTPException
from ..models.ai_models import (
    LearningPathRequest,
    LearningPathResponse
)
from ..services.openai_service import OpenAIService

router = APIRouter()


async def get_openai_service() -> OpenAIService:
    """Dependency to get OpenAI service instance."""
    from ..main import openai_service
    return openai_service


@router.post("/", response_model=LearningPathResponse)
async def generate_learning_path(
    request: LearningPathRequest,
    openai_service: OpenAIService = Depends(get_openai_service)
):
    """Generate a personalized learning path."""
    try:
        path_data = await openai_service.generate_learning_path(request)
        
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