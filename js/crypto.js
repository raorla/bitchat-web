/**
 * Crypto Service - Web version of EncryptionService
 * Handles all cryptographic operations for BitChat PWA
 */

class CryptoService {
    constructor() {
        this.keyPairs = new Map(); // Store key pairs for peers
        this.sessionKeys = new Map(); // Store session keys
        this.myKeyPair = null;
        this.init();
    }

    async init() {
        try {
            // Generate our own key pair
            await this.generateKeyPair();
            console.log('Crypto service initialized');
        } catch (error) {
            console.error('Failed to initialize crypto service:', error);
        }
    }

    /**
     * Generate X25519 key pair for ECDH
     */
    async generateKeyPair() {
        try {
            this.myKeyPair = await crypto.subtle.generateKey(
                {
                    name: "ECDH",
                    namedCurve: "P-256" // Web Crypto doesn't support X25519, using P-256
                },
                true,
                ["deriveKey"]
            );
            
            console.log('Generated new key pair');
            return this.myKeyPair;
        } catch (error) {
            console.error('Failed to generate key pair:', error);
            throw error;
        }
    }

    /**
     * Export public key for sharing
     */
    async exportPublicKey() {
        if (!this.myKeyPair) {
            throw new Error('No key pair available');
        }

        try {
            const exported = await crypto.subtle.exportKey("raw", this.myKeyPair.publicKey);
            return new Uint8Array(exported);
        } catch (error) {
            console.error('Failed to export public key:', error);
            throw error;
        }
    }

    /**
     * Import peer's public key
     */
    async importPublicKey(publicKeyBytes) {
        try {
            const publicKey = await crypto.subtle.importKey(
                "raw",
                publicKeyBytes,
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                false,
                []
            );
            return publicKey;
        } catch (error) {
            console.error('Failed to import public key:', error);
            throw error;
        }
    }

    /**
     * Derive shared secret using ECDH
     */
    async deriveSharedSecret(peerPublicKey) {
        if (!this.myKeyPair) {
            throw new Error('No key pair available');
        }

        try {
            const sharedSecret = await crypto.subtle.deriveKey(
                {
                    name: "ECDH",
                    public: peerPublicKey
                },
                this.myKeyPair.privateKey,
                {
                    name: "AES-GCM",
                    length: 256
                },
                false,
                ["encrypt", "decrypt"]
            );
            
            return sharedSecret;
        } catch (error) {
            console.error('Failed to derive shared secret:', error);
            throw error;
        }
    }

    /**
     * Generate AES key from password (for channels)
     */
    async deriveKeyFromPassword(password, salt) {
        try {
            // Import password as key material
            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(password),
                "PBKDF2",
                false,
                ["deriveKey"]
            );

            // Derive AES key using PBKDF2
            const key = await crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                keyMaterial,
                {
                    name: "AES-GCM",
                    length: 256
                },
                false,
                ["encrypt", "decrypt"]
            );

            return key;
        } catch (error) {
            console.error('Failed to derive key from password:', error);
            throw error;
        }
    }

    /**
     * Encrypt message with AES-GCM
     */
    async encryptMessage(message, key) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            // Generate random IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                data
            );

            // Return IV + encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encrypted), iv.length);
            
            return result;
        } catch (error) {
            console.error('Failed to encrypt message:', error);
            throw error;
        }
    }

    /**
     * Decrypt message with AES-GCM
     */
    async decryptMessage(encryptedData, key) {
        try {
            // Extract IV and encrypted data
            const iv = encryptedData.slice(0, 12);
            const encrypted = encryptedData.slice(12);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Failed to decrypt message:', error);
            throw error;
        }
    }

    /**
     * Generate Ed25519 signature (using ECDSA P-256 as fallback)
     */
    async signMessage(message) {
        try {
            if (!this.signKeyPair) {
                // Generate signing key pair
                this.signKeyPair = await crypto.subtle.generateKey(
                    {
                        name: "ECDSA",
                        namedCurve: "P-256"
                    },
                    true,
                    ["sign", "verify"]
                );
            }

            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            const signature = await crypto.subtle.sign(
                {
                    name: "ECDSA",
                    hash: "SHA-256"
                },
                this.signKeyPair.privateKey,
                data
            );

            return new Uint8Array(signature);
        } catch (error) {
            console.error('Failed to sign message:', error);
            throw error;
        }
    }

    /**
     * Verify Ed25519 signature
     */
    async verifySignature(message, signature, publicKey) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            const isValid = await crypto.subtle.verify(
                {
                    name: "ECDSA",
                    hash: "SHA-256"
                },
                publicKey,
                signature,
                data
            );

            return isValid;
        } catch (error) {
            console.error('Failed to verify signature:', error);
            return false;
        }
    }

    /**
     * Generate random bytes
     */
    generateRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Generate message ID
     */
    generateMessageId() {
        const randomBytes = this.generateRandomBytes(16);
        return Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Hash data using SHA-256
     */
    async hash(data) {
        const encoder = new TextEncoder();
        const dataBytes = typeof data === 'string' ? encoder.encode(data) : data;
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        return new Uint8Array(hashBuffer);
    }

    /**
     * Store session key for peer
     */
    storeSessionKey(peerId, key) {
        this.sessionKeys.set(peerId, key);
    }

    /**
     * Get session key for peer
     */
    getSessionKey(peerId) {
        return this.sessionKeys.get(peerId);
    }

    /**
     * Generate salt for password derivation
     */
    generateSalt() {
        return this.generateRandomBytes(32);
    }

    /**
     * Encode data to base64
     */
    toBase64(data) {
        return btoa(String.fromCharCode(...data));
    }

    /**
     * Decode base64 to data
     */
    fromBase64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

// Export for use in other modules
window.CryptoService = CryptoService;
