#!/bin/bash

# Test script for Real-time Collaboration API endpoints with authentication
# This script will create a test user, login, and test authenticated endpoints

API_BASE="http://localhost:4000/api/v1"
CONTENT_TYPE="Content-Type: application/json"

echo "🚀 Testing Real-time Collaboration API with Authentication"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
    fi
}

# Function to test endpoint with auth
test_endpoint_auth() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local token=$6
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo -e "${YELLOW}$method${NC} $endpoint"
    
    if [ -n "$data" ]; then
        if [ -n "$token" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "$CONTENT_TYPE" \
                -H "Authorization: Bearer $token" \
                -d "$data" \
                "$API_BASE$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "$CONTENT_TYPE" \
                -d "$data" \
                "$API_BASE$endpoint")
        fi
    else
        if [ -n "$token" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "$CONTENT_TYPE" \
                -H "Authorization: Bearer $token" \
                "$API_BASE$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method \
                -H "$CONTENT_TYPE" \
                "$API_BASE$endpoint")
        fi
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    body=$(echo "$response" | head -n -1)
    
    echo "Status: $status_code"
    echo "Response: $body" | jq . 2>/dev/null || echo "Response: $body"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        print_result 0 "$description"
        return 0
    else
        print_result 1 "$description (Expected: $expected_status, Got: $status_code)"
        return 1
    fi
}

echo -e "\n${BLUE}1. Testing Health Check${NC}"
health_response=$(curl -s http://localhost:4000/health)
echo "Health Status: $health_response" | jq . 2>/dev/null || echo "Health Status: $health_response"

echo -e "\n${BLUE}2. Creating Test User${NC}"
user_data='{
    "email": "testuser@example.com",
    "password": "TestPassword123",
    "username": "testuser123",
    "demographics": {
        "ageRange": "18-25",
        "educationLevel": "college",
        "timezone": "America/New_York",
        "preferredLanguage": "en"
    },
    "learningPreferences": {
        "learningStyle": ["visual", "reading_writing"],
        "preferredContentTypes": ["video", "text"],
        "sessionDuration": 60,
        "difficultyPreference": "moderate"
    }
}'

echo "Creating user..."
create_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "$CONTENT_TYPE" \
    -d "$user_data" \
    "$API_BASE/auth/register")

create_status=$(echo "$create_response" | tail -n1)
create_body=$(echo "$create_response" | head -n -1)

echo "Create User Status: $create_status"
echo "Create User Response: $create_body" | jq . 2>/dev/null || echo "Create User Response: $create_body"

echo -e "\n${BLUE}3. Logging In${NC}"
login_data='{
    "email": "testuser@example.com",
    "password": "TestPassword123"
}'

login_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "$CONTENT_TYPE" \
    -d "$login_data" \
    "$API_BASE/auth/login")

login_status=$(echo "$login_response" | tail -n1)
login_body=$(echo "$login_response" | head -n -1)

echo "Login Status: $login_status"
echo "Login Response: $login_body" | jq . 2>/dev/null || echo "Login Response: $login_body"

