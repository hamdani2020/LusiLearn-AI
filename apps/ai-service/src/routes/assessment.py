"""
Assessment routes for AI-powered skill assessment generation.
"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from ..services.ai_service import AIService
from ..utils.exceptions import AIServiceError

logger = logging.getLogger(__name__)

router = APIRouter()


class SkillAssessmentRequest(BaseModel):
    """Request model for skill assessment generation."""
    user_id: str
    subject: Optional[str] = None
    education_level: Optional[str] = None
    learning_style: Optional[List[str]] = None
    current_level: Optional[str] = None
    num_questions: Optional[int] = 10


class SkillAssessmentQuestion(BaseModel):
    """Model for skill assessment questions."""
    id: str
    question: str
    type: str  # multiple_choice, true_false, rating, text
    category: str
    difficulty: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None


class SkillAssessmentResponse(BaseModel):
    """Response model for skill assessment generation."""
    questions: List[SkillAssessmentQuestion]
    total_questions: int
    estimated_duration: int
    subject: str
    difficulty_range: str


class SkillAssessmentEvaluationRequest(BaseModel):
    """Request model for skill assessment evaluation."""
    user_id: str
    answers: Dict[str, Any]


# Global AI service instance (will be set during startup)
ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get the AI service instance."""
    if ai_service is None:
        raise HTTPException(status_code=503, detail="AI service not initialized")
    return ai_service


@router.post("/generate-questions", response_model=SkillAssessmentResponse)
async def generate_skill_assessment_questions(
    request: SkillAssessmentRequest,
    ai_svc: AIService = Depends(get_ai_service)
):
    """
    Generate skill assessment questions using AI.
    
    This endpoint creates personalized skill assessment questions based on:
    - User's education level
    - Learning style preferences
    - Subject area
    - Current skill level
    """
    try:
        logger.info(f"Generating skill assessment questions for user {request.user_id}")
        
        # Prepare the request for AI service
        ai_request = {
            "user_id": request.user_id,
            "subject": request.subject or "general",
            "education_level": request.education_level or "high_school",
            "learning_style": request.learning_style or ["visual", "auditory"],
            "current_level": request.current_level or "beginner",
            "num_questions": request.num_questions or 10
        }
        
        # Generate questions using AI
        ai_response = await ai_svc.generate_skill_assessment_questions(ai_request)
        
        # Convert AI response to our format
        questions = []
        for i, q_data in enumerate(ai_response.get("questions", [])):
            question = SkillAssessmentQuestion(
                id=f"q_{request.user_id}_{i}",
                question=q_data.get("question", f"Question {i+1}"),
                type=q_data.get("type", "multiple_choice"),
                category=q_data.get("category", "general"),
                difficulty=q_data.get("difficulty", "beginner"),
                options=q_data.get("options"),
                correct_answer=q_data.get("correct_answer")
            )
            questions.append(question)
        
        # If AI didn't generate enough questions, add fallback questions
        if len(questions) < request.num_questions:
            fallback_questions = generate_fallback_questions(
                request.subject or "general",
                request.num_questions - len(questions)
            )
            questions.extend(fallback_questions)
        
        response = SkillAssessmentResponse(
            questions=questions,
            total_questions=len(questions),
            estimated_duration=len(questions) * 30,  # 30 seconds per question
            subject=request.subject or "general",
            difficulty_range=f"{request.current_level or 'beginner'} to advanced"
        )
        
        logger.info(f"Generated {len(questions)} questions for user {request.user_id}")
        return response
        
    except AIServiceError as e:
        logger.error(f"AI service error generating questions: {e}")
        # Fallback to algorithmic questions
        fallback_questions = generate_fallback_questions(
            request.subject or "general",
            request.num_questions or 10
        )
        
        response = SkillAssessmentResponse(
            questions=fallback_questions,
            total_questions=len(fallback_questions),
            estimated_duration=len(fallback_questions) * 30,
            subject=request.subject or "general",
            difficulty_range=f"{request.current_level or 'beginner'} to advanced"
        )
        
        logger.info(f"Using fallback questions for user {request.user_id}")
        return response
        
    except Exception as e:
        logger.error(f"Error generating skill assessment questions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate skill assessment questions"
        )


def generate_fallback_questions(subject: str, num_questions: int) -> List[SkillAssessmentQuestion]:
    """Generate fallback questions when AI is unavailable."""
    questions = []
    
    # Subject-specific question templates
    subject_questions = {
        "mathematics": [
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
        ],
        "science": [
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
        ],
        "language": [
            {
                "question": "How would you rate your reading comprehension skills?",
                "type": "rating",
                "category": "reading",
                "difficulty": "beginner"
            },
            {
                "question": "Are you comfortable with creative writing?",
                "type": "multiple_choice",
                "category": "writing",
                "difficulty": "intermediate",
                "options": ["Very comfortable", "Somewhat comfortable", "Not comfortable", "Never tried"]
            }
        ],
        "general": [
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
    }
    
    # Get questions for the subject, fallback to general if not found
    available_questions = subject_questions.get(subject.lower(), subject_questions["general"])
    
    # Generate the requested number of questions
    for i in range(min(num_questions, len(available_questions))):
        q_data = available_questions[i % len(available_questions)]
        question = SkillAssessmentQuestion(
            id=f"fallback_q_{i}",
            question=q_data["question"],
            type=q_data["type"],
            category=q_data["category"],
            difficulty=q_data["difficulty"],
            options=q_data.get("options"),
            correct_answer=q_data.get("correct_answer")
        )
        questions.append(question)
    
    return questions


@router.post("/evaluate")
async def evaluate_skill_assessment(
    request: SkillAssessmentEvaluationRequest,
    ai_svc: AIService = Depends(get_ai_service)
):
    """
    Evaluate skill assessment answers using AI.
    
    This endpoint analyzes user responses to provide:
    - Overall skill level assessment
    - Strengths and areas for improvement
    - Personalized recommendations
    """
    try:
        logger.info(f"Evaluating skill assessment for user {request.user_id}")
        
        # Prepare evaluation request
        evaluation_request = {
            "user_id": request.user_id,
            "answers": request.answers,
            "timestamp": "2025-08-19T02:34:00.868Z"
        }
        
        # Use AI to evaluate responses
        evaluation_result = await ai_svc.evaluate_skill_assessment(evaluation_request)
        
        return {
            "success": True,
            "data": evaluation_result,
            "message": "Skill assessment evaluated successfully"
        }
        
    except AIServiceError as e:
        logger.error(f"AI service error evaluating assessment: {e}")
        # Fallback to algorithmic evaluation
        fallback_result = evaluate_fallback_assessment(request.answers)
        
        return {
            "success": True,
            "data": fallback_result,
            "message": "Skill assessment evaluated using fallback method"
        }
        
    except Exception as e:
        logger.error(f"Error evaluating skill assessment: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to evaluate skill assessment"
        )


def evaluate_fallback_assessment(answers: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate assessment using fallback algorithm when AI is unavailable."""
    # Simple algorithmic evaluation
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
            if answer.lower() in ["very comfortable", "excellent", "advanced"]:
                scores.append(5)
            elif answer.lower() in ["comfortable", "good", "intermediate"]:
                scores.append(4)
            elif answer.lower() in ["somewhat comfortable", "fair", "beginner"]:
                scores.append(3)
            elif answer.lower() in ["not comfortable", "poor", "novice"]:
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