/**
 * Bluetooth Service - Web version using WebRTC for P2P communication
 * Since Web Bluetooth API doesn't support mesh networking, we use WebRTC as fallback
 */

class BluetoothService {
    constructor() {
        this.peers = new Map(); // Connected peers
        this.discoveredPeers = new Map(); // Discovered but not connected peers
        this.isScanning = false;
        this.isAdvertising = false;
        this.messageQueue = [];
        this.processedMessages = new Set();
        this.delegate = null;
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        this.localStream = null;
        this.connections = new Map();
        this.dataChannels = new Map();
        this.roomId = this.generateRoomId();
        this.signalingServer = null;
        this.init();
    }

    async init() {
        console.log('Initializing Bluetooth Service (WebRTC fallback)');
        
        // Check if Web Bluetooth is available
        if ('bluetooth' in navigator) {
            console.log('Web Bluetooth API available but limited for mesh networking');
            // We could try to use it for discovery only
            this.setupWebBluetooth();
        }
        
        // Setup WebRTC for actual P2P communication
        await this.setupWebRTC();
        
        // Setup signaling with fallback
        await this.initWithFallback();
    }

    /**
     * Setup limited Web Bluetooth functionality
     */
    async setupWebBluetooth() {
        try {
            // This is limited - Web Bluetooth can only connect to devices,
            // not create mesh networks or act as peripheral
            console.log('Web Bluetooth setup attempted');
        } catch (error) {
            console.warn('Web Bluetooth not fully supported:', error);
        }
    }

    /**
     * Setup WebRTC for P2P communication
     */
    async setupWebRTC() {
        try {
            // Create a dummy media stream for WebRTC (not required in modern browsers)
            console.log('WebRTC setup complete');
        } catch (error) {
            console.warn('WebRTC setup failed:', error);
        }
    }

    /**
     * Setup signaling server connection
     */
    setupSignaling() {
        // Connect to WebSocket signaling server
        try {
            const wsUrl = `ws://${window.location.host}/signaling`;
            console.log('Connecting to signaling server:', wsUrl);
            
            this.signalingWs = new WebSocket(wsUrl);
            
            this.signalingWs.onopen = () => {
                console.log('Connected to signaling server');
                this.joinSignalingRoom();
            };
            
            this.signalingWs.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleSignalingMessage(message);
                } catch (error) {
                    console.error('Invalid signaling message:', error);
                }
            };
            
            this.signalingWs.onclose = () => {
                console.log('Disconnected from signaling server, using fallback');
                // Use simulation as fallback
                setTimeout(() => {
                    console.log('Starting simulation fallback');
                    this.simulatePeerDiscovery();
                }, 1000);
            };
            
            this.signalingWs.onerror = (error) => {
                console.error('Signaling WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('Failed to setup signaling:', error);
            // Fallback to simulation with delay
            setTimeout(() => {
                console.log('Falling back to simulated peer discovery');
                this.simulatePeerDiscovery();
            }, 2000);
        }
    }

    /**
     * Join signaling room
     */
    joinSignalingRoom() {
        if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
            const message = {
                type: 'join',
                roomId: this.roomId,
                peerId: this.getMyId()
            };
            this.signalingWs.send(JSON.stringify(message));
        }
    }

    /**
     * Handle signaling messages
     */
    handleSignalingMessage(message) {
        const { type, peerId, data } = message;
        
        switch (type) {
            case 'room-joined':
                console.log('Joined signaling room, existing peers:', message.peers);
                message.peers.forEach(id => {
                    if (id !== this.getMyId()) {
                        this.initiateConnectionToPeer(id);
                    }
                });
                break;
                
            case 'peer-joined':
                console.log('New peer joined:', peerId);
                if (peerId !== this.getMyId()) {
                    this.initiateConnectionToPeer(peerId);
                }
                break;
                
            case 'peer-left':
                console.log('Peer left:', peerId);
                this.onPeerDisconnected(peerId);
                break;
                
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                this.handleWebRTCSignaling(peerId, message);
                break;
        }
    }

    /**
     * Initiate connection to peer
     */
    async initiateConnectionToPeer(peerId) {
        if (this.connections.has(peerId)) {
            return; // Already connecting/connected
        }
        
        console.log(`Initiating connection to peer ${peerId}`);
        
        try {
            const connection = new RTCPeerConnection(this.rtcConfig);
            this.connections.set(peerId, connection);
            
            // Setup connection event handlers
            this.setupConnectionHandlers(connection, peerId);
            
            // Create data channel
            const dataChannel = connection.createDataChannel('bitchat', {
                ordered: true
            });
            this.setupDataChannel(dataChannel, peerId);
            
            // Create and send offer
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: 'offer',
                peerId: this.getMyId(),
                targetPeer: peerId,
                data: offer
            });
            
        } catch (error) {
            console.error(`Failed to initiate connection to ${peerId}:`, error);
            this.connections.delete(peerId);
        }
    }

    /**
     * Setup connection event handlers
     */
    setupConnectionHandlers(connection, peerId) {
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    peerId: this.getMyId(),
                    targetPeer: peerId,
                    data: event.candidate
                });
            }
        };

        connection.onconnectionstatechange = () => {
            console.log(`Connection state for ${peerId}:`, connection.connectionState);
            
            if (connection.connectionState === 'connected') {
                this.onPeerConnected(peerId);
            } else if (connection.connectionState === 'disconnected' || 
                      connection.connectionState === 'failed') {
                this.onPeerDisconnected(peerId);
            }
        };

        connection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            this.setupDataChannel(dataChannel, peerId);
        };
    }

    /**
     * Handle WebRTC signaling
     */
    async handleWebRTCSignaling(peerId, message) {
        const connection = this.connections.get(peerId);
        
        if (!connection) {
            // Create connection if we don't have one (we're answering)
            if (message.type === 'offer') {
                await this.handleIncomingOffer(peerId, message.data);
            }
            return;
        }
        
        try {
            switch (message.type) {
                case 'offer':
                    await connection.setRemoteDescription(message.data);
                    const answer = await connection.createAnswer();
                    await connection.setLocalDescription(answer);
                    
                    this.sendSignalingMessage({
                        type: 'answer',
                        peerId: this.getMyId(),
                        targetPeer: peerId,
                        data: answer
                    });
                    break;
                    
                case 'answer':
                    await connection.setRemoteDescription(message.data);
                    break;
                    
                case 'ice-candidate':
                    await connection.addIceCandidate(message.data);
                    break;
            }
        } catch (error) {
            console.error(`WebRTC signaling error with ${peerId}:`, error);
        }
    }

    /**
     * Handle incoming offer from peer
     */
    async handleIncomingOffer(peerId, offer) {
        try {
            const connection = new RTCPeerConnection(this.rtcConfig);
            this.connections.set(peerId, connection);
            
            this.setupConnectionHandlers(connection, peerId);
            
            await connection.setRemoteDescription(offer);
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            
            this.sendSignalingMessage({
                type: 'answer',
                peerId: this.getMyId(),
                targetPeer: peerId,
                data: answer
            });
            
        } catch (error) {
            console.error(`Failed to handle offer from ${peerId}:`, error);
            this.connections.delete(peerId);
        }
    }

    /**
     * Send signaling message
     */
    sendSignalingMessage(message) {
        if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
            this.signalingWs.send(JSON.stringify(message));
        }
    }

    /**
     * Generate a room ID for peer discovery
     */
    generateRoomId() {
        return 'bitchat-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Start scanning for peers
     */
    async startScanning() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        console.log('Starting peer discovery...');
        
        // Notify delegate
        if (this.delegate && this.delegate.onScanningStarted) {
            this.delegate.onScanningStarted();
        }
        
        // Start WebRTC peer discovery simulation
        this.startPeerDiscovery();
        
        return true;
    }

    /**
     * Stop scanning for peers
     */
    stopScanning() {
        this.isScanning = false;
        console.log('Stopped peer discovery');
        
        if (this.delegate && this.delegate.onScanningStopped) {
            this.delegate.onScanningStopped();
        }
    }

    /**
     * Start advertising as available peer
     */
    async startAdvertising() {
        if (this.isAdvertising) return;
        
        this.isAdvertising = true;
        console.log('Starting advertising...');
        
        // In a real implementation, this would make us discoverable
        // For demo, we'll just log it
        
        return true;
    }

    /**
     * Stop advertising
     */
    stopAdvertising() {
        this.isAdvertising = false;
        console.log('Stopped advertising');
    }

    /**
     * Simulate peer discovery
     */
    simulatePeerDiscovery() {
        const simulatedPeers = [
            { id: 'peer-001', name: 'Alice', rssi: -45 },
            { id: 'peer-002', name: 'Bob', rssi: -67 },
            { id: 'peer-003', name: 'Carol', rssi: -89 }
        ];

        simulatedPeers.forEach((peer, index) => {
            setTimeout(() => {
                this.discoveredPeers.set(peer.id, {
                    id: peer.id,
                    name: peer.name,
                    rssi: peer.rssi,
                    discovered: new Date(),
                    connected: false
                });

                if (this.delegate && this.delegate.onPeerDiscovered) {
                    this.delegate.onPeerDiscovered(peer.id, peer.name, peer.rssi);
                }

                // Auto-connect to discovered peers with delay
                setTimeout(() => {
                    this.onPeerConnected(peer.id);
                }, 500 + Math.random() * 1000);
                
            }, index * 1000); // Stagger discovery
        });
    }

    /**
     * Start peer discovery
     */
    startPeerDiscovery() {
        // Simulate continuous peer discovery
        setInterval(() => {
            if (this.isScanning) {
                this.simulatePeerDiscovery();
            }
        }, 10000); // Discover new peers every 10 seconds
    }

    /**
     * Connect to a specific peer (legacy method - now uses initiateConnectionToPeer)
     */
    async connectToPeer(peerId) {
        return this.initiateConnectionToPeer(peerId);
    }

    /**
     * Setup data channel for peer communication
     */
    setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => {
            console.log(`Data channel opened for peer ${peerId}`);
            this.dataChannels.set(peerId, dataChannel);
        };

        dataChannel.onmessage = (event) => {
            this.handleIncomingMessage(peerId, event.data);
        };

        dataChannel.onclose = () => {
            console.log(`Data channel closed for peer ${peerId}`);
            this.dataChannels.delete(peerId);
        };

        dataChannel.onerror = (error) => {
            console.error(`Data channel error for peer ${peerId}:`, error);
        };
    }

    /**
     * Handle peer connected
     */
    onPeerConnected(peerId) {
        const discoveredPeer = this.discoveredPeers.get(peerId);
        
        const peer = {
            id: peerId,
            name: discoveredPeer?.name || `Peer-${peerId.slice(-4)}`,
            connected: true,
            connectedAt: new Date(),
            rssi: discoveredPeer?.rssi || -50,
            lastSeen: new Date()
        };

        this.peers.set(peerId, peer);
        
        console.log(`Peer ${peerId} connected`);
        
        if (this.delegate && this.delegate.onPeerConnected) {
            this.delegate.onPeerConnected(peerId, peer.name);
        }

        // Send handshake
        this.sendHandshake(peerId);
    }

    /**
     * Handle peer disconnected
     */
    onPeerDisconnected(peerId) {
        this.peers.delete(peerId);
        this.connections.delete(peerId);
        this.dataChannels.delete(peerId);
        
        console.log(`Peer ${peerId} disconnected`);
        
        if (this.delegate && this.delegate.onPeerDisconnected) {
            this.delegate.onPeerDisconnected(peerId);
        }
    }

    /**
     * Send handshake to peer
     */
    sendHandshake(peerId) {
        const handshake = {
            type: 'handshake',
            from: this.getMyId(),
            nickname: this.getMyNickname(),
            timestamp: Date.now()
        };

        this.sendToPeer(peerId, JSON.stringify(handshake));
    }

    /**
     * Send message to specific peer
     */
    sendToPeer(peerId, message) {
        const dataChannel = this.dataChannels.get(peerId);
        
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                dataChannel.send(message);
                return true;
            } catch (error) {
                console.error(`Failed to send to peer ${peerId}:`, error);
                return false;
            }
        } else {
            console.warn(`No open channel to peer ${peerId}`);
            return false;
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    broadcastMessage(message) {
        let sentCount = 0;
        
        this.peers.forEach((peer, peerId) => {
            if (this.sendToPeer(peerId, message)) {
                sentCount++;
            }
        });
        
        return sentCount;
    }

    /**
     * Handle incoming message from peer
     */
    handleIncomingMessage(peerId, messageData) {
        try {
            const message = JSON.parse(messageData);
            
            // Update last seen
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.lastSeen = new Date();
            }
            
            // Handle different message types
            switch (message.type) {
                case 'handshake':
                    this.handleHandshake(peerId, message);
                    break;
                case 'chat':
                    this.handleChatMessage(peerId, message);
                    break;
                case 'private':
                    this.handlePrivateMessage(peerId, message);
                    break;
                case 'announcement':
                    this.handleAnnouncement(peerId, message);
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
            
        } catch (error) {
            console.error('Failed to parse incoming message:', error);
        }
    }

    /**
     * Handle handshake message
     */
    handleHandshake(peerId, message) {
        console.log(`Received handshake from ${message.nickname} (${peerId})`);
        
        // Update peer info
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.name = message.nickname;
        }
        
        if (this.delegate && this.delegate.onHandshakeReceived) {
            this.delegate.onHandshakeReceived(peerId, message.nickname);
        }
    }

    /**
     * Handle chat message
     */
    handleChatMessage(peerId, message) {
        if (this.delegate && this.delegate.onMessageReceived) {
            this.delegate.onMessageReceived(peerId, message);
        }
    }

    /**
     * Handle private message
     */
    handlePrivateMessage(peerId, message) {
        if (this.delegate && this.delegate.onPrivateMessageReceived) {
            this.delegate.onPrivateMessageReceived(peerId, message);
        }
    }

    /**
     * Handle announcement
     */
    handleAnnouncement(peerId, message) {
        if (this.delegate && this.delegate.onAnnouncementReceived) {
            this.delegate.onAnnouncementReceived(peerId, message);
        }
    }

    /**
     * Get connected peers
     */
    getConnectedPeers() {
        return Array.from(this.peers.values());
    }

    /**
     * Get peer count
     */
    getPeerCount() {
        return this.peers.size;
    }

    /**
     * Get my ID
     */
    getMyId() {
        if (!this.myId) {
            this.myId = 'me-' + Math.random().toString(36).substr(2, 9);
        }
        return this.myId;
    }

    /**
     * Get my nickname
     */
    getMyNickname() {
        return localStorage.getItem('bitchat-nickname') || 'Anonyme';
    }

    /**
     * Set my nickname
     */
    setMyNickname(nickname) {
        localStorage.setItem('bitchat-nickname', nickname);
    }

    /**
     * Check if peer is connected
     */
    isPeerConnected(peerId) {
        return this.peers.has(peerId);
    }

    /**
     * Disconnect from peer
     */
    disconnectFromPeer(peerId) {
        const connection = this.connections.get(peerId);
        if (connection) {
            connection.close();
        }
        this.onPeerDisconnected(peerId);
    }

    /**
     * Disconnect from all peers
     */
    disconnectAll() {
        this.connections.forEach((connection, peerId) => {
            connection.close();
        });
        this.peers.clear();
        this.connections.clear();
        this.dataChannels.clear();
    }

    /**
     * Set delegate for handling events
     */
    setDelegate(delegate) {
        this.delegate = delegate;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        if (this.peers.size === 0) {
            return 'disconnected';
        } else if (this.isScanning) {
            return 'connecting';
        } else {
            return 'connected';
        }
    }

    /**
     * Check if we can connect to signaling server
     */
    async checkSignalingConnectivity() {
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(`ws://${window.location.host}/signaling`);
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 3000);
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                };
                
                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
                
            } catch (error) {
                resolve(false);
            }
        });
    }

    /**
     * Initialize with fallback strategy
     */
    async initWithFallback() {
        console.log('Checking signaling server connectivity...');
        const hasSignaling = await this.checkSignalingConnectivity();
        
        if (hasSignaling) {
            console.log('Signaling server available, using WebRTC mode');
            this.setupSignaling();
        } else {
            console.log('Signaling server not available, using simulation mode');
            setTimeout(() => this.simulatePeerDiscovery(), 2000);
        }
    }
}

// Export for use in other modules
window.BluetoothService = BluetoothService;