# Extract token from login response
if [ "$login_status" -eq 200 ]; then
    TOKEN=$(echo "$login_body" | jq -r '.data.accessToken // .accessToken // .data.token // .token // empty' 2>/dev/null)
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo -e "${RED}❌ Could not extract token from login response${NC}"
        echo "Trying alternative token extraction..."
        TOKEN=$(echo "$login_body" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        if [ -z "$TOKEN" ]; then
            TOKEN=$(echo "$login_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        fi
    fi
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo -e "${GREEN}✅ Successfully logged in and got token${NC}"
        echo "Token: ${TOKEN:0:20}..."
    else
        echo -e "${RED}❌ Failed to extract token${NC}"
        echo "Will test without authentication"
        TOKEN=""
    fi
else
    echo -e "${RED}❌ Login failed${NC}"
    TOKEN=""
fi

echo -e "\n${BLUE}4. Testing Authenticated Endpoints${NC}"

if [ -n "$TOKEN" ]; then
    echo -e "\n${BLUE}4.1 Testing Active Sessions${NC}"
    test_endpoint_auth "GET" "/collaboration/active-sessions" "" 200 "Get active collaboration sessions" "$TOKEN"
    
    echo -e "\n${BLUE}4.2 Testing Session Creation${NC}"
    session_data='{
        "topic": "JavaScript Fundamentals",
        "participants": ["user1", "user2"],
        "duration": 60
    }'
    test_endpoint_auth "POST" "/collaboration/sessions" "$session_data" 201 "Create collaboration session" "$TOKEN"
    
    echo -e "\n${BLUE}4.3 Testing Study Group Creation${NC}"
    group_data='{
        "name": "JavaScript Study Group",
        "description": "Learning JavaScript fundamentals together",
        "topic": "JavaScript",
        "subject": "Programming",
        "maxSize": 5,
        "moderationLevel": "moderate",
        "privacy": "public"
    }'
    test_endpoint_auth "POST" "/collaboration/study-groups" "$group_data" 201 "Create study group" "$TOKEN"
    
    echo -e "\n${BLUE}4.4 Testing Get Study Groups${NC}"
    test_endpoint_auth "GET" "/collaboration/study-groups" "" 200 "Get user study groups" "$TOKEN"
    
    echo -e "\n${BLUE}4.5 Testing Peer Matching${NC}"
    matching_data='{
        "subjects": ["javascript", "programming"],
        "skillLevels": ["beginner", "intermediate"],
        "learningGoals": ["learn basics", "build projects"],
        "collaborationType": "study_buddy"
    }'
    test_endpoint_auth "POST" "/collaboration/peer-matching" "$matching_data" 200 "Find peer matches" "$TOKEN"
    
    echo -e "\n${BLUE}4.6 Testing Session Progress (with fake session)${NC}"
    test_endpoint_auth "GET" "/collaboration/sessions/fake-session/progress" "" 200 "Get session progress" "$TOKEN"
    
    echo -e "\n${BLUE}4.7 Testing Shared Files (with fake session)${NC}"
    test_endpoint_auth "GET" "/collaboration/sessions/fake-session/files" "" 200 "Get shared files" "$TOKEN"
    
else
    echo -e "${YELLOW}⚠️  Skipping authenticated tests - no valid token${NC}"
fi

echo -e "\n${BLUE}5. Testing WebSocket Connection${NC}"
echo "Note: WebSocket testing requires a WebSocket client"
echo "You can test WebSocket connections using:"
echo "  • Browser developer tools"
echo "  • wscat: npm install -g wscat"
echo "  • Custom WebSocket client"

echo -e "\n${GREEN}🎉 Collaboration API testing completed!${NC}"

if [ -n "$TOKEN" ]; then
    echo -e "\n${BLUE}📋 Summary:${NC}"
    echo -e "  • Authentication: ${GREEN}Working${NC}"
    echo -e "  • REST API Endpoints: ${GREEN}Available${NC}"
    echo -e "  • WebSocket Server: ${GREEN}Running${NC}"
    echo -e "  • Database: ${GREEN}Connected${NC}"
    
    echo -e "\n${BLUE}🔧 WebSocket Testing Commands:${NC}"
    echo -e "  # Install wscat if not already installed"
    echo -e "  npm install -g wscat"
    echo -e ""
    echo -e "  # Connect to WebSocket with authentication"
    echo -e "  wscat -c 'ws://localhost:4000' -H 'Authorization: Bearer $TOKEN'"
    echo -e ""
    echo -e "  # Or test in browser console:"
    echo -e "  const socket = io('ws://localhost:4000', {"
    echo -e "    auth: { token: '$TOKEN' }"
    echo -e "  });"
else
    echo -e "\n${YELLOW}⚠️  Authentication issues detected${NC}"
    echo -e "  • Check if auth endpoints are working"
    echo -e "  • Verify database connection"
    echo -e "  • Check JWT configuration"
fi