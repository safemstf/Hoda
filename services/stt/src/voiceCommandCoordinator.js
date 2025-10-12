// services/stt/src/voiceCommandCoordinator.js
// Single source of truth for voice command system lifecycle
// Updated for main thread Whisper (no worker)

import { MicrophoneManager } from './microphoneManager.js';
import { SpeechRecognitionService } from './speechRecognitionService.js';
import { CommandNormalizer } from './commandNormalizer.js';

export class VoiceCommandCoordinator {
    constructor(config = {}) {
        // Singleton pattern
        if (VoiceCommandCoordinator.instance) {
            console.warn('[Coordinator] Returning existing instance');
            return VoiceCommandCoordinator.instance;
        }
        VoiceCommandCoordinator.instance = this;

        // Configuration (Web Speech API - no workers needed!)
        this.config = {
            defaultConfidence: config.defaultConfidence || 0.92,
            language: config.language || 'en-US',
            continuous: config.continuous !== false,
            interimResults: config.interimResults !== false
        };

        // Core state
        this.state = {
            permissionStatus: 'unknown',
            isInitializing: false,
            isInitialized: false,
            modelLoaded: false,
            isListening: false,
            micManager: null,
            speechRecognition: null,
            commandNormalizer: null
        };

        // Event callbacks
        this.callbacks = {
            onTranscript: [],
            onCommand: [],
            onError: [],
            onStatus: []
        };

        console.log('[Coordinator] Created with config:', this.config);
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    async initialize() {
        if (this.state.isInitializing) {
            console.log('[Coordinator] Already initializing, waiting...');
            return this._waitForInitialization();
        }

        if (this.state.isInitialized && this.state.speechRecognition) {
            console.log('[Coordinator] Already initialized');
            return true;
        }

        this.state.isInitializing = true;
        this._notifyStatus('initializing', { message: 'Initializing voice system...' });

        try {
            // Step 1: Check permission
            await this._updatePermissionStatus();
            
            if (this.state.permissionStatus === 'denied') {
                throw new Error('Microphone permission denied');
            }

            // Step 2: Initialize microphone manager
            if (!this.state.micManager) {
                console.log('[Coordinator] Creating MicrophoneManager...');
                this.state.micManager = new MicrophoneManager();
            }

            // Step 3: Request permission if needed
            const hasPermission = await this._ensurePermission();
            if (!hasPermission) {
                throw new Error('Failed to get microphone permission');
            }

            // Step 4: Initialize microphone
            if (!this.state.micManager.isInitialized) {
                console.log('[Coordinator] Initializing microphone...');
                this._notifyStatus('initializing_mic', { message: 'Initializing microphone...' });
                
                const micOk = await this.state.micManager.initialize();
                if (!micOk) {
                    throw new Error('Failed to initialize microphone');
                }
            }

            // Step 5: Initialize speech recognition (Web Speech API - much simpler!)
            if (!this.state.speechRecognition) {
                console.log('[Coordinator] Creating SpeechRecognitionService...');
                this._notifyStatus('initializing_speech', { message: 'Initializing speech recognition...' });
                
                this.state.speechRecognition = new SpeechRecognitionService(
                    this.state.micManager,
                    {
                        defaultConfidence: this.config.defaultConfidence,
                        language: this.config.language,
                        continuous: this.config.continuous,
                        interimResults: this.config.interimResults
                    }
                );

                // Hook up callbacks
                this._setupSpeechCallbacks();
            }

            // Step 6: Initialize command normalizer
            if (!this.state.commandNormalizer) {
                console.log('[Coordinator] Creating CommandNormalizer...');
                this.state.commandNormalizer = new CommandNormalizer();
            }

            // Step 7: Load/initialize speech recognition (instant with Web Speech API!)
            if (!this.state.modelLoaded) {
                console.log('[Coordinator] Initializing speech recognition...');
                this._notifyStatus('loading_model', { 
                    message: 'Initializing speech recognition...'
                });
                
                await this.state.speechRecognition.loadModel();
                this.state.modelLoaded = true;
            }

            // Success!
            this.state.isInitialized = true;
            this.state.isInitializing = false;
            
            console.log('[Coordinator] Initialization complete');
            this._notifyStatus('ready', { message: 'Ready to listen' });
            
            return true;

        } catch (err) {
            console.error('[Coordinator] Initialization failed:', err);
            this.state.isInitializing = false;
            this._notifyError({
                type: 'initialization_failed',
                message: err.message || 'Initialization failed'
            });
            return false;
        }
    }

    async startListening() {
        if (!this.state.isInitialized) {
            console.log('[Coordinator] Not initialized, initializing first...');
            const success = await this.initialize();
            if (!success) {
                throw new Error('Failed to initialize before starting');
            }
        }

        if (this.state.isListening) {
            console.log('[Coordinator] Already listening');
            return;
        }

        console.log('[Coordinator] Starting listening...');
        
        try {
            await this.state.speechRecognition.start();
            this.state.isListening = true;
            this._notifyStatus('listening', { message: 'Listening for commands...' });
        } catch (err) {
            console.error('[Coordinator] Failed to start listening:', err);
            this._notifyError({
                type: 'start_failed',
                message: err.message || 'Failed to start listening'
            });
            throw err;
        }
    }

    stopListening() {
        if (!this.state.isListening) {
            console.log('[Coordinator] Not listening, nothing to stop');
            return;
        }

        console.log('[Coordinator] Stopping listening...');
        
        try {
            this.state.speechRecognition.stop();
            this.state.isListening = false;
            this._notifyStatus('stopped', { message: 'Stopped listening' });
        } catch (err) {
            console.error('[Coordinator] Error stopping:', err);
            this._notifyError({
                type: 'stop_failed',
                message: err.message || 'Failed to stop listening'
            });
        }
    }

    destroy() {
        console.log('[Coordinator] Destroying...');

        try {
            if (this.state.isListening) {
                this.stopListening();
            }

            if (this.state.speechRecognition) {
                try {
                    this.state.speechRecognition.destroy();
                } catch (e) {
                    console.error('[Coordinator] Error destroying speech service:', e);
                }
                this.state.speechRecognition = null;
            }

            if (this.state.micManager) {
                try {
                    this.state.micManager.destroy();
                } catch (e) {
                    console.error('[Coordinator] Error destroying mic manager:', e);
                }
                this.state.micManager = null;
            }

            this.state.isInitialized = false;
            this.state.modelLoaded = false;
            this.state.isListening = false;
            this.state.commandNormalizer = null;

            this.callbacks = {
                onTranscript: [],
                onCommand: [],
                onError: [],
                onStatus: []
            };

            console.log('[Coordinator] Destroyed successfully');
        } catch (err) {
            console.error('[Coordinator] Error during destroy:', err);
        }
    }

    // -------------------------------------------------------------------------
    // Permission handling
    // -------------------------------------------------------------------------

    async _updatePermissionStatus() {
        try {
            if (!navigator.permissions || !navigator.permissions.query) {
                this.state.permissionStatus = 'unknown';
                return;
            }
            const result = await navigator.permissions.query({ name: 'microphone' });
            this.state.permissionStatus = result.state;
            console.log('[Coordinator] Permission status:', this.state.permissionStatus);
        } catch (err) {
            console.warn('[Coordinator] Could not query permission:', err);
            this.state.permissionStatus = 'unknown';
        }
    }

    async _ensurePermission() {
        await this._updatePermissionStatus();

        if (this.state.permissionStatus === 'granted') {
            return true;
        }

        if (this.state.permissionStatus === 'prompt') {
            console.log('[Coordinator] Requesting microphone permission...');
            this._notifyStatus('requesting_permission', { message: 'Requesting microphone permission...' });
            
            try {
                const success = await this.state.micManager.initialize();
                if (success) {
                    await this._updatePermissionStatus();
                    return this.state.permissionStatus === 'granted';
                }
            } catch (err) {
                console.error('[Coordinator] Permission request failed:', err);
                return false;
            }
        }

        return false;
    }

    async getPermissionStatus() {
        await this._updatePermissionStatus();
        return this.state.permissionStatus;
    }

    // -------------------------------------------------------------------------
    // Callback management
    // -------------------------------------------------------------------------

    onTranscript(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onTranscript.push(callback);
        }
    }

