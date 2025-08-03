"""
Tests for learning path generation algorithms.
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime
from typing import List, Dict, Any

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.learning_path_service import LearningPathAlgorithm
from src.models.ai_models import (
    UserProfile,
    EducationLevel,
    DifficultyLevel,
    LearningStyle
)


class TestLearningPathAlgorithm:
    """Test suite for learning path generation algorithms."""
    
    @pytest.fixture
    def algorithm(self):
        """Create LearningPathAlgorithm instance for testing."""
        return LearningPathAlgorithm()
    
    @pytest.fixture
    def sample_user_profile(self):
        """Create sample user profile for testing."""
        return UserProfile(
            user_id="test_user_123",
            education_level=EducationLevel.K12,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.BEGINNER},
            learning_preferences={
                "learning_style": "visual",
                "time_commitment": 10,
                "preferred_formats": ["video", "interactive"]
            },
            goals=["learn algebra", "master fractions"],
            interaction_history=[
                {
                    "subject": "mathematics",
                    "success_rate": 0.8,
                    "topics": ["arithmetic", "basic_math"],
                    "timestamp": "2024-01-01"
                }
            ]
        )
    
    @pytest.fixture
    def sample_objectives(self):
        """Create sample learning objectives for testing."""
        return [
            {
                "id": "obj_1",
                "title": "Basic Arithmetic",
                "description": "Learn addition and subtraction",
                "difficulty": DifficultyLevel.BEGINNER,
                "prerequisites": [],
                "skills_gained": ["addition", "subtraction"],
                "topics": ["arithmetic"]
            },
            {
                "id": "obj_2", 
                "title": "Multiplication",
                "description": "Learn multiplication tables",
                "difficulty": DifficultyLevel.BEGINNER,
                "prerequisites": ["obj_1"],
                "skills_gained": ["multiplication"],
                "topics": ["arithmetic"]
            },
            {
                "id": "obj_3",
                "title": "Fractions",
                "description": "Understand fractions and decimals",
                "difficulty": DifficultyLevel.INTERMEDIATE,
                "prerequisites": ["obj_1", "obj_2"],
                "skills_gained": ["fractions", "decimals"],
                "topics": ["fractions"]
            }
        ]
    
    def test_generate_personalized_path_basic(self, algorithm, sample_user_profile):
        """Test basic personalized path generation."""
        result = algorithm.generate_personalized_path(
            user_profile=sample_user_profile,
            subject="mathematics",
            learning_goals=["learn algebra"],
            time_commitment=10
        )
        
        # Verify basic structure
        assert "path_id" in result
        assert "user_id" in result
        assert "subject" in result
        assert "objectives" in result
        assert "total_estimated_hours" in result
        assert "difficulty_progression" in result
        assert "milestones" in result
        
        # Verify content
        assert result["user_id"] == "test_user_123"
        assert result["subject"] == "mathematics"
        assert isinstance(result["objectives"], list)
        assert len(result["objectives"]) > 0
        assert result["total_estimated_hours"] > 0
    
    def test_generate_personalized_path_with_learning_style(self, algorithm, sample_user_profile):
        """Test path generation adapts to learning style."""
        # Test visual learning style
        sample_user_profile.learning_preferences["learning_style"] = "visual"
        result = algorithm.generate_personalized_path(
            user_profile=sample_user_profile,
            subject="mathematics",
            learning_goals=["learn geometry"],
            time_commitment=8
        )
        
        # Check that objectives have visual format recommendations
        for obj in result["objectives"]:
            if "recommended_formats" in obj:
                assert any(fmt in ["video", "infographic", "diagram"] 
                          for fmt in obj["recommended_formats"])
    
    def test_adapt_path_based_on_performance_struggling(self, algorithm, sample_user_profile):
        """Test path adaptation when user is struggling."""
        current_path = {
            "path_id": "test_path",
            "objectives": [
                {
                    "id": "obj_1",
                    "title": "Algebra Basics",
                    "difficulty": DifficultyLevel.INTERMEDIATE,
                    "estimated_hours": 4,
                    "topics": ["algebra"]
                }
            ],
            "difficulty_progression": {"starting_level": DifficultyLevel.INTERMEDIATE},
            "adaptation_history": []
        }
        
        performance_data = {
            "comprehension_score": 45,  # Below 60% threshold
            "struggling_concepts": ["algebra"],
            "mastered_concepts": [],
            "engagement_metrics": {"attention_score": 60}
        }
        
        adapted_path = algorithm.adapt_path_based_on_performance(
            current_path=current_path,
            performance_data=performance_data,
            user_profile=sample_user_profile
        )
        
        # Verify adaptation occurred
        assert "adaptation_history" in adapted_path
        assert len(adapted_path["adaptation_history"]) > 0
        
        # Check that remedial content was added
        objectives = adapted_path["objectives"]
        assert any(obj.get("remedial_content") for obj in objectives)
    
    def test_adapt_path_based_on_performance_mastery(self, algorithm, sample_user_profile):
        """Test path adaptation when user shows mastery."""
        current_path = {
            "path_id": "test_path",
            "objectives": [
                {
                    "id": "obj_1",
                    "title": "Basic Math",
                    "difficulty": DifficultyLevel.BEGINNER,
                    "estimated_hours": 4,
                    "topics": ["arithmetic"]
                }
            ],
            "difficulty_progression": {"starting_level": DifficultyLevel.BEGINNER},
            "adaptation_history": []
        }
        
        performance_data = {
            "comprehension_score": 95,  # Above 90% threshold
            "struggling_concepts": [],
            "mastered_concepts": ["arithmetic"],
            "engagement_metrics": {"attention_score": 90}
        }
        
        adapted_path = algorithm.adapt_path_based_on_performance(
            current_path=current_path,
            performance_data=performance_data,
            user_profile=sample_user_profile
        )
        
        # Verify adaptation occurred
        assert "adaptation_history" in adapted_path
        assert len(adapted_path["adaptation_history"]) > 0
        
        # Check that content was accelerated
        objectives = adapted_path["objectives"]
        assert any(obj.get("accelerated") for obj in objectives)
    
    def test_sequence_with_prerequisites(self, algorithm, sample_objectives):
        """Test objective sequencing based on prerequisites."""
        # Shuffle objectives to test ordering
        shuffled_objectives = [sample_objectives[2], sample_objectives[0], sample_objectives[1]]
        
        sequenced = algorithm.sequence_with_prerequisites(shuffled_objectives)
        
        # Verify correct ordering
        assert len(sequenced) == 3
        
        # Find positions of objectives
        positions = {}
        for i, obj in enumerate(sequenced):
            positions[obj["id"]] = i
        
        # obj_1 should come before obj_2 and obj_3
        assert positions["obj_1"] < positions["obj_2"]
        assert positions["obj_1"] < positions["obj_3"]
        
        # obj_2 should come before obj_3 (since obj_3 depends on obj_2)
        assert positions["obj_2"] < positions["obj_3"]
        
        # Verify sequence numbers are added
        for i, obj in enumerate(sequenced):
            assert obj["sequence_number"] == i + 1
    
    def test_sequence_with_completed_prerequisites(self, algorithm, sample_objectives):
        """Test sequencing when some prerequisites are already completed."""
        completed = ["obj_1"]  # User has completed obj_1
        
        sequenced = algorithm.sequence_with_prerequisites(
            sample_objectives, 
            user_completed=completed
        )
        
        # Verify prerequisites_met is correctly set
        for obj in sequenced:
            if obj["id"] == "obj_2":
                assert obj["prerequisites_met"] == True  # obj_1 is completed
            elif obj["id"] == "obj_3":
                # obj_3 needs both obj_1 and obj_2, only obj_1 is completed
                # This depends on the specific implementation logic
                pass
    
    def test_create_fallback_path_k12_math(self, algorithm):
        """Test fallback path creation for K-12 mathematics."""
        fallback_path = algorithm.create_fallback_path(
            education_level=EducationLevel.K12,
            subject="mathematics",
            learning_goals=["learn algebra"],
            time_commitment=8
        )
        
        # Verify basic structure
        assert "path_id" in fallback_path
        assert "subject" in fallback_path
        assert "education_level" in fallback_path
        assert "objectives" in fallback_path
        assert "source" in fallback_path
        
        # Verify content
        assert fallback_path["subject"] == "mathematics"
        assert fallback_path["education_level"] == EducationLevel.K12
        assert fallback_path["source"] == "fallback_algorithm"
        assert len(fallback_path["objectives"]) > 0
        
        # Verify objectives are appropriate for K-12 level
        for obj in fallback_path["objectives"]:
            assert obj["difficulty"] in [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE]
    
    def test_create_fallback_path_college_cs(self, algorithm):
        """Test fallback path creation for college computer science."""
        fallback_path = algorithm.create_fallback_path(
            education_level=EducationLevel.COLLEGE,
            subject="computer_science",
            learning_goals=["learn programming"],
            time_commitment=12
        )
        
        # Verify structure and content
        assert fallback_path["subject"] == "computer_science"
        assert fallback_path["education_level"] == EducationLevel.COLLEGE
        assert len(fallback_path["objectives"]) > 0
        
        # College level should have more advanced content
        difficulties = [obj["difficulty"] for obj in fallback_path["objectives"]]
        assert DifficultyLevel.INTERMEDIATE in difficulties or DifficultyLevel.ADVANCED in difficulties
    
    def test_create_fallback_path_unknown_subject(self, algorithm):
        """Test fallback path creation for unknown subject."""
        fallback_path = algorithm.create_fallback_path(
            education_level=EducationLevel.PROFESSIONAL,
            subject="quantum_physics",  # Not in predefined curricula
            learning_goals=["understand quantum mechanics"],
            time_commitment=6
        )
        
        # Should still create a valid path
        assert "objectives" in fallback_path
        assert len(fallback_path["objectives"]) > 0
        
        # Should contain generic objectives for the subject
        objectives_text = " ".join([obj["title"] for obj in fallback_path["objectives"]])
        assert "quantum_physics" in objectives_text.lower()
    
    def test_error_handling_in_path_generation(self, algorithm):
        """Test error handling in path generation."""
        # Test with invalid user profile
        invalid_profile = UserProfile(
            user_id="",  # Empty user ID
            education_level=EducationLevel.K12,
            subjects=[],
            skill_levels={},
            learning_preferences={},
            goals=[],
            interaction_history=[]
        )
        
        # Should handle gracefully and not crash
        try:
            result = algorithm.generate_personalized_path(
                user_profile=invalid_profile,
                subject="mathematics",
                learning_goals=[],
                time_commitment=0  # Invalid time commitment
            )
            # Should still return a valid structure
            assert "objectives" in result
        except Exception as e:
            # If it raises an exception, it should be a specific AIServiceError
            from src.utils.exceptions import AIServiceError
            assert isinstance(e, AIServiceError)
    
    def test_milestone_creation(self, algorithm, sample_objectives):
        """Test milestone creation from objectives."""
        milestones = algorithm._create_milestones(sample_objectives)
        
        # Should create at least one milestone
        assert len(milestones) > 0
        
        # Each milestone should have required fields
        for milestone in milestones:
            assert "id" in milestone
            assert "title" in milestone
            assert "description" in milestone
            assert "objectives" in milestone
            assert "completion_criteria" in milestone
            assert isinstance(milestone["objectives"], list)
            assert isinstance(milestone["completion_criteria"], list)
    
    def test_difficulty_progression_creation(self, algorithm, sample_objectives):
        """Test difficulty progression strategy creation."""
        progression = algorithm._create_difficulty_progression(
            sample_objectives,
            DifficultyLevel.BEGINNER
        )
        
        # Should have required fields
        assert "starting_level" in progression
        assert "target_level" in progression
        assert "progression_rate" in progression
        assert "milestones" in progression
        
        # Should progress from beginner
        assert progression["starting_level"] == DifficultyLevel.BEGINNER
        assert progression["target_level"] == DifficultyLevel.ADVANCED
    
    def test_learning_style_adaptation(self, algorithm, sample_objectives):
        """Test adaptation for different learning styles."""
        # Test visual learning style
        visual_adapted = algorithm._adapt_for_learning_style(
            sample_objectives,
            "visual",
            ["video", "infographic"]
        )
        
        for obj in visual_adapted:
            if "recommended_formats" in obj:
                assert "video" in obj["recommended_formats"] or "infographic" in obj["recommended_formats"]
        
        # Test auditory learning style
        auditory_adapted = algorithm._adapt_for_learning_style(
            sample_objectives,
            "auditory",
            ["audio", "podcast"]
        )
        
        for obj in auditory_adapted:
            if "recommended_formats" in obj:
                assert any(fmt in ["audio", "podcast"] for fmt in obj["recommended_formats"])
    
    def test_time_estimation_calculation(self, algorithm, sample_objectives):
        """Test time estimation for objectives."""
        timed_objectives = algorithm._calculate_time_estimates(sample_objectives, 10)
        
        # All objectives should have time estimates
        for obj in timed_objectives:
            assert "estimated_hours" in obj
            assert "estimated_weeks" in obj
            assert obj["estimated_hours"] > 0
            assert obj["estimated_weeks"] >= 1
        
        # More difficult objectives should take more time
        beginner_obj = next(obj for obj in timed_objectives if obj["difficulty"] == DifficultyLevel.BEGINNER)
        intermediate_obj = next(obj for obj in timed_objectives if obj["difficulty"] == DifficultyLevel.INTERMEDIATE)
        
        assert intermediate_obj["estimated_hours"] >= beginner_obj["estimated_hours"]
    
    @pytest.mark.asyncio
    async def test_performance_pattern_analysis(self, algorithm):
        """Test performance pattern analysis."""
        performance_data = {
            "comprehension_score": 75,
            "struggling_concepts": ["algebra", "geometry"],
            "mastered_concepts": ["arithmetic"],
            "engagement_metrics": {"attention_score": 80}
        }
        
        analysis = algorithm._analyze_performance_patterns(performance_data)
        
        # Should return analysis with expected fields
        assert "average_comprehension" in analysis
        assert "struggling_concepts" in analysis
        assert "mastered_concepts" in analysis
        assert "engagement_trend" in analysis
        
        # Should preserve the input data
        assert analysis["average_comprehension"] == 75
        assert "algebra" in analysis["struggling_concepts"]
        assert "arithmetic" in analysis["mastered_concepts"]
    
    def test_confidence_score_calculation(self, algorithm):
        """Test confidence score calculation."""
        interaction_history = [
            {"subject": "mathematics", "success_rate": 0.8},
            {"subject": "mathematics", "success_rate": 0.9},
            {"subject": "mathematics", "success_rate": 0.7},
            {"subject": "science", "success_rate": 0.6},  # Different subject
        ]
        
        confidence = algorithm._calculate_confidence_score(interaction_history, "mathematics")
        
        # Should be average of mathematics interactions only
        expected = (0.8 + 0.9 + 0.7) / 3
        assert abs(confidence - expected) < 0.01
        
        # Test with no interactions
        confidence_empty = algorithm._calculate_confidence_score([], "mathematics")
        assert confidence_empty == 0.5  # Neutral confidence
    
    def test_prerequisite_graph_building(self, algorithm, sample_objectives):
        """Test building prerequisite dependency graph."""
        dependency_graph = algorithm._build_objective_dependencies(sample_objectives)
        
        # Should have entries for all objectives
        assert "obj_1" in dependency_graph
        assert "obj_2" in dependency_graph
        assert "obj_3" in dependency_graph
        
        # Should correctly map prerequisites
        assert dependency_graph["obj_1"] == []  # No prerequisites
        assert "obj_1" in dependency_graph["obj_2"]  # obj_2 depends on obj_1
        assert "obj_1" in dependency_graph["obj_3"]  # obj_3 depends on obj_1
        assert "obj_2" in dependency_graph["obj_3"]  # obj_3 depends on obj_2


@pytest.mark.integration
class TestLearningPathIntegration:
    """Integration tests for learning path algorithms."""
    
    @pytest.fixture
    def algorithm(self):
        """Create algorithm instance for integration testing."""
        return LearningPathAlgorithm()
    
    def test_full_path_generation_workflow(self, algorithm):
        """Test complete workflow from user profile to adapted path."""
        # Step 1: Create user profile
        user_profile = UserProfile(
            user_id="integration_test_user",
            education_level=EducationLevel.COLLEGE,
            subjects=["computer_science"],
            skill_levels={"computer_science": DifficultyLevel.INTERMEDIATE},
            learning_preferences={
                "learning_style": "kinesthetic",
                "time_commitment": 15,
                "preferred_formats": ["interactive", "hands_on"]
            },
            goals=["learn data structures", "master algorithms"],
            interaction_history=[]
        )
        
        # Step 2: Generate initial path
        initial_path = algorithm.generate_personalized_path(
            user_profile=user_profile,
            subject="computer_science",
            learning_goals=["learn data structures", "master algorithms"],
            time_commitment=15
        )
        
        assert initial_path is not None
        assert len(initial_path["objectives"]) > 0
        
        # Step 3: Simulate performance data
        performance_data = {
            "comprehension_score": 85,
            "struggling_concepts": [],
            "mastered_concepts": ["basic_programming"],
            "engagement_metrics": {"attention_score": 90}
        }
        
        # Step 4: Adapt path based on performance
        adapted_path = algorithm.adapt_path_based_on_performance(
            current_path=initial_path,
            performance_data=performance_data,
            user_profile=user_profile
        )
        
        assert adapted_path is not None
        assert "adaptation_history" in adapted_path
        assert len(adapted_path["adaptation_history"]) > 0
        
        # Step 5: Verify the adaptation made sense
        adaptation_record = adapted_path["adaptation_history"][-1]
        assert adaptation_record["reason"] == "performance_based_adaptation"
        assert "changes" in adaptation_record
    
    def test_cross_education_level_paths(self, algorithm):
        """Test path generation across different education levels."""
        subjects = ["mathematics", "computer_science"]
        levels = [EducationLevel.K12, EducationLevel.COLLEGE, EducationLevel.PROFESSIONAL]
        
        for subject in subjects:
            for level in levels:
                path = algorithm.create_fallback_path(
                    education_level=level,
                    subject=subject,
                    learning_goals=[f"learn {subject}"],
                    time_commitment=10
                )
                
                # Each path should be valid and appropriate for the level
                assert path is not None
                assert path["education_level"] == level
                assert path["subject"] == subject
                assert len(path["objectives"]) > 0
                
                # Higher education levels should have more complex objectives
                if level == EducationLevel.PROFESSIONAL:
                    difficulties = [obj.get("difficulty", DifficultyLevel.BEGINNER) 
                                  for obj in path["objectives"]]
                    assert DifficultyLevel.ADVANCED in difficulties or DifficultyLevel.INTERMEDIATE in difficulties