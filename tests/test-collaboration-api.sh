#!/bin/bash

# Test script for Real-time Collaboration API endpoints
# Make sure the API server is running on port 4000

API_BASE="http://localhost:4000/api/v1"
CONTENT_TYPE="Content-Type: application/json"

echo "🚀 Testing Real-time Collaboration API Endpoints"
echo "================================================"

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

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -e "\n${BLUE}Testing:${NC} $description"
    echo -e "${YELLOW}$method${NC} $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "$CONTENT_TYPE" \
            -d "$data" \
            "$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "$CONTENT_TYPE" \
            "$API_BASE$endpoint")
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
test_endpoint "GET" "/health" "" 200 "API Health Check"

echo -e "\n${BLUE}2. Testing Collaboration Session Creation (without auth)${NC}"
session_data='{
    "topic": "JavaScript Fundamentals",
    "participants": ["user1", "user2"],
    "duration": 60
}'
test_endpoint "POST" "/collaboration/sessions" "$session_data" 401 "Create session without authentication"

echo -e "\n${BLUE}3. Testing Session Progress (without auth)${NC}"
test_endpoint "GET" "/collaboration/sessions/test-session/progress" "" 401 "Get session progress without authentication"

echo -e "\n${BLUE}4. Testing Shared Files (without auth)${NC}"
test_endpoint "GET" "/collaboration/sessions/test-session/files" "" 401 "Get shared files without authentication"

echo -e "\n${BLUE}5. Testing End Session (without auth)${NC}"
end_data='{
    "outcomes": ["Completed learning objectives"],
    "satisfaction": 4,
    "feedback": "Great session!"
}'
test_endpoint "POST" "/collaboration/sessions/test-session/end" "$end_data" 401 "End session without authentication"

echo -e "\n${BLUE}6. Testing Active Sessions Status${NC}"
test_endpoint "GET" "/collaboration/active-sessions" "" 200 "Get active collaboration sessions"

echo -e "\n${BLUE}7. Testing Invalid Session Data${NC}"
invalid_data='{
    "topic": "",
    "participants": []
}'
test_endpoint "POST" "/collaboration/sessions" "$invalid_data" 401 "Create session with invalid data (should fail auth first)"

echo -e "\n${BLUE}8. Testing Peer Matching (without auth)${NC}"
matching_data='{
    "subjects": ["javascript", "programming"],
    "skillLevels": ["beginner", "intermediate"],
    "learningGoals": ["learn basics", "build projects"],
    "collaborationType": "study_buddy"
}'
test_endpoint "POST" "/collaboration/peer-matching" "$matching_data" 401 "Peer matching without authentication"

echo -e "\n${BLUE}9. Testing Study Group Creation (without auth)${NC}"
group_data='{
    "name": "JavaScript Study Group",
    "description": "Learning JavaScript fundamentals together",
    "topic": "JavaScript",
    "subject": "Programming",
    "maxSize": 5,
    "moderationLevel": "moderate",
    "privacy": "public"
}'
test_endpoint "POST" "/collaboration/study-groups" "$group_data" 401 "Create study group without authentication"

echo -e "\n${BLUE}10. Testing Get Study Groups (without auth)${NC}"
test_endpoint "GET" "/collaboration/study-groups" "" 401 "Get study groups without authentication"

echo -e "\n${YELLOW}📝 Note: Most endpoints require authentication${NC}"
echo -e "${YELLOW}   To test with authentication, you would need to:${NC}"
echo -e "${YELLOW}   1. Create a user account${NC}"
echo -e "${YELLOW}   2. Login to get a JWT token${NC}"
echo -e "${YELLOW}   3. Include the token in Authorization header${NC}"

echo -e "\n${GREEN}🎉 Basic API structure tests completed!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Test with valid authentication tokens"
echo -e "  • Test WebSocket connections"
echo -e "  • Test real-time collaboration features"

# Test WebSocket endpoint availability
echo -e "\n${BLUE}11. Testing WebSocket Server Availability${NC}"
echo "Checking if WebSocket server is accessible..."

# Simple check if the server responds to HTTP upgrade requests
response=$(curl -s -w "%{http_code}" -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:4000)
if [[ $response == *"426"* ]] || [[ $response == *"400"* ]]; then
    echo -e "${GREEN}✅ WebSocket server is responding${NC} (HTTP $response - expected for WebSocket upgrade)"
else
    echo -e "${YELLOW}⚠️  WebSocket server response:${NC} $response"
fi

echo -e "\n${BLUE}🔗 WebSocket Connection Details:${NC}"
echo -e "  • WebSocket URL: ws://localhost:4000"
echo -e "  • Authentication: JWT token required in auth.token"
echo -e "  • Supported events: join-collaboration, progress-update, share-file, etc."