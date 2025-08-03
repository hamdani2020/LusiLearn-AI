# LusiLearn AI Service

FastAPI-based AI service for the LusiLearn platform, providing AI-powered learning analytics, content recommendations, and peer matching.

## Features

- **OpenAI Integration**: GPT-powered learning path generation and content recommendations
- **Vector Database**: Pinecone integration for content similarity and embeddings
- **Health Monitoring**: Comprehensive health checks and service monitoring
- **Error Handling**: Robust error handling with fallback mechanisms
- **Rate Limiting**: Built-in rate limiting for API protection

## Architecture

```
src/
├── main.py                 # FastAPI application entry point
├── config.py              # Configuration settings
├── services/              # Core services
│   ├── openai_service.py  # OpenAI API integration
│   ├── vector_service.py  # Pinecone vector database
│   └── health_service.py  # Health monitoring
├── models/                # Pydantic models
│   └── ai_models.py       # Request/response models
├── routes/                # API routes
│   ├── health.py          # Health check endpoints
│   ├── recommendations.py # Content recommendations
│   ├── learning_paths.py  # Learning path generation
│   └── peer_matching.py   # Peer matching (placeholder)
├── middleware/            # Custom middleware
│   ├── error_handler.py   # Error handling
│   └── logging_middleware.py # Request logging
└── utils/                 # Utilities
    └── exceptions.py      # Custom exceptions
```

## Setup

### Prerequisites

- Python 3.11+
- Redis (for caching)
- OpenAI API key
- Pinecone API key and environment

### Environment Variables

Configure the following environment variables in your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=2048
OPENAI_TEMPERATURE=0.7

# Vector Database (Pinecone)
VECTOR_DB_API_KEY=your-pinecone-api-key
VECTOR_DB_ENVIRONMENT=your-pinecone-environment
VECTOR_DB_INDEX=lusilearn-content

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the service:
```bash
python -m uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

### Docker

Build and run with Docker:

```bash
# Development
docker build --target development -t lusilearn-ai:dev .
docker run -p 8001:8001 --env-file .env lusilearn-ai:dev

# Production
docker build --target production -t lusilearn-ai:prod .
docker run -p 8001:8001 --env-file .env lusilearn-ai:prod
```

## API Endpoints

### Health Checks
- `GET /health/` - Comprehensive health check
- `GET /health/status` - Current health status
- `GET /health/metrics` - Service metrics

### Learning Paths
- `POST /api/v1/learning-paths/` - Generate personalized learning path

### Content Recommendations
- `POST /api/v1/recommendations/` - Get content recommendations
- `POST /api/v1/recommendations/embeddings` - Create text embeddings

### Peer Matching
- `POST /api/v1/peer-matching/` - Find peer matches (placeholder)

## API Documentation

When running in development mode, API documentation is available at:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## Testing

Run the setup verification:
```bash
python test_setup.py
```

## Error Handling

The service includes comprehensive error handling with:
- Custom exception classes
- Fallback mechanisms for AI service failures
- Rate limiting protection
- Structured error responses

## Monitoring

Health checks monitor:
- OpenAI API connectivity and performance
- Pinecone vector database status
- Redis cache availability
- System resource usage

## Development

### Adding New Features

1. Create models in `src/models/ai_models.py`
2. Implement service logic in `src/services/`
3. Add API routes in `src/routes/`
4. Update tests and documentation

### Configuration

All configuration is managed through `src/config.py` using Pydantic settings with environment variable support.

## Production Considerations

- Set `ENVIRONMENT=production` to disable debug features
- Configure proper logging levels
- Set up monitoring and alerting
- Use environment-specific API keys
- Configure rate limiting based on usage patterns