    onCommand(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onCommand.push(callback);
        }
    }

    onError(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onError.push(callback);
        }
    }

    onStatus(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onStatus.push(callback);
        }
    }

    // -------------------------------------------------------------------------
    // Internal methods
    // -------------------------------------------------------------------------

    _setupSpeechCallbacks() {
        this.state.speechRecognition.onTranscript((data) => {
            this.callbacks.onTranscript.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error('[Coordinator] Error in transcript callback:', e);
                }
            });
        });

        this.state.speechRecognition.onCommand((sttInput) => {
            const normalized = this.state.commandNormalizer.normalize(sttInput.text);
            
            this.callbacks.onCommand.forEach(cb => {
                try {
                    cb({
                        raw: sttInput,
                        normalized: normalized
                    });
                } catch (e) {
                    console.error('[Coordinator] Error in command callback:', e);
                }
            });
        });

        this.state.speechRecognition.onError((errorData) => {
            this._notifyError(errorData);
        });

        this.state.speechRecognition.onStatus((status, data) => {
            this._notifyStatus(status, data);
        });
    }

    _notifyError(errorData) {
        console.error('[Coordinator] Error:', errorData);
        this.callbacks.onError.forEach(cb => {
            try {
                cb(errorData);
            } catch (e) {
                console.error('[Coordinator] Error in error callback:', e);
            }
        });
    }

    _notifyStatus(status, data) {
        console.log('[Coordinator] Status:', status, data);
        this.callbacks.onStatus.forEach(cb => {
            try {
                cb(status, data);
            } catch (e) {
                console.error('[Coordinator] Error in status callback:', e);
            }
        });
    }

    _waitForInitialization() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this.state.isInitializing) {
                    clearInterval(checkInterval);
                    resolve(this.state.isInitialized);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(false);
            }, 30000);
        });
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    getState() {
        return {
            permissionStatus: this.state.permissionStatus,
            isInitializing: this.state.isInitializing,
            isInitialized: this.state.isInitialized,
            modelLoaded: this.state.modelLoaded,
            isListening: this.state.isListening
        };
    }

    getStats() {
        if (!this.state.speechRecognition) {
            return {
                totalCommands: 0,
                recognizedCommands: 0,
                failedCommands: 0,
                successRate: '0%',
                averageConfidencePercent: '0%'
            };
        }
        return this.state.speechRecognition.getStats();
    }

    getSuggestions(text) {
        if (!this.state.commandNormalizer) {
            return [];
        }
        return this.state.commandNormalizer.getSuggestions(text);
    }

    // -------------------------------------------------------------------------
    // Static methods
    // -------------------------------------------------------------------------

    static getInstance(config) {
        if (!VoiceCommandCoordinator.instance) {
            return new VoiceCommandCoordinator(config);
        }
        return VoiceCommandCoordinator.instance;
    }

    static resetInstance() {
        if (VoiceCommandCoordinator.instance) {
            VoiceCommandCoordinator.instance.destroy();
            VoiceCommandCoordinator.instance = null;
        }
    }
}