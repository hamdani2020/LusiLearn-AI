"""
Configuration settings for the AI service.
"""
import os
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", description="Application environment")
    DEBUG: bool = Field(default=True, description="Debug mode")
    
    # API Configuration
    API_HOST: str = Field(default="0.0.0.0", description="API host")
    API_PORT: int = Field(default=8001, description="API port")
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key")
    OPENAI_MODEL: str = Field(default="gpt-3.5-turbo", description="Default OpenAI model")
    OPENAI_MAX_TOKENS: int = Field(default=1000, description="Max tokens per request")
    OPENAI_TEMPERATURE: float = Field(default=0.7, description="OpenAI temperature")
    OPENAI_TIMEOUT: int = Field(default=30, description="OpenAI request timeout in seconds")
    OPENAI_MAX_RETRIES: int = Field(default=3, description="Max retry attempts for OpenAI")
    
    # Pinecone Configuration
    PINECONE_API_KEY: str = Field(default="", description="Pinecone API key", alias="VECTOR_DB_API_KEY")
    PINECONE_ENVIRONMENT: str = Field(default="", description="Pinecone environment", alias="VECTOR_DB_ENVIRONMENT")
    PINECONE_INDEX_NAME: str = Field(default="lusilearn-content", description="Pinecone index name", alias="VECTOR_DB_INDEX")
    PINECONE_DIMENSION: int = Field(default=1536, description="Vector dimension")
    PINECONE_METRIC: str = Field(default="cosine", description="Distance metric")
    
    # Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379", description="Redis connection URL")
    REDIS_DB: int = Field(default=0, description="Redis database number")
    REDIS_MAX_CONNECTIONS: int = Field(default=10, description="Redis connection pool size")
    REDIS_TIMEOUT: int = Field(default=5, description="Redis operation timeout")
    
    # Database Configuration (for future use)
    DATABASE_URL: str = Field(default="postgresql://localhost/lusilearn_ai", description="Database URL")
    
    # Monitoring and Health
    HEALTH_CHECK_INTERVAL: int = Field(default=60, description="Health check interval in seconds")
    METRICS_ENABLED: bool = Field(default=True, description="Enable metrics collection")
    
    # AI Service Limits
    MAX_CONTENT_RECOMMENDATIONS: int = Field(default=20, description="Max content recommendations per request")
    MAX_PEER_MATCHES: int = Field(default=10, description="Max peer matches per request")
    EMBEDDING_BATCH_SIZE: int = Field(default=100, description="Batch size for embedding operations")
    
    # Fallback Configuration
    ENABLE_FALLBACKS: bool = Field(default=True, description="Enable fallback mechanisms")
    FALLBACK_CACHE_TTL: int = Field(default=3600, description="Fallback cache TTL in seconds")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings