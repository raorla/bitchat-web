/**
 * Chat Service - Main chat logic and message handling
 */

class ChatService {
    constructor() {
        this.bluetoothService = new BluetoothService();
        this.cryptoService = new CryptoService();
        this.crossTabService = new CrossTabService();
        this.channels = new Map();
        this.currentChannel = '#général';
        this.messages = new Map(); // Messages per channel
        this.privateMessages = new Map(); // Private messages per peer
        this.blockedPeers = new Set();
        this.channelPasswords = new Map();
        this.myNickname = this.loadNickname();
        this.delegate = null;
        this.commands = new Map();
        this.isInitialized = false;
        
        this.init();
        this.setupCommands();
    }

    async init() {
        console.log('Initializing chat service...');
        
        // Setup Bluetooth service delegate
        this.bluetoothService.setDelegate({
            onPeerDiscovered: this.onPeerDiscovered.bind(this),
            onPeerConnected: this.onPeerConnected.bind(this),
            onPeerDisconnected: this.onPeerDisconnected.bind(this),
            onMessageReceived: this.onMessageReceived.bind(this),
            onPrivateMessageReceived: this.onPrivateMessageReceived.bind(this),
            onHandshakeReceived: this.onHandshakeReceived.bind(this),
            onScanningStarted: this.onScanningStarted.bind(this),
            onScanningStopped: this.onScanningStopped.bind(this)
        });

        try {
            // Initialize crypto service
            await this.cryptoService.init();
            console.log('Crypto service ready');

            // Initialize cross-tab service
            await this.crossTabService.init();
            console.log('Cross-tab service ready');

            // Setup cross-tab message handling
            this.crossTabService.setDelegate({
                onMessageReceived: this.onCrossTabMessage.bind(this)
            });

            // Setup default channel
            this.setupDefaultChannel();
            console.log('Default channel setup');

            // Start Bluetooth services
            await this.bluetoothService.startScanning();
            console.log('Bluetooth scanning started');
            
            await this.bluetoothService.startAdvertising();
            console.log('Bluetooth advertising started');

            this.isInitialized = true;
            console.log('Chat service initialized successfully');

            // Notify delegate
            if (this.delegate && this.delegate.onInitialized) {
                this.delegate.onInitialized();
            }
        } catch (error) {
            console.error('Failed to initialize chat service:', error);
            // Still notify delegate so UI can show error
            if (this.delegate && this.delegate.onInitialized) {
                this.delegate.onInitialized();
            }
        }
    }

    /**
     * Setup default channel
     */
    setupDefaultChannel() {
        this.channels.set('#général', {
            name: '#général',
            users: new Set([this.myNickname]),
            hasPassword: false,
            owner: this.myNickname,
            created: new Date(),
            messageRetention: false
        });

        this.messages.set('#général', [
            {
                id: 'welcome-1',
                type: 'system',
                content: 'Bienvenue sur BitChat! Tapez /help pour voir les commandes disponibles.',
                timestamp: new Date(),
                channel: '#général'
            }
        ]);
    }

    /**
     * Setup chat commands
     */
    setupCommands() {
        this.commands.set('/help', this.cmdHelp.bind(this));
        this.commands.set('/h', this.cmdHelp.bind(this));
        this.commands.set('/join', this.cmdJoin.bind(this));
        this.commands.set('/j', this.cmdJoin.bind(this));
        this.commands.set('/leave', this.cmdLeave.bind(this));
        this.commands.set('/l', this.cmdLeave.bind(this));
        this.commands.set('/msg', this.cmdMessage.bind(this));
        this.commands.set('/m', this.cmdMessage.bind(this));
        this.commands.set('/who', this.cmdWho.bind(this));
        this.commands.set('/w', this.cmdWho.bind(this));
        this.commands.set('/channels', this.cmdChannels.bind(this));
        this.commands.set('/clear', this.cmdClear.bind(this));
        this.commands.set('/nick', this.cmdNick.bind(this));
        this.commands.set('/block', this.cmdBlock.bind(this));
        this.commands.set('/unblock', this.cmdUnblock.bind(this));
        this.commands.set('/pass', this.cmdPassword.bind(this));
        this.commands.set('/me', this.cmdMe.bind(this));
    }

