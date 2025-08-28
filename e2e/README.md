# End-to-End Testing with Playwright

This directory contains comprehensive end-to-end tests for the LusiLearn AI platform using Playwright.

## Overview

The E2E tests validate the complete user journey across all features of the platform, ensuring that the integration between frontend, backend, AI services, and database works correctly in a production-like environment.

## Test Structure

### Test Files

- **`user-registration-onboarding.spec.ts`** - Tests user registration and onboarding flow
- **`learning-session-progress.spec.ts`** - Tests learning sessions and progress tracking
- **`peer-collaboration-study-groups.spec.ts`** - Tests peer collaboration and study group functionality
- **`content-discovery-consumption.spec.ts`** - Tests content discovery and consumption workflows
- **`complete-user-journey.spec.ts`** - Comprehensive end-to-end user journey tests

### Supporting Files

- **`fixtures/page-objects.ts`** - Page Object Model implementations
- **`fixtures/test-data.ts`** - Test data fixtures and mock data
- **`utils/test-helpers.ts`** - Utility functions for common test operations

## Requirements Covered

The E2E tests validate all requirements from the core learning architecture specification:

### User Profile and Learning Assessment (Requirement 1)
- ✅ User registration with demographic information collection
- ✅ Initial skill assessment and profile generation
- ✅ Learning preferences adaptation
- ✅ Privacy protections for minors
- ✅ Skill level assignment

### AI-Powered Learning Path Generation (Requirement 2)
- ✅ Personalized learning path creation
- ✅ Performance-based path updates
- ✅ Difficulty adjustment based on comprehension
- ✅ Content acceleration for high performers
- ✅ Fallback mechanisms for AI service unavailability

### Multi-Source Content Recommendation (Requirement 3)
- ✅ Content recommendations from multiple sources
- ✅ Age-appropriate content filtering
- ✅ User feedback integration
- ✅ Content quality and relevance ranking
- ✅ Search functionality

### Peer Collaboration and Matching (Requirement 4)
- ✅ Peer matching based on compatibility
- ✅ Study group creation and management
- ✅ Safety measures for minors
- ✅ Collaboration effectiveness tracking
- ✅ Reporting and moderation

### Real-Time Progress Tracking (Requirement 5)
- ✅ Real-time progress updates
- ✅ Comprehensive analytics dashboard
- ✅ Learning pattern insights
- ✅ Motivational interventions
- ✅ Privacy-compliant data handling

### Adaptive Difficulty and Content Sequencing (Requirement 6)
- ✅ Performance-based difficulty adjustment
- ✅ Prerequisite mastery verification
- ✅ Optimal challenge level maintenance
- ✅ Competency testing for advancement

### Multi-Platform Integration (Requirement 7)
- ✅ External content source integration
- ✅ Metadata management and updates
- ✅ Session continuity across platforms
- ✅ Fallback content availability

### Safety and Moderation Framework (Requirement 8)
- ✅ Automated content moderation
- ✅ Behavior monitoring and reporting
- ✅ Enhanced safety for minors
- ✅ Human moderator escalation

## Running Tests

### Prerequisites

1. **Docker and Docker Compose** - Required for running the full application stack
2. **Node.js 18+** - For running Playwright tests
3. **Playwright browsers** - Installed automatically with `npx playwright install`

### Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Start the application stack
docker compose up -d

# Wait for services to be ready (about 30 seconds)

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug -- --grep "user registration"

# Run specific test file
npx playwright test user-registration-onboarding.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
```

### Test Reports

```bash
# View HTML test report
npm run test:e2e:report

# Generate and view report after test run
npx playwright show-report
```

### CI/CD Integration

The E2E tests run automatically in GitHub Actions on:
- Push to main/develop branches
- Pull requests
- Daily scheduled runs (2 AM UTC)

Multiple test jobs run in parallel:
- **Desktop browsers** (Chrome, Firefox, Safari)
- **Mobile browsers** (Mobile Chrome, Mobile Safari)
- **Cross-browser compatibility** testing

## Test Configuration

### Playwright Configuration

The `playwright.config.ts` file configures:
- Test directory and file patterns
- Browser projects (desktop and mobile)
- Base URL and timeout settings
- Test reporters and output
- Docker Compose integration for services

### Environment Variables

Required environment variables for testing:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lusilearn_test
REDIS_URL=redis://localhost:6379
NODE_ENV=test
JWT_SECRET=test-secret-key
AI_SERVICE_URL=http://localhost:8001
```

## Test Data Management

### Fixtures
- **User profiles** for different education levels (K-12, college, professional)
- **Content items** representing various formats and sources
- **Study groups** and collaboration scenarios
- **Assessment questions** and expected responses

### Data Cleanup
- Tests use unique identifiers to avoid conflicts
- Automatic cleanup after test completion
- Database isolation between test runs

## Best Practices

### Page Object Model
- Encapsulates page interactions in reusable classes
- Provides type-safe element selectors
- Centralizes UI change impact

### Test Isolation
- Each test starts with a clean state
- Independent test data generation
- No dependencies between tests

### Realistic User Interactions
- Simulates human-like timing and behavior
- Tests responsive design across viewports
- Validates accessibility standards

### Error Handling
- Tests both happy path and error scenarios
- Validates error messages and recovery
- Ensures graceful degradation

## Debugging Tests

### Local Debugging
```bash
# Run with debug mode
npm run test:e2e:debug

# Run specific test with debug
npx playwright test --debug --grep "learning session"

# Generate trace files
npx playwright test --trace on
```

### CI Debugging
- Test artifacts (screenshots, videos, traces) uploaded on failure
- HTML reports available for download
- Detailed logs in GitHub Actions output

## Performance Testing

The E2E tests include performance validations:
- Page load times under 5 seconds
- First contentful paint under 2 seconds
- DOM content loaded under 3 seconds
- Responsive design across viewports

## Accessibility Testing

Automated accessibility checks verify:
- WCAG 2.1 AA compliance
- Proper heading structure
- Alt text for images
- Form label associations
- Keyboard navigation support

## Mobile Testing

Dedicated mobile test configurations:
- Touch interactions and gestures
- Mobile-specific UI components
- Responsive layout validation
- Performance on mobile devices

## Continuous Improvement

### Metrics Tracked
- Test execution time and reliability
- Feature coverage and gap analysis
- Cross-browser compatibility issues
- Performance regression detection

### Maintenance
- Regular updates for new features
- Browser compatibility updates
- Test data refresh and cleanup
- Performance baseline adjustments

## Troubleshooting

### Common Issues

1. **Services not ready**
   ```bash
   # Increase wait time in docker-compose startup
   sleep 60  # Instead of 30
   ```

2. **Port conflicts**
   ```bash
   # Check for running services
   docker ps
   # Stop conflicting services
   docker compose down
   ```

3. **Database connection issues**
   ```bash
   # Verify database is running
   docker compose exec postgres pg_isready
   ```

4. **Browser installation issues**
   ```bash
   # Reinstall browsers
   npx playwright install --force
   ```

### Getting Help

- Check the [Playwright documentation](https://playwright.dev/)
- Review test logs and artifacts
- Use debug mode for step-by-step execution
- Consult the development team for platform-specific issues

## Contributing

When adding new E2E tests:

1. Follow the existing Page Object Model pattern
2. Add appropriate test data fixtures
3. Include both positive and negative test cases
4. Verify cross-browser compatibility
5. Update this README with new test coverage
6. Ensure tests are deterministic and reliable