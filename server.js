/**
 * Simple HTTP server for serving BitChat PWA
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS for all origins (for development)
app.use(cors());

// Serve static files
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        // Set proper MIME types
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
        }
        
        // Enable service worker caching
        if (path.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server for signaling (optional)
const wss = new WebSocket.Server({ server, path: '/signaling' });

// Simple signaling server for WebRTC
const rooms = new Map();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleSignalingMessage(ws, message);
        } catch (error) {
            console.error('Invalid signaling message:', error);
        }
    });
    
    ws.on('close', () => {
        // Remove from all rooms
        rooms.forEach((clients, roomId) => {
            clients.delete(ws);
            if (clients.size === 0) {
                rooms.delete(roomId);
            }
        });
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

/**
 * Handle signaling messages for WebRTC
 */
function handleSignalingMessage(ws, message) {
    const { type, roomId, peerId, data } = message;
    
    switch (type) {
        case 'join':
            joinRoom(ws, roomId, peerId);
            break;
            
        case 'leave':
            leaveRoom(ws, roomId);
            break;
            
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            relayMessage(ws, roomId, message);
            break;
            
        default:
            console.warn('Unknown signaling message type:', type);
    }
}

/**
 * Join a signaling room
 */
function joinRoom(ws, roomId, peerId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    
    const room = rooms.get(roomId);
    
    // Notify existing peers about new peer
    room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'peer-joined',
                peerId: peerId,
                roomId: roomId
            }));
        }
    });
    
    // Add to room
    room.add(ws);
    ws.roomId = roomId;
    ws.peerId = peerId;
    
    // Send current peers to new peer
    const peerIds = Array.from(room)
        .filter(client => client !== ws && client.peerId)
        .map(client => client.peerId);
    
    ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: roomId,
        peers: peerIds
    }));
    
    console.log(`Peer ${peerId} joined room ${roomId} (${room.size} total)`);
}

/**
 * Leave a signaling room
 */
function leaveRoom(ws, roomId) {
    const room = rooms.get(roomId);
    if (room) {
        room.delete(ws);
        
        // Notify other peers
        room.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'peer-left',
                    peerId: ws.peerId,
                    roomId: roomId
                }));
            }
        });
        
        // Clean up empty room
        if (room.size === 0) {
            rooms.delete(roomId);
        }
        
        console.log(`Peer ${ws.peerId} left room ${roomId}`);
    }
}

/**
 * Relay message to other peers in room
 */
function relayMessage(ws, roomId, message) {
    const room = rooms.get(roomId);
    if (room) {
        room.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Start server
server.listen(PORT, () => {
    console.log(`BitChat PWA server running on http://localhost:${PORT}`);
    console.log('WebSocket signaling available at ws://localhost:' + PORT + '/signaling');
    console.log('\nOpen http://localhost:' + PORT + ' in your browser to test the app');
    
    // Log room status periodically
    setInterval(() => {
        if (rooms.size > 0) {
            console.log(`Active rooms: ${rooms.size}, Total connections: ${Array.from(rooms.values()).reduce((acc, room) => acc + room.size, 0)}`);
        }
    }, 30000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nServer shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
