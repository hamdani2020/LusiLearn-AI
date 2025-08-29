import time
import uuid
from typing import Callable, Optional
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from src.utils.logger import ai_logger
import psutil
import os

class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for monitoring API requests and performance"""
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Record start time
        start_time = time.time()
        
        # Extract user info if available
        user_id = None
        if hasattr(request.state, 'user_id'):
            user_id = request.state.user_id
        
        # Log request start
        ai_logger.info(
            f"Request started: {request.method} {request.url.path}",
            request_id=request_id,
            user_id=user_id,
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log successful request
            ai_logger.log_performance(
                f"API Request: {request.method} {request.url.path}",
                duration * 1000,  # Convert to milliseconds
                user_id=user_id,
                request_id=request_id,
                status_code=response.status_code,
                method=request.method,
                path=request.url.path
            )
            
            # Log slow requests
            if duration > 5.0:  # 5 seconds threshold
                ai_logger.warning(
                    f"Slow request detected: {request.method} {request.url.path}",
                    request_id=request_id,
                    duration=duration * 1000,
                    user_id=user_id
                )
            
            # Add response headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        except Exception as e:
            # Calculate duration for failed requests
            duration = time.time() - start_time
            
            # Log error
            ai_logger.error(
                f"Request failed: {request.method} {request.url.path}",
                request_id=request_id,
                user_id=user_id,
                error=str(e),
                duration=duration * 1000,
                method=request.method,
                path=request.url.path
            )
            
            raise

class AIUsageTracker:
    """Track AI model usage and costs"""
    
    def __init__(self):
        self.model_costs = {
            "gpt-4": 0.00003,  # $0.03 per 1K tokens
            "gpt-3.5-turbo": 0.000002,  # $0.002 per 1K tokens
            "text-embedding-ada-002": 0.0000001,  # $0.0001 per 1K tokens
            "dall-e-3": 0.04,  # $0.04 per image
            "whisper-1": 0.006  # $0.006 per minute
        }
    
    def track_usage(self, model: str, operation: str, tokens: int, 
                   user_id: Optional[str] = None, **kwargs):
        """Track AI model usage and calculate cost"""
        cost = self.calculate_cost(model, tokens)
        
        ai_logger.log_ai_usage(
            model=model,
            operation=operation,
            tokens=tokens,
            cost=cost,
            user_id=user_id,
            **kwargs
        )
        
        return cost
    
    def calculate_cost(self, model: str, tokens: int) -> float:
        """Calculate cost based on model and token count"""
        cost_per_token = self.model_costs.get(model, 0.00001)  # Default fallback
        return tokens * cost_per_token
    
    def track_inference(self, model: str, input_tokens: int, output_tokens: int,
                       latency: float, user_id: Optional[str] = None, **kwargs):
        """Track model inference with detailed metrics"""
        total_tokens = input_tokens + output_tokens
        cost = self.calculate_cost(model, total_tokens)
        
        ai_logger.log_model_inference(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency=latency,
            user_id=user_id,
            cost=cost,
            **kwargs
        )
        
        return cost

class SystemMonitor:
    """Monitor system resources and performance"""
    
    def __init__(self):
        self.process = psutil.Process(os.getpid())
    
    def get_system_metrics(self) -> dict:
        """Get current system metrics"""
        try:
            cpu_percent = self.process.cpu_percent()
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()
            
            return {
                "cpu_percent": cpu_percent,
                "memory_rss": memory_info.rss,
                "memory_vms": memory_info.vms,
                "memory_percent": memory_percent,
                "num_threads": self.process.num_threads(),
                "num_fds": self.process.num_fds() if hasattr(self.process, 'num_fds') else None,
                "create_time": self.process.create_time(),
                "uptime": time.time() - self.process.create_time()
            }
        except Exception as e:
            ai_logger.error(f"Failed to get system metrics: {str(e)}")
            return {}
    
    def log_system_metrics(self):
        """Log current system metrics"""
        metrics = self.get_system_metrics()
        if metrics:
            ai_logger.info("System metrics", **metrics)
    
    def check_resource_alerts(self):
        """Check for resource usage alerts"""
        metrics = self.get_system_metrics()
        
        # CPU usage alert
        if metrics.get("cpu_percent", 0) > 80:
            ai_logger.warning(
                "High CPU usage detected",
                cpu_percent=metrics["cpu_percent"]
            )
        
        # Memory usage alert
        if metrics.get("memory_percent", 0) > 80:
            ai_logger.warning(
                "High memory usage detected",
                memory_percent=metrics["memory_percent"],
                memory_rss=metrics["memory_rss"]
            )

class HealthChecker:
    """Health check utilities for AI service"""
    
    def __init__(self):
        self.system_monitor = SystemMonitor()
        self.start_time = time.time()
    
    async def check_health(self) -> dict:
        """Perform comprehensive health check"""
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "uptime": time.time() - self.start_time,
            "version": os.getenv("SERVICE_VERSION", "1.0.0"),
            "environment": os.getenv("ENVIRONMENT", "development")
        }
        
        try:
            # Check system resources
            system_metrics = self.system_monitor.get_system_metrics()
            health_status["system"] = system_metrics
            
            # Check external dependencies
            dependencies = await self._check_dependencies()
            health_status["dependencies"] = dependencies
            
            # Determine overall health
            if any(dep.get("status") == "unhealthy" for dep in dependencies.values()):
                health_status["status"] = "degraded"
            
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["error"] = str(e)
            ai_logger.error(f"Health check failed: {str(e)}")
        
        return health_status
    
    async def _check_dependencies(self) -> dict:
        """Check external dependencies"""
        dependencies = {}
        
        # Check OpenAI API
        try:
            # This would be a simple API call to check connectivity
            dependencies["openai"] = {
                "status": "healthy",
                "response_time": 0  # Would measure actual response time
            }
        except Exception as e:
            dependencies["openai"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # Check Vector Database (Pinecone)
        try:
            # This would ping the vector database
            dependencies["vector_db"] = {
                "status": "healthy",
                "response_time": 0
            }
        except Exception as e:
            dependencies["vector_db"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # Check Redis
        try:
            # This would ping Redis
            dependencies["redis"] = {
                "status": "healthy",
                "response_time": 0
            }
        except Exception as e:
            dependencies["redis"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        return dependencies

# Global instances
usage_tracker = AIUsageTracker()
system_monitor = SystemMonitor()
health_checker = HealthChecker()

# Decorator for tracking AI operations
def track_ai_operation(model: str, operation: str):
    """Decorator to track AI operations"""
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            user_id = kwargs.get('user_id')
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Extract token count from result if available
                tokens = getattr(result, 'tokens', 0)
                if hasattr(result, 'usage'):
                    tokens = result.usage.total_tokens
                
                # Track usage
                usage_tracker.track_usage(
                    model=model,
                    operation=operation,
                    tokens=tokens,
                    user_id=user_id,
                    duration=duration * 1000,
                    success=True
                )
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                ai_logger.error(
                    f"AI operation failed: {operation}",
                    model=model,
                    operation=operation,
                    user_id=user_id,
                    duration=duration * 1000,
                    error=str(e)
                )
                
                raise
        
        return wrapper
    return decorator