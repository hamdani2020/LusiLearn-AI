"""
Learning path generation service with advanced algorithms for personalized learning.
"""
import logging
import json
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import asyncio

from ..models.ai_models import (
    LearningPathRequest,
    LearningObjective,
    EducationLevel,
    DifficultyLevel,
    LearningStyle,
    UserProfile
)
from ..utils.exceptions import AIServiceError

logger = logging.getLogger(__name__)


class PrerequisiteType(str, Enum):
    """Types of prerequisites for learning objectives."""
    HARD = "hard"  # Must be completed before advancing
    SOFT = "soft"  # Recommended but not required
    PARALLEL = "parallel"  # Can be learned simultaneously


class LearningPathAlgorithm:
    """Core algorithms for learning path generation and adaptation."""
    
    def __init__(self):
        self.subject_taxonomies = self._load_subject_taxonomies()
        self.difficulty_progressions = self._load_difficulty_progressions()
        self.prerequisite_graph = self._build_prerequisite_graph()
    
    def generate_personalized_path(
        self,
        user_profile: UserProfile,
        subject: str,
        learning_goals: List[str],
        time_commitment: int
    ) -> Dict[str, Any]:
        """
        Generate a personalized learning path based on user profile and goals.
        
        Args:
            user_profile: User's learning profile and preferences
            subject: Subject area for the learning path
            learning_goals: List of specific learning objectives
            time_commitment: Available hours per week
            
        Returns:
            Dictionary containing the generated learning path
        """
        try:
            logger.info(f"Generating personalized path for user {user_profile.user_id} in {subject}")
            
            # Step 1: Analyze user's current knowledge and skill gaps
            skill_assessment = self._assess_current_skills(user_profile, subject)
            
            # Step 2: Map learning goals to specific objectives
            mapped_objectives = self._map_goals_to_objectives(learning_goals, subject, user_profile.education_level)
            
            # Step 3: Sequence objectives based on prerequisites and difficulty
            sequenced_objectives = self._sequence_objectives(
                mapped_objectives, 
                skill_assessment,
                user_profile.education_level
            )
            
            # Step 4: Adapt for learning style and preferences
            adapted_objectives = self._adapt_for_learning_style(
                sequenced_objectives,
                user_profile.learning_preferences.get('learning_style', 'visual'),
                user_profile.learning_preferences.get('preferred_formats', ['video', 'interactive'])
            )
            
            # Step 5: Calculate time estimates and create milestones
            timed_path = self._calculate_time_estimates(adapted_objectives, time_commitment)
            
            # Step 6: Generate difficulty progression strategy
            progression_strategy = self._create_difficulty_progression(
                timed_path,
                user_profile.skill_levels.get(subject, DifficultyLevel.BEGINNER)
            )
            
            return {
                "path_id": f"path_{user_profile.user_id}_{subject}_{int(datetime.now().timestamp())}",
                "user_id": user_profile.user_id,
                "subject": subject,
                "objectives": timed_path,
                "total_estimated_hours": sum(obj.get('estimated_hours', 2) for obj in timed_path),
                "difficulty_progression": progression_strategy,
                "milestones": self._create_milestones(timed_path),
                "adaptation_strategy": self._create_adaptation_strategy(user_profile),
                "created_at": datetime.now().isoformat(),
                "source": "algorithm_generated"
            }
            
        except Exception as e:
            logger.error(f"Error generating personalized path: {e}")
            raise AIServiceError(f"Failed to generate learning path: {e}")
    
    def adapt_path_based_on_performance(
        self,
        current_path: Dict[str, Any],
        performance_data: Dict[str, Any],
        user_profile: UserProfile
    ) -> Dict[str, Any]:
        """
        Adapt learning path based on user performance and engagement metrics.
        
        Args:
            current_path: Current learning path structure
            performance_data: User's recent performance metrics
            user_profile: Updated user profile
            
        Returns:
            Adapted learning path
        """
        try:
            logger.info(f"Adapting path based on performance for user {user_profile.user_id}")
            
            # Analyze performance patterns
            performance_analysis = self._analyze_performance_patterns(performance_data)
            
            # Determine if difficulty adjustment is needed
            difficulty_adjustment = self._calculate_difficulty_adjustment(
                performance_analysis,
                current_path.get('difficulty_progression', {})
            )
            
            # Identify struggling concepts and mastered concepts
            struggling_concepts = performance_analysis.get('struggling_concepts', [])
            mastered_concepts = performance_analysis.get('mastered_concepts', [])
            
            # Adapt objectives based on performance
            adapted_objectives = self._adapt_objectives_for_performance(
                current_path.get('objectives', []),
                struggling_concepts,
                mastered_concepts,
                difficulty_adjustment
            )
            
            # Update progression strategy
            updated_progression = self._update_difficulty_progression(
                current_path.get('difficulty_progression', {}),
                difficulty_adjustment,
                performance_analysis
            )
            
            # Create adaptation record
            adaptation_record = {
                "timestamp": datetime.now().isoformat(),
                "reason": "performance_based_adaptation",
                "changes": {
                    "difficulty_adjustment": difficulty_adjustment,
                    "added_objectives": [],
                    "removed_objectives": [],
                    "modified_objectives": []
                },
                "performance_metrics": performance_analysis
            }
            
            # Update the path
            adapted_path = current_path.copy()
            adapted_path.update({
                "objectives": adapted_objectives,
                "difficulty_progression": updated_progression,
                "adaptation_history": current_path.get("adaptation_history", []) + [adaptation_record],
                "updated_at": datetime.now().isoformat()
            })
            
            return adapted_path
            
        except Exception as e:
            logger.error(f"Error adapting path based on performance: {e}")
            raise AIServiceError(f"Failed to adapt learning path: {e}")
    
    def sequence_with_prerequisites(
        self,
        objectives: List[Dict[str, Any]],
        user_completed: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Sequence learning objectives based on prerequisite relationships.
        
        Args:
            objectives: List of learning objectives to sequence
            user_completed: List of already completed objective IDs
            
        Returns:
            Sequenced list of objectives
        """
        try:
            if user_completed is None:
                user_completed = []
            
            # Build dependency graph
            dependency_graph = self._build_objective_dependencies(objectives)
            
            # Perform topological sort with prerequisite constraints
            sequenced = self._topological_sort_with_constraints(
                objectives,
                dependency_graph,
                user_completed
            )
            
            # Add sequence numbers and prerequisite information
            for i, obj in enumerate(sequenced):
                obj['sequence_number'] = i + 1
                obj['prerequisites_met'] = self._check_prerequisites_met(
                    obj,
                    user_completed,
                    sequenced[:i]
                )
            
            return sequenced
            
        except Exception as e:
            logger.error(f"Error sequencing objectives with prerequisites: {e}")
            return objectives  # Return original order as fallback
    
    def create_fallback_path(
        self,
        education_level: EducationLevel,
        subject: str,
        learning_goals: List[str] = None,
        time_commitment: int = 10
    ) -> Dict[str, Any]:
        """
        Create a fallback learning path when AI services are unavailable.
        
        Args:
            education_level: User's education level
            subject: Subject area
            learning_goals: Optional learning goals
            time_commitment: Available hours per week
            
        Returns:
            Fallback learning path structure
        """
        try:
            logger.info(f"Creating fallback path for {education_level} - {subject}")
            
            # Get predefined curriculum for the subject and level
            curriculum = self._get_fallback_curriculum(education_level, subject)
            
            # Create basic objectives from curriculum
            objectives = self._create_fallback_objectives(
                curriculum,
                learning_goals or [],
                time_commitment
            )
            
            # Apply basic sequencing
            sequenced_objectives = self._apply_basic_sequencing(objectives)
            
            return {
                "path_id": f"fallback_{subject}_{education_level}_{int(datetime.now().timestamp())}",
                "subject": subject,
                "education_level": education_level,
                "objectives": sequenced_objectives,
                "total_estimated_hours": sum(obj.get('estimated_hours', 2) for obj in sequenced_objectives),
                "difficulty_progression": self._get_default_progression(education_level),
                "milestones": self._create_basic_milestones(sequenced_objectives),
                "created_at": datetime.now().isoformat(),
                "source": "fallback_algorithm"
            }
            
        except Exception as e:
            logger.error(f"Error creating fallback path: {e}")
            # Return minimal fallback
            return self._create_minimal_fallback(education_level, subject)
    
    def _assess_current_skills(self, user_profile: UserProfile, subject: str) -> Dict[str, Any]:
        """Assess user's current skills and knowledge gaps."""
        skill_levels = user_profile.skill_levels
        interaction_history = user_profile.interaction_history
        
        # Analyze skill levels in the subject
        current_level = skill_levels.get(subject, DifficultyLevel.BEGINNER)
        
        # Identify knowledge gaps based on interaction history
        knowledge_gaps = []
        strengths = []
        
        for interaction in interaction_history[-10:]:  # Last 10 interactions
            if interaction.get('subject') == subject:
                if interaction.get('success_rate', 0) < 0.7:
                    knowledge_gaps.extend(interaction.get('topics', []))
                elif interaction.get('success_rate', 0) > 0.9:
                    strengths.extend(interaction.get('topics', []))
        
        return {
            "current_level": current_level,
            "knowledge_gaps": list(set(knowledge_gaps)),
            "strengths": list(set(strengths)),
            "confidence_score": self._calculate_confidence_score(interaction_history, subject)
        }
    
    def _map_goals_to_objectives(
        self,
        learning_goals: List[str],
        subject: str,
        education_level: EducationLevel
    ) -> List[Dict[str, Any]]:
        """Map high-level learning goals to specific learning objectives."""
        objectives = []
        
        # Get subject taxonomy
        taxonomy = self.subject_taxonomies.get(subject, {})
        level_content = taxonomy.get(education_level, {})
        
        for goal in learning_goals:
            # Find matching objectives in taxonomy
            matching_objectives = self._find_matching_objectives(goal, level_content)
            objectives.extend(matching_objectives)
        
        # Add foundational objectives if needed
        if not objectives:
            objectives = self._get_default_objectives(subject, education_level)
        
        return objectives
    
    def _sequence_objectives(
        self,
        objectives: List[Dict[str, Any]],
        skill_assessment: Dict[str, Any],
        education_level: EducationLevel
    ) -> List[Dict[str, Any]]:
        """Sequence objectives based on prerequisites and difficulty."""
        # Filter out objectives for concepts already mastered
        strengths = skill_assessment.get('strengths', [])
        filtered_objectives = [
            obj for obj in objectives
            if not any(strength in obj.get('topics', []) for strength in strengths)
        ]
        
        # Add remedial objectives for knowledge gaps
        knowledge_gaps = skill_assessment.get('knowledge_gaps', [])
        remedial_objectives = self._create_remedial_objectives(knowledge_gaps, education_level)
        
        all_objectives = remedial_objectives + filtered_objectives
        
        # Apply prerequisite-based sequencing
        return self.sequence_with_prerequisites(all_objectives)
    
    def _adapt_for_learning_style(
        self,
        objectives: List[Dict[str, Any]],
        learning_style: str,
        preferred_formats: List[str]
    ) -> List[Dict[str, Any]]:
        """Adapt objectives based on learning style preferences."""
        adapted_objectives = []
        
        for obj in objectives:
            adapted_obj = obj.copy()
            
            # Adjust content recommendations based on learning style
            if learning_style == 'visual':
                adapted_obj['recommended_formats'] = ['video', 'infographic', 'diagram']
            elif learning_style == 'auditory':
                adapted_obj['recommended_formats'] = ['audio', 'podcast', 'lecture']
            elif learning_style == 'kinesthetic':
                adapted_obj['recommended_formats'] = ['interactive', 'simulation', 'hands_on']
            else:  # reading/writing
                adapted_obj['recommended_formats'] = ['article', 'document', 'text']
            
            # Filter by user's preferred formats
            if preferred_formats:
                adapted_obj['recommended_formats'] = [
                    fmt for fmt in adapted_obj['recommended_formats']
                    if fmt in preferred_formats
                ]
            
            adapted_objectives.append(adapted_obj)
        
        return adapted_objectives
    
    def _calculate_time_estimates(
        self,
        objectives: List[Dict[str, Any]],
        time_commitment: int
    ) -> List[Dict[str, Any]]:
        """Calculate time estimates for each objective."""
        timed_objectives = []
        
        for obj in objectives:
            timed_obj = obj.copy()
            
            # Base time estimate based on difficulty and content type
            base_hours = {
                DifficultyLevel.BEGINNER: 2,
                DifficultyLevel.INTERMEDIATE: 3,
                DifficultyLevel.ADVANCED: 4
            }.get(obj.get('difficulty', DifficultyLevel.BEGINNER), 2)
            
            # Adjust based on objective complexity
            complexity_multiplier = len(obj.get('skills_gained', [])) * 0.5 + 1
            estimated_hours = int(base_hours * complexity_multiplier)
            
            timed_obj['estimated_hours'] = estimated_hours
            timed_obj['estimated_weeks'] = max(1, estimated_hours // time_commitment)
            
            timed_objectives.append(timed_obj)
        
        return timed_objectives
    
    def _create_difficulty_progression(
        self,
        objectives: List[Dict[str, Any]],
        starting_level: DifficultyLevel
    ) -> Dict[str, Any]:
        """Create a difficulty progression strategy."""
        progression = {
            "starting_level": starting_level,
            "target_level": DifficultyLevel.ADVANCED,
            "progression_rate": "adaptive",
            "milestones": []
        }
        
        # Create progression milestones
        current_level = starting_level
        for i, obj in enumerate(objectives):
            if i > 0 and i % 3 == 0:  # Every 3 objectives
                if current_level == DifficultyLevel.BEGINNER:
                    current_level = DifficultyLevel.INTERMEDIATE
                elif current_level == DifficultyLevel.INTERMEDIATE:
                    current_level = DifficultyLevel.ADVANCED
                
                progression["milestones"].append({
                    "objective_index": i,
                    "target_level": current_level,
                    "assessment_required": True
                })
        
        return progression
    
    def _create_milestones(self, objectives: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create learning milestones from objectives."""
        milestones = []
        
        # Group objectives into milestones (every 2-3 objectives)
        for i in range(0, len(objectives), 3):
            milestone_objectives = objectives[i:i+3]
            
            milestone = {
                "id": f"milestone_{i//3 + 1}",
                "title": f"Milestone {i//3 + 1}",
                "description": f"Complete objectives {i+1}-{min(i+3, len(objectives))}",
                "objectives": [obj.get('id', f"obj_{j}") for j, obj in enumerate(milestone_objectives)],
                "completion_criteria": [
                    "Complete all assigned objectives",
                    "Pass milestone assessment with 80% or higher",
                    "Demonstrate practical application of concepts"
                ],
                "estimated_completion": sum(obj.get('estimated_hours', 2) for obj in milestone_objectives)
            }
            
            milestones.append(milestone)
        
        return milestones
    
    def _create_adaptation_strategy(self, user_profile: UserProfile) -> Dict[str, Any]:
        """Create strategy for adapting the learning path."""
        return {
            "performance_thresholds": {
                "struggling": 0.6,  # Below 60% comprehension
                "mastery": 0.9,     # Above 90% comprehension
                "optimal_range": [0.7, 0.85]  # Target comprehension range
            },
            "adaptation_triggers": [
                "consecutive_low_performance",
                "rapid_mastery",
                "engagement_drop",
                "time_constraint_changes"
            ],
            "adaptation_methods": [
                "difficulty_adjustment",
                "content_format_change",
                "prerequisite_reinforcement",
                "advanced_content_introduction"
            ]
        }
    
    def _load_subject_taxonomies(self) -> Dict[str, Any]:
        """Load subject taxonomies and learning progressions."""
        # This would typically load from a database or configuration file
        return {
            "mathematics": {
                EducationLevel.K12: {
                    "arithmetic": ["addition", "subtraction", "multiplication", "division"],
                    "algebra": ["variables", "equations", "functions", "graphing"],
                    "geometry": ["shapes", "area", "volume", "proofs"],
                    "statistics": ["data_analysis", "probability", "distributions"]
                },
                EducationLevel.COLLEGE: {
                    "calculus": ["limits", "derivatives", "integrals", "series"],
                    "linear_algebra": ["vectors", "matrices", "eigenvalues", "transformations"],
                    "discrete_math": ["logic", "sets", "combinatorics", "graph_theory"]
                }
            },
            "computer_science": {
                EducationLevel.K12: {
                    "programming_basics": ["variables", "loops", "conditionals", "functions"],
                    "problem_solving": ["algorithms", "debugging", "testing", "documentation"]
                },
                EducationLevel.COLLEGE: {
                    "data_structures": ["arrays", "lists", "trees", "graphs", "hash_tables"],
                    "algorithms": ["sorting", "searching", "dynamic_programming", "greedy"],
                    "software_engineering": ["design_patterns", "testing", "version_control"]
                }
            }
        }
    
    def _load_difficulty_progressions(self) -> Dict[str, Any]:
        """Load difficulty progression patterns."""
        return {
            "linear": {"rate": 0.1, "description": "Steady increase in difficulty"},
            "exponential": {"rate": 0.2, "description": "Rapid difficulty increase"},
            "adaptive": {"rate": "variable", "description": "Adjust based on performance"}
        }
    
    def _build_prerequisite_graph(self) -> Dict[str, List[str]]:
        """Build prerequisite relationships between concepts."""
        return {
            "algebra": ["arithmetic"],
            "calculus": ["algebra", "functions"],
            "data_structures": ["programming_basics"],
            "algorithms": ["data_structures", "problem_solving"]
        }
    
    def _get_fallback_curriculum(self, education_level: EducationLevel, subject: str) -> List[str]:
        """Get predefined curriculum for fallback scenarios."""
        fallback_curricula = {
            (EducationLevel.K12, "mathematics"): [
                "Basic arithmetic operations",
                "Fractions and decimals",
                "Introduction to algebra",
                "Geometry fundamentals",
                "Basic statistics"
            ],
            (EducationLevel.COLLEGE, "computer_science"): [
                "Programming fundamentals",
                "Data structures",
                "Algorithm design",
                "Software development practices",
                "System design basics"
            ]
        }
        
        return fallback_curricula.get((education_level, subject), [
            f"Introduction to {subject}",
            f"Fundamental concepts in {subject}",
            f"Intermediate {subject} topics",
            f"Advanced {subject} applications"
        ])
    
    def _create_minimal_fallback(self, education_level: EducationLevel, subject: str) -> Dict[str, Any]:
        """Create minimal fallback when all else fails."""
        return {
            "path_id": f"minimal_fallback_{subject}_{int(datetime.now().timestamp())}",
            "subject": subject,
            "education_level": education_level,
            "objectives": [
                {
                    "id": "obj_1",
                    "title": f"Introduction to {subject}",
                    "description": f"Basic concepts and fundamentals of {subject}",
                    "difficulty": DifficultyLevel.BEGINNER,
                    "estimated_hours": 4,
                    "skills_gained": [f"{subject}_basics"]
                }
            ],
            "total_estimated_hours": 4,
            "difficulty_progression": {"starting_level": DifficultyLevel.BEGINNER},
            "milestones": [],
            "created_at": datetime.now().isoformat(),
            "source": "minimal_fallback"
        }
    
    # Additional helper methods would be implemented here...
    def _analyze_performance_patterns(self, performance_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze user performance patterns."""
        # Implementation for performance analysis
        return {
            "average_comprehension": performance_data.get("comprehension_score", 75),
            "struggling_concepts": performance_data.get("struggling_concepts", []),
            "mastered_concepts": performance_data.get("mastered_concepts", []),
            "engagement_trend": "stable"
        }
    
    def _calculate_difficulty_adjustment(self, performance_analysis: Dict[str, Any], current_progression: Dict[str, Any]) -> str:
        """Calculate needed difficulty adjustment."""
        avg_comprehension = performance_analysis.get("average_comprehension", 75)
        
        if avg_comprehension < 60:
            return "decrease"
        elif avg_comprehension > 90:
            return "increase"
        else:
            return "maintain"
    
    def _adapt_objectives_for_performance(
        self,
        objectives: List[Dict[str, Any]],
        struggling_concepts: List[str],
        mastered_concepts: List[str],
        difficulty_adjustment: str
    ) -> List[Dict[str, Any]]:
        """Adapt objectives based on performance data."""
        adapted = []
        
        for obj in objectives:
            adapted_obj = obj.copy()
            
            # Add remedial content for struggling concepts
            if any(concept in obj.get('topics', []) for concept in struggling_concepts):
                adapted_obj['remedial_content'] = True
                adapted_obj['estimated_hours'] = int(obj.get('estimated_hours', 2) * 1.5)
            
            # Skip or accelerate mastered concepts
            if any(concept in obj.get('topics', []) for concept in mastered_concepts):
                adapted_obj['accelerated'] = True
                adapted_obj['estimated_hours'] = max(1, int(obj.get('estimated_hours', 2) * 0.7))
            
            adapted.append(adapted_obj)
        
        return adapted
    
    def _update_difficulty_progression(
        self,
        current_progression: Dict[str, Any],
        difficulty_adjustment: str,
        performance_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update difficulty progression based on performance."""
        updated = current_progression.copy()
        updated["last_adjustment"] = {
            "timestamp": datetime.now().isoformat(),
            "adjustment": difficulty_adjustment,
            "reason": f"Performance analysis: {performance_analysis.get('average_comprehension', 0)}% comprehension"
        }
        return updated
    
    def _build_objective_dependencies(self, objectives: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Build dependency graph for objectives."""
        dependencies = {}
        for obj in objectives:
            obj_id = obj.get('id', obj.get('title', ''))
            dependencies[obj_id] = obj.get('prerequisites', [])
        return dependencies
    
    def _topological_sort_with_constraints(
        self,
        objectives: List[Dict[str, Any]],
        dependency_graph: Dict[str, List[str]],
        completed: List[str]
    ) -> List[Dict[str, Any]]:
        """Perform topological sort considering prerequisites."""
        # Simple implementation - in practice, this would be more sophisticated
        sorted_objectives = []
        remaining = objectives.copy()
        
        while remaining:
            # Find objectives with no unmet prerequisites
            ready = []
            for obj in remaining:
                obj_id = obj.get('id', obj.get('title', ''))
                prerequisites = dependency_graph.get(obj_id, [])
                
                if all(prereq in completed or 
                      any(sorted_obj.get('id') == prereq for sorted_obj in sorted_objectives)
                      for prereq in prerequisites):
                    ready.append(obj)
            
            if not ready:
                # Break circular dependencies by taking the first remaining
                ready = [remaining[0]]
            
            # Add ready objectives to sorted list
            for obj in ready:
                sorted_objectives.append(obj)
                remaining.remove(obj)
        
        return sorted_objectives
    
    def _check_prerequisites_met(
        self,
        objective: Dict[str, Any],
        completed: List[str],
        previous_in_sequence: List[Dict[str, Any]]
    ) -> bool:
        """Check if prerequisites for an objective are met."""
        prerequisites = objective.get('prerequisites', [])
        
        for prereq in prerequisites:
            if prereq not in completed and not any(
                prev.get('id') == prereq for prev in previous_in_sequence
            ):
                return False
        
        return True
    
    def _create_fallback_objectives(
        self,
        curriculum: List[str],
        learning_goals: List[str],
        time_commitment: int
    ) -> List[Dict[str, Any]]:
        """Create objectives from fallback curriculum."""
        objectives = []
        
        for i, topic in enumerate(curriculum):
            obj = {
                "id": f"fallback_obj_{i+1}",
                "title": topic,
                "description": f"Learn and understand {topic.lower()}",
                "difficulty": DifficultyLevel.BEGINNER if i < 2 else DifficultyLevel.INTERMEDIATE,
                "estimated_hours": max(2, time_commitment // len(curriculum)),
                "skills_gained": [topic.lower().replace(" ", "_")],
                "prerequisites": [f"fallback_obj_{i}"] if i > 0 else []
            }
            objectives.append(obj)
        
        return objectives
    
    def _apply_basic_sequencing(self, objectives: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply basic sequencing to objectives."""
        # Sort by difficulty and prerequisites
        return sorted(objectives, key=lambda x: (
            list(DifficultyLevel).index(x.get('difficulty', DifficultyLevel.BEGINNER)),
            len(x.get('prerequisites', []))
        ))
    
    def _get_default_progression(self, education_level: EducationLevel) -> Dict[str, Any]:
        """Get default difficulty progression for education level."""
        progressions = {
            EducationLevel.K12: {
                "starting_level": DifficultyLevel.BEGINNER,
                "target_level": DifficultyLevel.INTERMEDIATE,
                "progression_rate": "gradual"
            },
            EducationLevel.COLLEGE: {
                "starting_level": DifficultyLevel.INTERMEDIATE,
                "target_level": DifficultyLevel.ADVANCED,
                "progression_rate": "moderate"
            },
            EducationLevel.PROFESSIONAL: {
                "starting_level": DifficultyLevel.INTERMEDIATE,
                "target_level": DifficultyLevel.ADVANCED,
                "progression_rate": "accelerated"
            }
        }
        
        return progressions.get(education_level, progressions[EducationLevel.K12])
    
    def _create_basic_milestones(self, objectives: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create basic milestones for fallback scenarios."""
        milestones = []
        
        for i in range(0, len(objectives), 2):
            milestone = {
                "id": f"milestone_{i//2 + 1}",
                "title": f"Learning Milestone {i//2 + 1}",
                "description": f"Complete objectives {i+1}-{min(i+2, len(objectives))}",
                "objectives": [obj.get('id', f"obj_{j}") for j, obj in enumerate(objectives[i:i+2])],
                "completion_criteria": ["Complete assigned objectives", "Demonstrate understanding"]
            }
            milestones.append(milestone)
        
        return milestones
    
    def _calculate_confidence_score(self, interaction_history: List[Dict[str, Any]], subject: str) -> float:
        """Calculate user's confidence score in a subject."""
        subject_interactions = [
            interaction for interaction in interaction_history
            if interaction.get('subject') == subject
        ]
        
        if not subject_interactions:
            return 0.5  # Neutral confidence
        
        # Calculate based on recent success rates
        recent_success_rates = [
            interaction.get('success_rate', 0.5)
            for interaction in subject_interactions[-5:]  # Last 5 interactions
        ]
        
        return sum(recent_success_rates) / len(recent_success_rates)
    
    def _find_matching_objectives(self, goal: str, level_content: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Find objectives that match a learning goal."""
        objectives = []
        
        for category, topics in level_content.items():
            if any(topic.lower() in goal.lower() or goal.lower() in topic.lower() for topic in topics):
                for topic in topics:
                    obj = {
                        "id": f"obj_{category}_{topic}",
                        "title": f"Learn {topic}",
                        "description": f"Master {topic} concepts and applications",
                        "difficulty": DifficultyLevel.BEGINNER,
                        "topics": [topic],
                        "category": category,
                        "skills_gained": [topic.lower().replace(" ", "_")]
                    }
                    objectives.append(obj)
        
        return objectives
    
    def _get_default_objectives(self, subject: str, education_level: EducationLevel) -> List[Dict[str, Any]]:
        """Get default objectives when no specific goals are provided."""
        return [
            {
                "id": f"default_obj_1_{subject}",
                "title": f"Introduction to {subject}",
                "description": f"Learn fundamental concepts of {subject}",
                "difficulty": DifficultyLevel.BEGINNER,
                "estimated_hours": 4,
                "skills_gained": [f"{subject}_fundamentals"]
            },
            {
                "id": f"default_obj_2_{subject}",
                "title": f"Intermediate {subject}",
                "description": f"Build on {subject} fundamentals",
                "difficulty": DifficultyLevel.INTERMEDIATE,
                "estimated_hours": 6,
                "prerequisites": [f"default_obj_1_{subject}"],
                "skills_gained": [f"{subject}_intermediate"]
            }
        ]
    
    def _create_remedial_objectives(self, knowledge_gaps: List[str], education_level: EducationLevel) -> List[Dict[str, Any]]:
        """Create remedial objectives to address knowledge gaps."""
        remedial_objectives = []
        
        for i, gap in enumerate(knowledge_gaps):
            obj = {
                "id": f"remedial_obj_{i+1}",
                "title": f"Review {gap}",
                "description": f"Strengthen understanding of {gap}",
                "difficulty": DifficultyLevel.BEGINNER,
                "estimated_hours": 2,
                "remedial": True,
                "topics": [gap],
                "skills_gained": [gap.lower().replace(" ", "_")]
            }
            remedial_objectives.append(obj)
        
        return remedial_objectives