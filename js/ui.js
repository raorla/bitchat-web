/**
 * UI Controller - Handles all user interface interactions
 */

class UIController {
    constructor() {
        this.chatService = null;
        this.loadingManager = new LoadingManager();
        this.elements = {};
        this.settings = this.loadSettings();
        this.commandHistory = [];
        this.commandHistoryIndex = -1;
        this.currentSuggestionIndex = -1;
        this.tripleClickCount = 0;
        this.tripleClickTimer = null;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.applySettings();
        this.showBluetoothWarning();
        
        // Start loading sequence
        this.startInitialization();
    }

    /**
     * Start initialization with loading screen
     */
    async startInitialization() {
        try {
            // Start loading animation
            await this.loadingManager.startLoading();
            
            // Initialize chat service
            await this.initChatService();
            
        } catch (error) {
            console.error('UI: Initialization failed:', error);
            this.loadingManager.showError('Échec de l\'initialisation');
            
            // Still try to show the app after a delay
            setTimeout(() => {
                this.loadingManager.hide();
                this.showToast('Initialisation partielle - certaines fonctionnalités peuvent ne pas fonctionner', 'warning', 5000);
            }, 2000);
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Header
            sidebarToggle: document.getElementById('sidebar-toggle'),
            appLogo: document.getElementById('app-logo'),
            peerCount: document.getElementById('peer-count'),
            statusIndicator: document.getElementById('status-indicator'),
            settingsBtn: document.getElementById('settings-btn'),
            
            // Sidebar
            sidebar: document.getElementById('sidebar'),
            nicknameInput: document.getElementById('nickname-input'),
            channelsList: document.getElementById('channels-list'),
            peersList: document.getElementById('peers-list'),
            
            // Chat
            currentChannel: document.getElementById('current-channel'),
            messagesContainer: document.getElementById('messages-container'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            clearChat: document.getElementById('clear-chat'),
            commandSuggestions: document.getElementById('command-suggestions'),
            
            // Modals
            passwordModal: document.getElementById('password-modal'),
            passwordChannel: document.getElementById('password-channel'),
            passwordInput: document.getElementById('password-input'),
            passwordOk: document.getElementById('password-ok'),
            passwordCancel: document.getElementById('password-cancel'),
            
            settingsModal: document.getElementById('settings-modal'),
            settingsClose: document.getElementById('settings-close'),
            autoConnect: document.getElementById('auto-connect'),
            allowDiscovery: document.getElementById('allow-discovery'),
            showTimestamps: document.getElementById('show-timestamps'),
            enableNotifications: document.getElementById('enable-notifications'),
            
            // Other
            toastContainer: document.getElementById('toast-container'),
            bluetoothWarning: document.getElementById('bluetooth-warning'),
            dismissWarning: document.getElementById('dismiss-warning')
        };
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Header events
        this.elements.sidebarToggle.addEventListener('click', this.toggleSidebar.bind(this));
        this.elements.appLogo.addEventListener('click', this.handleLogoClick.bind(this));
        this.elements.settingsBtn.addEventListener('click', this.showSettings.bind(this));
        
        // Sidebar events
        this.elements.nicknameInput.addEventListener('change', this.handleNicknameChange.bind(this));
        this.elements.nicknameInput.addEventListener('blur', this.handleNicknameChange.bind(this));
        
        // Chat events
        this.elements.messageInput.addEventListener('keydown', this.handleInputKeydown.bind(this));
        this.elements.messageInput.addEventListener('input', this.handleInputChange.bind(this));
        this.elements.sendBtn.addEventListener('click', this.sendMessage.bind(this));
        this.elements.clearChat.addEventListener('click', this.clearChat.bind(this));
        
        // Modal events
        this.elements.passwordOk.addEventListener('click', this.handlePasswordOk.bind(this));
        this.elements.passwordCancel.addEventListener('click', this.hidePasswordModal.bind(this));
        this.elements.settingsClose.addEventListener('click', this.hideSettings.bind(this));
        
        // Settings events
        this.elements.autoConnect.addEventListener('change', this.handleSettingChange.bind(this));
        this.elements.allowDiscovery.addEventListener('change', this.handleSettingChange.bind(this));
        this.elements.showTimestamps.addEventListener('change', this.handleSettingChange.bind(this));
        this.elements.enableNotifications.addEventListener('change', this.handleSettingChange.bind(this));
        
        // Warning events
        this.elements.dismissWarning.addEventListener('click', this.hideBluetoothWarning.bind(this));
        
        // Click outside to close
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        
        // Escape key to close modals
        document.addEventListener('keydown', this.handleDocumentKeydown.bind(this));
        
        // Window events
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    /**
     * Initialize chat service
     */
    async initChatService() {
        console.log('UI: Initializing chat service...');
        
        try {
            this.chatService = new ChatService();
            console.log('UI: Chat service created');
            
            // Set up chat service delegate
            this.chatService.setDelegate({
                onInitialized: this.onChatServiceInitialized.bind(this),
                onMessageAdded: this.onMessageAdded.bind(this),
                onChannelChanged: this.onChannelChanged.bind(this),
                onPeerConnected: this.onPeerConnected.bind(this),
                onPeerDisconnected: this.onPeerDisconnected.bind(this),
                onNicknameChanged: this.onNicknameChanged.bind(this),
                onPasswordRequired: this.onPasswordRequired.bind(this),
                onMessagesCleared: this.onMessagesCleared.bind(this),
                onScanningStarted: this.onScanningStarted.bind(this),
                onScanningStopped: this.onScanningStopped.bind(this)
            });
            
            console.log('UI: Chat service delegate set');

            // Initialize UI with chat service data
            this.updateNickname();
            this.updateConnectionStatus();
            this.updateChannelsList();
            this.updatePeersList();
            
            console.log('UI: Initial UI update complete');
            
        } catch (error) {
            console.error('UI: Failed to initialize chat service:', error);
            this.showToast('Erreur d\'initialisation du service de chat', 'error');
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const defaults = {
            autoConnect: true,
            allowDiscovery: true,
            showTimestamps: true,
            enableNotifications: true,
            sidebarOpen: false
        };

        try {
            const saved = localStorage.getItem('bitchat-settings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return defaults;
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('bitchat-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    /**
     * Apply settings to UI
     */
    applySettings() {
        this.elements.autoConnect.checked = this.settings.autoConnect;
        this.elements.allowDiscovery.checked = this.settings.allowDiscovery;
        this.elements.showTimestamps.checked = this.settings.showTimestamps;
        this.elements.enableNotifications.checked = this.settings.enableNotifications;
        
        if (this.settings.sidebarOpen) {
            this.elements.sidebar.classList.add('open');
        }
    }

    /**
     * Handle logo triple-click for emergency wipe
     */
    handleLogoClick() {
        this.tripleClickCount++;
        
        if (this.tripleClickTimer) {
            clearTimeout(this.tripleClickTimer);
        }
        
        this.tripleClickTimer = setTimeout(() => {
            this.tripleClickCount = 0;
        }, 1000);
        
        if (this.tripleClickCount === 3) {
            this.emergencyWipe();
            this.tripleClickCount = 0;
        }
    }

    /**
     * Emergency wipe - clear all data
     */
    emergencyWipe() {
        if (confirm('ATTENTION: Ceci va effacer toutes vos données BitChat. Continuer?')) {
            // Clear all localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('bitchat-')) {
                    localStorage.removeItem(key);
                }
            });
            
            // Reload page
            location.reload();
        }
    }

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        this.elements.sidebar.classList.toggle('open');
        this.settings.sidebarOpen = this.elements.sidebar.classList.contains('open');
        this.saveSettings();
    }

    /**
     * Handle nickname change
     */
    handleNicknameChange() {
        const nickname = this.elements.nicknameInput.value.trim();
        if (nickname && this.chatService) {
            this.chatService.setNickname(nickname);
        }
    }

    /**
     * Handle input keydown
     */
    handleInputKeydown(event) {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                if (event.shiftKey) {
                    // Allow line break with Shift+Enter
                    const input = event.target;
                    const start = input.selectionStart;
                    const end = input.selectionEnd;
                    input.value = input.value.substring(0, start) + '\n' + input.value.substring(end);
                    input.selectionStart = input.selectionEnd = start + 1;
                } else {
                    this.sendMessage();
                }
                break;
                
            case 'ArrowUp':
                if (this.commandHistory.length > 0) {
                    event.preventDefault();
                    this.navigateCommandHistory(-1);
                }
                break;
                
            case 'ArrowDown':
                if (this.commandHistory.length > 0) {
                    event.preventDefault();
                    this.navigateCommandHistory(1);
                }
                break;
                
            case 'Tab':
                if (this.elements.commandSuggestions.classList.contains('show')) {
                    event.preventDefault();
                    this.selectCommandSuggestion();
                }
                break;
                
            case 'Escape':
                this.hideCommandSuggestions();
                break;
        }
    }

    /**
     * Handle input change
     */
    handleInputChange(event) {
        const value = event.target.value;
        
        if (value.startsWith('/')) {
            this.showCommandSuggestions(value);
        } else {
            this.hideCommandSuggestions();
        }
    }

    /**
     * Navigate command history
     */
    navigateCommandHistory(direction) {
        if (direction < 0) {
            // Up arrow
            if (this.commandHistoryIndex < this.commandHistory.length - 1) {
                this.commandHistoryIndex++;
            }
        } else {
            // Down arrow
            if (this.commandHistoryIndex > -1) {
                this.commandHistoryIndex--;
            }
        }
        
        if (this.commandHistoryIndex >= 0) {
            this.elements.messageInput.value = this.commandHistory[this.commandHistory.length - 1 - this.commandHistoryIndex];
        } else {
            this.elements.messageInput.value = '';
        }
    }

    /**
     * Show command suggestions
     */
    showCommandSuggestions(input) {
        const commands = [
            '/help', '/join', '/leave', '/msg', '/who', '/channels', 
            '/clear', '/nick', '/block', '/unblock', '/pass', '/me'
        ];
        
        const filtered = commands.filter(cmd => cmd.startsWith(input.toLowerCase()));
        
        if (filtered.length > 0) {
            this.elements.commandSuggestions.innerHTML = filtered
                .map((cmd, index) => `<div class="suggestion-item${index === 0 ? ' selected' : ''}" data-command="${cmd}">${cmd}</div>`)
                .join('');
            
            this.elements.commandSuggestions.classList.add('show');
            this.currentSuggestionIndex = 0;
            
            // Bind click events
            this.elements.commandSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.elements.messageInput.value = item.dataset.command + ' ';
                    this.hideCommandSuggestions();
                    this.elements.messageInput.focus();
                });
            });
        } else {
            this.hideCommandSuggestions();
        }
    }

    /**
     * Hide command suggestions
     */
    hideCommandSuggestions() {
        this.elements.commandSuggestions.classList.remove('show');
        this.currentSuggestionIndex = -1;
    }

    /**
     * Select command suggestion
     */
    selectCommandSuggestion() {
        const selected = this.elements.commandSuggestions.querySelector('.suggestion-item.selected');
        if (selected) {
            this.elements.messageInput.value = selected.dataset.command + ' ';
            this.hideCommandSuggestions();
            this.elements.messageInput.focus();
        }
    }

    /**
     * Send message
     */
    async sendMessage() {
        const content = this.elements.messageInput.value.trim();
        if (!content || !this.chatService) return;
        
        // Add to command history if it's a command
        if (content.startsWith('/')) {
            this.commandHistory.unshift(content);
            if (this.commandHistory.length > 50) {
                this.commandHistory.pop();
            }
            this.commandHistoryIndex = -1;
        }
        
        // Clear input
        this.elements.messageInput.value = '';
        this.hideCommandSuggestions();
        
        // Send message
        const success = await this.chatService.sendMessage(content);
        
        if (!success) {
            this.showToast('Échec de l\'envoi du message', 'error');
        }
    }

    /**
     * Clear chat
     */
    clearChat() {
        if (this.chatService) {
            this.chatService.clearMessages(this.chatService.getCurrentChannel());
        }
    }

    /**
     * Show password modal
     */
    showPasswordModal(channelName) {
        this.elements.passwordChannel.textContent = channelName;
        this.elements.passwordInput.value = '';
        this.elements.passwordModal.classList.add('show');
        this.elements.passwordInput.focus();
    }

    /**
     * Hide password modal
     */
    hidePasswordModal() {
        this.elements.passwordModal.classList.remove('show');
    }

    /**
     * Handle password OK
     */
    handlePasswordOk() {
        const channelName = this.elements.passwordChannel.textContent;
        const password = this.elements.passwordInput.value;
        
        if (this.chatService && this.chatService.joinChannelWithPassword(channelName, password)) {
            this.hidePasswordModal();
        } else {
            this.showToast('Mot de passe incorrect', 'error');
        }
    }

    /**
     * Show settings modal
     */
    showSettings() {
        this.elements.settingsModal.classList.add('show');
    }

    /**
     * Hide settings modal
     */
    hideSettings() {
        this.elements.settingsModal.classList.remove('show');
    }

    /**
     * Handle setting change
     */
    handleSettingChange(event) {
        const setting = event.target.id;
        const value = event.target.checked;
        
        this.settings[setting] = value;
        this.saveSettings();
        
        // Apply setting immediately if needed
        if (setting === 'showTimestamps') {
            this.refreshMessages();
        }
    }

    /**
     * Show Bluetooth warning
     */
    showBluetoothWarning() {
        if (!localStorage.getItem('bitchat-bluetooth-warning-dismissed')) {
            this.elements.bluetoothWarning.classList.remove('hidden');
        }
    }

    /**
     * Hide Bluetooth warning
     */
    hideBluetoothWarning() {
        this.elements.bluetoothWarning.classList.add('hidden');
        localStorage.setItem('bitchat-bluetooth-warning-dismissed', 'true');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, duration);
    }

    /**
     * Update nickname in UI
     */
    updateNickname() {
        if (this.chatService) {
            this.elements.nicknameInput.value = this.chatService.myNickname;
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus() {
        if (!this.chatService) return;
        
        const status = this.chatService.getConnectionStatus();
        const peerCount = this.chatService.getConnectedPeers().length;
        
        this.elements.peerCount.textContent = `${peerCount} pair${peerCount !== 1 ? 's' : ''} connecté${peerCount !== 1 ? 's' : ''}`;
        
        this.elements.statusIndicator.className = 'status-indicator ' + status;
        
        // Update periodically
        setTimeout(() => this.updateConnectionStatus(), 2000);
    }

    /**
     * Update channels list
     */
    updateChannelsList() {
        if (!this.chatService) return;
        
        const channels = this.chatService.getChannels();
        const currentChannel = this.chatService.getCurrentChannel();
        
        this.elements.channelsList.innerHTML = channels.map(channel => `
            <div class="channel-item${channel.name === currentChannel ? ' active' : ''}" data-channel="${channel.name}">
                <div class="channel-info">
                    <div class="channel-name">${channel.name}</div>
                    <div class="channel-users">${channel.users.size} utilisateur${channel.users.size !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `).join('');
        
        // Bind click events
        this.elements.channelsList.querySelectorAll('.channel-item').forEach(item => {
            item.addEventListener('click', () => {
                const channelName = item.dataset.channel;
                if (this.chatService) {
                    this.chatService.joinChannel(channelName);
                }
            });
        });
    }

    /**
     * Update peers list
     */
    updatePeersList() {
        if (!this.chatService) return;
        
        const peers = this.chatService.getConnectedPeers();
        
        this.elements.peersList.innerHTML = peers.map(peer => `
            <div class="peer-item" data-peer-id="${peer.id}">
                <div class="peer-info">
                    <div class="peer-name">${peer.name}</div>
                    <div class="peer-status online">En ligne</div>
                </div>
            </div>
        `).join('');
        
        // Update periodically
        setTimeout(() => this.updatePeersList(), 5000);
    }

    /**
     * Add message to UI
     */
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}${message.own ? ' own' : ''}`;
        
        if (message.type !== 'system') {
            const header = document.createElement('div');
            header.className = 'message-header';
            
            if (message.from) {
                const sender = document.createElement('span');
                sender.className = 'message-sender';
                sender.textContent = message.from;
                header.appendChild(sender);
            }
            
            if (this.settings.showTimestamps) {
                const time = document.createElement('span');
                time.className = 'message-time';
                time.textContent = message.timestamp.toLocaleTimeString();
                header.appendChild(time);
            }
            
            messageElement.appendChild(header);
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message.content;
        messageElement.appendChild(content);
        
        this.elements.messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    /**
     * Refresh all messages
     */
    refreshMessages() {
        if (!this.chatService) return;
        
        const currentChannel = this.chatService.getCurrentChannel();
        const messages = this.chatService.getMessages(currentChannel);
        
        // Clear existing messages
        this.elements.messagesContainer.innerHTML = '';
        
        // Add all messages
        messages.forEach(message => this.addMessageToUI(message));
    }

    /**
     * Handle document click
     */
    handleDocumentClick(event) {
        // Close sidebar if clicking outside
        if (this.elements.sidebar.classList.contains('open') && 
            !this.elements.sidebar.contains(event.target) && 
            !this.elements.sidebarToggle.contains(event.target)) {
            this.elements.sidebar.classList.remove('open');
            this.settings.sidebarOpen = false;
            this.saveSettings();
        }
        
        // Close command suggestions
        if (!this.elements.commandSuggestions.contains(event.target) &&
            !this.elements.messageInput.contains(event.target)) {
            this.hideCommandSuggestions();
        }
    }

    /**
     * Handle document keydown
     */
    handleDocumentKeydown(event) {
        if (event.key === 'Escape') {
            this.hidePasswordModal();
            this.hideSettings();
            this.hideCommandSuggestions();
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close sidebar on small screens
        if (window.innerWidth <= 768 && this.elements.sidebar.classList.contains('open')) {
            this.elements.sidebar.classList.remove('open');
            this.settings.sidebarOpen = false;
            this.saveSettings();
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload() {
        // Cleanup
        if (this.chatService && this.chatService.bluetoothService) {
            this.chatService.bluetoothService.disconnectAll();
        }
    }

    // Chat Service Event Handlers

    onChatServiceInitialized() {
        console.log('UI: Chat service initialized');
        this.updateNickname();
        this.updateChannelsList();
        this.refreshMessages();
        this.showToast('BitChat initialisé avec succès', 'success');
    }

    onMessageAdded(channel, message) {
        console.log('UI: Message added to channel', channel, message);
        const currentChannel = this.chatService.getCurrentChannel();
        if (channel === currentChannel) {
            this.addMessageToUI(message);
        }
        
        // Show notification for private messages
        if (message.type === 'private' && !message.own && this.settings.enableNotifications) {
            this.showToast(`Message privé de ${message.from}`, 'info');
        }
    }

    onChannelChanged(channel) {
        console.log('UI: Channel changed to', channel);
        this.elements.currentChannel.textContent = channel;
        this.updateChannelsList();
        this.refreshMessages();
    }

    onPeerConnected(peerId, nickname) {
        console.log('UI: Peer connected', peerId, nickname);
        this.updatePeersList();
        this.updateConnectionStatus();
        this.showToast(`${nickname} connecté`, 'success');
    }

    onPeerDisconnected(peerId) {
        console.log('UI: Peer disconnected', peerId);
        this.updatePeersList();
        this.updateConnectionStatus();
    }

    onNicknameChanged(nickname) {
        this.updateNickname();
    }

    onPasswordRequired(channelName) {
        this.showPasswordModal(channelName);
    }

    onMessagesCleared(channel) {
        const currentChannel = this.chatService.getCurrentChannel();
        if (channel === currentChannel) {
            this.refreshMessages();
        }
    }

    onScanningStarted() {
        this.elements.statusIndicator.classList.add('connecting');
    }

    onScanningStopped() {
        this.elements.statusIndicator.classList.remove('connecting');
    }
}

// Export for use in other modules
window.UIController = UIController;
