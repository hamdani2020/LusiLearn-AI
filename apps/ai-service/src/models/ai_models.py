"""
Pydantic models for AI service requests and responses.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class EducationLevel(str, Enum):
    """Education level enumeration."""
    K12 = "k12"
    COLLEGE = "college"
    PROFESSIONAL = "professional"


class DifficultyLevel(str, Enum):
    """Difficulty level enumeration."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class LearningStyle(str, Enum):
    """Learning style enumeration."""
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING = "reading"


class ContentFormat(str, Enum):
    """Content format enumeration."""
    VIDEO = "video"
    ARTICLE = "article"
    INTERACTIVE = "interactive"
    AUDIO = "audio"
    DOCUMENT = "document"


class LearningContext(str, Enum):
    """Learning context enumeration."""
    SELF_PACED = "self_paced"
    CLASSROOM = "classroom"
    GROUP_STUDY = "group_study"
    EXAM_PREP = "exam_prep"


# Request Models
class LearningPathRequest(BaseModel):
    """Request model for learning path generation."""
    user_id: str = Field(..., description="User identifier")
    subject: str = Field(..., description="Subject area")
    education_level: EducationLevel = Field(..., description="Education level")
    current_level: DifficultyLevel = Field(..., description="Current skill level")
    learning_goals: List[str] = Field(..., description="Learning objectives")
    time_commitment: int = Field(..., description="Hours per week available")
    learning_style: LearningStyle = Field(..., description="Preferred learning style")
    prerequisites: Optional[List[str]] = Field(default=[], description="Prerequisites completed")
    
    @validator('time_commitment')
    def validate_time_commitment(cls, v):
        if v < 1 or v > 40:
            raise ValueError('Time commitment must be between 1 and 40 hours per week')
        return v


class ContentRecommendationRequest(BaseModel):
    """Request model for content recommendations."""
    user_id: str = Field(..., description="User identifier")
    current_topic: str = Field(..., description="Current learning topic")
    education_level: EducationLevel = Field(..., description="Education level")
    skill_level: DifficultyLevel = Field(..., description="Current skill level")
    learning_context: LearningContext = Field(..., description="Learning context")
    preferred_formats: List[ContentFormat] = Field(..., description="Preferred content formats")
    max_duration: Optional[int] = Field(default=60, description="Max content duration in minutes")
    exclude_content: Optional[List[str]] = Field(default=[], description="Content IDs to exclude")


class PeerMatchingRequest(BaseModel):
    """Request model for peer matching."""
    user_id: str = Field(..., description="User identifier")
    education_level: EducationLevel = Field(..., description="Education level")
    subjects: List[str] = Field(..., description="Subjects of interest")
    skill_levels: Dict[str, DifficultyLevel] = Field(..., description="Skill levels by subject")
    learning_goals: List[str] = Field(..., description="Learning goals")
    availability: Dict[str, List[str]] = Field(..., description="Available time slots")
    communication_preferences: List[str] = Field(..., description="Communication preferences")
    age_range: Optional[str] = Field(default=None, description="Age range for matching")


class EmbeddingRequest(BaseModel):
    """Request model for creating embeddings."""
    texts: List[str] = Field(..., description="Texts to embed")
    model: Optional[str] = Field(default="text-embedding-ada-002", description="Embedding model")
    
    @validator('texts')
    def validate_texts(cls, v):
        if len(v) > 100:
            raise ValueError('Maximum 100 texts per request')
        return v


# Response Models
class LearningObjective(BaseModel):
    """Learning objective model."""
    id: str = Field(..., description="Objective identifier")
    title: str = Field(..., description="Objective title")
    description: str = Field(..., description="Objective description")
    difficulty: DifficultyLevel = Field(..., description="Objective difficulty")
    estimated_hours: int = Field(..., description="Estimated completion time")
    prerequisites: List[str] = Field(default=[], description="Required prerequisites")
    skills_gained: List[str] = Field(default=[], description="Skills gained")


class LearningPathResponse(BaseModel):
    """Response model for learning path generation."""
    path_id: str = Field(..., description="Generated path identifier")
    user_id: str = Field(..., description="User identifier")
    subject: str = Field(..., description="Subject area")
    objectives: List[LearningObjective] = Field(..., description="Learning objectives")
    total_estimated_hours: int = Field(..., description="Total estimated completion time")
    difficulty_progression: str = Field(..., description="Difficulty progression description")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    source: str = Field(default="ai_generated", description="Generation source")


