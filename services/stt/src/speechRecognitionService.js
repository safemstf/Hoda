// speechRecognitionService.js
// WASM-only SpeechRecognitionService wrapper for in-browser Whisper
// Refactored for single worker instance and clear state management

export class SpeechRecognitionService {
    constructor(micManager = null, options = {}) {
        this.micManager = micManager;

        // Detect if running in extension context
        const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL;

        // Validate required options
        if (!options.modelUrl) {
            throw new Error('modelUrl is required - specify path to ggml-tiny.en.bin');
        }
        if (!options.workerUrl) {
            throw new Error('workerUrl is required - specify path to speech-worker.js');
        }
        if (!options.bundleUrl) {
            throw new Error('bundleUrl is required - specify path to libstream.js');
        }

        // Helper function to resolve URLs (ensures absolute URLs for workers)
        const resolveUrl = (path) => {
            if (!path) return path;

            // Already absolute URL
            if (path.startsWith('http://') ||
                path.startsWith('https://') ||
                path.startsWith('blob:') ||
                path.startsWith('chrome-extension://') ||
                path.startsWith('moz-extension://')) {
                return path;
            }

            // In extension context, use chrome.runtime.getURL
            if (isExtension) {
                const resolved = chrome.runtime.getURL(path);
                console.log('[SpeechService] Resolved URL:', path, '→', resolved);
                return resolved;
            }

            // In standalone test pages, convert relative paths to absolute
            if (typeof window !== 'undefined' && window.location) {
                const url = new URL(path, window.location.href);
                console.log('[SpeechService] Resolved URL:', path, '→', url.href);
                return url.href;
            }

            return path;
        };

        // CRITICAL: Resolve URLs BEFORE creating opts object
        const resolvedModelUrl = resolveUrl(options.modelUrl);
        const resolvedWorkerUrl = resolveUrl(options.workerUrl);
        const resolvedBundleUrl = resolveUrl(options.bundleUrl);
        const resolvedWasmUrl = options.wasmUrl ? resolveUrl(options.wasmUrl) : null;

        // Build opts object - spread options FIRST, then override with resolved URLs
        this.opts = {
            ...options,
            modelSize: options.modelSize || 'tiny-en-q5_1',
            sampleRate: options.sampleRate || 16000,
            modelUrl: resolvedModelUrl,
            workerUrl: resolvedWorkerUrl,
            bundleUrl: resolvedBundleUrl,
            wasmUrl: resolvedWasmUrl,
            useWorker: options.useWorker !== false,
            defaultConfidence: typeof options.defaultConfidence === 'number' ? options.defaultConfidence : 0.92,
            allowAutoLoad: options.allowAutoLoad !== false,
            isExtension: isExtension,
            language: options.language || 'en-US'
        };

        // Callbacks
        this.onCommandCallbacks = [];
        this.onTranscriptCallbacks = [];
        this.onErrorCallbacks = [];
        this.onStatusCallbacks = [];

        // State management
        this.worker = null;
        this.modelLoaded = false;
        this.isListening = false;
        this.isLoadingModel = false; // Guard against concurrent loading

        // Audio processing
        this.audioContext = null;
        this.audioSource = null;
        this.audioProcessor = null;

        // Stats
        this.stats = {
            totalCommands: 0,
            recognizedCommands: 0,
            failedCommands: 0,
            averageConfidence: 0
        };

        console.log('[SpeechService] Initialized', {
            context: this.opts.isExtension ? 'extension' : 'standalone',
            modelUrl: this.opts.modelUrl,
            workerUrl: this.opts.workerUrl,
            bundleUrl: this.opts.bundleUrl
        });
    }

    // ---------- Worker Management ----------
    async _initWorker() {
        // Guard: prevent multiple worker creation
        if (this.worker) {
            console.log('[SpeechService] Worker already exists');
            return;
        }

        try {
            console.log('[SpeechService] Creating worker from:', this.opts.workerUrl);
            this.worker = new Worker(this.opts.workerUrl);

            this.worker.onmessage = (e) => {
                const { type, ...data } = e.data;
                
                switch (type) {
                    case 'transcript':
                        this._onLibraryTranscription(data.text, data.confidence, data.isFinal);
                        break;
                        
                    case 'status':
                        this._notifyStatus(data.status, data.data);
                        break;
                        
                    case 'progress':
                        this._notifyStatus('library_progress', { progress: data.progress });
                        break;
                        
                    case 'ready':
                        console.log('[SpeechService] Worker ready, model loaded');
                        this.modelLoaded = true;
                        this.isLoadingModel = false;
                        this._notifyStatus('model_loaded', {
                            modelSize: this.opts.modelSize,
                            modelUrl: this.opts.modelUrl
                        });
                        break;
                        
                    case 'error':
                        this._onLibraryError({ type: 'worker', message: data.message });
                        break;
                        
                    default:
                        // Ignore unknown messages (likely Emscripten internal)
                        break;
                }
            };

            this.worker.onerror = (err) => {
                console.error('[SpeechService] Worker error:', err);
                this._onLibraryError({
                    type: 'worker_error',
                    message: err.message || String(err)
                });
            };

            console.log('[SpeechService] Sending init to worker:', {
                bundleUrl: this.opts.bundleUrl,
                modelUrl: this.opts.modelUrl,
                modelSize: this.opts.modelSize
            });

            this.worker.postMessage({
                type: 'init',
                payload: {
                    bundleUrl: this.opts.bundleUrl,
                    modelUrl: this.opts.modelUrl,
                    modelSize: this.opts.modelSize,
                    sampleRate: this.opts.sampleRate
                }
            });
            
        } catch (err) {
            console.error('[SpeechService] Worker init failed:', err);
            this.isLoadingModel = false;
            this._onLibraryError({
                type: 'worker_init',
                message: err.message || String(err)
            });
            throw err;
        }
    }

