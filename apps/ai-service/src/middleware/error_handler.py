"""
Error handling middleware for AI service.
"""
import logging
import traceback
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ..utils.exceptions import (
    AIServiceError,
    OpenAIError,
    RateLimitError,
    VectorServiceError,
    HealthCheckError,
    ValidationError,
    ConfigurationError
)

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware for handling errors and exceptions."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
            
        except Exception as exc:
            return await self.handle_exception(request, exc)
    
    async def handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """Handle different types of exceptions."""
        
        # Log the exception
        logger.error(
            f"Exception in {request.method} {request.url.path}: {exc}",
            exc_info=True
        )
        
        # Handle specific AI service exceptions
        if isinstance(exc, RateLimitError):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": str(exc),
                    "error_code": exc.error_code,
                    "retry_after": 60
                }
            )
        
        elif isinstance(exc, OpenAIError):
            return JSONResponse(
                status_code=503,
                content={
                    "error": "AI service temporarily unavailable",
                    "message": "The AI service is experiencing issues. Please try again later.",
                    "error_code": exc.error_code,
                    "fallback_available": True
                }
            )
        
        elif isinstance(exc, VectorServiceError):
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Vector database service unavailable",
                    "message": "The recommendation service is temporarily unavailable.",
                    "error_code": exc.error_code
                }
            )
        
        elif isinstance(exc, HealthCheckError):
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Health check failed",
                    "message": str(exc),
                    "error_code": exc.error_code
                }
            )
        
        elif isinstance(exc, ValidationError):
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Validation error",
                    "message": str(exc),
                    "error_code": exc.error_code
                }
            )
        
        elif isinstance(exc, ConfigurationError):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Configuration error",
                    "message": "Service configuration issue. Please contact support.",
                    "error_code": exc.error_code
                }
            )
        
        elif isinstance(exc, AIServiceError):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "AI service error",
                    "message": str(exc),
                    "error_code": exc.error_code
                }
            )
        
        # Handle other common exceptions
        else:
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "message": "An unexpected error occurred. Please try again later.",
                    "error_code": "INTERNAL_ERROR"
                }
            )


async def error_handler_middleware(request: Request, call_next: Callable) -> Response:
    """Standalone error handler middleware function."""
    middleware = ErrorHandlerMiddleware(None)
    return await middleware.dispatch(request, call_next)