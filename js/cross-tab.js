/**
 * Cross-Tab Communication Service
 * Permet aux onglets de communiquer via BroadcastChannel + localStorage
 */

class CrossTabService {
    constructor() {
        this.channel = null;
        this.storageKey = 'bitchat-messages';
        this.peersKey = 'bitchat-peers';
        this.myTabId = this.generateTabId();
        this.delegates = new Set();
        this.isLeader = false;
        this.init();
    }

    init() {
        // Try BroadcastChannel first (modern browsers)
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('bitchat');
            this.channel.onmessage = this.handleBroadcastMessage.bind(this);
            console.log('CrossTab: Using BroadcastChannel');
        } else {
            // Fallback to localStorage events
            window.addEventListener('storage', this.handleStorageChange.bind(this));
            console.log('CrossTab: Using localStorage fallback');
        }

        // Listen for storage changes (works in all browsers)
        window.addEventListener('storage', this.handleStorageChange.bind(this));
        
        // Register this tab
        this.registerTab();
        
        // Elect leader tab
        this.electLeader();
        
        // Cleanup on unload
        window.addEventListener('beforeunload', () => {
            this.unregisterTab();
        });

        // Heartbeat to detect active tabs
        setInterval(() => {
            this.updateHeartbeat();
            this.cleanupDeadTabs();
        }, 5000);
    }

    generateTabId() {
        return 'tab-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    registerTab() {
        const tabs = this.getActiveTabs();
        tabs[this.myTabId] = {
            id: this.myTabId,
            created: Date.now(),
            lastSeen: Date.now(),
            nickname: localStorage.getItem('bitchat-nickname') || 'Anonyme'
        };
        localStorage.setItem('bitchat-tabs', JSON.stringify(tabs));
        
        console.log('CrossTab: Registered tab', this.myTabId);
        this.broadcastMessage({
            type: 'tab-joined',
            tabId: this.myTabId,
            data: tabs[this.myTabId]
        });
    }

    unregisterTab() {
        const tabs = this.getActiveTabs();
        delete tabs[this.myTabId];
        localStorage.setItem('bitchat-tabs', JSON.stringify(tabs));
        
        this.broadcastMessage({
            type: 'tab-left',
            tabId: this.myTabId
        });
    }

    updateHeartbeat() {
        const tabs = this.getActiveTabs();
        if (tabs[this.myTabId]) {
            tabs[this.myTabId].lastSeen = Date.now();
            localStorage.setItem('bitchat-tabs', JSON.stringify(tabs));
        }
    }

    cleanupDeadTabs() {
        const tabs = this.getActiveTabs();
        const now = Date.now();
        const timeout = 30000; // 30 seconds
        
        let changed = false;
        Object.keys(tabs).forEach(tabId => {
            if (now - tabs[tabId].lastSeen > timeout) {
                delete tabs[tabId];
                changed = true;
                console.log('CrossTab: Cleaned up dead tab', tabId);
            }
        });
        
        if (changed) {
            localStorage.setItem('bitchat-tabs', JSON.stringify(tabs));
            this.electLeader();
        }
    }

    electLeader() {
        const tabs = this.getActiveTabs();
        const tabIds = Object.keys(tabs).sort();
        
        const wasLeader = this.isLeader;
        this.isLeader = tabIds.length > 0 && tabIds[0] === this.myTabId;
        
        if (this.isLeader && !wasLeader) {
            console.log('CrossTab: Became leader tab');
            this.notifyDelegates('onBecameLeader');
        } else if (!this.isLeader && wasLeader) {
            console.log('CrossTab: Lost leader status');
            this.notifyDelegates('onLostLeader');
        }
    }

    getActiveTabs() {
        try {
            return JSON.parse(localStorage.getItem('bitchat-tabs') || '{}');
        } catch {
            return {};
        }
    }

    broadcastMessage(message) {
        message.from = this.myTabId;
        message.timestamp = Date.now();
        
        // Use BroadcastChannel if available
        if (this.channel) {
            this.channel.postMessage(message);
        }
        
        // Also use localStorage for compatibility
        const messages = this.getStoredMessages();
        messages.push(message);
        
        // Keep only last 100 messages
        if (messages.length > 100) {
            messages.splice(0, messages.length - 100);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(messages));
    }

    handleBroadcastMessage(event) {
        if (event.data.from !== this.myTabId) {
            this.processMessage(event.data);
        }
    }

    handleStorageChange(event) {
        if (event.key === this.storageKey && event.newValue) {
            try {
                const messages = JSON.parse(event.newValue);
                const lastMessage = messages[messages.length - 1];
                
                if (lastMessage && lastMessage.from !== this.myTabId) {
                    this.processMessage(lastMessage);
                }
            } catch (error) {
                console.error('CrossTab: Failed to parse storage message:', error);
            }
        } else if (event.key === 'bitchat-tabs') {
            this.electLeader();
        }
    }

    processMessage(message) {
        console.log('CrossTab: Received message', message);
        
        switch (message.type) {
            case 'chat-message':
                this.notifyDelegates('onChatMessage', message.data);
                break;
            case 'private-message':
                this.notifyDelegates('onPrivateMessage', message.data);
                break;
            case 'peer-update':
                this.notifyDelegates('onPeerUpdate', message.data);
                break;
            case 'channel-update':
                this.notifyDelegates('onChannelUpdate', message.data);
                break;
            case 'tab-joined':
                this.notifyDelegates('onTabJoined', message.data);
                break;
            case 'tab-left':
                this.notifyDelegates('onTabLeft', message.tabId);
                break;
        }
    }

    getStoredMessages() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch {
            return [];
        }
    }

    // Public API
    sendChatMessage(channel, message) {
        this.broadcastMessage({
            type: 'chat-message',
            data: {
                channel,
                message,
                from: localStorage.getItem('bitchat-nickname') || 'Anonyme'
            }
        });
    }

    sendPrivateMessage(to, message) {
        this.broadcastMessage({
            type: 'private-message',
            data: {
                to,
                message,
                from: localStorage.getItem('bitchat-nickname') || 'Anonyme'
            }
        });
    }

    updatePeerList(peers) {
        if (this.isLeader) {
            this.broadcastMessage({
                type: 'peer-update',
                data: peers
            });
        }
    }

    updateChannelList(channels) {
        this.broadcastMessage({
            type: 'channel-update',
            data: channels
        });
    }

    addDelegate(delegate) {
        this.delegates.add(delegate);
    }

    removeDelegate(delegate) {
        this.delegates.delete(delegate);
    }

    notifyDelegates(method, ...args) {
        this.delegates.forEach(delegate => {
            if (delegate[method]) {
                try {
                    delegate[method](...args);
                } catch (error) {
                    console.error(`CrossTab: Delegate error in ${method}:`, error);
                }
            }
        });
    }

    getTabCount() {
        return Object.keys(this.getActiveTabs()).length;
    }

    isMultiTab() {
        return this.getTabCount() > 1;
    }
}

// Export for use in other modules
window.CrossTabService = CrossTabService;
