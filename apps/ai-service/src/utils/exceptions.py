"""
Custom exceptions for AI service.
"""


class AIServiceError(Exception):
    """Base exception for AI service errors."""
    
    def __init__(self, message: str, error_code: str = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or "AI_SERVICE_ERROR"


class OpenAIError(AIServiceError):
    """Exception for OpenAI API errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "OPENAI_ERROR")


class RateLimitError(AIServiceError):
    """Exception for rate limit errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "RATE_LIMIT_ERROR")


class VectorServiceError(AIServiceError):
    """Exception for vector database errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "VECTOR_SERVICE_ERROR")


class HealthCheckError(AIServiceError):
    """Exception for health check errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "HEALTH_CHECK_ERROR")


class ValidationError(AIServiceError):
    """Exception for validation errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "VALIDATION_ERROR")


class ConfigurationError(AIServiceError):
    """Exception for configuration errors."""
    
    def __init__(self, message: str):
        super().__init__(message, "CONFIGURATION_ERROR")