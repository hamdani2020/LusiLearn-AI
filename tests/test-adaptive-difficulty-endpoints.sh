#!/bin/bash

# Test script for Adaptive Difficulty API endpoints
API_BASE="http://localhost:4000/api/v1/adaptive-difficulty"

echo "🎯 Testing Adaptive Difficulty API Endpoints"
echo "============================================="

# Test data
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

# Mock JWT token (for testing - in real scenario this would be a valid JWT)
AUTH_TOKEN="Bearer mock-jwt-token"

echo ""
echo "📊 1. Testing Performance Analysis Endpoint"
echo "POST $API_BASE/analyze"
curl -s -X POST "$API_BASE/analyze" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_TOKEN" \
  -d "$MOCK_SESSION_DATA" | jq . || echo "Response: $(curl -s -X POST "$API_BASE/analyze" -H "Content-Type: application/json" -H "Authorization: $AUTH_TOKEN" -d "$MOCK_SESSION_DATA")"

echo ""
echo "🔗 2. Testing Content Sequencing Endpoint"
echo "POST $API_BASE/next-content"
curl -s -X POST "$API_BASE/next-content" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_TOKEN" \
  -d "$NEXT_CONTENT_DATA" | jq . || echo "Response: $(curl -s -X POST "$API_BASE/next-content" -H "Content-Type: application/json" -H "Authorization: $AUTH_TOKEN" -d "$NEXT_CONTENT_DATA")"

echo ""
echo "🎓 3. Testing Competency Test Endpoint"
echo "POST $API_BASE/request-advancement"
curl -s -X POST "$API_BASE/request-advancement" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_TOKEN" \
  -d "$ADVANCEMENT_DATA" | jq . || echo "Response: $(curl -s -X POST "$API_BASE/request-advancement" -H "Content-Type: application/json" -H "Authorization: $AUTH_TOKEN" -d "$ADVANCEMENT_DATA")"

echo ""
echo "⚖️  4. Testing Optimal Challenge Endpoint"
echo "POST $API_BASE/optimal-challenge"
curl -s -X POST "$API_BASE/optimal-challenge" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH_TOKEN" \
  -d "$OPTIMAL_CHALLENGE_DATA" | jq . || echo "Response: $(curl -s -X POST "$API_BASE/optimal-challenge" -H "Content-Type: application/json" -H "Authorization: $AUTH_TOKEN" -d "$OPTIMAL_CHALLENGE_DATA")"

echo ""
echo "📈 5. Testing Comprehensive Analysis Endpoint"
echo "GET $API_BASE/path/test-path-123/analysis"
curl -s -X GET "$API_BASE/path/test-path-123/analysis" \
  -H "Authorization: $AUTH_TOKEN" | jq . || echo "Response: $(curl -s -X GET "$API_BASE/path/test-path-123/analysis" -H "Authorization: $AUTH_TOKEN")"

echo ""
echo "✅ Testing completed!"
echo ""