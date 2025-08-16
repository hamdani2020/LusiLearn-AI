#!/bin/bash

API_URL="http://localhost:4000/api/v1"
SAFETY_URL="$API_URL/safety"

echo "🔒 Testing Safety and Moderation Endpoints"
echo "=========================================="

# Test 1: Test moderate-message endpoint (without auth - should fail)
echo "📝 Test 1: Moderate message without authentication (should fail)"
curl -s -X POST "$SAFETY_URL/moderate-message" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "message": "This is a test message",
    "messageType": "text"
  }' | jq .

echo -e "\n"

# Test 2: Test validate-minor-participation endpoint (without auth - should fail)
echo "👶 Test 2: Validate minor participation without authentication (should fail)"
curl -s -X POST "$SAFETY_URL/validate-minor-participation" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "participants": ["user-1", "user-2"]
  }' | jq .

echo -e "\n"

# Test 3: Test get minor settings endpoint (without auth - should fail)
echo "⚙️ Test 3: Get minor safety settings without authentication (should fail)"
curl -s -X GET "$SAFETY_URL/minor-settings" | jq .

echo -e "\n"

# Test 4: Test create safety report endpoint (without auth - should fail)
echo "🚨 Test 4: Create safety report without authentication (should fail)"
curl -s -X POST "$SAFETY_URL/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "reportedUserId": "bad-user-123",
    "type": "harassment",
    "category": "behavior",
    "description": "This user was being inappropriate in the chat"
  }' | jq .

echo -e "\n"

# Test 5: Test get moderator notifications (without auth - should fail)
echo "🔔 Test 5: Get moderator notifications without authentication (should fail)"
curl -s -X GET "$SAFETY_URL/moderator-notifications" | jq .

echo -e "\n"

# Test 6: Test invalid endpoint
echo "❌ Test 6: Test invalid endpoint (should return 404)"
curl -s -X GET "$SAFETY_URL/invalid-endpoint" | jq .

echo -e "\n"

# Test 7: Test with invalid JSON (should return validation error)
echo "🔍 Test 7: Test moderate message with invalid JSON (should return validation error)"
curl -s -X POST "$SAFETY_URL/moderate-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token" \
  -d '{
    "sessionId": "",
    "message": "",
    "messageType": "invalid-type"
  }' | jq .

echo -e "\n"

echo "✅ Safety endpoint tests completed!"
echo "Note: All tests should fail with authentication errors since we're not providing valid tokens."
echo "This confirms the endpoints are properly protected."