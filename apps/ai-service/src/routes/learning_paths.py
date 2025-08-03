"""
Learning path routes for AI service.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from ..models.ai_models import (
    LearningPathRequest,
    LearningPathResponse,
    EducationLevel
)
from ..services.ai_service import AIService

router = APIRouter()


class PathAdaptationRequest(BaseModel):
    """Request model for adapting learning paths."""
    current_path: Dict[str, Any] = Field(..., description="Current learning path")
    performance_data: Dict[str, Any] = Field(..., description="User performance data")
    user_profile: Dict[str, Any] = Field(..., description="Updated user profile")


class ObjectiveSequencingRequest(BaseModel):
    """Request model for sequencing learning objectives."""
    objectives: List[Dict[str, Any]] = Field(..., description="Learning objectives to sequence")
    user_completed: Optional[List[str]] = Field(default=None, description="Completed objective IDs")


class FallbackPathRequest(BaseModel):
    """Request model for fallback learning paths."""
    education_level: EducationLevel = Field(..., description="Education level")
    subject: str = Field(..., description="Subject area")
    learning_goals: Optional[List[str]] = Field(default=None, description="Learning goals")
    time_commitment: int = Field(default=10, description="Hours per week")


async def get_ai_service() -> AIService:
    """Dependency to get AI service instance."""
    from ..main import ai_service
    return ai_service


@router.post("/", response_model=LearningPathResponse)
async def generate_learning_path(
    request: LearningPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Generate a personalized learning path using AI and algorithmic enhancement."""
    try:
        path_data = await ai_service.generate_learning_path(request)
        
        # Convert to response format
        return LearningPathResponse(
            path_id=path_data.get("path_id", f"path_{request.user_id}_{hash(str(request.dict()))}"),
            user_id=request.user_id,
            subject=request.subject,
            objectives=path_data.get("objectives", []),
            total_estimated_hours=path_data.get("total_estimated_hours", request.time_commitment * 8),
            difficulty_progression=str(path_data.get("difficulty_progression", "beginner -> intermediate")),
            source=path_data.get("source", "ai_generated")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/algorithmic", response_model=LearningPathResponse)
async def generate_algorithmic_learning_path(
    request: LearningPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Generate a learning path using pure algorithmic approach."""
    try:
        path_data = await ai_service.generate_algorithmic_learning_path(request)
        
        # Convert to response format
        return LearningPathResponse(
            path_id=path_data.get("path_id", f"algo_path_{request.user_id}_{hash(str(request.dict()))}"),
            user_id=request.user_id,
            subject=request.subject,
            objectives=path_data.get("objectives", []),
            total_estimated_hours=path_data.get("total_estimated_hours", request.time_commitment * 8),
            difficulty_progression=str(path_data.get("difficulty_progression", "beginner -> intermediate")),
            source=path_data.get("source", "algorithmic")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/adapt")
async def adapt_learning_path(
    request: PathAdaptationRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Adapt learning path based on user performance and engagement."""
    try:
        adapted_path = await ai_service.adapt_learning_path(
            current_path=request.current_path,
            performance_data=request.performance_data,
            user_profile=request.user_profile
        )
        
        return {
            "success": True,
            "adapted_path": adapted_path,
            "adaptation_summary": {
                "timestamp": adapted_path.get("updated_at"),
                "changes_made": len(adapted_path.get("adaptation_history", [])),
                "performance_score": request.performance_data.get("comprehension_score", 0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sequence")
async def sequence_learning_objectives(
    request: ObjectiveSequencingRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Sequence learning objectives based on prerequisites and dependencies."""
    try:
        sequenced_objectives = await ai_service.sequence_learning_objectives(
            objectives=request.objectives,
            user_completed=request.user_completed
        )
        
        return {
            "success": True,
            "sequenced_objectives": sequenced_objectives,
            "sequencing_info": {
                "original_count": len(request.objectives),
                "sequenced_count": len(sequenced_objectives),
                "prerequisites_considered": any(
                    obj.get("prerequisites") for obj in sequenced_objectives
                )
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fallback")
async def create_fallback_learning_path(
    request: FallbackPathRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Create fallback learning path when AI services are unavailable."""
    try:
        fallback_path = await ai_service.create_fallback_learning_path(
            education_level=request.education_level.value,
            subject=request.subject,
            learning_goals=request.learning_goals,
            time_commitment=request.time_commitment
        )
        
        return {
            "success": True,
            "fallback_path": fallback_path,
            "fallback_info": {
                "education_level": request.education_level.value,
                "subject": request.subject,
                "objectives_count": len(fallback_path.get("objectives", [])),
                "estimated_hours": fallback_path.get("total_estimated_hours", 0)
            }
        }
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
            path_id=path_data.get("path_id", f"path_{request.user_id}_{hash(str(request.dict()))}_{provider}"),
            user_id=request.user_id,
            subject=request.subject,
            objectives=path_data.get("objectives", []),
            total_estimated_hours=path_data.get("total_estimated_hours", request.time_commitment * 8),
            difficulty_progression=str(path_data.get("difficulty_progression", "beginner -> intermediate")),
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


@router.get("/algorithms/status")
async def get_algorithm_status():
    """Get status of learning path algorithms."""
    try:
        return {
            "status": "operational",
            "algorithms_available": [
                "personalized_path_generation",
                "difficulty_progression",
                "prerequisite_sequencing",
                "performance_adaptation",
                "fallback_generation"
            ],
            "features": {
                "prerequisite_handling": True,
                "difficulty_adaptation": True,
                "learning_style_adaptation": True,
                "performance_based_adaptation": True,
                "fallback_mechanisms": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))