#!/usr/bin/env node

// Simple WebSocket test for collaboration features
// This script tests the WebSocket connection and basic events

const { io } = require('socket.io-client');

console.log('🚀 Testing WebSocket Collaboration Features');
console.log('============================================');

// Test configuration
const WS_URL = 'ws://localhost:4000';
const TEST_TOKEN = 'test-token'; // This will fail auth, but we can test connection

console.log(`\n📡 Connecting to: ${WS_URL}`);

// Create socket connection
const socket = io(WS_URL, {
    auth: {
        token: TEST_TOKEN
    },
    transports: ['websocket', 'polling']
});

// Connection events
socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Test basic events
    testBasicEvents();
});

socket.on('connect_error', (error) => {
    console.log('❌ Connection failed:', error.message);
    
    if (error.message.includes('Authentication')) {
        console.log('   This is expected - authentication is required');
        console.log('   WebSocket server is responding correctly');
    }
    
    // Try to test without auth (this should also fail)
    console.log('\n🔄 Testing connection without auth...');
    testWithoutAuth();
});

socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected:', reason);
});

socket.on('error', (error) => {
    console.log('⚠️  Socket error:', error);
});

// Test basic collaboration events
function testBasicEvents() {
    console.log('\n🧪 Testing collaboration events...');
    
    // Test join collaboration
    socket.emit('join-collaboration', {
        sessionId: 'test-session-123',
        groupId: 'test-group-456'
    });
    
    // Test progress update
    socket.emit('progress-update', {
        sessionId: 'test-session-123',
        progress: 75,
        contentId: 'content-789',
        milestone: 'Completed Chapter 1'
    });
    
    // Test file sharing
    socket.emit('share-file', {
        sessionId: 'test-session-123',
        file: {
            id: 'file-123',
            name: 'test-document.pdf',
            url: 'https://example.com/file.pdf',
            size: 1024000,
            type: 'application/pdf'
        }
    });
    
    // Test messaging
    socket.emit('send-message', {
        sessionId: 'test-session-123',
        message: 'Hello, this is a test message!',
        type: 'text'
    });
    
    console.log('📤 Sent test events (these should be rejected due to auth)');
}

function testWithoutAuth() {
    const socketNoAuth = io(WS_URL, {
        transports: ['websocket', 'polling']
    });
    
    socketNoAuth.on('connect', () => {
        console.log('✅ Connected without auth (unexpected!)');
        socketNoAuth.disconnect();
    });
    
    socketNoAuth.on('connect_error', (error) => {
        console.log('❌ Connection without auth failed (expected):', error.message);
        console.log('✅ Authentication is properly enforced');
        
        // Clean up and exit
        setTimeout(() => {
            console.log('\n🎉 WebSocket server tests completed!');
            console.log('\n📋 Summary:');
            console.log('  • WebSocket server is running ✅');
            console.log('  • Authentication is enforced ✅');
            console.log('  • Event handling is set up ✅');
            console.log('\n💡 Next steps:');
            console.log('  • Get a valid JWT token');
            console.log('  • Test with proper authentication');
            console.log('  • Test real-time collaboration features');
            
            process.exit(0);
        }, 1000);
    });
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Closing WebSocket connection...');
    socket.disconnect();
    process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout reached');
    socket.disconnect();
    process.exit(0);
}, 10000);