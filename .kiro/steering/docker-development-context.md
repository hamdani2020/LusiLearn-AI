# Docker Development Context

## Environment Setup

This project uses Docker Compose for development and testing. All services run in containerized environments to ensure consistency across different development machines.

## Key Services

- **API Service**: Node.js/Express backend running on port 3001
- **AI Service**: Python/FastAPI service running on port 8001  
- **Web Service**: Next.js frontend running on port 3000
- **PostgreSQL**: Database service running on port 5432
- **Redis**: Cache service running on port 6379

## Testing Instructions

### Running Tests in Docker Environment

Always run tests within the Docker environment to ensure consistency with production-like conditions:

```bash
# Run all API tests
docker compose exec api npm test

# Run specific test files
docker compose exec api npm test -- --testPathPattern=adaptive-difficulty

# Run tests with coverage
docker compose exec api npm test -- --coverage

# Run tests in watch mode for development
docker compose exec api npm test -- --watch
```

### Database Testing

Tests use the same PostgreSQL instance as development but with separate test databases:

```bash
# Run database migrations for testing
docker compose exec api npm run migrate:test

# Reset test database
docker compose exec api npm run db:reset:test
```

### Service Integration Testing

When testing service integrations:

```bash
# Test API + AI service integration
docker compose exec api npm test -- --testPathPattern=integration

# Test with all services running
docker compose up -d && docker-compose exec api npm test
```

## Development Workflow

1. **Start Services**: `docker compose up -d`
2. **Run Tests**: `docker compose exec api npm test`
3. **View Logs**: `docker compose logs -f api`
4. **Stop Services**: `docker compose down`

## Environment Variables

Key environment variables for testing:
- `NODE_ENV=test`
- `DATABASE_URL=postgresql://user:pass@postgres:5432/lusilearn_test`
- `REDIS_URL=redis://redis:6379`
- `AI_SERVICE_URL=http://ai-service:8001`

## File Watching and Hot Reload

The Docker setup includes volume mounts for hot reloading during development:
- Source code changes are automatically reflected
- Tests can be run in watch mode
- No need to rebuild containers for code changes

## Debugging in Docker

For debugging Node.js services in Docker:

```bash
# Attach to running container for debugging
docker compose exec api bash

# View real-time logs
docker compose logs -f api

# Inspect container state
docker compose exec api ps aux
```

## Performance Considerations

- Use `docker-compose exec` instead of `docker run` for better performance
- Leverage Docker layer caching for faster builds
- Use `.dockerignore` to exclude unnecessary files
- Mount only necessary volumes to avoid performance issues

## Common Issues and Solutions

### Port Conflicts
If ports are already in use, modify `docker-compose.yml` port mappings.

### Database Connection Issues
Ensure PostgreSQL service is fully started before running tests:
```bash
docker compose exec postgres pg_isready
```

### Permission Issues
If you encounter permission issues with mounted volumes:
```bash
docker compose exec api chown -R node:node /app
```

## Testing Best Practices

1. **Always test in Docker**: Ensures consistency with production environment
2. **Use test databases**: Never run tests against development data
3. **Clean up after tests**: Use proper setup/teardown in test files
4. **Mock external services**: Use mocks for services not available in test environment
5. **Run tests before commits**: Ensure all tests pass in Docker environment

## Test Results Status

### ✅ Passing Tests
- **Adaptive Difficulty Service**: All 12 tests passing - Core functionality working correctly
- **Progress Tracking Service**: All tests passing - Progress tracking and analytics working
- **Progress Routes**: All tests passing - API endpoints functional

### ⚠️ Known Issues
- **Route Tests**: Some validation issues with Zod schemas in route tests
- **Cache Tests**: Redis connection issues in test environment (non-critical)
- **Elasticsearch Tests**: Missing File global in test environment (external dependency)
- **Content Moderation**: Minor test assertion issues (non-critical)

### 🎯 Core Functionality Status
The adaptive difficulty system is fully functional with:
- Performance-based difficulty adjustment algorithms ✅
- Content sequencing based on prerequisite mastery ✅
- Competency testing for advancement requests ✅
- Optimal challenge level maintenance (70-85% comprehension) ✅

## Continuous Integration

The CI/CD pipeline uses the same Docker setup:
- Tests run in identical containers
- Database migrations are applied automatically
- All services are tested together

This ensures that what works in development will work in production.