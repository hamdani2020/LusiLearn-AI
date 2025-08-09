#!/bin/bash

# Test script for Adaptive Difficulty API endpoints with authentication
API_BASE="http://localhost:4000/api/v1"
ADAPTIVE_BASE="$API_BASE/adaptive-difficulty"

echo "🎯 Testing Adaptive Difficulty API with Authentication"
echo "====================================================="

# Test user data
TEST_USER_EMAIL="test-adaptive@example.com"
TEST_USER_PASSWORD="TestPass123"
TEST_USERNAME="adaptive-tester"

# Registration data
REGISTER_DATA='{
  "email": "'$TEST_USER_EMAIL'",
  "password": "'$TEST_USER_PASSWORD'",
  "username": "'$TEST_USERNAME'",
  "demographics": {
    "ageRange": "18-25",
    "educationLevel": "college",
    "timezone": "UTC",
    "preferredLanguage": "en"
  },
  "learningPreferences": {
    "learningStyle": ["visual"],
    "preferredContentTypes": ["video"],
    "sessionDuration": 60,
    "difficultyPreference": "moderate"
  }
}'

# Login data
LOGIN_DATA='{
  "email": "'$TEST_USER_EMAIL'",
  "password": "'$TEST_USER_PASSWORD'"
}'

echo ""
echo "👤 Step 1: Register Test User"
echo "=============================="
echo "POST $API_BASE/auth/register"

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_DATA")

echo "Registration Response:"
echo "$REGISTER_RESPONSE" | jq . 2>/dev/null || echo "$REGISTER_RESPONSE"

echo ""
echo "🔐 Step 2: Login and Get JWT Token"
echo "=================================="
echo "POST $API_BASE/auth/login"

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_DATA")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"

# Extract JWT token from login response
JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken' 2>/dev/null)

if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ]; then
  echo "❌ Failed to get JWT token. Trying to extract from different response format..."
  JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken' 2>/dev/null)
fi

if [ "$JWT_TOKEN" = "null" ] || [ -z "$JWT_TOKEN" ]; then
  echo "❌ Could not extract JWT token from login response"
  echo "Response was: $LOGIN_RESPONSE"
  echo "⚠️  Proceeding with mock token for endpoint testing..."
  JWT_TOKEN="mock-token-for-testing"
fi

echo ""
echo "🔑 JWT Token: ${JWT_TOKEN:0:50}..."

# Test data for adaptive difficulty endpoints
MOCK_SESSION_DATA='{
  "pathId": "test-path-123",
  "recentSessions": [
    {
      "id": "session-1",
      "userId": "user-123",
      "pathId": "test-path-123",
      "contentItems": ["content-1"],
      "duration": 1800,
      "interactions": [],
      "assessmentResults": [
        {
          "questionId": "math-1",
          "answer": "5",
          "isCorrect": true,
          "timeSpent": 30,
          "attempts": 1
        }
      ],
      "comprehensionScore": 95,
      "engagementMetrics": {
        "attentionScore": 90,
        "interactionCount": 15,
        "pauseCount": 2,
        "replayCount": 1,
        "completionRate": 100
      },
      "createdAt": "2025-08-08T23:00:00.000Z",
      "updatedAt": "2025-08-08T23:30:00.000Z"
    }
  ]
}'

NEXT_CONTENT_DATA='{
  "pathId": "test-path-123"
}'

ADVANCEMENT_DATA='{
  "pathId": "test-path-123",
  "requestedLevel": "intermediate"
}'

OPTIMAL_CHALLENGE_DATA='{
  "pathId": "test-path-123"
}'

AUTH_HEADER="Authorization: Bearer $JWT_TOKEN"

echo ""
echo "🧪 Step 3: Test Adaptive Difficulty Endpoints"
echo "============================================="

echo ""
echo "📊 3.1 Testing Performance Analysis Endpoint"
echo "POST $ADAPTIVE_BASE/analyze"
ANALYZE_RESPONSE=$(curl -s -X POST "$ADAPTIVE_BASE/analyze" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$MOCK_SESSION_DATA")

echo "Response:"
echo "$ANALYZE_RESPONSE" | jq . 2>/dev/null || echo "$ANALYZE_RESPONSE"

echo ""
echo "🔗 3.2 Testing Content Sequencing Endpoint"
echo "POST $ADAPTIVE_BASE/next-content"
CONTENT_RESPONSE=$(curl -s -X POST "$ADAPTIVE_BASE/next-content" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$NEXT_CONTENT_DATA")

echo "Response:"
echo "$CONTENT_RESPONSE" | jq . 2>/dev/null || echo "$CONTENT_RESPONSE"

echo ""
echo "🎓 3.3 Testing Competency Test Endpoint"
echo "POST $ADAPTIVE_BASE/request-advancement"
ADVANCEMENT_RESPONSE=$(curl -s -X POST "$ADAPTIVE_BASE/request-advancement" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$ADVANCEMENT_DATA")

echo "Response:"
echo "$ADVANCEMENT_RESPONSE" | jq . 2>/dev/null || echo "$ADVANCEMENT_RESPONSE"

echo ""
echo "⚖️  3.4 Testing Optimal Challenge Endpoint"
echo "POST $ADAPTIVE_BASE/optimal-challenge"
CHALLENGE_RESPONSE=$(curl -s -X POST "$ADAPTIVE_BASE/optimal-challenge" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d "$OPTIMAL_CHALLENGE_DATA")

echo "Response:"
echo "$CHALLENGE_RESPONSE" | jq . 2>/dev/null || echo "$CHALLENGE_RESPONSE"

echo ""
echo "📈 3.5 Testing Comprehensive Analysis Endpoint"
echo "GET $ADAPTIVE_BASE/path/test-path-123/analysis"
ANALYSIS_RESPONSE=$(curl -s -X GET "$ADAPTIVE_BASE/path/test-path-123/analysis" \
  -H "$AUTH_HEADER")

echo "Response:"
echo "$ANALYSIS_RESPONSE" | jq . 2>/dev/null || echo "$ANALYSIS_RESPONSE"

echo ""
echo "📋 Step 4: Test Results Summary"
echo "==============================="

# Function to check if response contains error
check_response() {
  local response="$1"
  local endpoint="$2"
  
  if echo "$response" | grep -q '"error"'; then
    echo "❌ $endpoint: Error response"
    echo "   $(echo "$response" | jq -r '.error // .message' 2>/dev/null || echo "$response")"
  elif echo "$response" | grep -q '"success"'; then
    echo "✅ $endpoint: Success response"
  elif echo "$response" | grep -q '"data"'; then
    echo "✅ $endpoint: Data response received"
  else
    echo "⚠️  $endpoint: Unknown response format"
  fi
}

check_response "$ANALYZE_RESPONSE" "Performance Analysis"
check_response "$CONTENT_RESPONSE" "Content Sequencing"
check_response "$ADVANCEMENT_RESPONSE" "Competency Test"
check_response "$CHALLENGE_RESPONSE" "Optimal Challenge"
check_response "$ANALYSIS_RESPONSE" "Comprehensive Analysis"

echo ""
echo "🎉 Testing completed!"
echo ""
echo "📝 Notes:"
echo "- If you see authentication errors, the user registration/login may have failed"
echo "- If you see validation errors, the request data format may need adjustment"
echo "- If you see 'Learning path not found' errors, that's expected for test data"
echo "- The important thing is that endpoints are responding and not returning 404 errors"
echo ""