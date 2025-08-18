#!/bin/bash

# Start development environment for LusiLearn AI platform

echo "🚀 Starting LusiLearn AI Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the services
echo "📦 Starting services with Docker Compose..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check API service
if curl -f http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "✅ API service is running on http://localhost:4000"
else
    echo "⚠️  API service may not be ready yet"
fi

# Check AI service
if curl -f http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ AI service is running on http://localhost:8001"
else
    echo "⚠️  AI service may not be ready yet"
fi

# Check Web service
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web service is running on http://localhost:3000"
else
    echo "⚠️  Web service may not be ready yet"
fi

echo ""
echo "🎉 Development environment is starting up!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 API: http://localhost:4000"
echo "🤖 AI Service: http://localhost:8001"
echo "🗄️  Database: localhost:5432"
echo "📊 Redis: localhost:6379"
echo ""
echo "🧪 Test API Integration: http://localhost:3000/test-api"
echo "👥 Collaboration Hub: http://localhost:3000/collaboration"
echo ""
echo "To stop services: docker compose down"
echo "To view logs: docker compose logs -f [service-name]"