class ContentRecommendation(BaseModel):
    """Content recommendation model."""
    content_id: str = Field(..., description="Content identifier")
    title: str = Field(..., description="Content title")
    description: str = Field(..., description="Content description")
    url: Optional[str] = Field(default=None, description="Content URL")
    difficulty: DifficultyLevel = Field(..., description="Content difficulty")
    format: ContentFormat = Field(..., description="Content format")
    duration_minutes: int = Field(..., description="Content duration")
    topics: List[str] = Field(default=[], description="Covered topics")
    source: str = Field(..., description="Content source")
    relevance_score: float = Field(..., description="Relevance score (0-1)")
    quality_score: float = Field(..., description="Quality score (0-1)")


class ContentRecommendationResponse(BaseModel):
    """Response model for content recommendations."""
    user_id: str = Field(..., description="User identifier")
    topic: str = Field(..., description="Requested topic")
    recommendations: List[ContentRecommendation] = Field(..., description="Content recommendations")
    total_count: int = Field(..., description="Total recommendations returned")
    generated_at: datetime = Field(default_factory=datetime.now, description="Generation timestamp")
    source: str = Field(default="ai_generated", description="Generation source")


class PeerMatch(BaseModel):
    """Peer match model."""
    user_id: str = Field(..., description="Matched user identifier")
    compatibility_score: float = Field(..., description="Compatibility score (0-1)")
    shared_subjects: List[str] = Field(..., description="Shared subjects")
    complementary_skills: Dict[str, str] = Field(..., description="Complementary skills")
    common_goals: List[str] = Field(..., description="Common learning goals")
    availability_overlap: List[str] = Field(..., description="Overlapping availability")
    communication_match: List[str] = Field(..., description="Matching communication preferences")
    match_reasons: List[str] = Field(..., description="Reasons for the match")


class PeerMatchingResponse(BaseModel):
    """Response model for peer matching."""
    user_id: str = Field(..., description="Requesting user identifier")
    matches: List[PeerMatch] = Field(..., description="Peer matches")
    total_matches: int = Field(..., description="Total matches found")
    generated_at: datetime = Field(default_factory=datetime.now, description="Generation timestamp")
    source: str = Field(default="ai_generated", description="Generation source")


class AIResponse(BaseModel):
    """Generic AI response model."""
    success: bool = Field(..., description="Request success status")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Response data")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    processing_time_ms: Optional[int] = Field(default=None, description="Processing time")
    source: str = Field(default="ai_service", description="Response source")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")


class HealthCheckResponse(BaseModel):
    """Health check response model."""
    status: str = Field(..., description="Overall health status")
    timestamp: datetime = Field(..., description="Check timestamp")
    services: Dict[str, Dict[str, Any]] = Field(..., description="Individual service statuses")
    overall_latency_ms: int = Field(..., description="Overall check latency")


# Utility Models
class UserProfile(BaseModel):
    """User profile model for AI processing."""
    user_id: str = Field(..., description="User identifier")
    education_level: EducationLevel = Field(..., description="Education level")
    age_range: Optional[str] = Field(default=None, description="Age range")
    subjects: List[str] = Field(default=[], description="Subjects of interest")
    skill_levels: Dict[str, DifficultyLevel] = Field(default={}, description="Skill levels")
    learning_preferences: Dict[str, Any] = Field(default={}, description="Learning preferences")
    goals: List[str] = Field(default=[], description="Learning goals")
    interaction_history: List[Dict[str, Any]] = Field(default=[], description="Past interactions")


class ContentItem(BaseModel):
    """Content item model for AI processing."""
    content_id: str = Field(..., description="Content identifier")
    title: str = Field(..., description="Content title")
    description: str = Field(..., description="Content description")
    subject: str = Field(..., description="Subject area")
    topics: List[str] = Field(default=[], description="Covered topics")
    difficulty: DifficultyLevel = Field(..., description="Content difficulty")
    format: ContentFormat = Field(..., description="Content format")
    duration_minutes: int = Field(..., description="Duration in minutes")
    source: str = Field(..., description="Content source")
    url: Optional[str] = Field(default=None, description="Content URL")
    embedding: Optional[List[float]] = Field(default=None, description="Content embedding")
    metadata: Dict[str, Any] = Field(default={}, description="Additional metadata")