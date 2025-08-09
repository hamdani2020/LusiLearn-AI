#!/bin/bash

# Test script for collaboration API endpoints
API_BASE="http://localhost:4000/api/v1"

echo "Testing Collaboration API Endpoints..."
echo "======================================"

# Test peer matching endpoint
echo "1. Testing peer matching..."
curl -X POST "${API_BASE}/collaboration/peer-matching" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "subjects": ["mathematics", "programming"],
    "skillLevels": ["beginner", "intermediate"],
    "learningGoals": ["learn algorithms", "improve problem solving"],
    "collaborationType": "study_buddy"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test study group creation
echo "2. Testing study group creation..."
curl -X POST "${API_BASE}/collaboration/study-groups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "name": "Math Study Group",
    "description": "A group for learning mathematics together",
    "topic": "Algebra",
    "subject": "Mathematics",
    "maxSize": 6,
    "moderationLevel": "moderate",
    "privacy": "public"
  }' \
  -w "\nStatus: %{http_code}\n\n"

# Test getting user study groups
echo "3. Testing get user study groups..."
curl -X GET "${API_BASE}/collaboration/study-groups" \
  -H "Authorization: Bearer test-token" \
  -w "\nStatus: %{http_code}\n\n"

# Test moderation endpoint
echo "4. Testing moderation..."
curl -X POST "${API_BASE}/collaboration/moderation/test-interaction-id" \
  -H "Authorization: Bearer test-token" \
  -w "\nStatus: %{http_code}\n\n"

echo "Collaboration API testing completed!"