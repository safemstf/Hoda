// speechRecognitionService.js
// Bridge to content.js - sends messages to content script which runs Web Speech API

export class SpeechRecognitionService {
    constructor(micManager = null, options = {}) {
        this.micManager = micManager;

        // Configuration
        this.opts = {
            ...options,
            defaultConfidence: options.defaultConfidence || 0.92,
            language: options.language || 'en-US'
        };

        // Callbacks
        this.onCommandCallbacks = [];
        this.onTranscriptCallbacks = [];
        this.onErrorCallbacks = [];
        this.onStatusCallbacks = [];

        // State
        this.isListening = false;
        this.isInitialized = false;
        this.currentTabId = null;

        // Stats
        this.stats = {
            totalCommands: 0,
            recognizedCommands: 0,
            failedCommands: 0,
            averageConfidence: 0
        };

        console.log('[SpeechService] Initialized (content script bridge)', {
            language: this.opts.language
        });
    }

    // ---------- Initialization ----------
    async loadModel() {
        if (this.isInitialized) {
            console.log('[SpeechService] Already initialized');
            return true;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Only operate on http(s) pages
            if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
                throw new Error('Active tab is not a supported webpage (must be http(s) page)');
            }

            this.currentTabId = tab.id;
            console.log('[SpeechService] Using tab:', this.currentTabId, 'url:', tab.url);

            const tryPing = async () => {
                try {
                    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                    console.log('[SpeechService] Content script responded to PING:', resp);
                    return true;
                } catch (e) {
                    console.warn('[SpeechService] PING failed:', e && e.message ? e.message : e);
                    return false;
                }
            };

            let hasReceiver = await tryPing();

            if (!hasReceiver) {
                console.log('[SpeechService] No content script found — injecting content.js');
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    // small grace period for content script to register listeners
                    await new Promise(r => setTimeout(r, 150));
                    hasReceiver = await tryPing();
                } catch (injectErr) {
                    console.warn('[SpeechService] Injection attempt failed:', injectErr && injectErr.message ? injectErr.message : injectErr);
                }
            }

            if (!hasReceiver) {
                throw new Error('Content script not present or failed to register in the active tab');
            }

            this.isInitialized = true;
            console.log('[SpeechService] Ready to communicate with content script');
            this._notifyStatus('model_loaded', {
                engine: 'content_script_bridge',
                language: this.opts.language,
                tabId: this.currentTabId
            });

            return true;
        } catch (err) {
            console.error('[SpeechService] Initialization failed:', err);
            this._notifyError({ type: 'initialization_failed', message: err.message });
            throw err;
        }
    }

    // ---------- Recording Control ----------
    async start() {
        if (!this.isInitialized) {
            console.log('[SpeechService] Not initialized, initializing...');
            await this.loadModel();
        }

        if (this.isListening) {
            console.log('[SpeechService] Already listening');
            return;
        }

        if (!this.currentTabId) {
            throw new Error('No tab selected');
        }

        try {
            console.log('[SpeechService] Sending START_STT to content script');

            const response = await chrome.tabs.sendMessage(this.currentTabId, {
                type: 'START_STT'
            });

            if (response && response.ok) {
                this.isListening = true;
                console.log('[SpeechService] Content script started successfully');
                this._notifyStatus('started', { message: 'Listening...' });
            } else {
                throw new Error(response?.err || 'Failed to start content script STT');
            }

        } catch (err) {
            console.error('[SpeechService] Failed to start:', err);
            this._notifyError({
                type: 'start_failed',
                message: `Failed to start: ${err.message}. Make sure you're on a webpage (not chrome:// or edge://).`
            });
            throw err;
        }
    }

    stop() {
        if (!this.isListening) {
            console.log('[SpeechService] Not listening');
            return;
        }

        if (!this.currentTabId) {
            console.warn('[SpeechService] No tab to send stop message to');
            return;
        }

        try {
            console.log('[SpeechService] Sending STOP_STT to content script');

            chrome.tabs.sendMessage(this.currentTabId, {
                type: 'STOP_STT'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[SpeechService] Stop message error:', chrome.runtime.lastError);
                } else {
                    console.log('[SpeechService] Content script stopped');
                }
            });

            this.isListening = false;
            this._notifyStatus('stopped', { message: 'Stopped' });

        } catch (err) {
            console.error('[SpeechService] Error stopping:', err);
        }
    }

    // ---------- Message Handler (call this from popup) ----------
    // This handles messages FROM content script (transcripts, confirmations, etc.)
    handleContentScriptMessage(message) {
        if (!message) return;

        // Handle transcript/command from content.js
        if (message.cmd === 'confirm') {
            // Content script is confirming a command execution
            console.log('[SpeechService] Command confirmed:', message.text);

            // Treat this as a transcript
            this._onTranscription(message.text, this.opts.defaultConfidence);
        }
        // You could add more message types here if content.js sends them
    }

    // ---------- Internal Handlers ----------
    _onTranscription(text, confidence) {
        if (!text || !text.trim()) {
            console.warn('[SpeechService] Empty transcription');
            return;
        }

        const normalizedText = text.trim().toLowerCase();
        const conf = confidence || this.opts.defaultConfidence;

        const sttInput = {
            text: normalizedText,
            confidence: conf,
            language: this.opts.language,
            timestamp: Date.now(),
            context: {
                engine: 'content_script'
            }
        };

        // Update stats
        this.stats.totalCommands++;
        this.stats.recognizedCommands++;
        this._updateAverageConfidence(conf);

        // Notify transcript callback (for UI display)
        this._notifyTranscript({
            text: sttInput.text,
            confidence: sttInput.confidence,
            isFinal: true,
            timestamp: sttInput.timestamp
        });

        // Notify command callback
        this._notifyCommand(sttInput);
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
            modelLoaded: this.isInitialized,
            isLoadingModel: false,
            engineType: 'content_script_bridge',
            currentTabId: this.currentTabId
        };
    }

    // ---------- Cleanup ----------
    destroy() {
        console.log('[SpeechService] Destroying');

        try {
            this.stop();
        } catch (e) {
            console.error('[SpeechService] Error during stop:', e);
        }

        this.onCommandCallbacks = [];
        this.onTranscriptCallbacks = [];
        this.onErrorCallbacks = [];
        this.onStatusCallbacks = [];
    }
}