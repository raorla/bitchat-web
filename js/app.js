/**
 * Main Application Entry Point
 */

class BitChatApp {
    constructor() {
        this.uiController = null;
        this.init();
    }

    async init() {
        console.log('BitChat PWA starting...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    start() {
        try {
            // Verify required classes are available
            if (typeof LoadingManager === 'undefined') {
                throw new Error('LoadingManager not loaded');
            }
            if (typeof CryptoService === 'undefined') {
                throw new Error('CryptoService not loaded');
            }
            if (typeof BluetoothService === 'undefined') {
                throw new Error('BluetoothService not loaded');
            }
            if (typeof ChatService === 'undefined') {
                throw new Error('ChatService not loaded');
            }
            if (typeof UIController === 'undefined') {
                throw new Error('UIController not loaded');
            }
            if (typeof CrossTabService === 'undefined') {
                throw new Error('CrossTabService not loaded');
            }
            
            console.log('All required classes loaded successfully');
            
            // Initialize UI Controller (which will initialize other services with loading screen)
            this.uiController = new UIController();
            
            // Setup global error handler
            this.setupErrorHandler();
            
            // Setup service worker update handler
            this.setupServiceWorkerUpdate();
            
            console.log('BitChat PWA started successfully');
            
        } catch (error) {
            console.error('Failed to start BitChat PWA:', error);
            this.showFatalError(error);
        }
    }

    /**
     * Setup global error handler
     */
    setupErrorHandler() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason);
        });
    }

    /**
     * Handle application errors
     */
    handleError(error) {
        if (this.uiController) {
            this.uiController.showToast('Erreur de l\'application: ' + error.message, 'error', 5000);
        } else {
            alert('Erreur de l\'application: ' + error.message);
        }
    }

    /**
     * Show fatal error
     */
    showFatalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            color: #ff0000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: monospace;
            font-size: 16px;
            z-index: 10000;
            padding: 20px;
            text-align: center;
        `;
        
        errorDiv.innerHTML = `
            <div>
                <h2>Erreur Fatale BitChat</h2>
                <p>L'application n'a pas pu démarrer:</p>
                <pre>${error.message}</pre>
                <button onclick="location.reload()" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #ff0000;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Recharger</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }

    /**
     * Setup service worker update handler
     */
    setupServiceWorkerUpdate() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (this.uiController) {
                    this.uiController.showToast('Nouvelle version disponible, rechargement...', 'info');
                    setTimeout(() => location.reload(), 2000);
                }
            });
        }
    }
}

// Application configuration
const APP_CONFIG = {
    version: '1.0.0',
    name: 'BitChat PWA',
    description: 'Messagerie sécurisée et décentralisée P2P',
    author: 'BitChat Team',
    repository: 'https://github.com/bitchat/bitchat',
    
    // Feature flags
    features: {
        webBluetooth: 'bluetooth' in navigator,
        webRTC: 'RTCPeerConnection' in window,
        notifications: 'Notification' in window,
        serviceWorker: 'serviceWorker' in navigator,
        crypto: 'crypto' in window && 'subtle' in crypto
    },
    
    // Network configuration
    network: {
        maxPeers: 10,
        connectionTimeout: 30000,
        heartbeatInterval: 5000,
        messageTimeout: 10000
    },
    
    // Security configuration
    security: {
        maxMessageLength: 1000,
        maxNicknameLength: 32,
        maxChannelNameLength: 32,
        encryptionAlgorithm: 'AES-GCM',
        keyDerivationIterations: 100000
    },
    
    // UI configuration
    ui: {
        maxMessageHistory: 1000,
        toastDuration: 3000,
        commandHistorySize: 50,
        autoScrollThreshold: 100
    }
};

// Utility functions
const Utils = {
    /**
     * Generate unique ID
     */
    generateId: () => Math.random().toString(36).substr(2, 9),
    
    /**
     * Format timestamp
     */
    formatTime: (date) => date.toLocaleTimeString(),
    
    /**
     * Format date
     */
    formatDate: (date) => date.toLocaleDateString(),
    
    /**
     * Sanitize HTML
     */
    sanitizeHtml: (html) => {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },
    
    /**
     * Validate nickname
     */
    validateNickname: (nickname) => {
        return nickname && 
               nickname.length <= APP_CONFIG.security.maxNicknameLength &&
               /^[a-zA-Z0-9_-]+$/.test(nickname);
    },
    
    /**
     * Validate channel name
     */
    validateChannelName: (name) => {
        return name && 
               name.startsWith('#') &&
               name.length <= APP_CONFIG.security.maxChannelNameLength &&
               /^#[a-zA-Z0-9_-]+$/.test(name);
    },
    
    /**
     * Detect if mobile device
     */
    isMobile: () => /Mobi|Android/i.test(navigator.userAgent),
    
    /**
     * Get device info
     */
    getDeviceInfo: () => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
    }),
    
    /**
     * Request notification permission
     */
    requestNotificationPermission: async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            return await Notification.requestPermission();
        }
        return Notification.permission;
    },
    
    /**
     * Show native notification
     */
    showNotification: (title, options = {}) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: 'bitchat',
                ...options
            });
        }
    },
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('Clipboard API not available, falling back to execCommand');
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    },
    
    /**
     * Download data as file
     */
    downloadAsFile: (data, filename, type = 'text/plain') => {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Throttle function calls
     */
    throttle: (func, delay) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, delay);
            }
        };
    },
    
    /**
     * Debounce function calls
     */
    debounce: (func, delay) => {
        let debounceTimer;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }
};

// Performance monitoring
const Performance = {
    marks: new Map(),
    
    mark: (name) => {
        Performance.marks.set(name, performance.now());
    },
    
    measure: (name, startMark) => {
        const start = Performance.marks.get(startMark);
        if (start) {
            const duration = performance.now() - start;
            console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
            return duration;
        }
    },
    
    getMemoryUsage: () => {
        if ('memory' in performance) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
};

// Export globals
window.APP_CONFIG = APP_CONFIG;
window.Utils = Utils;
window.Performance = Performance;

// Start the application
Performance.mark('app-start');
const app = new BitChatApp();
window.bitchatApp = app;

// Log application info
console.log('%cBitChat PWA v' + APP_CONFIG.version, 'font-size: 16px; font-weight: bold; color: #00ff00;');
console.log('Features:', APP_CONFIG.features);
console.log('Device:', Utils.getDeviceInfo());

// Performance logging
setTimeout(() => {
    Performance.measure('App Startup', 'app-start');
    const memory = Performance.getMemoryUsage();
    if (memory) {
        console.log(`Memory usage: ${memory.used}MB / ${memory.total}MB (limit: ${memory.limit}MB)`);
    }
}, 1000);
