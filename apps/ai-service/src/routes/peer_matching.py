"""
Peer matching routes for AI service.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from ..models.ai_models import (
    PeerMatchingRequest,
    PeerMatchingResponse
)
from ..services.ai_service import AIService

router = APIRouter()


class MatchFeedbackRequest(BaseModel):
    """Request model for updating match feedback."""
    user_id: str = Field(..., description="User identifier")
    peer_id: str = Field(..., description="Peer identifier")
    feedback_score: float = Field(..., description="Feedback score (0-1)")
    feedback_type: str = Field(..., description="Type of feedback")


async def get_ai_service() -> AIService:
    """Dependency to get AI service instance."""
    from ..main import ai_service
    return ai_service


@router.post("/", response_model=PeerMatchingResponse)
async def find_peer_matches(
    request: PeerMatchingRequest,
    strategy: Optional[str] = Query(None, description="Matching strategy: skill_complementarity, learning_goal_alignment, communication_compatibility, safety_focused, comprehensive"),
    max_matches: int = Query(10, description="Maximum number of matches to return"),
    ai_service: AIService = Depends(get_ai_service)
):
    """Find peer matches for collaborative learning using advanced algorithms."""
    try:
        matches = await ai_service.find_peer_matches(
            request=request,
            strategy=strategy,
            max_matches=max_matches
        )
        
        return PeerMatchingResponse(
            user_id=request.user_id,
            matches=matches,
            total_matches=len(matches)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def update_match_feedback(
    request: MatchFeedbackRequest,
    ai_service: AIService = Depends(get_ai_service)
):
    """Update feedback for a peer match to improve future recommendations."""
    try:
        await ai_service.update_peer_match_feedback(
            user_id=request.user_id,
            peer_id=request.peer_id,
            feedback_score=request.feedback_score,
            feedback_type=request.feedback_type
        )
        
        return {
            "success": True,
            "message": f"Updated match feedback for user {request.user_id} and peer {request.peer_id}",
            "feedback_score": request.feedback_score
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/{user_id}")
async def get_matching_analytics(
    user_id: str,
    time_period: int = Query(30, description="Time period in days"),
    ai_service: AIService = Depends(get_ai_service)
):
    """Get peer matching analytics for a user."""
    try:
        analytics = await ai_service.get_peer_matching_analytics(
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
    """Get available peer matching strategies."""
    try:
        return {
            "strategies": [
                {
                    "name": "skill_complementarity",
                    "description": "Matches peers based on complementary skills for mutual learning",
                    "best_for": "Finding peers who can teach and learn from each other"
                },
                {
                    "name": "learning_goal_alignment",
                    "description": "Matches peers with similar or complementary learning goals",
                    "best_for": "Finding study partners with shared objectives"
                },
                {
                    "name": "communication_compatibility",
                    "description": "Matches based on communication styles and time zone compatibility",
                    "best_for": "Ensuring effective collaboration and scheduling"
                },
                {
                    "name": "safety_focused",
                    "description": "Prioritizes safety considerations, especially for different age groups",
                    "best_for": "Safe matching for minors and age-appropriate pairing"
                },
                {
                    "name": "comprehensive",
                    "description": "Combines all strategies for optimal peer matching",
                    "best_for": "Balanced matching considering all factors"
                }
            ],
            "default_strategy": "comprehensive"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/engine/status")
async def get_matching_engine_status():
    """Get status of the peer matching engine."""
    try:
        return {
            "status": "operational",
            "algorithms_available": [
                "skill_complementarity_analysis",
                "learning_goal_alignment",
                "communication_compatibility_matching",
                "safety_focused_matching",
                "comprehensive_matching"
            ],
            "features": {
                "skill_complementarity": True,
                "learning_goal_alignment": True,
                "communication_compatibility": True,
                "timezone_matching": True,
                "safety_filtering": True,
                "age_appropriate_matching": True,
                "feedback_learning": True,
                "real_time_availability": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))