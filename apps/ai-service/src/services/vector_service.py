"""
Vector database service using Pinecone for content embeddings.
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import asyncio
from concurrent.futures import ThreadPoolExecutor

from ..config import settings
from ..utils.exceptions import VectorServiceError

logger = logging.getLogger(__name__)

try:
    import pinecone
    from pinecone import Pinecone, ServerlessSpec
    PINECONE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Pinecone import failed: {e}")
    PINECONE_AVAILABLE = False
    # Create dummy classes for fallback
    class Pinecone:
        def __init__(self, *args, **kwargs):
            pass
    class ServerlessSpec:
        def __init__(self, *args, **kwargs):
            pass


class VectorService:
    """Service for vector database operations using Pinecone."""
    
    def __init__(self):
        self.client = None
        self.index = None
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    async def initialize(self):
        """Initialize Pinecone connection and index."""
        try:
            # Check if Pinecone is available and configured
            if not PINECONE_AVAILABLE:
                logger.warning("Pinecone not available - vector service will run in fallback mode")
                return
            
            if not settings.PINECONE_API_KEY or settings.PINECONE_API_KEY == "":
                logger.warning("Pinecone API key not configured - vector service will run in fallback mode")
                return
            
            # Initialize Pinecone client
            self.client = Pinecone(api_key=settings.PINECONE_API_KEY)
            
            # Check if index exists, create if not
            await self._ensure_index_exists()
            
            # Connect to index
            self.index = self.client.Index(settings.PINECONE_INDEX_NAME)
            
            logger.info(f"Vector service initialized with index: {settings.PINECONE_INDEX_NAME}")
            
        except Exception as e:
            logger.warning(f"Failed to initialize vector service: {e} - running in fallback mode")
            # Don't raise exception, just log warning and continue without vector service
    
    async def close(self):
        """Close connections and cleanup."""
        if self.executor:
            self.executor.shutdown(wait=True)
    
    async def _ensure_index_exists(self):
        """Ensure the Pinecone index exists, create if not."""
        try:
            # Run in thread pool since Pinecone client is synchronous
            existing_indexes = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: self.client.list_indexes().names()
            )
            
            if settings.PINECONE_INDEX_NAME not in existing_indexes:
                logger.info(f"Creating Pinecone index: {settings.PINECONE_INDEX_NAME}")
                
                await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    lambda: self.client.create_index(
                        name=settings.PINECONE_INDEX_NAME,
                        dimension=settings.PINECONE_DIMENSION,
                        metric=settings.PINECONE_METRIC,
                        spec=ServerlessSpec(
                            cloud='aws',
                            region='us-east-1'
                        )
                    )
                )
                
                # Wait for index to be ready
                await asyncio.sleep(10)
                logger.info(f"Index {settings.PINECONE_INDEX_NAME} created successfully")
            else:
                logger.info(f"Index {settings.PINECONE_INDEX_NAME} already exists")
                
        except Exception as e:
            logger.error(f"Error ensuring index exists: {e}")
            raise VectorServiceError(f"Failed to ensure index exists: {e}")
    
    async def upsert_content_embeddings(
        self, 
        content_items: List[Dict[str, Any]]
    ) -> bool:
        """Upsert content embeddings to Pinecone."""
        try:
            if not PINECONE_AVAILABLE or not self.index:
                logger.warning("Vector service not available - skipping upsert")
                return False
            
            # Prepare vectors for upsert
            vectors = []
            for item in content_items:
                if 'embedding' not in item or 'id' not in item:
                    logger.warning(f"Skipping item without embedding or id: {item.get('id', 'unknown')}")
                    continue
                
                vector_data = {
                    'id': str(item['id']),
                    'values': item['embedding'],
                    'metadata': {
                        'title': item.get('title', ''),
                        'subject': item.get('subject', ''),
                        'difficulty': item.get('difficulty', 'intermediate'),
                        'content_type': item.get('content_type', 'unknown'),
                        'source': item.get('source', 'unknown'),
                        'age_rating': item.get('age_rating', 'general'),
                        'duration': item.get('duration', 0),
                        'topics': ','.join(item.get('topics', [])),
                        'created_at': str(item.get('created_at', '')),
                    }
                }
                vectors.append(vector_data)
            
            if not vectors:
                logger.warning("No valid vectors to upsert")
                return False
            
            # Upsert in batches
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                
                await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    lambda b=batch: self.index.upsert(vectors=b)
                )
                
                logger.info(f"Upserted batch {i//batch_size + 1}/{(len(vectors)-1)//batch_size + 1}")
            
            logger.info(f"Successfully upserted {len(vectors)} content embeddings")
            return True
            
        except Exception as e:
            logger.error(f"Error upserting content embeddings: {e}")
            return False
    
    async def search_similar_content(
        self, 
        query_embedding: List[float],
        filters: Optional[Dict[str, Any]] = None,
        top_k: int = 10,
        include_metadata: bool = True
    ) -> List[Dict[str, Any]]:
        """Search for similar content using vector similarity."""
        try:
            if not PINECONE_AVAILABLE or not self.index:
                logger.warning("Vector service not available - returning empty results")
                return []
            
            # Prepare filter
            pinecone_filter = {}
            if filters:
                for key, value in filters.items():
                    if key in ['subject', 'difficulty', 'content_type', 'source', 'age_rating']:
                        pinecone_filter[key] = {'$eq': value}
                    elif key == 'topics' and isinstance(value, list):
                        # For topics, we'll search for any matching topic
                        pinecone_filter['topics'] = {'$in': value}
            
            # Perform search
            search_results = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: self.index.query(
                    vector=query_embedding,
                    top_k=top_k,
                    include_metadata=include_metadata,
                    filter=pinecone_filter if pinecone_filter else None
                )
            )
            
            # Process results
            results = []
            for match in search_results.matches:
                result = {
                    'id': match.id,
                    'score': float(match.score),
                }
                
                if include_metadata and match.metadata:
                    result['metadata'] = dict(match.metadata)
                    # Convert topics back to list
                    if 'topics' in result['metadata']:
                        result['metadata']['topics'] = result['metadata']['topics'].split(',')
                
                results.append(result)
            
            logger.info(f"Found {len(results)} similar content items")
            return results
            
        except Exception as e:
            logger.error(f"Error searching similar content: {e}")
            return []
    
    async def get_content_by_ids(
        self, 
        content_ids: List[str],
        include_metadata: bool = True
    ) -> Dict[str, Dict[str, Any]]:
        """Fetch content by IDs from Pinecone."""
        try:
            if not PINECONE_AVAILABLE or not self.index:
                logger.warning("Vector service not available - returning empty results")
                return {}
            
            # Fetch vectors by IDs
            fetch_result = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: self.index.fetch(ids=content_ids)
            )
            
            # Process results
            results = {}
            for content_id, vector_data in fetch_result.vectors.items():
                result = {
                    'id': content_id,
                    'values': vector_data.values if hasattr(vector_data, 'values') else None
                }
                
                if include_metadata and hasattr(vector_data, 'metadata') and vector_data.metadata:
                    result['metadata'] = dict(vector_data.metadata)
                    # Convert topics back to list
                    if 'topics' in result['metadata']:
                        result['metadata']['topics'] = result['metadata']['topics'].split(',')
                
                results[content_id] = result
            
            logger.info(f"Fetched {len(results)} content items by ID")
            return results
            
        except Exception as e:
            logger.error(f"Error fetching content by IDs: {e}")
            return {}
    
    async def delete_content(self, content_ids: List[str]) -> bool:
        """Delete content from Pinecone index."""
        try:
            if not self.index:
                raise VectorServiceError("Vector service not initialized")
            
            await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: self.index.delete(ids=content_ids)
            )
            
            logger.info(f"Deleted {len(content_ids)} content items")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting content: {e}")
            raise VectorServiceError(f"Failed to delete content: {e}")
    
    async def get_index_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        try:
            if not self.index:
                raise VectorServiceError("Vector service not initialized")
            
            stats = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                lambda: self.index.describe_index_stats()
            )
            
            return {
                'total_vector_count': stats.total_vector_count,
                'dimension': stats.dimension,
                'index_fullness': stats.index_fullness,
                'namespaces': dict(stats.namespaces) if stats.namespaces else {}
            }
            
        except Exception as e:
            logger.error(f"Error getting index stats: {e}")
            raise VectorServiceError(f"Failed to get index stats: {e}")
    
    async def create_user_preference_vector(
        self, 
        user_interactions: List[Dict[str, Any]],
        content_embeddings: Dict[str, List[float]]
    ) -> List[float]:
        """Create user preference vector based on interactions."""
        try:
            if not user_interactions:
                # Return zero vector for new users
                return [0.0] * settings.PINECONE_DIMENSION
            
            # Weight interactions by type and recency
            weighted_embeddings = []
            total_weight = 0
            
            for interaction in user_interactions:
                content_id = interaction.get('content_id')
                if content_id not in content_embeddings:
                    continue
                
                # Calculate weight based on interaction type and rating
                weight = self._calculate_interaction_weight(interaction)
                if weight > 0:
                    embedding = np.array(content_embeddings[content_id])
                    weighted_embeddings.append(embedding * weight)
                    total_weight += weight
            
            if not weighted_embeddings or total_weight == 0:
                return [0.0] * settings.PINECONE_DIMENSION
            
            # Calculate weighted average
            preference_vector = np.sum(weighted_embeddings, axis=0) / total_weight
            
            # Normalize vector
            norm = np.linalg.norm(preference_vector)
            if norm > 0:
                preference_vector = preference_vector / norm
            
            return preference_vector.tolist()
            
        except Exception as e:
            logger.error(f"Error creating user preference vector: {e}")
            return [0.0] * settings.PINECONE_DIMENSION
    
    def _calculate_interaction_weight(self, interaction: Dict[str, Any]) -> float:
        """Calculate weight for user interaction."""
        base_weights = {
            'view': 1.0,
            'like': 2.0,
            'complete': 3.0,
            'bookmark': 2.5,
            'share': 2.0,
            'rate': 1.5
        }
        
        interaction_type = interaction.get('type', 'view')
        base_weight = base_weights.get(interaction_type, 1.0)
        
        # Adjust by rating if available
        rating = interaction.get('rating', 3.0)  # Default neutral rating
        rating_multiplier = rating / 3.0  # Normalize to 1.0 for neutral
        
        # Adjust by recency (more recent interactions have higher weight)
        import datetime
        interaction_date = interaction.get('created_at')
        if interaction_date:
            try:
                if isinstance(interaction_date, str):
                    interaction_date = datetime.datetime.fromisoformat(interaction_date.replace('Z', '+00:00'))
                
                days_ago = (datetime.datetime.now(datetime.timezone.utc) - interaction_date).days
                recency_multiplier = max(0.1, 1.0 - (days_ago / 365))  # Decay over a year
            except:
                recency_multiplier = 1.0
        else:
            recency_multiplier = 1.0
        
        return base_weight * rating_multiplier * recency_multiplier