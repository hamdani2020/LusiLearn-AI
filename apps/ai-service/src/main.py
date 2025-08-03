"""
FastAPI application entry point for AI service.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .services.ai_service import AIService
from .services.vector_service import VectorService
from .services.health_service import HealthService
from .routes import health, recommendations, learning_paths, peer_matching
from .middleware.error_handler import error_handler_middleware
from .middleware.logging_middleware import logging_middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global service instances
ai_service = None
vector_service = None
health_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    global ai_service, vector_service, health_service
    
    logger.info("Starting AI service...")
    
    try:
        # Initialize services
        ai_service = AIService()
        vector_service = VectorService()
        health_service = HealthService()
        
        # Initialize connections
        await ai_service.initialize()
        await vector_service.initialize()
        await health_service.initialize()
        
        logger.info("AI service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start AI service: {e}")
        raise
    finally:
        # Cleanup
        logger.info("Shutting down AI service...")
        if ai_service:
            await ai_service.close()
        if vector_service:
            await vector_service.close()
        if health_service:
            await health_service.close()
        logger.info("AI service shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="LusiLearn AI Service",
        description="AI-powered learning analytics and recommendation service",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    
    # Add custom middleware
    app.middleware("http")(logging_middleware)
    app.middleware("http")(error_handler_middleware)
    
    # Include routers
    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["recommendations"])
    app.include_router(learning_paths.router, prefix="/api/v1/learning-paths", tags=["learning-paths"])
    app.include_router(peer_matching.router, prefix="/api/v1/peer-matching", tags=["peer-matching"])
    
    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": "An unexpected error occurred"}
        )
    
    return app


# Create app instance
app = create_app()


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "LusiLearn AI Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "disabled"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    )