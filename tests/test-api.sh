#!/bin/bash

# API Testing Script for LusiLearn API
BASE_URL="http://localhost:4000"

echo "🚀 Testing LusiLearn API..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# 1. Test Health Check
echo -e "\n${YELLOW}1. Testing Health Check...${NC}"
curl -s -X GET "$BASE_URL/health" | jq . > /dev/null
print_result $? "Health check"

# 2. Test User Registration
echo -e "\n${YELLOW}2. Testing User Registration...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test04@example.com",
    "password": "Password123!",
    "username": "testuser04'$(date +%s)'",
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
  }')

echo "$REGISTER_RESPONSE" | jq . > /dev/null
print_result $? "User registration"

# Extract tokens
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.accessToken // empty')
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.refreshToken // empty')

# Debug output
echo "DEBUG: Registration response keys: $(echo "$REGISTER_RESPONSE" | jq 'keys')"
echo "DEBUG: Access token length: ${#ACCESS_TOKEN}"

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    echo -e "${RED}❌ Failed to get access token from registration${NC}"
    echo "DEBUG: Full response: $REGISTER_RESPONSE"
    exit 1
fi

echo -e "${GREEN}🔑 Access token obtained${NC}"

# 3. Test User Login
echo -e "\n${YELLOW}3. Testing User Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test04@example.com",
    "password": "Password123!"
  }')

echo "$LOGIN_RESPONSE" | jq . > /dev/null
print_result $? "User login"

# 4. Test Get Profile
echo -e "\n${YELLOW}4. Testing Get User Profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/users/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$PROFILE_RESPONSE" | jq . > /dev/null
print_result $? "Get user profile"

# 5. Test Update Profile
echo -e "\n${YELLOW}5. Testing Update User Profile...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/v1/users/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "username": "updateduser",
    "demographics": {
      "ageRange": "26-40",
      "educationLevel": "professional",
      "timezone": "EST",
      "preferredLanguage": "en"
    }
  }')

echo "$UPDATE_RESPONSE" | jq . > /dev/null
print_result $? "Update user profile"

# 6. Test Skill Assessment
echo -e "\n${YELLOW}6. Testing Skill Assessment...${NC}"
ASSESSMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/assessments/skill" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "subject": "mathematics",
    "educationLevel": "college",
    "responses": [
      {
        "questionId": "q1",
        "selectedAnswer": "A",
        "timeSpent": 30
      },
      {
        "questionId": "q2",
        "selectedAnswer": "B",
        "timeSpent": 45
      }
    ]
  }')

echo "$ASSESSMENT_RESPONSE" | jq . > /dev/null
print_result $? "Skill assessment"

# 7. Test Get Assessment Results
echo -e "\n${YELLOW}7. Testing Get Assessment Results...${NC}"
RESULTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/assessments/results?subject=mathematics" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$RESULTS_RESPONSE" | jq . > /dev/null
print_result $? "Get assessment results"

# 8. Test Token Refresh
echo -e "\n${YELLOW}8. Testing Token Refresh...${NC}"
if [ ! -z "$REFRESH_TOKEN" ]; then
    REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/refresh" \
      -H "Content-Type: application/json" \
      -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
    
    echo "$REFRESH_RESPONSE" | jq . > /dev/null
    print_result $? "Token refresh"
else
    echo -e "${YELLOW}⚠️  Skipping token refresh (no refresh token)${NC}"
fi

# 9. Test Invalid Endpoint (should return 404)
echo -e "\n${YELLOW}9. Testing Invalid Endpoint...${NC}"
curl -s -X GET "$BASE_URL/api/v1/invalid" | grep -q "Not Found"
print_result $? "Invalid endpoint returns 404"

echo -e "\n${GREEN}🎉 API testing complete!${NC}"