    /**
     * Load nickname from storage
     */
    loadNickname() {
        const saved = localStorage.getItem('bitchat-nickname');
        if (saved) {
            return saved;
        }
        
        // Generate random nickname
        const adjectives = ['Swift', 'Clever', 'Brave', 'Quiet', 'Bold', 'Wise', 'Fast', 'Cool'];
        const animals = ['Fox', 'Wolf', 'Eagle', 'Tiger', 'Falcon', 'Lion', 'Bear', 'Hawk'];
        const nickname = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                        animals[Math.floor(Math.random() * animals.length)] + 
                        Math.floor(Math.random() * 100);
        
        this.setNickname(nickname);
        return nickname;
    }

    /**
     * Set nickname
     */
    setNickname(nickname) {
        const oldNickname = this.myNickname;
        this.myNickname = nickname;
        localStorage.setItem('bitchat-nickname', nickname);
        this.bluetoothService.setMyNickname(nickname);

        // Update channel user lists
        this.channels.forEach(channel => {
            if (channel.users.has(oldNickname)) {
                channel.users.delete(oldNickname);
                channel.users.add(nickname);
            }
        });

        if (this.delegate && this.delegate.onNicknameChanged) {
            this.delegate.onNicknameChanged(nickname);
        }
    }

    /**
     * Send message to current channel
     */
    async sendMessage(content) {
        if (!content.trim()) return false;

        // Check if it's a command
        if (content.startsWith('/')) {
            return this.handleCommand(content);
        }

        // Send regular message
        return this.sendChannelMessage(this.currentChannel, content);
    }

