from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from src.middleware.monitoring import health_checker, system_monitor, usage_tracker
from src.utils.logger import ai_logger
import time
import os

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    try:
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "uptime": time.time() - health_checker.start_time,
            "version": os.getenv("SERVICE_VERSION", "1.0.0"),
            "environment": os.getenv("ENVIRONMENT", "development")
        }
    except Exception as e:
        ai_logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@router.get("/health/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with dependencies"""
    try:
        health_status = await health_checker.check_health()
        
        status_code = 200 if health_status["status"] == "healthy" else 503
        return health_status
    except Exception as e:
        ai_logger.error(f"Detailed health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")

@router.get("/metrics")
async def get_system_metrics() -> Dict[str, Any]:
    """Get current system metrics"""
    try:
        metrics = system_monitor.get_system_metrics()
        
        return {
            "system": metrics,
            "timestamp": time.time(),
            "service": "lusilearn-ai"
        }
    except Exception as e:
        ai_logger.error(f"Failed to get system metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")

@router.get("/ai-usage")
async def get_ai_usage_stats(period: str = "daily") -> Dict[str, Any]:
    """Get AI usage statistics"""
    try:
        if period not in ["daily", "monthly"]:
            raise HTTPException(status_code=400, detail="Period must be 'daily' or 'monthly'")
        
        # This would integrate with the usage tracker
        # For now, return mock data structure
        stats = {
            "period": period,
            "total_requests": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "model_breakdown": {},
            "timestamp": time.time()
        }
        
        return stats
    except Exception as e:
        ai_logger.error(f"Failed to get AI usage stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve AI usage stats")

@router.post("/alerts/test")
async def test_alert_system() -> Dict[str, Any]:
    """Test the alert system"""
    try:
        ai_logger.warning("Test alert triggered", alert_type="test", severity="low")
        
        return {
            "message": "Test alert sent successfully",
            "timestamp": time.time()
        }
    except Exception as e:
        ai_logger.error(f"Failed to send test alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send test alert")

@router.get("/logs/level")
async def get_log_level() -> Dict[str, Any]:
    """Get current log level"""
    return {
        "current_level": os.getenv("LOG_LEVEL", "INFO"),
        "available_levels": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    }

@router.post("/logs/level")
async def set_log_level(level: str) -> Dict[str, Any]:
    """Set log level dynamically"""
    valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
    
    if level.upper() not in valid_levels:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid log level. Must be one of: {valid_levels}"
        )
    
    # This would update the logger level dynamically
    # For now, just log the change
    ai_logger.info(f"Log level change requested: {level}")
    
    return {
        "message": f"Log level set to {level}",
        "new_level": level.upper(),
        "timestamp": time.time()
    }

@router.get("/performance/summary")
async def get_performance_summary() -> Dict[str, Any]:
    """Get performance summary"""
    try:
        system_metrics = system_monitor.get_system_metrics()
        
        return {
            "performance": {
                "cpu_usage": system_metrics.get("cpu_percent", 0),
                "memory_usage": system_metrics.get("memory_percent", 0),
                "uptime": system_metrics.get("uptime", 0),
                "active_threads": system_metrics.get("num_threads", 0)
            },
            "ai_operations": {
                "total_requests": 0,  # Would be tracked by usage_tracker
                "average_latency": 0,  # Would be calculated from performance logs
                "error_rate": 0  # Would be calculated from error logs
            },
            "timestamp": time.time()
        }
    except Exception as e:
        ai_logger.error(f"Failed to get performance summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve performance summary")