    // ---------- Model Loading ----------
    async loadModel() {
        // Guard: already loaded
        if (this.modelLoaded) {
            console.log('[SpeechService] Model already loaded');
            return true;
        }

        // Guard: already loading
        if (this.isLoadingModel) {
            console.log('[SpeechService] Model already loading, waiting...');
            return this._waitForModelLoad();
        }

        this.isLoadingModel = true;

        try {
            if (this.opts.useWorker) {
                await this._initWorker();
            } else {
                throw new Error('Non-worker mode not implemented. Use worker mode in extension.');
            }

            return await this._waitForModelLoad();
            
        } catch (err) {
            this.isLoadingModel = false;
            throw err;
        }
    }

    _waitForModelLoad() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.isLoadingModel = false;
                reject(new Error('Model loading timeout after 30 seconds'));
            }, 30000);

            const checkReady = () => {
                if (this.modelLoaded) {
                    clearTimeout(timeout);
                    return resolve(true);
                }
                setTimeout(checkReady, 100);
            };
            checkReady();
        });
    }

    // ---------- Recording Control ----------
    async start() {
        // Guard: must be loaded
        if (!this.modelLoaded) {
            if (this.opts.allowAutoLoad) {
                console.log('[SpeechService] Auto-loading model...');
                await this.loadModel();
            } else {
                throw new Error('Model not loaded. Call loadModel() first.');
            }
        }

        // Guard: already listening
        if (this.isListening) {
            console.log('[SpeechService] Already listening');
            return;
        }

        if (!this.worker) {
            throw new Error('Worker not initialized');
        }

        // Guard: need microphone
        if (!this.micManager || !this.micManager.stream) {
            throw new Error('Microphone not available');
        }

        try {
            console.log('[SpeechService] Starting recording and audio capture');
            
            // Start audio capture pipeline
            await this._startAudioCapture();
            
            // Tell worker to start recording
            this.worker.postMessage({ type: 'start' });
            this.isListening = true;
            this._notifyStatus('started', { message: 'Recording started' });
            
        } catch (err) {
            console.error('[SpeechService] Failed to start audio capture:', err);
            this._stopAudioCapture();
            throw err;
        }
    }

    stop() {
        if (!this.isListening) {
            console.log('[SpeechService] Not listening, nothing to stop');
            return;
        }

        if (this.worker) {
            console.log('[SpeechService] Stopping recording and audio capture');
            
            // Stop audio capture first
            this._stopAudioCapture();
            
            // Tell worker to stop and process
            this.worker.postMessage({ type: 'stop' });
            this.isListening = false;
            this._notifyStatus('stopped', { message: 'Recording stopped' });
        }
    }

    abort() {
        console.log('[SpeechService] Aborting');
        
        // Stop audio capture
        this._stopAudioCapture();
        
        if (this.worker) {
            try {
                this.worker.postMessage({ type: 'abort' });
                this.worker.terminate();
            } catch (e) {
                console.error('[SpeechService] Error terminating worker:', e);
            }
            this.worker = null;
        }
        
        this.isListening = false;
        this.modelLoaded = false;
        this.isLoadingModel = false;
        this._notifyStatus('aborted', { message: 'Aborted' });
    }

    // ---------- Audio Capture Pipeline ----------
    async _startAudioCapture() {
        try {
            // Get microphone stream
            const stream = this.micManager.stream;
            if (!stream) {
                throw new Error('No microphone stream available');
            }

            console.log('[SpeechService] Setting up audio capture pipeline');

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.opts.sampleRate
            });

            // Create source from microphone stream
            this.audioSource = this.audioContext.createMediaStreamSource(stream);

            // Create script processor to capture audio samples
            // Buffer size: 4096 samples (larger = more latency but more efficient)
            const bufferSize = 4096;
            this.audioProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

            // Process audio samples
            this.audioProcessor.onaudioprocess = (e) => {
                if (!this.isListening || !this.worker) {
                    return;
                }

                // Get audio data from input
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Send to worker
                // Note: We send a copy because the buffer gets reused
                const audioCopy = new Float32Array(inputData);
                
                try {
                    this.worker.postMessage({
                        type: 'audioData',
                        payload: audioCopy
                    });
                } catch (err) {
                    console.error('[SpeechService] Error sending audio to worker:', err);
                }
            };

            // Connect the audio pipeline
            this.audioSource.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);

            console.log('[SpeechService] Audio capture pipeline active');

        } catch (err) {
            console.error('[SpeechService] Failed to setup audio capture:', err);
            this._stopAudioCapture();
            throw err;
        }
    }

    _stopAudioCapture() {
        try {
            // Disconnect and cleanup audio nodes
            if (this.audioProcessor) {
                this.audioProcessor.onaudioprocess = null;
                try {
                    this.audioProcessor.disconnect();
                } catch (e) {
                    // Already disconnected
                }
                this.audioProcessor = null;
            }

            if (this.audioSource) {
                try {
                    this.audioSource.disconnect();
                } catch (e) {
                    // Already disconnected
                }
                this.audioSource = null;
            }

            if (this.audioContext) {
                try {
                    this.audioContext.close();
                } catch (e) {
                    console.warn('[SpeechService] Error closing audio context:', e);
                }
                this.audioContext = null;
            }

            console.log('[SpeechService] Audio capture stopped');
        } catch (err) {
            console.error('[SpeechService] Error stopping audio capture:', err);
        }
    }

    destroy() {
        console.log('[SpeechService] Destroying');
        
        try {
            this.stop();
        } catch (e) {
            console.error('[SpeechService] Error stopping:', e);
        }
        
        // Cleanup audio capture
        this._stopAudioCapture();
        
        this.abort();
        
        // Clear callbacks
        this.onCommandCallbacks = [];
        this.onTranscriptCallbacks = [];
        this.onErrorCallbacks = [];
        this.onStatusCallbacks = [];
    }

    // ---------- Internal Handlers ----------
    _onLibraryTranscription(text, confidence = undefined, isFinal = true) {
        if (!text || !String(text).trim()) {
            console.warn('[SpeechService] Empty transcription received');
            return;
        }
        
        const normalizedText = String(text).trim();
        const conf = typeof confidence === 'number' ? confidence : this.opts.defaultConfidence;

        const sttInput = {
            text: normalizedText.toLowerCase(),
            confidence: conf,
            language: this.opts.language,
            timestamp: Date.now(),
            context: {
                engine: 'webwhisper',
                modelSize: this.opts.modelSize
            }
        };

        // Update stats
        this.stats.totalCommands++;
        this.stats.recognizedCommands++;
        this._updateAverageConfidence(conf);

        // Notify callbacks
        this._notifyTranscript({
            text: sttInput.text,
            confidence: sttInput.confidence,
            isFinal,
            timestamp: sttInput.timestamp
        });
        
        this._notifyCommand(sttInput);
    }

    _onLibraryError(err) {
        const e = err || {};
        this._notifyError({
            type: e.type || 'library_error',
            message: e.message || String(err)
        });
    }

    // ---------- Callback Registration ----------
    onCommand(cb) {
        if (typeof cb === 'function') {
            this.onCommandCallbacks.push(cb);
        }
    }

    onTranscript(cb) {
        if (typeof cb === 'function') {
            this.onTranscriptCallbacks.push(cb);
        }
    }

    onError(cb) {
        if (typeof cb === 'function') {
            this.onErrorCallbacks.push(cb);
        }
    }

    onStatus(cb) {
        if (typeof cb === 'function') {
            this.onStatusCallbacks.push(cb);
        }
    }

    // ---------- Callback Notifications ----------
    _notifyCommand(sttInput) {
        this.onCommandCallbacks.forEach(cb => {
            try {
                cb(sttInput);
            } catch (e) {
                console.error('[SpeechService] Error in command callback:', e);
            }
        });
    }

    _notifyTranscript(data) {
        this.onTranscriptCallbacks.forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error('[SpeechService] Error in transcript callback:', e);
            }
        });
    }

    _notifyError(err) {
        console.error('[SpeechService] Error:', err);
        this.onErrorCallbacks.forEach(cb => {
            try {
                cb(err);
            } catch (e) {
                console.error('[SpeechService] Error in error callback:', e);
            }
        });
    }

    _notifyStatus(status, data) {
        this.onStatusCallbacks.forEach(cb => {
            try {
                cb(status, data);
            } catch (e) {
                console.error('[SpeechService] Error in status callback:', e);
            }
        });
    }

    // ---------- Stats ----------
    _updateAverageConfidence(conf) {
        const n = this.stats.recognizedCommands;
        if (n <= 1) {
            this.stats.averageConfidence = conf;
        } else {
            this.stats.averageConfidence = ((this.stats.averageConfidence * (n - 1)) + conf) / n;
        }
    }

    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalCommands > 0
                ? ((this.stats.recognizedCommands / this.stats.totalCommands) * 100).toFixed(1) + '%'
                : '0%',
            averageConfidencePercent: (this.stats.averageConfidence * 100).toFixed(1) + '%'
        };
    }

    getState() {
        return {
            isListening: this.isListening,
            modelLoaded: this.modelLoaded,
            isLoadingModel: this.isLoadingModel,
            engineType: 'webwhisper_worker',
            context: this.opts.isExtension ? 'extension' : 'standalone'
        };
    }
}