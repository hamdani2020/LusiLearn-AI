"""
Health check routes for AI service.
"""
from fastapi import APIRouter, Depends
from ..models.ai_models import HealthCheckResponse
from ..services.health_service import HealthService

router = APIRouter()


async def get_health_service() -> HealthService:
    """Dependency to get health service instance."""
    from ..main import health_service
    return health_service


@router.get("/", response_model=HealthCheckResponse)
async def health_check(
    health_service: HealthService = Depends(get_health_service)
):
    """Perform health check."""
    return await health_service.perform_health_check()


@router.get("/status")
async def health_status(
    health_service: HealthService = Depends(get_health_service)
):
    """Get current health status."""
    return await health_service.get_health_status()


@router.get("/metrics")
async def service_metrics(
    health_service: HealthService = Depends(get_health_service)
):
    """Get service metrics."""
    return await health_service.get_service_metrics()