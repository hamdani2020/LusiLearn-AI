# Backend-Frontend Integration Guide

This guide explains how the LusiLearn AI platform's backend and frontend are integrated, providing a seamless collaboration experience.

## 🏗️ Architecture Overview

### Backend Services
- **API Gateway** (Port 3001): Express.js with authentication, routing, and middleware
- **AI Service** (Port 8001): Python/FastAPI for ML operations and recommendations
- **Database**: PostgreSQL for structured data storage
- **Cache**: Redis for session management and real-time features

### Frontend Application
- **Web App** (Port 3000): Next.js 14 with TypeScript and React Query
- **UI Components**: Shadcn/ui with Tailwind CSS
- **State Management**: TanStack Query for server state

## 🔗 Integration Points

### 1. API Client Setup

The frontend uses a centralized API client (`apps/web/src/lib/api.ts`) that:
- Handles authentication tokens automatically
- Provides consistent error handling
- Supports all HTTP methods with proper typing

```typescript
// Example API call
const response = await api.post('/api/v1/collaboration/peer-matching', {
  subjects: ['Mathematics'],
  educationLevels: ['college'],
  maxResults: 10
});
```

### 2. React Query Integration

Custom hooks in `apps/web/src/hooks/use-collaboration.ts` provide:
- Automatic caching and background updates
- Optimistic updates for better UX
- Error handling and retry logic
- Real-time data synchronization

```typescript
// Example hook usage
const { data, isLoading, error } = useStudyGroups();
const createGroupMutation = useCreateStudyGroup();
```

### 3. Collaboration Features

#### Peer Discovery
- **Component**: `PeerDiscovery`
- **API Endpoint**: `POST /api/v1/collaboration/peer-matching`
- **Features**: Search filters, compatibility scoring, real-time status

#### Study Group Management
- **Component**: `StudyGroupCreator`, `StudyGroupManager`
- **API Endpoints**: 
  - `POST /api/v1/collaboration/study-groups` (create)
  - `GET /api/v1/collaboration/study-groups` (list)
  - `GET /api/v1/collaboration/study-groups/:id` (details)

#### Real-time Collaboration
- **WebSocket Integration**: Planned for live sessions
- **Progress Sharing**: Real-time updates during study sessions
- **File Sharing**: Collaborative document management

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for AI service development)

### Quick Start

1. **Start all services**:
   ```bash
   ./start-dev.sh
   ```

2. **Access the applications**:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - AI Service: http://localhost:8001

3. **Test the integration**:
   - Visit http://localhost:3000/test-api to test API connectivity
   - Visit http://localhost:3000/collaboration to use collaboration features

### Manual Setup

1. **Start infrastructure**:
   ```bash
   docker compose up -d postgres redis
   ```

2. **Start backend services**:
   ```bash
   # API service
   cd apps/api
   npm install
   npm run dev

   # AI service
   cd apps/ai-service
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8001
   ```

3. **Start frontend**:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

## 🧪 Testing the Integration

### API Health Check
```bash
curl http://localhost:3001/api/health
```

### Collaboration Endpoints
```bash
# Test peer matching (requires authentication)
curl -X POST http://localhost:3001/api/v1/collaboration/peer-matching \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"subjects": ["Mathematics"], "maxResults": 10}'

# Test study group creation
curl -X POST http://localhost:3001/api/v1/collaboration/study-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Calculus Study Group",
    "description": "Weekly calculus problem solving",
    "subject": "Mathematics",
    "topic": "Calculus",
    "maxSize": 6,
    "moderationLevel": "moderate",
    "privacy": "public"
  }'
```

### Frontend Testing
- Use the test page at `/test-api` to verify API connectivity
- Navigate to `/collaboration` to test the full collaboration interface

## 📁 Key Files

### Backend
- `apps/api/src/routes/collaboration.routes.ts` - Collaboration API endpoints
- `apps/api/src/services/collaboration.service.ts` - Business logic
- `apps/api/src/middleware/auth.ts` - Authentication middleware

### Frontend
- `apps/web/src/hooks/use-collaboration.ts` - React Query hooks
- `apps/web/src/lib/api.ts` - API client configuration
- `apps/web/src/components/collaboration/` - UI components
- `apps/web/src/app/collaboration/page.tsx` - Main collaboration page

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/lusilearn
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
AI_SERVICE_URL=http://localhost:8001
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Docker Configuration
The `docker-compose.yml` file orchestrates all services with proper networking and volume mounts for development.

## 🚦 API Endpoints

### Collaboration Routes
- `POST /api/v1/collaboration/peer-matching` - Find peer matches
- `GET/POST /api/v1/collaboration/study-groups` - Manage study groups
- `GET /api/v1/collaboration/study-groups/:id` - Get group details
- `POST /api/v1/collaboration/study-groups/:id/participants` - Add participants
- `POST /api/v1/collaboration/sessions` - Create collaboration sessions
- `GET /api/v1/collaboration/sessions/:id/progress` - Get session progress

### Authentication
All collaboration endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🔄 Data Flow

1. **User Action**: User interacts with frontend component
2. **API Call**: React Query hook makes authenticated API request
3. **Backend Processing**: Express route validates and processes request
4. **Database Operation**: Data is stored/retrieved from PostgreSQL
5. **Response**: Formatted response sent back to frontend
6. **UI Update**: React Query updates component state automatically

## 🛠️ Development Workflow

1. **Make Backend Changes**: Update routes, services, or database schema
2. **Test API**: Use curl or the test page to verify endpoints
3. **Update Frontend**: Modify components or hooks as needed
4. **Test Integration**: Use the collaboration page to test end-to-end flow
5. **Commit Changes**: Both backend and frontend changes together

## 🐛 Troubleshooting

### Common Issues

**API Connection Failed**:
- Check if backend services are running
- Verify environment variables
- Check Docker container logs: `docker compose logs api`

**Authentication Errors**:
- Ensure JWT token is valid and not expired
- Check authentication middleware configuration
- Verify user permissions

**Database Connection Issues**:
- Ensure PostgreSQL is running: `docker compose ps`
- Check database credentials in environment variables
- Run migrations: `npm run migrate` in the API directory

**CORS Errors**:
- Verify CORS configuration in API gateway
- Check that frontend URL is allowed in CORS settings

### Debugging Tips

1. **Use the test page** (`/test-api`) to isolate API issues
2. **Check browser network tab** for failed requests
3. **Monitor Docker logs** for service-specific errors
4. **Use React Query DevTools** to inspect query state

## 🚀 Next Steps

### Planned Enhancements
1. **WebSocket Integration**: Real-time collaboration features
2. **File Upload**: Shared document management
3. **Video Chat**: Integrated video conferencing
4. **Mobile App**: React Native application
5. **Offline Support**: Progressive Web App features

### Contributing
1. Follow the existing code patterns and conventions
2. Add tests for new features
3. Update documentation for API changes
4. Test integration thoroughly before submitting PRs

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TanStack Query Guide](https://tanstack.com/query/latest)
- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)