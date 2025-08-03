FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Development stage
FROM base AS development
WORKDIR /app

# Copy requirements and install dependencies
COPY apps/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY apps/ai-service/ .

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos '' --uid 1001 aiuser

# Copy requirements and install dependencies
COPY apps/ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=aiuser:aiuser apps/ai-service/ .

USER aiuser

EXPOSE 8001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]