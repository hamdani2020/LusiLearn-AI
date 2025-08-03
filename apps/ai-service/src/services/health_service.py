"""
Health check and monitoring service for AI service.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
import redis.asyncio as redis
import openai
from openai import AsyncOpenAI
try:
    import pinecone
    from pinecone import Pinecone
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False
    class Pinecone:
        def __init__(self, *args, **kwargs):
            pass

from ..config import settings
from ..utils.exceptions import HealthCheckError

logger = logging.getLogger(__name__)


class HealthService:
    """Service for health checks and monitoring."""
    
    def __init__(self):
        self.redis_client = None
        self.openai_client = None
        self.pinecone_client = None
        self.health_status = {
            'status': 'unknown',
            'last_check': None,
            'services': {}
        }
        self._monitoring_task = None
        
    async def initialize(self):
        """Initialize health monitoring."""
        try:
            # Initialize clients for health checks
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                db=settings.REDIS_DB,
                socket_timeout=settings.REDIS_TIMEOUT
            )
            
            self.openai_client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                timeout=10  # Shorter timeout for health checks
            )
            
            if PINECONE_AVAILABLE and settings.PINECONE_API_KEY:
                self.pinecone_client = Pinecone(api_key=settings.PINECONE_API_KEY)
            else:
                self.pinecone_client = None
                logger.warning("Pinecone not available or not configured")
            
            # Start monitoring task
            self._monitoring_task = asyncio.create_task(self._monitoring_loop())
            
            logger.info("Health service initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize health service: {e}")
            raise HealthCheckError(f"Health service initialization failed: {e}")
    
    async def close(self):
        """Close health service."""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
        
        if self.redis_client:
            await self.redis_client.close()
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get current health status."""
        return self.health_status.copy()
    
    async def perform_health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check."""
        start_time = datetime.now()
        
        health_results = {
            'status': 'healthy',
            'timestamp': start_time.isoformat(),
            'services': {},
            'overall_latency_ms': 0
        }
        
        # Check Redis
        redis_result = await self._check_redis()
        health_results['services']['redis'] = redis_result
        
        # Check OpenAI
        openai_result = await self._check_openai()
        health_results['services']['openai'] = openai_result
        
        # Check Pinecone
        pinecone_result = await self._check_pinecone()
        health_results['services']['pinecone'] = pinecone_result
        
        # Check system resources
        system_result = await self._check_system_resources()
        health_results['services']['system'] = system_result
        
        # Determine overall status
        service_statuses = [
            redis_result['status'],
            openai_result['status'], 
            pinecone_result['status'],
            system_result['status']
        ]
        
        if 'unhealthy' in service_statuses:
            health_results['status'] = 'unhealthy'
        elif 'degraded' in service_statuses:
            health_results['status'] = 'degraded'
        else:
            health_results['status'] = 'healthy'
        
        # Calculate overall latency
        end_time = datetime.now()
        health_results['overall_latency_ms'] = int((end_time - start_time).total_seconds() * 1000)
        
        # Update internal status
        self.health_status = health_results
        
        logger.info(f"Health check completed: {health_results['status']}")
        return health_results
    
    async def _check_redis(self) -> Dict[str, Any]:
        """Check Redis connectivity and performance."""
        start_time = datetime.now()
        
        try:
            # Test basic connectivity
            await self.redis_client.ping()
            
            # Test read/write operations
            test_key = "health_check_test"
            test_value = f"test_{start_time.timestamp()}"
            
            await self.redis_client.set(test_key, test_value, ex=60)
            retrieved_value = await self.redis_client.get(test_key)
            await self.redis_client.delete(test_key)
            
            if retrieved_value.decode() != test_value:
                raise Exception("Redis read/write test failed")
            
            # Get Redis info
            info = await self.redis_client.info()
            memory_usage = info.get('used_memory', 0)
            connected_clients = info.get('connected_clients', 0)
            
            latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            status = 'healthy'
            if latency_ms > 1000:  # 1 second
                status = 'degraded'
            elif memory_usage > 1024 * 1024 * 1024:  # 1GB
                status = 'degraded'
            
            return {
                'status': status,
                'latency_ms': latency_ms,
                'memory_usage_bytes': memory_usage,
                'connected_clients': connected_clients,
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                'status': 'unhealthy',
                'latency_ms': int((datetime.now() - start_time).total_seconds() * 1000),
                'error': str(e)
            }
    
    async def _check_openai(self) -> Dict[str, Any]:
        """Check OpenAI API connectivity and performance."""
        start_time = datetime.now()
        
        try:
            # Test basic API call
            response = await self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Health check test"}],
                max_tokens=5,
                temperature=0
            )
            
            if not response.choices or not response.choices[0].message.content:
                raise Exception("OpenAI API returned empty response")
            
            latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            status = 'healthy'
            if latency_ms > 5000:  # 5 seconds
                status = 'degraded'
            
            return {
                'status': status,
                'latency_ms': latency_ms,
                'model': response.model,
                'error': None
            }
            
        except openai.RateLimitError as e:
            logger.warning(f"OpenAI rate limit during health check: {e}")
            return {
                'status': 'degraded',
                'latency_ms': int((datetime.now() - start_time).total_seconds() * 1000),
                'error': 'Rate limit exceeded'
            }
        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            return {
                'status': 'unhealthy',
                'latency_ms': int((datetime.now() - start_time).total_seconds() * 1000),
                'error': str(e)
            }
    
    async def _check_pinecone(self) -> Dict[str, Any]:
        """Check Pinecone connectivity and performance."""
        start_time = datetime.now()
        
        # If Pinecone is not available or configured, return degraded status
        if not PINECONE_AVAILABLE or not self.pinecone_client:
            return {
                'status': 'degraded',
                'latency_ms': 0,
                'error': 'Pinecone not available or not configured'
            }
        
        try:
            # Check if index exists and get stats
            index_list = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.pinecone_client.list_indexes().names()
            )
            
            if settings.PINECONE_INDEX_NAME not in index_list:
                raise Exception(f"Index {settings.PINECONE_INDEX_NAME} not found")
            
            # Get index stats
            index = self.pinecone_client.Index(settings.PINECONE_INDEX_NAME)
            stats = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: index.describe_index_stats()
            )
            
            latency_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            status = 'healthy'
            if latency_ms > 3000:  # 3 seconds
                status = 'degraded'
            elif stats.index_fullness > 0.9:  # 90% full
                status = 'degraded'
            
            return {
                'status': status,
                'latency_ms': latency_ms,
                'vector_count': stats.total_vector_count,
                'index_fullness': stats.index_fullness,
                'dimension': stats.dimension,
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Pinecone health check failed: {e}")
            return {
                'status': 'unhealthy',
                'latency_ms': int((datetime.now() - start_time).total_seconds() * 1000),
                'error': str(e)
            }
    
    async def _check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage."""
        try:
            import psutil
            
            # Get CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Get disk usage
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            status = 'healthy'
            if cpu_percent > 90 or memory_percent > 90 or disk_percent > 90:
                status = 'unhealthy'
            elif cpu_percent > 70 or memory_percent > 70 or disk_percent > 70:
                status = 'degraded'
            
            return {
                'status': status,
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'error': None
            }
            
        except ImportError:
            # psutil not available, return basic status
            return {
                'status': 'healthy',
                'cpu_percent': None,
                'memory_percent': None,
                'disk_percent': None,
                'error': 'psutil not available'
            }
        except Exception as e:
            logger.error(f"System resource check failed: {e}")
            return {
                'status': 'unknown',
                'error': str(e)
            }
    
    async def _monitoring_loop(self):
        """Continuous monitoring loop."""
        while True:
            try:
                await asyncio.sleep(settings.HEALTH_CHECK_INTERVAL)
                await self.perform_health_check()
                
            except asyncio.CancelledError:
                logger.info("Health monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                # Continue monitoring even if one check fails
                await asyncio.sleep(10)
    
    async def get_service_metrics(self) -> Dict[str, Any]:
        """Get detailed service metrics."""
        try:
            metrics = {
                'timestamp': datetime.now().isoformat(),
                'uptime_seconds': 0,  # Would need to track service start time
                'health_checks_performed': 0,  # Would need to track this
                'last_health_check': self.health_status.get('timestamp'),
                'current_status': self.health_status.get('status', 'unknown')
            }
            
            # Add service-specific metrics
            if 'services' in self.health_status:
                for service_name, service_data in self.health_status['services'].items():
                    metrics[f'{service_name}_status'] = service_data.get('status', 'unknown')
                    metrics[f'{service_name}_latency_ms'] = service_data.get('latency_ms', 0)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting service metrics: {e}")
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }