# LusiLearn AI

AI-enhanced educational platform for personalized learning experiences across K-12, college, and professional development.

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Python 3.11+ (for AI service development)

### Development Setup

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd lusilearn-ai
   ./scripts/setup-dev.sh
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start development services:**
   ```bash
   npm run dev
   ```

4. **Access the applications:**
   - Web App: http://localhost:3000
   - API Gateway: http://localhost:4000
   - AI Service: http://localhost:8000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379
   - Elasticsearch: http://localhost:9200

## Architecture

This is a monorepo containing:

### Applications (`apps/`)
- **web**: Next.js 14 frontend application
- **api**: Express.js API gateway and microservices
- **ai-service**: Python/FastAPI AI and ML services

### Packages (`packages/`)
- **shared-types**: TypeScript types and interfaces
- **config**: Shared configuration utilities
- **ui**: Reusable UI components (Shadcn/ui + Tailwind)

## Development

### Available Scripts

```bash
# Development
npm run dev          # Start all services in development mode
npm run build        # Build all applications
npm run test         # Run all tests
npm run lint         # Lint all code
npm run type-check   # Type check all TypeScript code

# Formatting
npm run format       # Format code with Prettier
npm run format:check # Check code formatting

# Workspace specific
npm run dev --workspace=apps/web      # Start only web app
npm run build --workspace=apps/api    # Build only API
npm run test --workspace=packages/*   # Test all packages
```

### Project Structure

```
lusilearn-ai/
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # Express.js API gateway
│   └── ai-service/          # Python/FastAPI AI service
├── packages/
│   ├── shared-types/        # TypeScript types
│   ├── config/              # Configuration utilities
│   └── ui/                  # UI components
├── scripts/
│   ├── setup-dev.sh         # Development setup script
│   └── init-db.sql          # Database initialization
├── docker-compose.yml       # Development services
├── turbo.json              # Turborepo configuration
└── package.json            # Root package configuration
```

## Testing

The project uses Jest for unit and integration testing:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test -- --watch

# Run specific test suite
npm run test --workspace=packages/shared-types
```

## Docker Development

Start all services with Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild services
docker-compose up --build
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- **Database**: PostgreSQL connection settings
- **Cache**: Redis configuration
- **AI Services**: OpenAI API keys and vector database
- **External APIs**: YouTube, Khan Academy, etc.
- **Security**: JWT secrets and encryption keys

## Configuration

The project uses a shared configuration system in `packages/config`:

- Database connection utilities
- Redis cache configuration  
- AI service settings
- Application constants

## Spec-Driven Development

This project uses a spec-driven development approach:

1. Review the spec documents in `.kiro/specs/core-learning-architecture/`
2. Open `tasks.md` and click "Start task" on any task to begin implementation
3. Follow the development standards in `.kiro/steering/development-standards.md`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.