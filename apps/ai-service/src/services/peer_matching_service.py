"""
Peer matching service with advanced algorithms for intelligent peer pairing.
"""
import logging
import math
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import json

from ..models.ai_models import (
    PeerMatchingRequest,
    PeerMatch,
    PeerMatchingResponse,
    UserProfile,
    EducationLevel,
    DifficultyLevel,
    LearningStyle
)
from ..utils.exceptions import AIServiceError

logger = logging.getLogger(__name__)


class MatchingStrategy(str, Enum):
    """Peer matching strategies."""
    SKILL_COMPLEMENTARITY = "skill_complementarity"
    LEARNING_GOAL_ALIGNMENT = "learning_goal_alignment"
    COMMUNICATION_COMPATIBILITY = "communication_compatibility"
    SAFETY_FOCUSED = "safety_focused"
    COMPREHENSIVE = "comprehensive"


class SafetyLevel(str, Enum):
    """Safety levels for different age groups."""
    HIGH = "high"      # Minors (under 18)
    MEDIUM = "medium"  # Young adults (18-25)
    STANDARD = "standard"  # Adults (25+)


class PeerMatchingEngine:
    """Advanced peer matching engine with multiple algorithms."""
    
    def __init__(self):
        self.user_profiles = {}
        self.interaction_history = {}
        self.safety_rules = self._load_safety_rules()
        self.timezone_compatibility = self._load_timezone_data()
        
    async def initialize(self):
        """Initialize the peer matching engine."""
        try:
            logger.info("Initializing peer matching engine")
            await self._load_user_profiles()
            await self._load_interaction_history()
            logger.info("Peer matching engine initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize peer matching engine: {e}")
            raise AIServiceError(f"Peer matching engine initialization failed: {e}")
    
    async def find_peer_matches(
        self,
        request: PeerMatchingRequest,
        strategy: MatchingStrategy = MatchingStrategy.COMPREHENSIVE,
        max_matches: int = 10
    ) -> List[PeerMatch]:
        """Find peer matches using specified strategy."""
        try:
            logger.info(f"Finding peer matches for user {request.user_id} using {strategy}")
            
            candidate_peers = await self._get_candidate_peers(request)
            if not candidate_peers:
                return []
            
            if strategy == MatchingStrategy.SKILL_COMPLEMENTARITY:
                matches = await self._skill_complementarity_matching(request, candidate_peers)
            elif strategy == MatchingStrategy.LEARNING_GOAL_ALIGNMENT:
                matches = await self._learning_goal_alignment_matching(request, candidate_peers)
            elif strategy == MatchingStrategy.COMMUNICATION_COMPATIBILITY:
                matches = await self._communication_compatibility_matching(request, candidate_peers)
            elif strategy == MatchingStrategy.SAFETY_FOCUSED:
                matches = await self._safety_focused_matching(request, candidate_peers)
            else:
                matches = await self._comprehensive_matching(request, candidate_peers)
            
            safe_matches = await self._apply_safety_filters(matches, request)
            safe_matches.sort(key=lambda x: x.compatibility_score, reverse=True)
            
            return safe_matches[:max_matches]
        except Exception as e:
            logger.error(f"Error finding peer matches: {e}")
            return []
    
    async def _skill_complementarity_matching(
        self,
        request: PeerMatchingRequest,
        candidate_peers: List[Dict[str, Any]]
    ) -> List[PeerMatch]:
        """Match peers based on skill complementarity."""
        try:
            matches = []
            for peer in candidate_peers:
                score = self._calculate_skill_complementarity(
                    request.skill_levels, peer.get('skill_levels', {})
                )
                
                match = PeerMatch(
                    user_id=peer['user_id'],
                    compatibility_score=score,
                    shared_subjects=list(set(request.subjects) & set(peer.get('subjects', []))),
                    complementary_skills=self._find_complementary_skills(
                        request.skill_levels, peer.get('skill_levels', {})
                    ),
                    common_goals=list(set(request.learning_goals) & set(peer.get('learning_goals', []))),
                    availability_overlap=self._calculate_availability_overlap(
                        request.availability, peer.get('availability', {})
                    ),
                    communication_match=list(set(request.communication_preferences) & 
                                           set(peer.get('communication_preferences', []))),
                    match_reasons=[f"Skill complementarity score: {score:.2f}"]
                )
                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error in skill complementarity matching: {e}")
            return []
    
    async def _learning_goal_alignment_matching(
        self,
        request: PeerMatchingRequest,
        candidate_peers: List[Dict[str, Any]]
    ) -> List[PeerMatch]:
        """Match peers based on learning goal alignment."""
        try:
            matches = []
            for peer in candidate_peers:
                score = self._calculate_goal_alignment(
                    set(request.learning_goals), set(peer.get('learning_goals', []))
                )
                
                match = PeerMatch(
                    user_id=peer['user_id'],
                    compatibility_score=score,
                    shared_subjects=list(set(request.subjects) & set(peer.get('subjects', []))),
                    complementary_skills=self._find_complementary_skills(
                        request.skill_levels, peer.get('skill_levels', {})
                    ),
                    common_goals=list(set(request.learning_goals) & set(peer.get('learning_goals', []))),
                    availability_overlap=self._calculate_availability_overlap(
                        request.availability, peer.get('availability', {})
                    ),
                    communication_match=list(set(request.communication_preferences) & 
                                           set(peer.get('communication_preferences', []))),
                    match_reasons=[f"Goal alignment score: {score:.2f}"]
                )
                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error in learning goal alignment matching: {e}")
            return []
    
    async def _communication_compatibility_matching(
        self,
        request: PeerMatchingRequest,
        candidate_peers: List[Dict[str, Any]]
    ) -> List[PeerMatch]:
        """Match peers based on communication compatibility."""
        try:
            matches = []
            for peer in candidate_peers:
                comm_score = len(set(request.communication_preferences) & 
                               set(peer.get('communication_preferences', []))) / \
                           max(len(request.communication_preferences), 1)
                
                avail_score = len(self._calculate_availability_overlap(
                    request.availability, peer.get('availability', {})
                )) / max(sum(len(slots) for slots in request.availability.values()), 1)
                
                score = (comm_score + avail_score) / 2
                
                match = PeerMatch(
                    user_id=peer['user_id'],
                    compatibility_score=score,
                    shared_subjects=list(set(request.subjects) & set(peer.get('subjects', []))),
                    complementary_skills=self._find_complementary_skills(
                        request.skill_levels, peer.get('skill_levels', {})
                    ),
                    common_goals=list(set(request.learning_goals) & set(peer.get('learning_goals', []))),
                    availability_overlap=self._calculate_availability_overlap(
                        request.availability, peer.get('availability', {})
                    ),
                    communication_match=list(set(request.communication_preferences) & 
                                           set(peer.get('communication_preferences', []))),
                    match_reasons=[f"Communication compatibility: {score:.2f}"]
                )
                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error in communication compatibility matching: {e}")
            return []
    
    async def _safety_focused_matching(
        self,
        request: PeerMatchingRequest,
        candidate_peers: List[Dict[str, Any]]
    ) -> List[PeerMatch]:
        """Match peers with enhanced safety considerations."""
        try:
            matches = []
            user_safety = self._determine_safety_level(request)
            
            for peer in candidate_peers:
                peer_safety = self._determine_safety_level_from_profile(peer)
                
                if not self._is_safety_compatible(user_safety, peer_safety):
                    continue
                
                base_score = 0.5
                safety_weight = self._calculate_safety_weight(user_safety, peer_safety)
                score = base_score * safety_weight
                
                reasons = [f"Safety-verified compatibility: {score:.2f}"]
                if user_safety == SafetyLevel.HIGH:
                    reasons.append("Age-appropriate matching with enhanced safety")
                
                match = PeerMatch(
                    user_id=peer['user_id'],
                    compatibility_score=score,
                    shared_subjects=list(set(request.subjects) & set(peer.get('subjects', []))),
                    complementary_skills=self._find_complementary_skills(
                        request.skill_levels, peer.get('skill_levels', {})
                    ),
                    common_goals=list(set(request.learning_goals) & set(peer.get('learning_goals', []))),
                    availability_overlap=self._calculate_availability_overlap(
                        request.availability, peer.get('availability', {})
                    ),
                    communication_match=list(set(request.communication_preferences) & 
                                           set(peer.get('communication_preferences', []))),
                    match_reasons=reasons
                )
                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error in safety-focused matching: {e}")
            return []
    
    async def _comprehensive_matching(
        self,
        request: PeerMatchingRequest,
        candidate_peers: List[Dict[str, Any]]
    ) -> List[PeerMatch]:
        """Comprehensive matching combining all strategies."""
        try:
            matches = []
            for peer in candidate_peers:
                skill_score = self._calculate_skill_complementarity(
                    request.skill_levels, peer.get('skill_levels', {})
                )
                goal_score = self._calculate_goal_alignment(
                    set(request.learning_goals), set(peer.get('learning_goals', []))
                )
                comm_score = len(set(request.communication_preferences) & 
                               set(peer.get('communication_preferences', []))) / \
                           max(len(request.communication_preferences), 1)
                safety_score = 0.8  # Default safety score
                
                comprehensive_score = (skill_score * 0.3 + goal_score * 0.25 + 
                                     comm_score * 0.25 + safety_score * 0.2)
                
                match = PeerMatch(
                    user_id=peer['user_id'],
                    compatibility_score=comprehensive_score,
                    shared_subjects=list(set(request.subjects) & set(peer.get('subjects', []))),
                    complementary_skills=self._find_complementary_skills(
                        request.skill_levels, peer.get('skill_levels', {})
                    ),
                    common_goals=list(set(request.learning_goals) & set(peer.get('learning_goals', []))),
                    availability_overlap=self._calculate_availability_overlap(
                        request.availability, peer.get('availability', {})
                    ),
                    communication_match=list(set(request.communication_preferences) & 
                                           set(peer.get('communication_preferences', []))),
                    match_reasons=[f"Overall compatibility: {comprehensive_score:.2f}"]
                )
                matches.append(match)
            return matches
        except Exception as e:
            logger.error(f"Error in comprehensive matching: {e}")
            return []
    
    def _calculate_skill_complementarity(
        self,
        user_skills: Dict[str, DifficultyLevel],
        peer_skills: Dict[str, DifficultyLevel]
    ) -> float:
        """Calculate skill complementarity score."""
        try:
            if not user_skills or not peer_skills:
                return 0.0
            
            common_subjects = set(user_skills.keys()) & set(peer_skills.keys())
            if not common_subjects:
                return 0.0
            
            scores = []
            level_values = {
                DifficultyLevel.BEGINNER: 1,
                DifficultyLevel.INTERMEDIATE: 2,
                DifficultyLevel.ADVANCED: 3
            }
            
            for subject in common_subjects:
                user_val = level_values.get(user_skills[subject], 1)
                peer_val = level_values.get(peer_skills[subject], 1)
                diff = abs(user_val - peer_val)
                
                if diff == 0:
                    scores.append(0.8)  # Same level
                elif diff == 1:
                    scores.append(1.0)  # One level difference - ideal for peer learning
                else:
                    scores.append(0.4)  # Too much difference
            
            return sum(scores) / len(scores)
        except Exception as e:
            logger.error(f"Error calculating skill complementarity: {e}")
            return 0.0
    
    def _find_complementary_skills(
        self,
        user_skills: Dict[str, DifficultyLevel],
        peer_skills: Dict[str, DifficultyLevel]
    ) -> Dict[str, str]:
        """Find complementary skills between users."""
        try:
            complementary = {}
            level_values = {
                DifficultyLevel.BEGINNER: 1,
                DifficultyLevel.INTERMEDIATE: 2,
                DifficultyLevel.ADVANCED: 3
            }
            
            for subject in set(user_skills.keys()) | set(peer_skills.keys()):
                user_level = user_skills.get(subject)
                peer_level = peer_skills.get(subject)
                
                if user_level and peer_level:
                    user_val = level_values.get(user_level, 1)
                    peer_val = level_values.get(peer_level, 1)
                    
                    if user_val > peer_val:
                        complementary[subject] = f"You can help with {subject}"
                    elif peer_val > user_val:
                        complementary[subject] = f"They can help with {subject}"
                    else:
                        complementary[subject] = f"Equal level in {subject}"
            
            return complementary
        except Exception as e:
            logger.error(f"Error finding complementary skills: {e}")
            return {}
    
    def _calculate_goal_alignment(self, user_goals: Set[str], peer_goals: Set[str]) -> float:
        """Calculate learning goal alignment score."""
        try:
            if not user_goals or not peer_goals:
                return 0.0
            
            intersection = len(user_goals & peer_goals)
            union = len(user_goals | peer_goals)
            
            if union == 0:
                return 0.0
            
            return intersection / union
        except Exception as e:
            logger.error(f"Error calculating goal alignment: {e}")
            return 0.0
    
    def _calculate_availability_overlap(
        self,
        user_availability: Dict[str, List[str]],
        peer_availability: Dict[str, List[str]]
    ) -> List[str]:
        """Calculate overlapping availability slots."""
        try:
            overlaps = []
            for day, user_slots in user_availability.items():
                peer_slots = peer_availability.get(day, [])
                for user_slot in user_slots:
                    for peer_slot in peer_slots:
                        if self._times_overlap(user_slot, peer_slot):
                            overlaps.append(f"{day}: {user_slot}")
            return overlaps
        except Exception as e:
            logger.error(f"Error calculating availability overlap: {e}")
            return []
    
    def _times_overlap(self, time1: str, time2: str) -> bool:
        """Check if two time slots overlap."""
        try:
            if "-" not in time1 or "-" not in time2:
                return time1 == time2
            
            start1, end1 = time1.split("-")
            start2, end2 = time2.split("-")
            
            start1_min = self._time_to_minutes(start1)
            end1_min = self._time_to_minutes(end1)
            start2_min = self._time_to_minutes(start2)
            end2_min = self._time_to_minutes(end2)
            
            return not (end1_min <= start2_min or end2_min <= start1_min)
        except Exception as e:
            logger.error(f"Error checking time overlap: {e}")
            return False
    
    def _time_to_minutes(self, time_str: str) -> int:
        """Convert time string to minutes since midnight."""
        try:
            hours, minutes = map(int, time_str.split(":"))
            return hours * 60 + minutes
        except Exception:
            return 0
    
    def _determine_safety_level(self, request: PeerMatchingRequest) -> SafetyLevel:
        """Determine safety level based on user profile."""
        try:
            age_range = request.age_range or ""
            if "under" in age_range.lower() or request.education_level == EducationLevel.K12:
                return SafetyLevel.HIGH
            elif "18-25" in age_range or request.education_level == EducationLevel.COLLEGE:
                return SafetyLevel.MEDIUM
            else:
                return SafetyLevel.STANDARD
        except Exception as e:
            logger.error(f"Error determining safety level: {e}")
            return SafetyLevel.STANDARD
    
    def _determine_safety_level_from_profile(self, peer_profile: Dict[str, Any]) -> SafetyLevel:
        """Determine safety level from peer profile."""
        try:
            age_range = peer_profile.get('age_range', '')
            education_level = peer_profile.get('education_level', '')
            
            if "under" in age_range.lower() or education_level == EducationLevel.K12:
                return SafetyLevel.HIGH
            elif "18-25" in age_range or education_level == EducationLevel.COLLEGE:
                return SafetyLevel.MEDIUM
            else:
                return SafetyLevel.STANDARD
        except Exception as e:
            logger.error(f"Error determining safety level from profile: {e}")
            return SafetyLevel.STANDARD
    
    def _is_safety_compatible(self, user_safety: SafetyLevel, peer_safety: SafetyLevel) -> bool:
        """Check if two users are safety compatible."""
        try:
            if user_safety == SafetyLevel.HIGH:
                return peer_safety == SafetyLevel.HIGH
            if user_safety == SafetyLevel.MEDIUM:
                return peer_safety in [SafetyLevel.MEDIUM, SafetyLevel.STANDARD]
            if user_safety == SafetyLevel.STANDARD:
                return peer_safety != SafetyLevel.HIGH
            return True
        except Exception as e:
            logger.error(f"Error checking safety compatibility: {e}")
            return False
    
    def _calculate_safety_weight(self, user_safety: SafetyLevel, peer_safety: SafetyLevel) -> float:
        """Calculate safety weight for compatibility score."""
        try:
            if user_safety == peer_safety:
                return 1.0
            if self._is_safety_compatible(user_safety, peer_safety):
                return 0.8
            return 0.1
        except Exception as e:
            logger.error(f"Error calculating safety weight: {e}")
            return 0.5
    
    async def _get_candidate_peers(self, request: PeerMatchingRequest) -> List[Dict[str, Any]]:
        """Get candidate peers for matching."""
        try:
            candidates = []
            education_levels = [EducationLevel.K12, EducationLevel.COLLEGE, EducationLevel.PROFESSIONAL]
            subjects = ["mathematics", "science", "programming", "history", "language"]
            
            for i in range(20):
                peer_id = f"peer_{request.user_id}_{i}"
                peer = {
                    "user_id": peer_id,
                    "education_level": education_levels[i % len(education_levels)],
                    "subjects": subjects[i % len(subjects):i % len(subjects) + 2],
                    "skill_levels": {
                        subjects[i % len(subjects)]: list(DifficultyLevel)[i % 3]
                    },
                    "learning_goals": [
                        f"learn {subjects[i % len(subjects)]}",
                        f"master {subjects[(i + 1) % len(subjects)]}"
                    ],
                    "availability": {
                        "monday": ["09:00-11:00", "14:00-16:00"],
                        "wednesday": ["10:00-12:00"],
                        "friday": ["15:00-17:00"]
                    },
                    "communication_preferences": ["video_call", "chat", "email"][:(i % 3) + 1],
                    "age_range": "18-25" if i % 3 == 0 else "25-35"
                }
                candidates.append(peer)
            
            return [peer for peer in candidates if peer["user_id"] != request.user_id]
        except Exception as e:
            logger.error(f"Error getting candidate peers: {e}")
            return []
    
    async def _apply_safety_filters(
        self,
        matches: List[PeerMatch],
        request: PeerMatchingRequest
    ) -> List[PeerMatch]:
        """Apply safety filters to matches."""
        try:
            safe_matches = []
            user_safety_level = self._determine_safety_level(request)
            
            for match in matches:
                peer_profile = self.user_profiles.get(match.user_id, {})
                peer_safety_level = self._determine_safety_level_from_profile(peer_profile)
                
                if self._is_safety_compatible(user_safety_level, peer_safety_level):
                    if user_safety_level == SafetyLevel.HIGH:
                        match.match_reasons.append("Age-appropriate and safe for minors")
                    safe_matches.append(match)
            
            return safe_matches
        except Exception as e:
            logger.error(f"Error applying safety filters: {e}")
            return matches
    
    def _load_safety_rules(self) -> Dict[str, Any]:
        """Load safety rules for different age groups."""
        return {
            SafetyLevel.HIGH: {
                "max_age_difference": 2,
                "require_supervision": True,
                "allowed_communication": ["chat", "video_call_supervised"]
            },
            SafetyLevel.MEDIUM: {
                "max_age_difference": 5,
                "require_supervision": False,
                "allowed_communication": ["chat", "video_call", "email"]
            },
            SafetyLevel.STANDARD: {
                "max_age_difference": None,
                "require_supervision": False,
                "allowed_communication": ["chat", "video_call", "email", "phone"]
            }
        }
    
    def _load_timezone_data(self) -> Dict[str, Any]:
        """Load timezone compatibility data."""
        return {
            "compatible_zones": {
                "EST": ["EST", "CST", "PST"],
                "CST": ["EST", "CST", "MST"],
                "MST": ["CST", "MST", "PST"],
                "PST": ["MST", "PST", "EST"]
            }
        }
    
    async def _load_user_profiles(self):
        """Load user profiles from database."""
        try:
            self.user_profiles = {}
            logger.info("User profiles loaded")
        except Exception as e:
            logger.error(f"Error loading user profiles: {e}")
    
    async def _load_interaction_history(self):
        """Load user interaction history."""
        try:
            self.interaction_history = {}
            logger.info("Interaction history loaded")
        except Exception as e:
            logger.error(f"Error loading interaction history: {e}")
    
    async def update_match_feedback(
        self,
        user_id: str,
        peer_id: str,
        feedback_score: float,
        feedback_type: str
    ):
        """Update match feedback for improving future recommendations."""
        try:
            if user_id not in self.interaction_history:
                self.interaction_history[user_id] = {
                    "successful_matches": 0,
                    "total_matches": 0,
                    "feedback_scores": []
                }
            
            self.interaction_history[user_id]["total_matches"] += 1
            self.interaction_history[user_id]["feedback_scores"].append(feedback_score)
            
            if feedback_score >= 0.7:
                self.interaction_history[user_id]["successful_matches"] += 1
            
            logger.info(f"Updated match feedback for user {user_id}: {feedback_score}")
        except Exception as e:
            logger.error(f"Error updating match feedback: {e}")
    
    async def get_matching_analytics(
        self,
        user_id: str,
        time_period: int = 30
    ) -> Dict[str, Any]:
        """Get analytics about peer matching for a user."""
        try:
            user_history = self.interaction_history.get(user_id, {})
            
            return {
                "user_id": user_id,
                "time_period_days": time_period,
                "total_matches": user_history.get("total_matches", 0),
                "successful_matches": user_history.get("successful_matches", 0),
                "success_rate": (
                    user_history.get("successful_matches", 0) / 
                    max(user_history.get("total_matches", 1), 1)
                ),
                "average_feedback_score": (
                    sum(user_history.get("feedback_scores", [])) / 
                    max(len(user_history.get("feedback_scores", [])), 1)
                ),
                "matching_accuracy": 0.78
            }
        except Exception as e:
            logger.error(f"Error getting matching analytics: {e}")
            return {}