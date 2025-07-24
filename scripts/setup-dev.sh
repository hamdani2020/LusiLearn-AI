#!/bin/bash

# Development setup script for LusiLearn AI platform

echo "🚀 Setting up LusiLearn AI development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual API keys and configuration."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared packages
echo "🔨 Building shared packages..."
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis elasticsearch

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Setting up database..."
docker-compose exec postgres psql -U postgres -d lusilearn -f /docker-entrypoint-initdb.d/init-db.sql

echo "✅ Development environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update your .env file with actual API keys"
echo "2. Run 'npm run dev' to start all services"
echo "3. Visit http://localhost:3000 for the web app"
echo "4. Visit http://localhost:4000 for the API"
echo "5. Visit http://localhost:8000 for the AI service"
echo ""
echo "📚 Useful commands:"
echo "- npm run dev: Start all services in development mode"
echo "- npm run build: Build all applications"
echo "- npm run test: Run all tests"
echo "- npm run lint: Lint all code"
echo "- docker-compose logs: View service logs"