    /**
     * Send message to specific channel
     */
    async sendChannelMessage(channel, content) {
        try {
            const messageId = this.cryptoService.generateMessageId();
            const timestamp = new Date();

            const message = {
                id: messageId,
                type: 'chat',
                channel: channel,
                from: this.myNickname,
                content: content,
                timestamp: timestamp.toISOString()
            };

            // Add to local messages
            const localMessage = {
                ...message,
                timestamp: timestamp,
                own: true
            };
            this.addMessage(channel, localMessage);

            // Broadcast to other tabs
            this.crossTabService.sendMessage({
                type: 'chat-message',
                data: localMessage
            });

            // Broadcast to peers
            const messageJson = JSON.stringify(message);
            const sentCount = this.bluetoothService.broadcastMessage(messageJson);

            console.log(`Sent message to ${sentCount} peers and broadcast to other tabs`);
            return true;

        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }

    /**
     * Send private message to peer
     */
    async sendPrivateMessage(targetNickname, content) {
        try {
            const messageId = this.cryptoService.generateMessageId();
            const timestamp = new Date();

            const message = {
                id: messageId,
                type: 'private',
                from: this.myNickname,
                to: targetNickname,
                content: content,
                timestamp: timestamp.toISOString()
            };

            // Add to local private messages
            this.addPrivateMessage(targetNickname, {
                ...message,
                timestamp: timestamp,
                own: true
            });

            // Find peer and send
            const peers = this.bluetoothService.getConnectedPeers();
            const targetPeer = peers.find(p => p.name === targetNickname);
            
            if (targetPeer) {
                const messageJson = JSON.stringify(message);
                const sent = this.bluetoothService.sendToPeer(targetPeer.id, messageJson);
                
                if (sent) {
                    console.log(`Sent private message to ${targetNickname}`);
                    return true;
                } else {
                    throw new Error('Failed to send to peer');
                }
            } else {
                throw new Error('Peer not found');
            }

        } catch (error) {
            console.error('Failed to send private message:', error);
            
            // Add error message
            this.addSystemMessage(this.currentChannel, 
                `Impossible d'envoyer le message privé à ${targetNickname}: ${error.message}`);
            
            return false;
        }
    }

    /**
     * Handle incoming command
     */
    handleCommand(input) {
        const parts = input.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        const handler = this.commands.get(command);
        if (handler) {
            return handler(args);
        } else {
            this.addSystemMessage(this.currentChannel, `Commande inconnue: ${command}`);
            return false;
        }
    }

    /**
     * Command: /help
     */
    cmdHelp(args) {
        const helpText = `
Commandes disponibles:
/join #canal ou /j #canal - Rejoindre un canal
/leave ou /l - Quitter le canal actuel
/msg @nom message ou /m @nom message - Message privé
/who ou /w - Lister les utilisateurs connectés
/channels - Lister tous les canaux
/clear - Effacer les messages du canal
/nick nouveau_nom - Changer de pseudo
/block @nom - Bloquer un utilisateur
/unblock @nom - Débloquer un utilisateur
/pass [mot_de_passe] - Définir/changer le mot de passe du canal
/me action - Action (ex: /me danse)
/help ou /h - Afficher cette aide
        `.trim();
        
        this.addSystemMessage(this.currentChannel, helpText);
        return true;
    }

    /**
     * Command: /join
     */
    cmdJoin(args) {
        if (args.length === 0) {
            this.addSystemMessage(this.currentChannel, 'Usage: /join #canal');
            return false;
        }

        let channelName = args[0];
        if (!channelName.startsWith('#')) {
            channelName = '#' + channelName;
        }

        return this.joinChannel(channelName);
    }

    /**
     * Command: /leave
     */
    cmdLeave(args) {
        if (this.currentChannel === '#général') {
            this.addSystemMessage(this.currentChannel, 'Impossible de quitter le canal général');
            return false;
        }

        return this.leaveChannel(this.currentChannel);
    }

    /**
     * Command: /msg
     */
    cmdMessage(args) {
        if (args.length < 2) {
            this.addSystemMessage(this.currentChannel, 'Usage: /msg @utilisateur message');
            return false;
        }

        let target = args[0];
        if (target.startsWith('@')) {
            target = target.substring(1);
        }

        const message = args.slice(1).join(' ');
        return this.sendPrivateMessage(target, message);
    }

    /**
     * Command: /who
     */
    cmdWho(args) {
        const channel = this.channels.get(this.currentChannel);
        if (channel) {
            const users = Array.from(channel.users).join(', ');
            this.addSystemMessage(this.currentChannel, `Utilisateurs dans ${this.currentChannel}: ${users}`);
        }

        const peers = this.bluetoothService.getConnectedPeers();
        if (peers.length > 0) {
            const peerNames = peers.map(p => p.name).join(', ');
            this.addSystemMessage(this.currentChannel, `Pairs connectés: ${peerNames}`);
        } else {
            this.addSystemMessage(this.currentChannel, 'Aucun pair connecté');
        }

        return true;
    }

    /**
     * Command: /channels
     */
    cmdChannels(args) {
        const channelList = Array.from(this.channels.keys()).join(', ');
        this.addSystemMessage(this.currentChannel, `Canaux disponibles: ${channelList}`);
        return true;
    }

    /**
     * Command: /clear
     */
    cmdClear(args) {
        this.clearMessages(this.currentChannel);
        return true;
    }

    /**
     * Command: /nick
     */
    cmdNick(args) {
        if (args.length === 0) {
            this.addSystemMessage(this.currentChannel, 'Usage: /nick nouveau_nom');
            return false;
        }

        const newNickname = args[0];
        if (newNickname.length > 32) {
            this.addSystemMessage(this.currentChannel, 'Le pseudo ne peut pas dépasser 32 caractères');
            return false;
        }

        this.setNickname(newNickname);
        this.addSystemMessage(this.currentChannel, `Pseudo changé en: ${newNickname}`);
        return true;
    }

    /**
     * Command: /block
     */
    cmdBlock(args) {
        if (args.length === 0) {
            const blocked = Array.from(this.blockedPeers);
            if (blocked.length === 0) {
                this.addSystemMessage(this.currentChannel, 'Aucun utilisateur bloqué');
            } else {
                this.addSystemMessage(this.currentChannel, `Utilisateurs bloqués: ${blocked.join(', ')}`);
            }
            return true;
        }

        let target = args[0];
        if (target.startsWith('@')) {
            target = target.substring(1);
        }

        this.blockedPeers.add(target);
        this.addSystemMessage(this.currentChannel, `${target} a été bloqué`);
        return true;
    }

    /**
     * Command: /unblock
     */
    cmdUnblock(args) {
        if (args.length === 0) {
            this.addSystemMessage(this.currentChannel, 'Usage: /unblock @utilisateur');
            return false;
        }

        let target = args[0];
        if (target.startsWith('@')) {
            target = target.substring(1);
        }

        if (this.blockedPeers.delete(target)) {
            this.addSystemMessage(this.currentChannel, `${target} a été débloqué`);
        } else {
            this.addSystemMessage(this.currentChannel, `${target} n'était pas bloqué`);
        }
        return true;
    }

    /**
     * Command: /pass
     */
    cmdPassword(args) {
        const channel = this.channels.get(this.currentChannel);
        if (!channel || channel.owner !== this.myNickname) {
            this.addSystemMessage(this.currentChannel, 'Seul le propriétaire du canal peut définir un mot de passe');
            return false;
        }

        if (args.length === 0) {
            // Remove password
            this.channelPasswords.delete(this.currentChannel);
            channel.hasPassword = false;
            this.addSystemMessage(this.currentChannel, 'Mot de passe du canal supprimé');
        } else {
            // Set password
            const password = args.join(' ');
            this.channelPasswords.set(this.currentChannel, password);
            channel.hasPassword = true;
            this.addSystemMessage(this.currentChannel, 'Mot de passe du canal défini');
        }

        return true;
    }

    /**
     * Command: /me
     */
    cmdMe(args) {
        if (args.length === 0) {
            this.addSystemMessage(this.currentChannel, 'Usage: /me action');
            return false;
        }

        const action = args.join(' ');
        const content = `* ${this.myNickname} ${action}`;
        return this.sendChannelMessage(this.currentChannel, content);
    }

    /**
     * Join channel
     */
    joinChannel(channelName) {
        // Check if channel exists and has password
        const existingChannel = this.channels.get(channelName);
        if (existingChannel && existingChannel.hasPassword) {
            const password = this.channelPasswords.get(channelName);
            if (!password) {
                // Need to ask for password
                if (this.delegate && this.delegate.onPasswordRequired) {
                    this.delegate.onPasswordRequired(channelName);
                    return true;
                }
            }
        }

        // Create or join channel
        if (!this.channels.has(channelName)) {
            this.channels.set(channelName, {
                name: channelName,
                users: new Set([this.myNickname]),
                hasPassword: false,
                owner: this.myNickname,
                created: new Date(),
                messageRetention: false
            });

            this.messages.set(channelName, []);
        } else {
            existingChannel.users.add(this.myNickname);
        }

        // Switch to channel
        this.currentChannel = channelName;
        this.addSystemMessage(channelName, `Vous avez rejoint ${channelName}`);

        if (this.delegate && this.delegate.onChannelChanged) {
            this.delegate.onChannelChanged(channelName);
        }

        return true;
    }

    /**
     * Join channel with password
     */
    joinChannelWithPassword(channelName, password) {
        const channel = this.channels.get(channelName);
        if (channel && channel.hasPassword) {
            const correctPassword = this.channelPasswords.get(channelName);
            if (correctPassword !== password) {
                this.addSystemMessage(this.currentChannel, 'Mot de passe incorrect');
                return false;
            }
        }

        return this.joinChannel(channelName);
    }

    /**
     * Leave channel
     */
    leaveChannel(channelName) {
        const channel = this.channels.get(channelName);
        if (channel) {
            channel.users.delete(this.myNickname);
            
            if (channel.users.size === 0 && channelName !== '#général') {
                this.channels.delete(channelName);
                this.messages.delete(channelName);
            }
        }

        // Switch to general channel
        this.currentChannel = '#général';
        this.addSystemMessage('#général', `Vous avez quitté ${channelName}`);

        if (this.delegate && this.delegate.onChannelChanged) {
            this.delegate.onChannelChanged('#général');
        }

        return true;
    }

    /**
     * Add message to channel
     */
    addMessage(channel, message) {
        if (!this.messages.has(channel)) {
            this.messages.set(channel, []);
        }

        this.messages.get(channel).push(message);

        // Limit message history
        const channelMessages = this.messages.get(channel);
        if (channelMessages.length > 1000) {
            channelMessages.splice(0, channelMessages.length - 1000);
        }

        if (this.delegate && this.delegate.onMessageAdded) {
            this.delegate.onMessageAdded(channel, message);
        }
    }

    /**
     * Add system message
     */
    addSystemMessage(channel, content) {
        this.addMessage(channel, {
            id: this.cryptoService.generateMessageId(),
            type: 'system',
            content: content,
            timestamp: new Date(),
            channel: channel
        });
    }

    /**
     * Add private message
     */
    addPrivateMessage(peer, message) {
        if (!this.privateMessages.has(peer)) {
            this.privateMessages.set(peer, []);
        }

        this.privateMessages.get(peer).push(message);

        if (this.delegate && this.delegate.onPrivateMessageAdded) {
            this.delegate.onPrivateMessageAdded(peer, message);
        }
    }

    /**
     * Clear messages from channel
     */
    clearMessages(channel) {
        this.messages.set(channel, []);
        
        if (this.delegate && this.delegate.onMessagesCleared) {
            this.delegate.onMessagesCleared(channel);
        }
    }

    /**
     * Get messages for channel
     */
    getMessages(channel) {
        return this.messages.get(channel) || [];
    }

    /**
     * Get channels
     */
    getChannels() {
        return Array.from(this.channels.values());
    }

    /**
     * Get current channel
     */
    getCurrentChannel() {
        return this.currentChannel;
    }

    /**
     * Get connected peers
     */
    getConnectedPeers() {
        return this.bluetoothService.getConnectedPeers();
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return this.bluetoothService.getConnectionStatus();
    }

    /**
     * Set delegate
     */
    setDelegate(delegate) {
        this.delegate = delegate;
    }

    /**
     * Handle cross-tab messages
     */
    onCrossTabMessage(message) {
        console.log('Received cross-tab message:', message);
        
        switch (message.type) {
            case 'chat-message':
                // Add message to local storage and notify UI
                this.addMessage(message.data.channel, message.data);
                break;
                
            case 'channel-joined':
                // Sync channel state
                this.addChannel(message.data.channel, message.data.info);
                break;
                
            case 'peer-connected':
                // Sync peer state
                this.onPeerConnected(message.data.peer);
                break;
                
            case 'peer-disconnected':
                // Sync peer state
                this.onPeerDisconnected(message.data.peer);
                break;
        }
    }

    // Bluetooth Service Event Handlers

    onPeerDiscovered(peerId, nickname, rssi) {
        console.log(`Peer discovered: ${nickname} (${peerId})`);
        
        if (this.delegate && this.delegate.onPeerDiscovered) {
            this.delegate.onPeerDiscovered(peerId, nickname, rssi);
        }
    }

    onPeerConnected(peerId, nickname) {
        console.log(`Peer connected: ${nickname} (${peerId})`);
        
        this.addSystemMessage(this.currentChannel, `${nickname} s'est connecté`);
        
        if (this.delegate && this.delegate.onPeerConnected) {
            this.delegate.onPeerConnected(peerId, nickname);
        }
    }

    onPeerDisconnected(peerId) {
        console.log(`Peer disconnected: ${peerId}`);
        
        if (this.delegate && this.delegate.onPeerDisconnected) {
            this.delegate.onPeerDisconnected(peerId);
        }
    }

    onMessageReceived(peerId, message) {
        // Check if sender is blocked
        if (this.blockedPeers.has(message.from)) {
            return;
        }

        // Add received message
        const localMessage = {
            ...message,
            timestamp: new Date(message.timestamp),
            own: false
        };
        this.addMessage(message.channel, localMessage);

        // Broadcast to other tabs
        this.crossTabService.sendMessage({
            type: 'chat-message',
            data: localMessage
        });
    }

    onPrivateMessageReceived(peerId, message) {
        // Check if sender is blocked
        if (this.blockedPeers.has(message.from)) {
            return;
        }

        // Add received private message
        this.addPrivateMessage(message.from, {
            ...message,
            timestamp: new Date(message.timestamp),
            own: false
        });
    }

    onHandshakeReceived(peerId, nickname) {
        console.log(`Handshake received from: ${nickname}`);
    }

    onScanningStarted() {
        if (this.delegate && this.delegate.onScanningStarted) {
            this.delegate.onScanningStarted();
        }
    }

    onScanningStopped() {
        if (this.delegate && this.delegate.onScanningStopped) {
            this.delegate.onScanningStopped();
        }
    }
}

// Export for use in other modules
window.ChatService = ChatService;
