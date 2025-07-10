/**
 * Loading Manager - Handles loading screen and progress
 */

class LoadingManager {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingText = document.getElementById('loading-text');
        this.progressFill = document.getElementById('progress-fill');
        this.progressSteps = document.getElementById('progress-steps');
        this.app = document.getElementById('app');
        
        this.currentStep = 0;
        this.steps = [
            { text: '🔐 Initialisation du chiffrement...', duration: 800 },
            { text: '📡 Configuration Bluetooth/WebRTC...', duration: 1200 },
            { text: '💬 Démarrage du service de chat...', duration: 600 },
            { text: '🎨 Chargement de l\'interface...', duration: 400 }
        ];
    }

    /**
     * Start loading sequence
     */
    async startLoading() {
        console.log('Loading: Starting loading sequence');
        
        // Ensure loading screen is visible
        this.loadingScreen.classList.remove('hidden');
        this.app.classList.add('app-hidden');
        
        // Run loading steps
        for (let i = 0; i < this.steps.length; i++) {
            await this.runStep(i);
        }
        
        // Complete loading
        await this.completeLoading();
    }

    /**
     * Run a specific loading step
     */
    async runStep(stepIndex) {
        const step = this.steps[stepIndex];
        
        // Update text
        this.loadingText.textContent = step.text;
        
        // Update progress bar
        const progress = ((stepIndex + 1) / this.steps.length) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // Update step indicators
        const stepElements = this.progressSteps.querySelectorAll('.step');
        
        // Mark previous steps as completed
        for (let i = 0; i < stepIndex; i++) {
            stepElements[i].classList.remove('active');
            stepElements[i].classList.add('completed');
        }
        
        // Mark current step as active
        if (stepElements[stepIndex]) {
            stepElements[stepIndex].classList.add('active');
        }
        
        // Wait for step duration
        await this.wait(step.duration);
        
        console.log(`Loading: Completed step ${stepIndex + 1}/${this.steps.length}: ${step.text}`);
    }

    /**
     * Complete loading and show app
     */
    async completeLoading() {
        // Mark all steps as completed
        const stepElements = this.progressSteps.querySelectorAll('.step');
        stepElements.forEach(step => {
            step.classList.remove('active');
            step.classList.add('completed');
        });
        
        // Final text and progress
        this.loadingText.textContent = '✅ BitChat prêt !';
        this.progressFill.style.width = '100%';
        
        // Wait a bit before hiding
        await this.wait(500);
        
        // Hide loading screen and show app
        this.loadingScreen.classList.add('hidden');
        this.app.classList.remove('app-hidden');
        
        console.log('Loading: Sequence completed, app is ready');
    }

    /**
     * Update loading progress manually
     */
    updateProgress(percentage, text) {
        if (text) {
            this.loadingText.textContent = text;
        }
        this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }

    /**
     * Show error state
     */
    showError(errorMessage) {
        this.loadingText.textContent = `❌ Erreur: ${errorMessage}`;
        this.loadingText.style.color = 'var(--error-color)';
        
        // Stop spinner
        const spinner = document.querySelector('.spinner');
        if (spinner) {
            spinner.style.animation = 'none';
        }
    }

    /**
     * Hide loading screen immediately
     */
    hide() {
        this.loadingScreen.classList.add('hidden');
        this.app.classList.remove('app-hidden');
    }

    /**
     * Show loading screen
     */
    show() {
        this.loadingScreen.classList.remove('hidden');
        this.app.classList.add('app-hidden');
    }

    /**
     * Wait for specified milliseconds
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Simulate loading with realistic steps
     */
    async simulateRealisticLoading() {
        console.log('Loading: Starting realistic simulation');
        
        // Step 1: Crypto initialization
        await this.runStep(0);
        
        // Step 2: Bluetooth/WebRTC setup (longer)
        this.loadingText.textContent = '📡 Recherche de serveurs de signaling...';
        await this.wait(600);
        this.loadingText.textContent = '📡 Configuration WebRTC...';
        await this.wait(400);
        await this.runStep(1);
        
        // Step 3: Chat service
        await this.runStep(2);
        
        // Step 4: UI initialization
        await this.runStep(3);
        
        // Complete
        await this.completeLoading();
    }
}

// Export for use in other modules
window.LoadingManager = LoadingManager;
