# Real-time Collaboration Features

This document describes the real-time collaboration features implemented for the LusiLearn AI platform.

## Overview

The real-time collaboration system enables users to:
- Join collaborative learning sessions
- Share progress updates in real-time
- Share files during sessions
- Enable screen sharing capabilities
- Send real-time messages
- Participate in collaborative activities

## Architecture

### Components

1. **WebSocketService** - Manages WebSocket connections and real-time events
2. **CollaborationService** - Handles collaboration business logic
3. **Database Tables** - Store collaboration session data, progress updates, and shared files
4. **API Routes** - REST endpoints for session management

### Database Schema

#### collaboration_session_data
- Stores session metadata, participants, and activities
- Tracks session duration and outcomes

#### collaboration_progress_updates
- Real-time progress updates from participants
- Links to content items and milestones

#### collaboration_shared_files
- Files shared during collaboration sessions
- Includes metadata and access controls

#### collaboration_messages
- Real-time messages between participants
- Supports text, code, and image messages

## WebSocket Events

### Client to Server Events

#### join-collaboration
```javascript
socket.emit('join-collaboration', {
  sessionId: 'session_123',
  groupId: 'group_456' // optional
});
```

#### progress-update
```javascript
socket.emit('progress-update', {
  sessionId: 'session_123',
  progress: 75,
  contentId: 'content_789',
  milestone: 'Completed Chapter 1'
});
```

#### share-file
```javascript
socket.emit('share-file', {
  sessionId: 'session_123',
  file: {
    id: 'file_123',
    name: 'document.pdf',
    url: 'https://example.com/file.pdf',
    size: 1024000,
    type: 'application/pdf'
  }
});
```

#### start-screen-share
```javascript
socket.emit('start-screen-share', {
  sessionId: 'session_123',
  streamId: 'stream_456'
});
```

#### send-message
```javascript
socket.emit('send-message', {
  sessionId: 'session_123',
  message: 'Hello everyone!',
  type: 'text' // 'text', 'code', 'image'
});
```

### Server to Client Events

#### participant-joined
```javascript
socket.on('participant-joined', (data) => {
  console.log(`${data.userProfile.name} joined the session`);
});
```

#### progress-updated
```javascript
socket.on('progress-updated', (data) => {
  console.log(`${data.userId} is ${data.progress}% complete`);
});
```

#### file-shared
```javascript
socket.on('file-shared', (data) => {
  console.log(`${data.sharedBy.name} shared ${data.file.name}`);
});
```

#### screen-share-started
```javascript
socket.on('screen-share-started', (data) => {
  console.log(`${data.userProfile.name} started screen sharing`);
});
```

#### message-received
```javascript
socket.on('message-received', (data) => {
  console.log(`${data.userProfile.name}: ${data.message}`);
});
```

## REST API Endpoints

### Create Session
```http
POST /api/v1/collaboration/sessions
Content-Type: application/json
Authorization: Bearer <token>

{
  "topic": "JavaScript Fundamentals",
  "participants": ["user1", "user2"],
  "groupId": "group_123", // optional
  "duration": 60 // optional, in minutes
}
```

### Get Session Progress
```http
GET /api/v1/collaboration/sessions/{sessionId}/progress
Authorization: Bearer <token>
```

### Get Shared Files
```http
GET /api/v1/collaboration/sessions/{sessionId}/files
Authorization: Bearer <token>
```

### End Session
```http
POST /api/v1/collaboration/sessions/{sessionId}/end
Content-Type: application/json
Authorization: Bearer <token>

{
  "outcomes": ["Completed learning objectives"],
  "satisfaction": 4,
  "feedback": "Great session!"
}
```

## Authentication

WebSocket connections require JWT authentication:

```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

## Security Features

### Content Moderation
- All messages are automatically moderated
- Inappropriate content is blocked
- Moderation results are logged

### File Sharing Security
- File size limits (50MB max)
- File type restrictions
- Virus scanning (future enhancement)

### Access Control
- Users must be session participants
- Group membership verification
- Age-appropriate matching for minors

## Usage Examples

### Basic Collaboration Session

```javascript
// Connect to WebSocket
const socket = io('ws://localhost:3001', {
  auth: { token: userToken }
});

// Join a session
socket.emit('join-collaboration', {
  sessionId: 'session_123'
});

// Listen for events
socket.on('participant-joined', (data) => {
  updateParticipantsList(data);
});

socket.on('progress-updated', (data) => {
  updateProgressDisplay(data);
});

// Send progress update
socket.emit('progress-update', {
  sessionId: 'session_123',
  progress: 80,
  milestone: 'Completed exercise 5'
});
```

### File Sharing

```javascript
// Share a file
socket.emit('share-file', {
  sessionId: 'session_123',
  file: {
    id: generateFileId(),
    name: file.name,
    url: uploadedFileUrl,
    size: file.size,
    type: file.type
  }
});

// Handle file shared by others
socket.on('file-shared', (data) => {
  addFileToSharedList(data.file);
});
```

### Screen Sharing

```javascript
// Start screen sharing
navigator.mediaDevices.getDisplayMedia()
  .then(stream => {
    const streamId = generateStreamId();
    
    socket.emit('start-screen-share', {
      sessionId: 'session_123',
      streamId: streamId
    });
    
    // Handle WebRTC peer connections
    setupPeerConnections(stream);
  });

// Handle screen share from others
socket.on('screen-share-started', (data) => {
  displayScreenShare(data.streamId);
});
```

## Error Handling

The system includes comprehensive error handling:

- Connection failures with automatic reconnection
- Authentication errors with clear messages
- Validation errors for malformed data
- Database errors with fallback responses
- Rate limiting for abuse prevention

## Performance Considerations

- WebSocket connections are pooled and managed efficiently
- Database queries are optimized with proper indexing
- File sharing uses streaming for large files
- Progress updates are throttled to prevent spam
- Memory usage is monitored and cleaned up

## Future Enhancements

- Video/audio calling integration
- Collaborative whiteboard
- Code editor with real-time collaboration
- Advanced moderation with AI
- Analytics and insights dashboard
- Mobile app support
- Offline synchronization

## Testing

The system includes comprehensive tests:
- Unit tests for WebSocket service
- Integration tests for API endpoints
- End-to-end tests for user workflows
- Performance tests for concurrent users
- Security tests for authentication and authorization

Run tests with:
```bash
npm test -- --testPathPattern=websocket
npm test -- --testPathPattern=collaboration
```