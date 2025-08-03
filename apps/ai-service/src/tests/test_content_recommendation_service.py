"""
Tests for content recommendation engine.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
from typing import List, Dict, Any

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.content_recommendation_service import ContentRecommendationEngine, RecommendationStrategy
from src.models.ai_models import (
    ContentRecommendationRequest,
    ContentRecommendation,
    UserProfile,
    ContentItem,
    EducationLevel,
    DifficultyLevel,
    LearningStyle,
    ContentFormat,
    LearningContext
)


class TestContentRecommendationEngine:
    """Test suite for content recommendation engine."""
    
    @pytest.fixture
    def engine(self):
        """Create ContentRecommendationEngine instance for testing."""
        return ContentRecommendationEngine()
    
    @pytest.fixture
    def sample_request(self):
        """Create sample content recommendation request."""
        return ContentRecommendationRequest(
            user_id="test_user_123",
            current_topic="mathematics",
            education_level=EducationLevel.K12,
            skill_level=DifficultyLevel.INTERMEDIATE,
            learning_context=LearningContext.SELF_PACED,
            preferred_formats=[ContentFormat.VIDEO, ContentFormat.INTERACTIVE],
            max_duration=45,
            exclude_content=[]
        )
    
    @pytest.fixture
    def sample_user_profile(self):
        """Create sample user profile."""
        return UserProfile(
            user_id="test_user_123",
            education_level=EducationLevel.K12,
            subjects=["mathematics"],
            skill_levels={"mathematics": DifficultyLevel.INTERMEDIATE},
            learning_preferences={
                "learning_style": "visual",
                "preferred_formats": ["video", "interactive"],
                "max_duration": 45
            },
            goals=["learn algebra", "master geometry"],
            interaction_history=[
                {
                    "subject": "mathematics",
                    "success_rate": 0.85,
                    "topics": ["algebra", "geometry"],
                    "timestamp": "2024-01-01"
                }
            ]
        )
    
    @pytest.fixture
    def sample_content_items(self):
        """Create sample content items."""
        return [
            ContentItem(
                content_id="content_math_1",
                title="Algebra Basics",
                description="Introduction to algebraic concepts",
                subject="mathematics",
                topics=["algebra"],
                difficulty=DifficultyLevel.INTERMEDIATE,
                format=ContentFormat.VIDEO,
                duration_minutes=30,
                source="khan_academy",
                url="https://example.com/algebra-basics"
            ),
            ContentItem(
                content_id="content_math_2",
                title="Geometry Fundamentals",
                description="Basic geometric shapes and properties",
                subject="mathematics",
                topics=["geometry"],
                difficulty=DifficultyLevel.INTERMEDIATE,
                format=ContentFormat.INTERACTIVE,
                duration_minutes=40,
                source="coursera",
                url="https://example.com/geometry-fundamentals"
            ),
            ContentItem(
                content_id="content_math_3",
                title="Advanced Calculus",
                description="Complex calculus problems",
                subject="mathematics",
                topics=["calculus"],
                difficulty=DifficultyLevel.ADVANCED,
                format=ContentFormat.ARTICLE,
                duration_minutes=60,
                source="youtube",
                url="https://example.com/advanced-calculus"
            )
        ]
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self, engine):
        """Test engine initialization."""
        await engine.initialize()
        
        # Check that internal structures are initialized
        assert isinstance(engine.content_embeddings, dict)
        assert isinstance(engine.user_interaction_matrix, dict)
        assert isinstance(engine.peer_success_rates, dict)
        assert isinstance(engine.learning_style_preferences, dict)
    
    @pytest.mark.asyncio
    async def test_get_personalized_recommendations_hybrid(self, engine, sample_request, sample_user_profile):
        """Test hybrid recommendation strategy."""
        await engine.initialize()
        
        recommendations = await engine.get_personalized_recommendations(
            request=sample_request,
            user_profile=sample_user_profile,
            strategy=RecommendationStrategy.HYBRID,
            max_recommendations=5
        )
        
        # Verify basic structure
        assert isinstance(recommendations, list)
        assert len(recommendations) <= 5
        
        # Verify each recommendation has required fields
        for rec in recommendations:
            assert isinstance(rec, ContentRecommendation)
            assert rec.content_id is not None
            assert rec.title is not None
            assert rec.relevance_score >= 0.0
            assert rec.relevance_score <= 1.0
            assert rec.quality_score >= 0.0
            assert rec.quality_score <= 1.0
    
    @pytest.mark.asyncio
    async def test_vector_similarity_recommendations(self, engine, sample_request, sample_user_profile):
        """Test vector similarity recommendation strategy."""
        await engine.initialize()
        
        # Mock candidate content
        with patch.object(engine, '_get_candidate_content') as mock_get_content:
            mock_content = [
                ContentItem(
                    content_id="test_content_1",
                    title="Test Content 1",
                    description="Test description",
                    subject="mathematics",
                    topics=["algebra"],
                    difficulty=DifficultyLevel.INTERMEDIATE,
                    format=ContentFormat.VIDEO,
                    duration_minutes=30,
                    source="test_source"
                )
            ]
            mock_get_content.return_value = mock_content
            
            recommendations = await engine._vector_similarity_recommendations(
                sample_request, mock_content, sample_user_profile
            )
            
            assert isinstance(recommendations, list)
            assert len(recommendations) > 0
            
            # Verify similarity scoring worked
            for rec in recommendations:
                assert rec.relevance_score >= 0.0
                assert rec.relevance_score <= 1.0
    
    @pytest.mark.asyncio
    async def test_collaborative_filtering_recommendations(self, engine, sample_request, sample_user_profile):
        """Test collaborative filtering recommendation strategy."""
        await engine.initialize()
        
        # Set up mock interaction data
        engine.user_interaction_matrix = {
            "similar_user_1": {"test_content_1": 0.9, "test_content_2": 0.7},
            "similar_user_2": {"test_content_1": 0.8, "test_content_3": 0.6}
        }
        
        engine.peer_success_rates = {
            "test_content_1": 0.85,
            "test_content_2": 0.75,
            "test_content_3": 0.65
        }
        
        # Mock candidate content and similar users
        mock_content = [
            ContentItem(
                content_id="test_content_1",
                title="Test Content 1",
                description="Test description",
                subject="mathematics",
                topics=["algebra"],
                difficulty=DifficultyLevel.INTERMEDIATE,
                format=ContentFormat.VIDEO,
                duration_minutes=30,
                source="test_source"
            )
        ]
        
        with patch.object(engine, '_find_similar_users') as mock_find_users:
            mock_find_users.return_value = ["similar_user_1", "similar_user_2"]
            
            recommendations = await engine._collaborative_filtering_recommendations(
                sample_request, mock_content, sample_user_profile
            )
            
            assert isinstance(recommendations, list)
            assert len(recommendations) > 0
            
            # Verify collaborative scoring worked
            for rec in recommendations:
                assert rec.relevance_score >= 0.0
                assert rec.relevance_score <= 1.0
    
    @pytest.mark.asyncio
    async def test_learning_style_recommendations(self, engine, sample_request, sample_user_profile):
        """Test learning style-based recommendation strategy."""
        await engine.initialize()
        
        mock_content = [
            ContentItem(
                content_id="video_content",
                title="Video Content",
                description="Visual learning content",
                subject="mathematics",
                topics=["algebra"],
                difficulty=DifficultyLevel.INTERMEDIATE,
                format=ContentFormat.VIDEO,
                duration_minutes=30,
                source="test_source"
            ),
            ContentItem(
                content_id="audio_content",
                title="Audio Content",
                description="Auditory learning content",
                subject="mathematics",
                topics=["algebra"],
                difficulty=DifficultyLevel.INTERMEDIATE,
                format=ContentFormat.AUDIO,
                duration_minutes=30,
                source="test_source"
            )
        ]
        
        recommendations = await engine._learning_style_recommendations(
            sample_request, mock_content, sample_user_profile
        )
        
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0
        
        # Video content should score higher for visual learner
        video_rec = next((rec for rec in recommendations if rec.content_id == "video_content"), None)
        audio_rec = next((rec for rec in recommendations if rec.content_id == "audio_content"), None)
        
        if video_rec and audio_rec:
            assert video_rec.relevance_score >= audio_rec.relevance_score
    
    @pytest.mark.asyncio
    async def test_get_candidate_content(self, engine, sample_request):
        """Test candidate content retrieval."""
        await engine.initialize()
        
        candidate_content = await engine._get_candidate_content(sample_request)
        
        assert isinstance(candidate_content, list)
        assert len(candidate_content) > 0
        
        # Verify content matches request criteria
        for content in candidate_content:
            assert isinstance(content, ContentItem)
            assert content.duration_minutes <= sample_request.max_duration
            assert content.content_id not in sample_request.exclude_content
    
    def test_cosine_similarity_calculation(self, engine):
        """Test cosine similarity calculation."""
        vec1 = [1.0, 0.0, 0.0]
        vec2 = [1.0, 0.0, 0.0]
        vec3 = [0.0, 1.0, 0.0]
        
        # Identical vectors should have similarity close to 1
        similarity_identical = engine._calculate_cosine_similarity(vec1, vec2)
        assert similarity_identical > 0.9
        
        # Orthogonal vectors should have similarity close to 0.5 (normalized)
        similarity_orthogonal = engine._calculate_cosine_similarity(vec1, vec3)
        assert 0.4 <= similarity_orthogonal <= 0.6
        
        # Different length vectors should return 0
        similarity_different_length = engine._calculate_cosine_similarity([1.0, 0.0], [1.0, 0.0, 0.0])
        assert similarity_different_length == 0.0
    
    @pytest.mark.asyncio
    async def test_create_query_vector(self, engine, sample_request, sample_user_profile):
        """Test query vector creation."""
        await engine.initialize()
        
        query_vector = await engine._create_query_vector(sample_request, sample_user_profile)
        
        assert isinstance(query_vector, list)
        assert len(query_vector) == 128  # Expected vector dimension
        assert all(isinstance(val, float) for val in query_vector)
        assert all(0.0 <= val <= 1.5 for val in query_vector)  # Reasonable range
    
    @pytest.mark.asyncio
    async def test_find_similar_users(self, engine, sample_user_profile):
        """Test finding similar users."""
        await engine.initialize()
        
        similar_users = await engine._find_similar_users("test_user_123", sample_user_profile)
        
        assert isinstance(similar_users, list)
        assert len(similar_users) > 0
        assert all(isinstance(user_id, str) for user_id in similar_users)
        assert "test_user_123" not in similar_users  # Should not include self
    
    @pytest.mark.asyncio
    async def test_calculate_collaborative_score(self, engine):
        """Test collaborative filtering score calculation."""
        await engine.initialize()
        
        # Set up test interaction matrix
        engine.user_interaction_matrix = {
            "user_1": {"content_1": 0.8, "content_2": 0.6},
            "user_2": {"content_1": 0.9, "content_2": 0.7},
            "user_3": {"content_1": 0.7}
        }
        
        similar_users = ["user_1", "user_2", "user_3"]
        
        # Test with content that has interactions
        score = await engine._calculate_collaborative_score("content_1", similar_users, "test_user")
        assert 0.0 <= score <= 1.0
        assert score > 0.5  # Should be above neutral since all interactions are positive
        
        # Test with content that has no interactions
        score_no_data = await engine._calculate_collaborative_score("content_unknown", similar_users, "test_user")
        assert score_no_data == 0.5  # Should return neutral score
    
    def test_learning_style_score_calculation(self, engine):
        """Test learning style compatibility scoring."""
        # Set up style preferences
        visual_preferences = {
            ContentFormat.VIDEO.value: 0.9,
            ContentFormat.INTERACTIVE.value: 0.8,
            ContentFormat.ARTICLE.value: 0.6,
            ContentFormat.AUDIO.value: 0.3
        }
        
        video_content = ContentItem(
            content_id="video_test",
            title="Video Test",
            description="Test video content",
            subject="test",
            topics=["test"],
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.VIDEO,
            duration_minutes=30,
            source="test"
        )
        
        audio_content = ContentItem(
            content_id="audio_test",
            title="Audio Test",
            description="Test audio content",
            subject="test",
            topics=["test"],
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.AUDIO,
            duration_minutes=30,
            source="test"
        )
        
        video_score = engine._calculate_learning_style_score(video_content, visual_preferences)
        audio_score = engine._calculate_learning_style_score(audio_content, visual_preferences)
        
        # Video should score higher for visual learner
        assert video_score > audio_score
        assert 0.0 <= video_score <= 1.0
        assert 0.0 <= audio_score <= 1.0
    
    def test_format_preference_score_calculation(self, engine):
        """Test format preference scoring."""
        preferred_formats = [ContentFormat.VIDEO, ContentFormat.INTERACTIVE, ContentFormat.ARTICLE]
        
        # First preference should get highest score
        video_score = engine._calculate_format_preference_score(ContentFormat.VIDEO, preferred_formats)
        assert video_score == 1.0
        
        # Second preference should get slightly lower score
        interactive_score = engine._calculate_format_preference_score(ContentFormat.INTERACTIVE, preferred_formats)
        assert interactive_score == 0.9
        
        # Non-preferred format should get low score
        audio_score = engine._calculate_format_preference_score(ContentFormat.AUDIO, preferred_formats)
        assert audio_score == 0.3
        
        # Empty preferences should return neutral score
        neutral_score = engine._calculate_format_preference_score(ContentFormat.VIDEO, [])
        assert neutral_score == 0.5
    
    @pytest.mark.asyncio
    async def test_calculate_quality_score(self, engine):
        """Test content quality scoring."""
        await engine.initialize()
        
        # High-quality source
        khan_content = ContentItem(
            content_id="khan_test",
            title="Khan Academy Content",
            description="High quality educational content",
            subject="test",
            topics=["test"],
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.VIDEO,
            duration_minutes=30,
            source="khan_academy",
            metadata={"verified": True, "expert_reviewed": True}
        )
        
        # Lower-quality source
        youtube_content = ContentItem(
            content_id="youtube_test",
            title="YouTube Content",
            description="User-generated content",
            subject="test",
            topics=["test"],
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.VIDEO,
            duration_minutes=30,
            source="youtube"
        )
        
        khan_score = await engine._calculate_quality_score(khan_content)
        youtube_score = await engine._calculate_quality_score(youtube_content)
        
        # Khan Academy should score higher
        assert khan_score > youtube_score
        assert 0.0 <= khan_score <= 1.0
        assert 0.0 <= youtube_score <= 1.0
    
    def test_age_appropriate_filtering(self, engine):
        """Test age-appropriate content filtering."""
        high_quality_rec = ContentRecommendation(
            content_id="high_quality",
            title="High Quality Content",
            description="Educational content",
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.VIDEO,
            duration_minutes=30,
            topics=["test"],
            source="khan_academy",
            relevance_score=0.8,
            quality_score=0.9
        )
        
        low_quality_rec = ContentRecommendation(
            content_id="low_quality",
            title="Low Quality Content",
            description="Poor quality content",
            difficulty=DifficultyLevel.BEGINNER,
            format=ContentFormat.VIDEO,
            duration_minutes=30,
            topics=["test"],
            source="unknown",
            relevance_score=0.8,
            quality_score=0.4
        )
        
        # K-12 should be more restrictive
        assert engine._is_age_appropriate(high_quality_rec, EducationLevel.K12) == True
        assert engine._is_age_appropriate(low_quality_rec, EducationLevel.K12) == False
        
        # College should be less restrictive
        assert engine._is_age_appropriate(high_quality_rec, EducationLevel.COLLEGE) == True
        assert engine._is_age_appropriate(low_quality_rec, EducationLevel.COLLEGE) == True
    
    def test_diversity_filtering(self, engine):
        """Test diversity filtering to avoid similar content."""
        recommendations = []
        
        # Create recommendations with similar topics
        for i in range(10):
            rec = ContentRecommendation(
                content_id=f"content_{i}",
                title=f"Content {i}",
                description="Test content",
                difficulty=DifficultyLevel.BEGINNER,
                format=ContentFormat.VIDEO if i % 2 == 0 else ContentFormat.ARTICLE,
                duration_minutes=30,
                topics=["algebra"] if i < 7 else ["geometry"],  # Most are algebra
                source="test",
                relevance_score=0.8,
                quality_score=0.7
            )
            recommendations.append(rec)
        
        diverse_recs = engine._apply_diversity_filter(recommendations)
        
        # Should have fewer recommendations due to diversity filtering
        assert len(diverse_recs) <= len(recommendations)
        
        # Should have mix of topics and formats
        topics = set()
        formats = set()
        for rec in diverse_recs:
            topics.update(rec.topics)
            formats.add(rec.format)
        
        # Should have some diversity in topics and formats
        assert len(topics) > 1 or len(formats) > 1
    
    def test_get_related_topics(self, engine):
        """Test related topic discovery."""
        # Test direct match
        math_related = engine._get_related_topics("mathematics")
        assert isinstance(math_related, list)
        assert len(math_related) > 0
        assert "algebra" in math_related
        
        # Test partial match
        prog_related = engine._get_related_topics("programming")
        assert isinstance(prog_related, list)
        assert len(prog_related) > 0
        
        # Test unknown topic
        unknown_related = engine._get_related_topics("quantum_physics")
        assert isinstance(unknown_related, list)
        # Should return empty list for unknown topics
    
    @pytest.mark.asyncio
    async def test_update_user_interaction(self, engine):
        """Test updating user interaction data."""
        await engine.initialize()
        
        await engine.update_user_interaction("test_user", "test_content", 0.85)
        
        # Verify interaction was recorded
        assert "test_user" in engine.user_interaction_matrix
        assert engine.user_interaction_matrix["test_user"]["test_content"] == 0.85
    
    @pytest.mark.asyncio
    async def test_update_peer_success_rate(self, engine):
        """Test updating peer success rates."""
        await engine.initialize()
        
        await engine.update_peer_success_rate("test_content", 0.78)
        
        # Verify success rate was recorded
        assert engine.peer_success_rates["test_content"] == 0.78
    
    @pytest.mark.asyncio
    async def test_get_recommendation_analytics(self, engine):
        """Test recommendation analytics retrieval."""
        await engine.initialize()
        
        analytics = await engine.get_recommendation_analytics("test_user", 30)
        
        assert isinstance(analytics, dict)
        assert "user_id" in analytics
        assert "total_recommendations" in analytics
        assert "click_through_rate" in analytics
        assert "completion_rate" in analytics
        assert analytics["user_id"] == "test_user"
    
    @pytest.mark.asyncio
    async def test_fallback_recommendations(self, engine, sample_request):
        """Test fallback recommendations when main algorithms fail."""
        await engine.initialize()
        
        fallback_recs = await engine._get_fallback_recommendations(sample_request)
        
        assert isinstance(fallback_recs, list)
        assert len(fallback_recs) > 0
        
        # Verify fallback recommendations have basic structure
        for rec in fallback_recs:
            assert isinstance(rec, ContentRecommendation)
            assert rec.content_id is not None
            assert rec.title is not None
            assert rec.source == "fallback"
            assert sample_request.current_topic.lower() in rec.title.lower()
    
    @pytest.mark.asyncio
    async def test_error_handling_in_recommendations(self, engine, sample_request):
        """Test error handling in recommendation generation."""
        await engine.initialize()
        
        # Test with invalid request data
        invalid_request = ContentRecommendationRequest(
            user_id="",  # Empty user ID
            current_topic="",  # Empty topic
            education_level=EducationLevel.K12,
            skill_level=DifficultyLevel.BEGINNER,
            learning_context=LearningContext.SELF_PACED,
            preferred_formats=[],
            max_duration=0  # Invalid duration
        )
        
        # Should handle gracefully and return fallback recommendations
        recommendations = await engine.get_personalized_recommendations(
            request=invalid_request,
            strategy=RecommendationStrategy.HYBRID
        )
        
        assert isinstance(recommendations, list)
        # Should return some recommendations even with invalid input


@pytest.mark.integration
class TestContentRecommendationIntegration:
    """Integration tests for content recommendation engine."""
    
    @pytest.fixture
    def engine(self):
        """Create engine instance for integration testing."""
        return ContentRecommendationEngine()
    
    @pytest.mark.asyncio
    async def test_full_recommendation_workflow(self, engine):
        """Test complete recommendation workflow."""
        await engine.initialize()
        
        # Step 1: Create request
        request = ContentRecommendationRequest(
            user_id="integration_test_user",
            current_topic="computer_science",
            education_level=EducationLevel.COLLEGE,
            skill_level=DifficultyLevel.INTERMEDIATE,
            learning_context=LearningContext.SELF_PACED,
            preferred_formats=[ContentFormat.VIDEO, ContentFormat.INTERACTIVE],
            max_duration=60
        )
        
        # Step 2: Get recommendations using different strategies
        strategies = [
            RecommendationStrategy.VECTOR_SIMILARITY,
            RecommendationStrategy.COLLABORATIVE_FILTERING,
            RecommendationStrategy.LEARNING_STYLE_BASED,
            RecommendationStrategy.HYBRID
        ]
        
        for strategy in strategies:
            recommendations = await engine.get_personalized_recommendations(
                request=request,
                strategy=strategy,
                max_recommendations=5
            )
            
            assert isinstance(recommendations, list)
            assert len(recommendations) <= 5
            
            # Verify each recommendation is valid
            for rec in recommendations:
                assert isinstance(rec, ContentRecommendation)
                assert rec.content_id is not None
                assert 0.0 <= rec.relevance_score <= 1.0
                assert 0.0 <= rec.quality_score <= 1.0
        
        # Step 3: Update interaction data
        if recommendations:
            await engine.update_user_interaction(
                user_id=request.user_id,
                content_id=recommendations[0].content_id,
                interaction_score=0.85
            )
            
            await engine.update_peer_success_rate(
                content_id=recommendations[0].content_id,
                success_rate=0.78
            )
        
        # Step 4: Get analytics
        analytics = await engine.get_recommendation_analytics(request.user_id)
        assert isinstance(analytics, dict)
        assert analytics["user_id"] == request.user_id
    
    @pytest.mark.asyncio
    async def test_cross_strategy_consistency(self, engine):
        """Test that different strategies return reasonable results."""
        await engine.initialize()
        
        request = ContentRecommendationRequest(
            user_id="consistency_test_user",
            current_topic="mathematics",
            education_level=EducationLevel.K12,
            skill_level=DifficultyLevel.BEGINNER,
            learning_context=LearningContext.CLASSROOM,
            preferred_formats=[ContentFormat.VIDEO],
            max_duration=30
        )
        
        # Get recommendations from all strategies
        results = {}
        for strategy in RecommendationStrategy:
            recommendations = await engine.get_personalized_recommendations(
                request=request,
                strategy=strategy,
                max_recommendations=3
            )
            results[strategy.value] = recommendations
        
        # Verify all strategies return valid results
        for strategy_name, recommendations in results.items():
            assert isinstance(recommendations, list)
            assert len(recommendations) > 0
            
            # All recommendations should be relevant to mathematics
            for rec in recommendations:
                # Check if content is math-related (including related topics like geometry, algebra)
                math_related_terms = ["mathematics", "math", "algebra", "geometry", "calculus", "arithmetic"]
                title_has_math = any(term in rec.title.lower() for term in math_related_terms)
                topics_have_math = any(any(term in topic.lower() for term in math_related_terms) for topic in rec.topics)
                assert title_has_math or topics_have_math
        
        # Hybrid should potentially combine insights from other strategies
        hybrid_recs = results["hybrid"]
        assert len(hybrid_recs) > 0
    
    @pytest.mark.asyncio
    async def test_recommendation_personalization(self, engine):
        """Test that recommendations are personalized for different users."""
        await engine.initialize()
        
        # Create two different user profiles
        visual_learner_request = ContentRecommendationRequest(
            user_id="visual_learner",
            current_topic="science",
            education_level=EducationLevel.K12,
            skill_level=DifficultyLevel.INTERMEDIATE,
            learning_context=LearningContext.SELF_PACED,
            preferred_formats=[ContentFormat.VIDEO, ContentFormat.INTERACTIVE],
            max_duration=45
        )
        
        auditory_learner_request = ContentRecommendationRequest(
            user_id="auditory_learner",
            current_topic="science",
            education_level=EducationLevel.K12,
            skill_level=DifficultyLevel.INTERMEDIATE,
            learning_context=LearningContext.SELF_PACED,
            preferred_formats=[ContentFormat.AUDIO],
            max_duration=45
        )
        
        # Get recommendations for both users
        visual_recs = await engine.get_personalized_recommendations(
            request=visual_learner_request,
            strategy=RecommendationStrategy.LEARNING_STYLE_BASED
        )
        
        auditory_recs = await engine.get_personalized_recommendations(
            request=auditory_learner_request,
            strategy=RecommendationStrategy.LEARNING_STYLE_BASED
        )
        
        # Both should get recommendations
        assert len(visual_recs) > 0
        assert len(auditory_recs) > 0
        
        # Recommendations should be different (personalized)
        visual_content_ids = {rec.content_id for rec in visual_recs}
        auditory_content_ids = {rec.content_id for rec in auditory_recs}
        
        # There should be some difference in recommendations
        # (though some overlap is acceptable)
        assert visual_content_ids != auditory_content_ids or len(visual_content_ids.intersection(auditory_content_ids)) < len(visual_content_ids)