# API Integration Tests

This directory contains comprehensive integration tests for the LusiLearn API endpoints. These tests verify the complete functionality of API routes, including authentication, data validation, database operations, and service integrations.

## Test Structure

### Test Files

- **`auth.integration.test.ts`** - Authentication and user management API tests
- **`learning-path.integration.test.ts`** - Learning path generation and management tests
- **`content.integration.test.ts`** - Content search, recommendation, and validation tests
- **`collaboration.integration.test.ts`** - Peer matching and collaboration feature tests
- **`setup.ts`** - Global test setup and database utilities

### Test Coverage

#### Authentication & User Management
- User registration with validation
- Login/logout flows
- Token management and refresh
- Password change and reset
- Profile management
- Learning preferences updates
- Privacy settings
- Parental controls (for minor users)
- Rate limiting enforcement
- Error handling

#### Learning Path Management
- Learning path creation with AI integration
- Path retrieval and filtering
- Progress tracking and updates
- Difficulty adaptation
- Path sharing and collaboration
- Access control and ownership
- Milestone and objective management

#### Content Management
- Multi-source content search
- Personalized recommendations
- Content validation and quality scoring
- Age-appropriate filtering
- Content reporting and moderation
- External API integration (YouTube, Khan Academy)
- Search pagination and filtering

#### Collaboration Features
- Peer matching algorithms
- Study group creation and management
- Real-time collaboration sessions
- Group activities and scheduling
- Content moderation and safety
- WebSocket integration
- Age-appropriate matching for minors
- Access control and permissions

## Running Integration Tests

### Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and accessible
2. **Environment Variables**: Set up test environment variables
3. **Dependencies**: Install all required packages

```bash
npm install
```

### Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- --testNamePattern="auth"

# Run with coverage
npm run test:integration -- --coverage

# Run in watch mode
npm run test:integration:watch

# Run all tests (unit + integration)
npm run test:all
```

### Docker Environment

For consistent testing, run integration tests in Docker:

```bash
# Start services
docker compose up -d

# Run integration tests in container
docker compose exec api npm run test:integration

# Run with coverage
docker compose exec api npm run test:integration -- --coverage
```

## Test Configuration

### Jest Configuration

Integration tests use a separate Jest configuration (`jest.integration.config.js`) with:

- **Longer timeout**: 60 seconds for database operations
- **Sequential execution**: `maxWorkers: 1` to avoid database conflicts
- **Custom setup**: Database initialization and cleanup
- **Environment isolation**: Separate from unit tests

### Database Management

Tests automatically:
- Set up test database connections
- Clean up test data before/after each test
- Handle database transactions and rollbacks
- Manage test user creation and cleanup

### Mocking Strategy

Integration tests use **minimal mocking**:
- **Real database operations**: Tests use actual PostgreSQL
- **Mocked external services**: AI services, external APIs
- **Mocked infrastructure**: Redis, Elasticsearch (when not critical)
- **Real authentication**: JWT tokens and middleware

## Test Data Management

### Test Users

Tests create isolated test users with:
- Unique email addresses (containing "test")
- Varied demographics and preferences
- Different age ranges (including minors)
- Parental controls when applicable

### Data Cleanup

Automatic cleanup ensures:
- No test data persists between runs
- Database remains clean
- No interference with other tests
- Proper foreign key constraint handling

### Test Isolation

Each test:
- Creates its own test data
- Cleans up after completion
- Doesn't depend on other tests
- Uses unique identifiers

## Error Scenarios

Tests cover comprehensive error handling:

### Authentication Errors
- Invalid credentials
- Expired tokens
- Missing authentication
- Rate limiting violations

### Validation Errors
- Invalid input data
- Missing required fields
- Data type mismatches
- Business rule violations

### Authorization Errors
- Insufficient permissions
- Resource ownership violations
- Age-based restrictions
- Privacy setting conflicts

### Service Errors
- Database connection failures
- External service unavailability
- Network timeouts
- Rate limiting from external APIs

## Performance Testing

Integration tests include:
- **Rate limiting verification**: Ensures endpoints respect limits
- **Concurrent request handling**: Tests system under load
- **Database query optimization**: Verifies efficient queries
- **Response time validation**: Ensures acceptable performance

## Security Testing

Tests verify:
- **Input sanitization**: SQL injection prevention
- **Authentication bypass attempts**: Unauthorized access prevention
- **Data exposure**: Sensitive information protection
- **CORS policy enforcement**: Cross-origin request handling
- **Rate limiting effectiveness**: Abuse prevention

## Monitoring and Debugging

### Test Output

Tests provide detailed output:
- Request/response logging
- Database query information
- Error stack traces
- Performance metrics

### Debugging Tips

1. **Increase timeout** for debugging: Set `testTimeout: 300000`
2. **Enable verbose logging**: Set `LOG_LEVEL=debug`
3. **Run single test**: Use `--testNamePattern` flag
4. **Check database state**: Query test database directly
5. **Verify mocks**: Ensure mocked services return expected data

### Common Issues

1. **Database connection errors**: Check PostgreSQL service
2. **Port conflicts**: Ensure test ports are available
3. **Mock configuration**: Verify service mocks are properly set up
4. **Test data conflicts**: Check cleanup functions
5. **Timeout issues**: Increase timeout for slow operations

## Continuous Integration

Integration tests are designed for CI/CD:
- **Docker compatibility**: Run in containerized environments
- **Parallel execution**: Safe for CI pipeline parallelization
- **Deterministic results**: Consistent across environments
- **Comprehensive reporting**: Detailed test results and coverage

### CI Configuration

```yaml
# Example GitHub Actions configuration
- name: Run Integration Tests
  run: |
    docker compose up -d postgres redis
    npm run test:integration
  env:
    NODE_ENV: test
    DATABASE_URL: postgresql://test:test@localhost:5432/lusilearn_test
```

## Best Practices

### Writing Integration Tests

1. **Test real user journeys**: Complete workflows end-to-end
2. **Use realistic data**: Representative of production scenarios
3. **Verify side effects**: Database changes, external API calls
4. **Test error conditions**: Network failures, invalid data
5. **Maintain test independence**: No shared state between tests

### Maintenance

1. **Keep tests updated**: Sync with API changes
2. **Monitor test performance**: Optimize slow tests
3. **Review test coverage**: Ensure comprehensive coverage
4. **Update mocks**: Keep external service mocks current
5. **Document changes**: Update README for new features

## Contributing

When adding new integration tests:

1. Follow existing test patterns
2. Include comprehensive error scenarios
3. Add appropriate cleanup logic
4. Update this README if needed
5. Ensure tests pass in Docker environment

## Troubleshooting

### Common Solutions

- **Database connection issues**: Check connection string and service status
- **Test timeouts**: Increase timeout or optimize test logic
- **Mock failures**: Verify mock implementations match service interfaces
- **Data cleanup issues**: Check foreign key constraints and cleanup order
- **Rate limiting**: Adjust test timing or increase limits for tests