/**
 * Simple test script to verify BitChat functionality
 */

// Test functions
const BitChatTest = {
    async runAllTests() {
        console.log('=== BitChat Test Suite ===');
        
        const tests = [
            this.testCryptoService,
            this.testBluetoothService,
            this.testChatService,
            this.testUIController
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                await test.call(this);
                console.log(`✓ ${test.name} PASSED`);
                passed++;
            } catch (error) {
                console.error(`✗ ${test.name} FAILED:`, error);
                failed++;
            }
        }
        
        console.log(`=== Test Results: ${passed} passed, ${failed} failed ===`);
        return { passed, failed };
    },
    
    async testCryptoService() {
        const crypto = new CryptoService();
        await crypto.init();
        
        // Test key generation
        const keyPair = crypto.myKeyPair;
        if (!keyPair) throw new Error('Key pair not generated');
        
        // Test message encryption/decryption
        const message = 'Test message';
        const key = await crypto.deriveKeyFromPassword('password', crypto.generateSalt());
        const encrypted = await crypto.encryptMessage(message, key);
        const decrypted = await crypto.decryptMessage(encrypted, key);
        
        if (decrypted !== message) {
            throw new Error('Encryption/decryption failed');
        }
        
        return true;
    },
    
    async testBluetoothService() {
        const bluetooth = new BluetoothService();
        await bluetooth.init();
        
        // Test peer simulation
        const initialPeers = bluetooth.discoveredPeers.size;
        bluetooth.simulatePeerDiscovery();
        
        // Wait a bit for simulation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (bluetooth.discoveredPeers.size <= initialPeers) {
            throw new Error('Peer discovery simulation failed');
        }
        
        return true;
    },
    
    async testChatService() {
        const chat = new ChatService();
        
        // Test command parsing
        const result = chat.handleCommand('/help');
        if (!result) throw new Error('Command handling failed');
        
        // Test channel management
        const initialChannels = chat.channels.size;
        chat.joinChannel('#test');
        
        if (chat.channels.size !== initialChannels + 1) {
            throw new Error('Channel creation failed');
        }
        
        return true;
    },
    
    async testUIController() {
        const ui = new UIController();
        
        // Test element caching
        if (!ui.elements.messageInput) {
            throw new Error('UI elements not cached properly');
        }
        
        // Test settings
        if (!ui.settings) {
            throw new Error('Settings not loaded');
        }
        
        return true;
    }
};

// Auto-run tests when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => BitChatTest.runAllTests(), 2000);
    });
} else {
    setTimeout(() => BitChatTest.runAllTests(), 2000);
}

// Make available globally
window.BitChatTest = BitChatTest;
