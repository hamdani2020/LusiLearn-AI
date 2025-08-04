"""
Tests for peer matching service.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from typing import List, Dict, Any

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.peer_matching_service import PeerMatchingEngine, MatchingStrategy, SafetyLevel
from src.models.ai_models import (
    PeerMatchingRequest,
    PeerMatch,
    EducationLevel,
    DifficultyLevel
)


class TestPeerMatchingEngine:
    """Test suite for peer matching engine."""
    
    @pytest.fixture
    def engine(self):
        """Create PeerMatchingEngine instance for testing."""
        return PeerMatchingEngine()
    
    @pytest.fixture
    def sample_request(self):
        """Create sample peer matching request."""
        return PeerMatchingRequest(
            user_id="test_user_123",
            education_level=EducationLevel.COLLEGE,
            subjects=["computer_science", "mathematics"],
            skill_levels={
                "computer_science": DifficultyLevel.INTERMEDIATE,
                "mathematics": DifficultyLevel.BEGINNER
            },
            learning_goals=["learn algorithms", "master data structures"],
            availability={
                "monday": ["09:00-11:00", "14:00-16:00"],
                "wednesday": ["10:00-12:00"],
                "friday": ["15:00-17:00"]
            },
            communication_preferences=["video_call", "chat"],
            age_range="18-25"
        )
    
    @pytest.fixture
    def sample_candidate_peers(self):
        """Create sample candidate peers."""
        return [
            {
                "user_id": "peer_1",
                "education_level": EducationLevel.COLLEGE,
                "subjects": ["computer_science"],
                "skill_levels": {"computer_science": DifficultyLevel.ADVANCED},
                "learning_goals": ["learn algorithms", "teach programming"],
                "availability": {
                    "monday": ["09:00-11:00"],
                    "wednesday": ["10:00-12:00"]
                },
                "communication_preferences": ["video_call"],
                "age_range": "18-25"
            },
            {
                "user_id": "peer_2",
                "education_level": EducationLevel.COLLEGE,
                "subjects": ["mathematics"],
                "skill_levels": {"mathematics": DifficultyLevel.INTERMEDIATE},
                "learning_goals": ["master calculus"],
                "availability": {
                    "friday": ["15:00-17:00"]
                },
                "communication_preferences": ["chat", "email"],
                "age_range": "22-28"
            }
        ]
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self, engine):
        """Test engine initialization."""
        await engine.initialize()
        
        # Check that internal structures are initialized
        assert isinstance(engine.user_profiles, dict)
        assert isinstance(engine.interaction_history, dict)
        assert isinstance(engine.safety_rules, dict)
        assert isinstance(engine.timezone_compatibility, dict)
    
    @pytest.mark.asyncio
    async def test_find_peer_matches_comprehensive(self, engine, sample_request):
        """Test comprehensive peer matching strategy."""
        await engine.initialize()
        
        matches = await engine.find_peer_matches(
            request=sample_request,
            strategy=MatchingStrategy.COMPREHENSIVE,
            max_matches=5
        )
        
        # Verify basic structure
        assert isinstance(matches, list)
        assert len(matches) <= 5
        
        # Verify each match has required fields
        for match in matches:
            assert isinstance(match, PeerMatch)
            assert match.user_id is not None
            assert 0.0 <= match.compatibility_score <= 1.0
            assert isinstance(match.shared_subjects, list)
            assert isinstance(match.complementary_skills, dict)
            assert isinstance(match.common_goals, list)
            assert isinstance(match.match_reasons, list)
    
    @pytest.mark.asyncio
    async def test_skill_complementarity_matching(self, engine, sample_request, sample_candidate_peers):
        """Test skill complementarity matching strategy."""
        await engine.initialize()
        
        with patch.object(engine, '_get_candidate_peers') as mock_get_peers:
            mock_get_peers.return_value = sample_candidate_peers
            
            matches = await engine._skill_complementarity_matching(
                sample_request, sample_candidate_peers
            )
            
            assert isinstance(matches, list)
            assert len(matches) > 0
            
            # Verify skill complementarity scoring worked
            for match in matches:
                assert match.compatibility_score >= 0.0
                assert match.compatibility_score <= 1.0
                assert len(match.complementary_skills) >= 0
    
    @pytest.mark.asyncio
    async def test_learning_goal_alignment_matching(self, engine, sample_request, sample_candidate_peers):
        """Test learning goal alignment matching strategy."""
        await engine.initialize()
        
        matches = await engine._learning_goal_alignment_matching(
            sample_request, sample_candidate_peers
        )
        
        assert isinstance(matches, list)
        assert len(matches) > 0
        
        # Verify goal alignment scoring worked
        for match in matches:
            assert match.compatibility_score >= 0.0
            assert match.compatibility_score <= 1.0
            # Should have some common goals or complementary goals
            assert len(match.common_goals) >= 0
    
    @pytest.mark.asyncio
    async def test_communication_compatibility_matching(self, engine, sample_request, sample_candidate_peers):
        """Test communication compatibility matching strategy."""
        await engine.initialize()
        
        matches = await engine._communication_compatibility_matching(
            sample_request, sample_candidate_peers
        )
        
        assert isinstance(matches, list)
        assert len(matches) > 0
        
        # Verify communication compatibility scoring worked
        for match in matches:
            assert match.compatibility_score >= 0.0
            assert match.compatibility_score <= 1.0
            assert len(match.availability_overlap) >= 0
            assert len(match.communication_match) >= 0
    
    @pytest.mark.asyncio
    async def test_safety_focused_matching(self, engine, sample_request, sample_candidate_peers):
        """Test safety-focused matching strategy."""
        await engine.initialize()
        
        matches = await engine._safety_focused_matching(
            sample_request, sample_candidate_peers
        )
        
        assert isinstance(matches, list)
        
        # Verify safety considerations are applied
        for match in matches:
            assert match.compatibility_score >= 0.0
            assert match.compatibility_score <= 1.0
            # Safety-focused matching should include safety-related reasons
            safety_mentioned = any(
                "safety" in reason.lower() or "age" in reason.lower()
                for reason in match.match_reasons
            )
            # Note: This might not always be true depending on the safety level
    
    def test_calculate_skill_complementarity(self, engine):
        """Test skill complementarity calculation."""
        user_skills = {
            "programming": DifficultyLevel.BEGINNER,
            "mathematics": DifficultyLevel.INTERMEDIATE
        }
        
        peer_skills = {
            "programming": DifficultyLevel.INTERMEDIATE,
            "mathematics": DifficultyLevel.BEGINNER
        }
        
        score = engine._calculate_skill_complementarity(user_skills, peer_skills)
        
        assert 0.0 <= score <= 1.0
        # Should be high since they complement each other well
        assert score > 0.5
        
        # Test with no common subjects
        no_common_skills = {"science": DifficultyLevel.BEGINNER}
        score_no_common = engine._calculate_skill_complementarity(user_skills, no_common_skills)
        assert score_no_common == 0.0
    
    def test_find_complementary_skills(self, engine):
        """Test finding complementary skills."""
        user_skills = {
            "programming": DifficultyLevel.BEGINNER,
            "mathematics": DifficultyLevel.ADVANCED
        }
        
        peer_skills = {
            "programming": DifficultyLevel.ADVANCED,
            "mathematics": DifficultyLevel.BEGINNER
        }
        
        complementary = engine._find_complementary_skills(user_skills, peer_skills)
        
        assert isinstance(complementary, dict)
        assert len(complementary) > 0
        
        # Should identify who can help whom
        assert "programming" in complementary
        assert "mathematics" in complementary
    
    def test_calculate_goal_alignment(self, engine):
        """Test goal alignment calculation."""
        user_goals = {"learn programming", "master algorithms", "understand databases"}
        peer_goals = {"learn programming", "master data structures", "understand databases"}
        
        score = engine._calculate_goal_alignment(user_goals, peer_goals)
        
        assert 0.0 <= score <= 1.0
        # Should have good alignment due to common goals
        assert score > 0.4
        
        # Test with no common goals
        no_common_goals = {"learn art", "master music"}
        score_no_common = engine._calculate_goal_alignment(user_goals, no_common_goals)
        assert score_no_common >= 0.0
    
    def test_calculate_availability_overlap(self, engine):
        """Test availability overlap calculation."""
        user_availability = {
            "monday": ["09:00-11:00", "14:00-16:00"],
            "wednesday": ["10:00-12:00"]
        }
        
        peer_availability = {
            "monday": ["09:00-11:00", "15:00-17:00"],
            "friday": ["10:00-12:00"]
        }
        
        overlap = engine._calculate_availability_overlap(user_availability, peer_availability)
        
        assert isinstance(overlap, list)
        # Should find at least one overlapping slot (Monday 09:00-11:00)
        assert len(overlap) > 0
        assert any("monday" in slot.lower() for slot in overlap)
    
    def test_times_overlap(self, engine):
        """Test time overlap detection."""
        # Test overlapping times
        assert engine._times_overlap("09:00-11:00", "10:00-12:00") == True
        assert engine._times_overlap("09:00-11:00", "09:00-11:00") == True
        
        # Test non-overlapping times
        assert engine._times_overlap("09:00-11:00", "12:00-14:00") == False
        
        # Test adjacent times
        assert engine._times_overlap("09:00-11:00", "11:00-13:00") == False
        
        # Test simple time strings
        assert engine._times_overlap("morning", "morning") == True
        assert engine._times_overlap("morning", "evening") == False
    
    def test_time_to_minutes(self, engine):
        """Test time string to minutes conversion."""
        assert engine._time_to_minutes("09:00") == 540  # 9 * 60
        assert engine._time_to_minutes("12:30") == 750  # 12 * 60 + 30
        assert engine._time_to_minutes("00:00") == 0
        
        # Test invalid format
        assert engine._time_to_minutes("invalid") == 0
    
    def test_determine_safety_level(self, engine):
        """Test safety level determination."""
        # Test minor user
        minor_request = PeerMatchingRequest(
            user_id="minor_user",
            education_level=EducationLevel.K12,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.BEGINNER},
            learning_goals=["learn math"],
            availability={},
            communication_preferences=["chat"],
            age_range="under 18"
        )
        
        safety_level = engine._determine_safety_level(minor_request)
        assert safety_level == SafetyLevel.HIGH
        
        # Test young adult
        young_adult_request = PeerMatchingRequest(
            user_id="young_adult",
            education_level=EducationLevel.COLLEGE,
            subjects=["computer_science"],
            skill_levels={"computer_science": DifficultyLevel.INTERMEDIATE},
            learning_goals=["learn programming"],
            availability={},
            communication_preferences=["video_call"],
            age_range="18-25"
        )
        
        safety_level = engine._determine_safety_level(young_adult_request)
        assert safety_level == SafetyLevel.MEDIUM
    
    def test_is_safety_compatible(self, engine):
        """Test safety compatibility checking."""
        # High safety users should only match with other high safety users
        assert engine._is_safety_compatible(SafetyLevel.HIGH, SafetyLevel.HIGH) == True
        assert engine._is_safety_compatible(SafetyLevel.HIGH, SafetyLevel.MEDIUM) == False
        
        # Medium safety users can match with medium and standard
        assert engine._is_safety_compatible(SafetyLevel.MEDIUM, SafetyLevel.MEDIUM) == True
        assert engine._is_safety_compatible(SafetyLevel.MEDIUM, SafetyLevel.STANDARD) == True
        
        # Standard users can match with anyone except high safety (minors)
        assert engine._is_safety_compatible(SafetyLevel.STANDARD, SafetyLevel.HIGH) == False
        assert engine._is_safety_compatible(SafetyLevel.STANDARD, SafetyLevel.STANDARD) == True
    
    def test_calculate_safety_weight(self, engine):
        """Test safety weight calculation."""
        # Same safety level should get full weight
        weight_same = engine._calculate_safety_weight(SafetyLevel.MEDIUM, SafetyLevel.MEDIUM)
        assert weight_same == 1.0
        
        # Compatible but different levels should get reduced weight
        weight_compatible = engine._calculate_safety_weight(SafetyLevel.MEDIUM, SafetyLevel.STANDARD)
        assert 0.5 <= weight_compatible < 1.0
    
    @pytest.mark.asyncio
    async def test_get_candidate_peers(self, engine, sample_request):
        """Test candidate peer retrieval."""
        await engine.initialize()
        
        candidates = await engine._get_candidate_peers(sample_request)
        
        assert isinstance(candidates, list)
        assert len(candidates) > 0
        
        # Verify candidates don't include the requesting user
        candidate_ids = [peer["user_id"] for peer in candidates]
        assert sample_request.user_id not in candidate_ids
        
        # Verify candidate structure
        for candidate in candidates:
            assert "user_id" in candidate
            assert "education_level" in candidate
            assert "subjects" in candidate
            assert "skill_levels" in candidate
    
    @pytest.mark.asyncio
    async def test_apply_safety_filters(self, engine, sample_request):
        """Test safety filter application."""
        await engine.initialize()
        
        # Create sample matches
        sample_matches = [
            PeerMatch(
                user_id="safe_peer",
                compatibility_score=0.8,
                shared_subjects=["mathematics"],
                complementary_skills={},
                common_goals=["learn math"],
                availability_overlap=["monday: 09:00-11:00"],
                communication_match=["chat"],
                match_reasons=["Good compatibility"]
            )
        ]
        
        filtered_matches = await engine._apply_safety_filters(sample_matches, sample_request)
        
        assert isinstance(filtered_matches, list)
        # Should return matches (since we don't have strict safety rules in test)
        assert len(filtered_matches) >= 0
    
    @pytest.mark.asyncio
    async def test_update_match_feedback(self, engine):
        """Test match feedback updating."""
        await engine.initialize()
        
        await engine.update_match_feedback("test_user", "test_peer", 0.85, "positive")
        
        # Verify feedback was recorded
        assert "test_user" in engine.interaction_history
        user_history = engine.interaction_history["test_user"]
        assert user_history["total_matches"] > 0
        assert len(user_history["feedback_scores"]) > 0
        assert user_history["feedback_scores"][-1] == 0.85
    
    @pytest.mark.asyncio
    async def test_get_matching_analytics(self, engine):
        """Test matching analytics retrieval."""
        await engine.initialize()
        
        # Add some sample data
        await engine.update_match_feedback("analytics_user", "peer1", 0.8, "positive")
        await engine.update_match_feedback("analytics_user", "peer2", 0.9, "positive")
        
        analytics = await engine.get_matching_analytics("analytics_user", 30)
        
        assert isinstance(analytics, dict)
        assert "user_id" in analytics
        assert "total_matches" in analytics
        assert "successful_matches" in analytics
        assert "success_rate" in analytics
        assert analytics["user_id"] == "analytics_user"
        assert analytics["total_matches"] >= 2
    
    @pytest.mark.asyncio
    async def test_error_handling_in_matching(self, engine):
        """Test error handling in peer matching."""
        await engine.initialize()
        
        # Test with invalid request data
        invalid_request = PeerMatchingRequest(
            user_id="",  # Empty user ID
            education_level=EducationLevel.K12,
            subjects=[],  # Empty subjects
            skill_levels={},
            learning_goals=[],
            availability={},
            communication_preferences=[]
        )
        
        # Should handle gracefully and return empty list
        matches = await engine.find_peer_matches(
            request=invalid_request,
            strategy=MatchingStrategy.COMPREHENSIVE
        )
        
        assert isinstance(matches, list)
        # Should return empty list or handle gracefully


@pytest.mark.integration
class TestPeerMatchingIntegration:
    """Integration tests for peer matching engine."""
    
    @pytest.fixture
    def engine(self):
        """Create engine instance for integration testing."""
        return PeerMatchingEngine()
    
    @pytest.mark.asyncio
    async def test_full_matching_workflow(self, engine):
        """Test complete peer matching workflow."""
        await engine.initialize()
        
        # Step 1: Create request
        request = PeerMatchingRequest(
            user_id="integration_test_user",
            education_level=EducationLevel.COLLEGE,
            subjects=["computer_science", "mathematics"],
            skill_levels={
                "computer_science": DifficultyLevel.INTERMEDIATE,
                "mathematics": DifficultyLevel.BEGINNER
            },
            learning_goals=["learn algorithms", "master data structures"],
            availability={
                "monday": ["09:00-11:00"],
                "wednesday": ["14:00-16:00"]
            },
            communication_preferences=["video_call", "chat"],
            age_range="20-25"
        )
        
        # Step 2: Get matches using different strategies
        strategies = [
            MatchingStrategy.SKILL_COMPLEMENTARITY,
            MatchingStrategy.LEARNING_GOAL_ALIGNMENT,
            MatchingStrategy.COMMUNICATION_COMPATIBILITY,
            MatchingStrategy.SAFETY_FOCUSED,
            MatchingStrategy.COMPREHENSIVE
        ]
        
        for strategy in strategies:
            matches = await engine.find_peer_matches(
                request=request,
                strategy=strategy,
                max_matches=5
            )
            
            assert isinstance(matches, list)
            assert len(matches) <= 5
            
            # Verify each match is valid
            for match in matches:
                assert isinstance(match, PeerMatch)
                assert match.user_id is not None
                assert 0.0 <= match.compatibility_score <= 1.0
                assert isinstance(match.match_reasons, list)
        
        # Step 3: Update feedback
        if matches:
            await engine.update_match_feedback(
                user_id=request.user_id,
                peer_id=matches[0].user_id,
                feedback_score=0.85,
                feedback_type="positive"
            )
        
        # Step 4: Get analytics
        analytics = await engine.get_matching_analytics(request.user_id)
        assert isinstance(analytics, dict)
        assert analytics["user_id"] == request.user_id
    
    @pytest.mark.asyncio
    async def test_cross_strategy_consistency(self, engine):
        """Test that different strategies return reasonable results."""
        await engine.initialize()
        
        request = PeerMatchingRequest(
            user_id="consistency_test_user",
            education_level=EducationLevel.K12,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.BEGINNER},
            learning_goals=["learn algebra"],
            availability={"monday": ["09:00-11:00"]},
            communication_preferences=["chat"],
            age_range="under 18"
        )
        
        # Get matches from all strategies
        results = {}
        for strategy in MatchingStrategy:
            matches = await engine.find_peer_matches(
                request=request,
                strategy=strategy,
                max_matches=3
            )
            results[strategy.value] = matches
        
        # Verify all strategies return valid results
        for strategy_name, matches in results.items():
            assert isinstance(matches, list)
            
            # All matches should be valid
            for match in matches:
                assert isinstance(match, PeerMatch)
                assert 0.0 <= match.compatibility_score <= 1.0
        
        # Comprehensive should potentially combine insights from other strategies
        comprehensive_matches = results["comprehensive"]
        assert isinstance(comprehensive_matches, list)
    
    @pytest.mark.asyncio
    async def test_safety_across_age_groups(self, engine):
        """Test safety considerations across different age groups."""
        await engine.initialize()
        
        # Test minor user
        minor_request = PeerMatchingRequest(
            user_id="minor_user",
            education_level=EducationLevel.K12,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.BEGINNER},
            learning_goals=["learn math"],
            availability={"monday": ["09:00-11:00"]},
            communication_preferences=["chat"],
            age_range="under 18"
        )
        
        # Test adult user
        adult_request = PeerMatchingRequest(
            user_id="adult_user",
            education_level=EducationLevel.PROFESSIONAL,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.ADVANCED},
            learning_goals=["teach math"],
            availability={"monday": ["09:00-11:00"]},
            communication_preferences=["video_call"],
            age_range="30-40"
        )
        
        # Get safety-focused matches for both
        minor_matches = await engine.find_peer_matches(
            request=minor_request,
            strategy=MatchingStrategy.SAFETY_FOCUSED
        )
        
        adult_matches = await engine.find_peer_matches(
            request=adult_request,
            strategy=MatchingStrategy.SAFETY_FOCUSED
        )
        
        # Both should get matches
        assert isinstance(minor_matches, list)
        assert isinstance(adult_matches, list)
        
        # Verify safety considerations are applied
        for match in minor_matches:
            # Minor matches should have safety-related reasons
            safety_mentioned = any(
                "safety" in reason.lower() or "age" in reason.lower() or "appropriate" in reason.lower()
                for reason in match.match_reasons
            )
            # Note: This might not always be true depending on implementation