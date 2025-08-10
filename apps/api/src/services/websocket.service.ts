import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { CollaborationService } from './collaboration.service';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userProfile?: {
        id: string;
        name: string;
        educationLevel: string;
        ageRange: string;
    };
}

interface CollaborationRoom {
    id: string;
    participants: Map<string, AuthenticatedSocket>;
    sessionData: {
        topic: string;
        startTime: Date;
        activities: Array<{
            type: string;
            timestamp: Date;
            userId: string;
            data: any;
        }>;
    };
    sharedState: {
        currentContent?: string;
        sharedFiles: Array<{
            id: string;
            name: string;
            url: string;
            uploadedBy: string;
            timestamp: Date;
        }>;
        progressUpdates: Map<string, {
            userId: string;
            progress: number;
            timestamp: Date;
        }>;
    };
}

export class WebSocketService {
    private io: SocketIOServer;
    private collaborationRooms: Map<string, CollaborationRoom> = new Map();
    private userSockets: Map<string, AuthenticatedSocket> = new Map();

    constructor(
        httpServer: HTTPServer,
        private db: Pool,
        private collaborationService: CollaborationService
    ) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.setupMiddleware();
        this.setupEventHandlers();
    }

    private setupMiddleware(): void {
        // Authentication middleware
        this.io.use(async (socket: AuthenticatedSocket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

                // Get user profile from database
                const userQuery = `
          SELECT id, demographics, learning_preferences 
          FROM users 
          WHERE id = $1
        `;

                const userResult = await this.db.query(userQuery, [decoded.userId]);

                if (userResult.rows.length === 0) {
                    return next(new Error('User not found'));
                }

                const user = userResult.rows[0];
                socket.userId = decoded.userId;
                socket.userProfile = {
                    id: user.id,
                    name: user.demographics?.name || 'Anonymous',
                    educationLevel: user.demographics?.educationLevel || 'unknown',
                    ageRange: user.demographics?.ageRange || 'unknown'
                };

                // Store socket reference
                this.userSockets.set(socket.userId!, socket);

                logger.info(`User ${socket.userId} connected via WebSocket`);
                next();

            } catch (error) {
                logger.error('WebSocket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            logger.info(`Socket connected: ${socket.id} for user ${socket.userId}`);

            // Handle joining collaboration rooms
            socket.on('join-collaboration', async (data: { sessionId: string; groupId?: string }) => {
                await this.handleJoinCollaboration(socket, data);
            });

            // Handle leaving collaboration rooms
            socket.on('leave-collaboration', async (data: { sessionId: string }) => {
                await this.handleLeaveCollaboration(socket, data);
            });

            // Handle real-time progress updates
            socket.on('progress-update', async (data: {
                sessionId: string;
                progress: number;
                contentId?: string;
                milestone?: string;
            }) => {
                await this.handleProgressUpdate(socket, data);
            });

            // Handle screen sharing
            socket.on('start-screen-share', async (data: { sessionId: string; streamId: string }) => {
                await this.handleStartScreenShare(socket, data);
            });

            socket.on('stop-screen-share', async (data: { sessionId: string }) => {
                await this.handleStopScreenShare(socket, data);
            });

            // Handle file sharing
            socket.on('share-file', async (data: {
                sessionId: string;
                file: {
                    id: string;
                    name: string;
                    url: string;
                    size: number;
                    type: string;
                }
            }) => {
                await this.handleFileShare(socket, data);
            });

            // Handle collaborative activities
            socket.on('collaboration-activity', async (data: {
                sessionId: string;
                type: 'question' | 'answer' | 'discussion' | 'code_share' | 'whiteboard';
                content: any;
            }) => {
                await this.handleCollaborationActivity(socket, data);
            });

            // Handle real-time messaging
            socket.on('send-message', async (data: {
                sessionId: string;
                message: string;
                type: 'text' | 'code' | 'image';
            }) => {
                await this.handleSendMessage(socket, data);
            });

            // Handle session management
            socket.on('update-session-state', async (data: {
                sessionId: string;
                state: any;
            }) => {
                await this.handleUpdateSessionState(socket, data);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    private async handleJoinCollaboration(
        socket: AuthenticatedSocket,
        data: { sessionId: string; groupId?: string }
    ): Promise<void> {
        try {
            const { sessionId, groupId } = data;
            const userId = socket.userId!;

            // Verify user has access to this collaboration session
            if (groupId) {
                const group = await this.collaborationService.getStudyGroup(groupId);
                if (!group || !group.participants.some(p => p.userId === userId)) {
                    socket.emit('error', { message: 'Access denied to collaboration session' });
                    return;
                }
            }

            // Create or get collaboration room
            let room = this.collaborationRooms.get(sessionId);
            if (!room) {
                room = {
                    id: sessionId,
                    participants: new Map(),
                    sessionData: {
                        topic: groupId ? (await this.collaborationService.getStudyGroup(groupId))?.topic || 'Study Session' : 'Collaboration Session',
                        startTime: new Date(),
                        activities: []
                    },
                    sharedState: {
                        sharedFiles: [],
                        progressUpdates: new Map()
                    }
                };
                this.collaborationRooms.set(sessionId, room);
            }

            // Add participant to room
            room.participants.set(userId, socket);
            socket.join(sessionId);

            // Notify other participants
            socket.to(sessionId).emit('participant-joined', {
                userId,
                userProfile: socket.userProfile,
                timestamp: new Date()
            });

            // Send current room state to new participant
            socket.emit('collaboration-state', {
                sessionId,
                participants: Array.from(room.participants.keys()).map(id => {
                    const participantSocket = room!.participants.get(id);
                    return {
                        userId: id,
                        profile: participantSocket?.userProfile,
                        isActive: true
                    };
                }),
                sharedState: {
                    currentContent: room.sharedState.currentContent,
                    sharedFiles: room.sharedState.sharedFiles,
                    progressUpdates: Array.from(room.sharedState.progressUpdates.values())
                },
                sessionData: room.sessionData
            });

            logger.info(`User ${userId} joined collaboration session ${sessionId}`);

        } catch (error) {
            logger.error('Error joining collaboration:', error);
            socket.emit('error', { message: 'Failed to join collaboration session' });
        }
    }

    private async handleLeaveCollaboration(
        socket: AuthenticatedSocket,
        data: { sessionId: string }
    ): Promise<void> {
        try {
            const { sessionId } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (room && room.participants.has(userId)) {
                room.participants.delete(userId);
                socket.leave(sessionId);

                // Notify other participants
                socket.to(sessionId).emit('participant-left', {
                    userId,
                    timestamp: new Date()
                });

                // Clean up empty rooms
                if (room.participants.size === 0) {
                    await this.saveSessionData(sessionId, room);
                    this.collaborationRooms.delete(sessionId);
                }

                logger.info(`User ${userId} left collaboration session ${sessionId}`);
            }

        } catch (error) {
            logger.error('Error leaving collaboration:', error);
        }
    }

    private async handleProgressUpdate(
        socket: AuthenticatedSocket,
        data: { sessionId: string; progress: number; contentId?: string; milestone?: string }
    ): Promise<void> {
        try {
            const { sessionId, progress, contentId, milestone } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Update progress in room state
            room.sharedState.progressUpdates.set(userId, {
                userId,
                progress,
                timestamp: new Date()
            });

            // Record activity
            room.sessionData.activities.push({
                type: 'progress_update',
                timestamp: new Date(),
                userId,
                data: { progress, contentId, milestone }
            });

            // Broadcast progress update to all participants
            this.io.to(sessionId).emit('progress-updated', {
                userId,
                progress,
                contentId,
                milestone,
                timestamp: new Date()
            });

            // Store progress update in database
            await this.storeProgressUpdate(sessionId, userId, progress, contentId, milestone);

            logger.info(`Progress update from user ${userId} in session ${sessionId}: ${progress}%`);

        } catch (error) {
            logger.error('Error handling progress update:', error);
            socket.emit('error', { message: 'Failed to update progress' });
        }
    }

    private async handleStartScreenShare(
        socket: AuthenticatedSocket,
        data: { sessionId: string; streamId: string }
    ): Promise<void> {
        try {
            const { sessionId, streamId } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Record activity
            room.sessionData.activities.push({
                type: 'screen_share_start',
                timestamp: new Date(),
                userId,
                data: { streamId }
            });

            // Notify all participants about screen sharing
            socket.to(sessionId).emit('screen-share-started', {
                userId,
                streamId,
                userProfile: socket.userProfile,
                timestamp: new Date()
            });

            logger.info(`User ${userId} started screen sharing in session ${sessionId}`);

        } catch (error) {
            logger.error('Error starting screen share:', error);
            socket.emit('error', { message: 'Failed to start screen sharing' });
        }
    }

    private async handleStopScreenShare(
        socket: AuthenticatedSocket,
        data: { sessionId: string }
    ): Promise<void> {
        try {
            const { sessionId } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                return;
            }

            // Record activity
            room.sessionData.activities.push({
                type: 'screen_share_stop',
                timestamp: new Date(),
                userId,
                data: {}
            });

            // Notify all participants
            socket.to(sessionId).emit('screen-share-stopped', {
                userId,
                timestamp: new Date()
            });

            logger.info(`User ${userId} stopped screen sharing in session ${sessionId}`);

        } catch (error) {
            logger.error('Error stopping screen share:', error);
        }
    }

    private async handleFileShare(
        socket: AuthenticatedSocket,
        data: {
            sessionId: string;
            file: { id: string; name: string; url: string; size: number; type: string; }
        }
    ): Promise<void> {
        try {
            const { sessionId, file } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Validate file (basic security checks)
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                socket.emit('error', { message: 'File too large (max 50MB)' });
                return;
            }

            const allowedTypes = ['image/', 'text/', 'application/pdf', 'application/json'];
            if (!allowedTypes.some(type => file.type.startsWith(type))) {
                socket.emit('error', { message: 'File type not allowed' });
                return;
            }

            // Add file to shared state
            const sharedFile = {
                id: file.id,
                name: file.name,
                url: file.url,
                uploadedBy: userId,
                timestamp: new Date()
            };

            room.sharedState.sharedFiles.push(sharedFile);

            // Record activity
            room.sessionData.activities.push({
                type: 'file_share',
                timestamp: new Date(),
                userId,
                data: { file: sharedFile }
            });

            // Broadcast file to all participants
            this.io.to(sessionId).emit('file-shared', {
                file: sharedFile,
                sharedBy: socket.userProfile,
                timestamp: new Date()
            });

            // Store file reference in database
            await this.storeSharedFile(sessionId, userId, sharedFile);

            logger.info(`User ${userId} shared file ${file.name} in session ${sessionId}`);

        } catch (error) {
            logger.error('Error sharing file:', error);
            socket.emit('error', { message: 'Failed to share file' });
        }
    }

    private async handleCollaborationActivity(
        socket: AuthenticatedSocket,
        data: {
            sessionId: string;
            type: 'question' | 'answer' | 'discussion' | 'code_share' | 'whiteboard';
            content: any;
        }
    ): Promise<void> {
        try {
            const { sessionId, type, content } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Record activity
            const activity = {
                type: `collaboration_${type}`,
                timestamp: new Date(),
                userId,
                data: { activityType: type, content }
            };

            room.sessionData.activities.push(activity);

            // Broadcast activity to all participants
            this.io.to(sessionId).emit('collaboration-activity', {
                userId,
                userProfile: socket.userProfile,
                type,
                content,
                timestamp: new Date()
            });

            logger.info(`User ${userId} performed ${type} activity in session ${sessionId}`);

        } catch (error) {
            logger.error('Error handling collaboration activity:', error);
            socket.emit('error', { message: 'Failed to process collaboration activity' });
        }
    }

    private async handleSendMessage(
        socket: AuthenticatedSocket,
        data: { sessionId: string; message: string; type: 'text' | 'code' | 'image' }
    ): Promise<void> {
        try {
            const { sessionId, message, type } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Basic content moderation
            const moderationResult = await this.collaborationService.moderateInteraction(`${sessionId}_${Date.now()}`);

            if (!moderationResult.isAppropriate) {
                socket.emit('message-blocked', {
                    reason: moderationResult.reason || 'Message blocked by moderation',
                    severity: moderationResult.severity
                });
                return;
            }

            // Record activity
            room.sessionData.activities.push({
                type: 'message',
                timestamp: new Date(),
                userId,
                data: { message, messageType: type }
            });

            // Broadcast message to all participants
            this.io.to(sessionId).emit('message-received', {
                userId,
                userProfile: socket.userProfile,
                message,
                type,
                timestamp: new Date()
            });

            logger.info(`User ${userId} sent ${type} message in session ${sessionId}`);

        } catch (error) {
            logger.error('Error sending message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    private async handleUpdateSessionState(
        socket: AuthenticatedSocket,
        data: { sessionId: string; state: any }
    ): Promise<void> {
        try {
            const { sessionId, state } = data;
            const userId = socket.userId!;

            const room = this.collaborationRooms.get(sessionId);
            if (!room || !room.participants.has(userId)) {
                socket.emit('error', { message: 'Not in collaboration session' });
                return;
            }

            // Update shared state (merge with existing state)
            if (state.currentContent !== undefined) {
                room.sharedState.currentContent = state.currentContent;
            }

            // Record activity
            room.sessionData.activities.push({
                type: 'state_update',
                timestamp: new Date(),
                userId,
                data: { state }
            });

            // Broadcast state update to other participants
            socket.to(sessionId).emit('session-state-updated', {
                userId,
                state,
                timestamp: new Date()
            });

            logger.info(`User ${userId} updated session state in ${sessionId}`);

        } catch (error) {
            logger.error('Error updating session state:', error);
            socket.emit('error', { message: 'Failed to update session state' });
        }
    }

    private handleDisconnect(socket: AuthenticatedSocket): void {
        const userId = socket.userId;
        if (userId) {
            // Remove from user sockets map
            this.userSockets.delete(userId);

            // Remove from all collaboration rooms
            for (const [sessionId, room] of this.collaborationRooms.entries()) {
                if (room.participants.has(userId)) {
                    room.participants.delete(userId);

                    // Notify other participants
                    socket.to(sessionId).emit('participant-disconnected', {
                        userId,
                        timestamp: new Date()
                    });

                    // Clean up empty rooms
                    if (room.participants.size === 0) {
                        this.saveSessionData(sessionId, room).catch(error => {
                            logger.error('Error saving session data on disconnect:', error);
                        });
                        this.collaborationRooms.delete(sessionId);
                    }
                }
            }

            logger.info(`User ${userId} disconnected from WebSocket`);
        }
    }

    // Helper methods for database operations

    private async storeProgressUpdate(
        sessionId: string,
        userId: string,
        progress: number,
        contentId?: string,
        milestone?: string
    ): Promise<void> {
        try {
            const query = `
        INSERT INTO collaboration_progress_updates (
          session_id, user_id, progress, content_id, milestone, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id, user_id, timestamp) 
        DO UPDATE SET progress = EXCLUDED.progress
      `;

            await this.db.query(query, [
                sessionId,
                userId,
                progress,
                contentId,
                milestone,
                new Date()
            ]);

        } catch (error) {
            logger.error('Error storing progress update:', error);
        }
    }

    private async storeSharedFile(
        sessionId: string,
        userId: string,
        file: { id: string; name: string; url: string; uploadedBy: string; timestamp: Date }
    ): Promise<void> {
        try {
            const query = `
        INSERT INTO collaboration_shared_files (
          session_id, file_id, file_name, file_url, uploaded_by, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

            await this.db.query(query, [
                sessionId,
                file.id,
                file.name,
                file.url,
                userId,
                file.timestamp
            ]);

        } catch (error) {
            logger.error('Error storing shared file:', error);
        }
    }

    private async saveSessionData(sessionId: string, room: CollaborationRoom): Promise<void> {
        try {
            const query = `
        INSERT INTO collaboration_session_data (
          session_id, topic, start_time, end_time, activities, 
          participant_count, total_duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          end_time = EXCLUDED.end_time,
          activities = EXCLUDED.activities,
          total_duration = EXCLUDED.total_duration
      `;

            const endTime = new Date();
            const duration = Math.floor((endTime.getTime() - room.sessionData.startTime.getTime()) / 1000 / 60); // minutes

            await this.db.query(query, [
                sessionId,
                room.sessionData.topic,
                room.sessionData.startTime,
                endTime,
                JSON.stringify(room.sessionData.activities),
                room.participants.size,
                duration
            ]);

            logger.info(`Saved session data for ${sessionId}`);

        } catch (error) {
            logger.error('Error saving session data:', error);
        }
    }

    // Public methods for external use

    public async notifyUserProgress(userId: string, progressData: any): Promise<void> {
        const socket = this.userSockets.get(userId);
        if (socket) {
            socket.emit('progress-notification', progressData);
        }
    }

    public async broadcastToGroup(groupId: string, event: string, data: any): Promise<void> {
        // Find all sessions for this group and broadcast
        for (const [sessionId, room] of this.collaborationRooms.entries()) {
            // This is a simplified approach - in production, you'd want to track group-session relationships
            this.io.to(sessionId).emit(event, data);
        }
    }

    public getActiveCollaborations(): Array<{ sessionId: string; participantCount: number; topic: string }> {
        return Array.from(this.collaborationRooms.entries()).map(([sessionId, room]) => ({
            sessionId,
            participantCount: room.participants.size,
            topic: room.sessionData.topic
        }));
    }
}