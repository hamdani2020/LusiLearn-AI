---
inclusion: manual
---

# Project Structure Guidelines

## Directory Structure

```
ai-learning-platform/
├── apps/
│   ├── web/                    # Next.js frontend application
│   ├── api/                    # Main API service (Node.js/Express)
│   ├── ai-service/             # AI/ML service (Python/FastAPI)
│   └── realtime-service/       # WebSocket service for collaboration
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── database/               # Database schemas and migrations
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utility functions
│   └── config/                 # Shared configuration
├── docs/                       # Documentation
├── scripts/                    # Build and deployment scripts
└── .kiro/                      # Kiro configuration
```

## Application Structure

### Frontend (apps/web)
```
apps/web/
├── src/
│   ├── app/                    # Next.js app router
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI components
│   │   ├── forms/              # Form components
│   │   ├── layout/             # Layout components
│   │   └── features/           # Feature-specific components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility libraries
│   ├── stores/                 # State management
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
└── tests/                      # Test files
```

### Backend API (apps/api)
```
apps/api/
├── src/
│   ├── controllers/            # Route handlers
│   ├── middleware/             # Express middleware
│   ├── models/                 # Data models
│   ├── services/               # Business logic
│   ├── routes/                 # API routes
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript types
├── tests/                      # Test files
└── migrations/                 # Database migrations
```

### AI Service (apps/ai-service)
```
apps/ai-service/
├── src/
│   ├── api/                    # FastAPI routes
│   ├── models/                 # ML models and logic
│   ├── services/               # AI service implementations
│   ├── utils/                  # Utility functions
│   └── schemas/                # Pydantic schemas
├── tests/                      # Test files
└── requirements.txt            # Python dependencies
```

## Naming Conventions

### Files and Directories
- Use kebab-case for directories: `user-management/`
- Use kebab-case for component files: `learning-dashboard.tsx`
- Use camelCase for utility files: `apiClient.ts`
- Use PascalCase for component names: `LearningDashboard`

### Database
- Use snake_case for table names: `user_profiles`
- Use snake_case for column names: `created_at`
- Use descriptive names for indexes: `idx_users_email`

### API Endpoints
- Use RESTful conventions: `/api/v1/users/:id`
- Use plural nouns for collections: `/api/v1/courses`
- Use clear, descriptive paths: `/api/v1/users/:id/learning-progress`

## Code Organization

### Component Structure
```typescript
// Component file structure
import { ComponentProps } from './types'
import { useComponentLogic } from './hooks'
import { ComponentStyles } from './styles'

export function Component({ prop1, prop2 }: ComponentProps) {
  const { state, handlers } = useComponentLogic()
  
  return (
    // JSX implementation
  )
}

export type { ComponentProps }
```

### Service Layer Pattern
```typescript
// Service implementation
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private aiService: AIService
  ) {}

  async createLearningPath(userId: string): Promise<LearningPath> {
    // Implementation
  }
}
```

### Error Handling
- Use custom error classes for different error types
- Implement global error handlers
- Provide meaningful error messages
- Log errors with appropriate context

## Environment Configuration

### Development
- Use `.env.local` for local development
- Use `.env.example` as template
- Never commit sensitive credentials
- Use different databases for dev/test/prod

### Production
- Use environment variables for all configuration
- Implement proper secret management
- Use different API keys for different environments
- Enable proper logging and monitoring

## Testing Structure

### Unit Tests
- Co-locate test files with source files
- Use `.test.ts` or `.spec.ts` extensions
- Test business logic thoroughly
- Mock external dependencies

### Integration Tests
- Place in dedicated `tests/` directories
- Test API endpoints with real database
- Test service integrations
- Use test containers for databases

### E2E Tests
- Place in `tests/e2e/` directory
- Test critical user journeys
- Use page object pattern
- Run against staging environment

## Documentation

### Code Documentation
- Use JSDoc for functions and classes
- Document complex business logic
- Provide examples for public APIs
- Keep documentation up to date

### API Documentation
- Use OpenAPI/Swagger specifications
- Document all endpoints and schemas
- Provide example requests/responses
- Include authentication requirements

### Architecture Documentation
- Document system architecture
- Explain design decisions
- Provide deployment guides
- Include troubleshooting guides