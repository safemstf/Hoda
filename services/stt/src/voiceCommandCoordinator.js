// services/stt/src/voiceCommandCoordinator.js
// Single source of truth for voice command system lifecycle
// Manages initialization, state, and communication between components

import { MicrophoneManager } from './microphoneManager.js';
import { SpeechRecognitionService } from './speechRecognitionService.js';
import { CommandNormalizer } from './commandNormalizer.js';

export class VoiceCommandCoordinator {
    constructor(config = {}) {
        // Singleton pattern - prevent multiple instances
        if (VoiceCommandCoordinator.instance) {
            console.warn('[Coordinator] Returning existing instance');
            return VoiceCommandCoordinator.instance;
        }
        VoiceCommandCoordinator.instance = this;

        // Configuration
        this.config = {
            modelSize: config.modelSize || 'tiny-en-q5_1',
            modelUrl: config.modelUrl || 'src/models/ggml-tiny.en.bin',
            workerUrl: config.workerUrl || 'src/worker/speech-worker.js',
            bundleUrl: config.bundleUrl || 'src/vender/bin/libstream.js',
            sampleRate: config.sampleRate || 16000,
            defaultConfidence: config.defaultConfidence || 0.92,
            language: config.language || 'en-US',
            allowAutoLoad: config.allowAutoLoad !== false
        };

        // Core state - single source of truth
        this.state = {
            // Permission state
            permissionStatus: 'unknown', // 'granted' | 'denied' | 'prompt' | 'unknown'
            
            // Initialization state
            isInitializing: false,
            isInitialized: false,
            modelLoaded: false,
            
            // Runtime state
            isListening: false,
            
            // Component instances (singletons managed by coordinator)
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
    // Public API - Main lifecycle methods
    // -------------------------------------------------------------------------

    /**
     * Initialize the entire voice command system
     * Single entry point - prevents duplicate initialization
     */
    async initialize() {
        // Guard: prevent concurrent initialization
        if (this.state.isInitializing) {
            console.log('[Coordinator] Already initializing, waiting...');
            return this._waitForInitialization();
        }

        // Guard: already initialized
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

            // Step 5: Initialize speech recognition (ONLY ONCE)
            if (!this.state.speechRecognition) {
                console.log('[Coordinator] Creating SpeechRecognitionService...');
                this._notifyStatus('initializing_speech', { message: 'Initializing speech recognition...' });
                
                this.state.speechRecognition = new SpeechRecognitionService(
                    this.state.micManager,
                    {
                        modelSize: this.config.modelSize,
                        modelUrl: this.config.modelUrl,
                        workerUrl: this.config.workerUrl,
                        bundleUrl: this.config.bundleUrl,
                        sampleRate: this.config.sampleRate,
                        defaultConfidence: this.config.defaultConfidence,
                        language: this.config.language,
                        allowAutoLoad: false
                    }
                );

                // Hook up speech callbacks to coordinator callbacks
                this._setupSpeechCallbacks();
            }

            // Step 6: Initialize command normalizer
            if (!this.state.commandNormalizer) {
                console.log('[Coordinator] Creating CommandNormalizer...');
                this.state.commandNormalizer = new CommandNormalizer();
            }

            // Step 7: Load model
            if (!this.state.modelLoaded) {
                console.log('[Coordinator] Loading speech model...');
                this._notifyStatus('loading_model', { 
                    message: 'Loading speech model...',
                    modelSize: this.config.modelSize 
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

    /**
     * Start listening for voice commands
     */
    async startListening() {
        // Ensure initialized
        if (!this.state.isInitialized) {
            console.log('[Coordinator] Not initialized, initializing first...');
            const success = await this.initialize();
            if (!success) {
                throw new Error('Failed to initialize before starting');
            }
        }

        // Guard: already listening
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

    /**
     * Stop listening for voice commands
     */
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

    /**
     * Destroy all components and reset state
     */
    destroy() {
        console.log('[Coordinator] Destroying...');

        try {
            // Stop listening if active
            if (this.state.isListening) {
                this.stopListening();
            }

            // Destroy speech recognition
            if (this.state.speechRecognition) {
                try {
                    this.state.speechRecognition.destroy();
                } catch (e) {
                    console.error('[Coordinator] Error destroying speech service:', e);
                }
                this.state.speechRecognition = null;
            }

            // Destroy microphone manager
            if (this.state.micManager) {
                try {
                    this.state.micManager.destroy();
                } catch (e) {
                    console.error('[Coordinator] Error destroying mic manager:', e);
                }
                this.state.micManager = null;
            }

            // Reset state
            this.state.isInitialized = false;
            this.state.modelLoaded = false;
            this.state.isListening = false;
            this.state.commandNormalizer = null;

            // Clear callbacks
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
                // Try to initialize mic which will trigger permission prompt
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
        // Forward transcript events
        this.state.speechRecognition.onTranscript((data) => {
            this.callbacks.onTranscript.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error('[Coordinator] Error in transcript callback:', e);
                }
            });
        });

        // Forward command events with normalization
        this.state.speechRecognition.onCommand((sttInput) => {
            // Normalize the command
            const normalized = this.state.commandNormalizer.normalize(sttInput.text);
            
            // Notify callbacks with both raw and normalized data
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

        // Forward error events
        this.state.speechRecognition.onError((errorData) => {
            this._notifyError(errorData);
        });

        // Forward status events
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

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(false);
            }, 30000);
        });
    }

    // -------------------------------------------------------------------------
    // Getters - Read-only access to state
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
    // Static method to get/create singleton
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