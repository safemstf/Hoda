// content.js - COMPLETE FINAL VERSION
// Handles: WebSpeech + Command Queue + Feedback + Execution
console.log('[Content] Loading - Complete final version...');

(function () {
  'use strict';

  // ============================================================================
  // WEBSPEECH MANAGER - Handles speech recognition in page context
  // ============================================================================
  // Internal logic: Speech must run in page context (not content script context)
  // to avoid CSP restrictions and maintain stable network connection

  let speechInjected = false;
  let speechReady = false;
  let isListening = false;
  let pendingStart = null;

  /**
   * Inject WebSpeech recognition into page context
   * Why: Page context has unrestricted access to WebSpeech API and stable network
   */
  function injectSpeechIntoPage() {
    if (speechInjected) {
      console.log('[Content] Speech already injected');
      return;
    }

    speechInjected = true;
    console.log('[Content] Injecting WebSpeech into page context...');

    const script = document.createElement('script');
    script.textContent = `
      (function() {
        console.log('[Page] Initializing WebSpeech in page context...');
        
        let recognition = null;
        let isListening = false;

        function initSpeech() {
          if (recognition) {
            console.log('[Page] Speech already initialized');
            return true;
          }

          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) {
            console.error('[Page] WebSpeech API not supported');
            window.postMessage({ type: 'HODA_SPEECH_ERROR', error: 'not-supported' }, '*');
            return false;
          }

          try {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
              console.log('[Page] 🎤 Recognition started');
              isListening = true;
              window.postMessage({ type: 'HODA_SPEECH_STARTED' }, '*');
            };

            recognition.onresult = (event) => {
              const last = event.results.length - 1;
              const result = event.results[last];
              
              window.postMessage({
                type: 'HODA_SPEECH_RESULT',
                transcript: result[0].transcript.trim(),
                isFinal: result.isFinal,
                confidence: result[0].confidence || 0.9
              }, '*');
            };

            recognition.onerror = (event) => {
              console.error('[Page] Recognition error:', event.error);
              
              if (event.error !== 'no-speech') {
                window.postMessage({
                  type: 'HODA_SPEECH_ERROR',
                  error: event.error,
                  message: event.message || ''
                }, '*');
              }
            };

            recognition.onend = () => {
              console.log('[Page] Recognition ended, isListening:', isListening);
              
              if (isListening) {
                console.log('[Page] Auto-restarting recognition...');
                setTimeout(() => {
                  if (recognition && isListening) {
                    try {
                      recognition.start();
                    } catch(e) {
                      console.error('[Page] Auto-restart failed:', e);
                      window.postMessage({
                        type: 'HODA_SPEECH_ERROR',
                        error: 'restart-failed',
                        message: e.message
                      }, '*');
                    }
                  }
                }, 100);
              } else {
                window.postMessage({ type: 'HODA_SPEECH_ENDED' }, '*');
              }
            };

            console.log('[Page] ✅ WebSpeech initialized successfully');
            window.postMessage({ type: 'HODA_SPEECH_READY' }, '*');
            return true;

          } catch (error) {
            console.error('[Page] Failed to initialize WebSpeech:', error);
            window.postMessage({ 
              type: 'HODA_SPEECH_ERROR', 
              error: 'initialization-failed',
              message: error.message 
            }, '*');
            return false;
          }
        }

        function startSpeech() {
          console.log('[Page] Start requested');
          
          if (!recognition && !initSpeech()) {
            console.error('[Page] Cannot start - initialization failed');
            return;
          }

          if (isListening) {
            console.log('[Page] Already listening');
            return;
          }

          try {
            isListening = true;
            recognition.start();
            console.log('[Page] ✅ Recognition start() called');
          } catch(e) {
            console.error('[Page] Start failed:', e);
            isListening = false;
            window.postMessage({ 
              type: 'HODA_SPEECH_ERROR', 
              error: 'start-failed',
              message: e.message 
            }, '*');
          }
        }

        function stopSpeech() {
          console.log('[Page] Stop requested');
          
          if (!recognition) {
            console.log('[Page] No recognition instance');
            return;
          }

          if (!isListening) {
            console.log('[Page] Not listening');
            return;
          }

          isListening = false;
          try {
            recognition.stop();
            console.log('[Page] ✅ Recognition stop() called');
          } catch(e) {
            console.error('[Page] Stop failed:', e);
          }
        }

        window.addEventListener('message', (event) => {
          if (event.source !== window) return;
          
          if (event.data.type === 'HODA_START_SPEECH') {
            console.log('[Page] 📥 Received START command');
            startSpeech();
          }
          
          if (event.data.type === 'HODA_STOP_SPEECH') {
            console.log('[Page] 📥 Received STOP command');
            stopSpeech();
          }

          if (event.data.type === 'HODA_CHECK_READY') {
            console.log('[Page] 📥 Received CHECK_READY');
            if (recognition) {
              window.postMessage({ type: 'HODA_SPEECH_READY' }, '*');
            } else {
              initSpeech();
            }
          }
        });

        console.log('[Page] Setting up WebSpeech...');
        initSpeech();
        console.log('[Page] ✅ Speech bridge ready');
      })();
    `;

    (document.head || document.documentElement).appendChild(script);
    script.remove();

    console.log('[Content] ✅ WebSpeech script injected into page');
  }

  // Inject immediately or on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSpeechIntoPage);
  } else {
    injectSpeechIntoPage();
  }

  /**
   * Listen for messages from page context
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    const data = event.data;

    if (data.type === 'HODA_SPEECH_READY') {
      console.log('[Content] ✅ WebSpeech ready in page context');
      speechReady = true;

      if (pendingStart) {
        console.log('[Content] Executing pending start request');
        window.postMessage({ type: 'HODA_START_SPEECH' }, '*');
        pendingStart = null;
      }
      return;
    }

    // Forward all speech events to popup
    if (data.type && data.type.startsWith('HODA_SPEECH_')) {
      const message = {
        type: data.type.replace('HODA_', ''),
        error: data.error,
        message: data.message,
        transcript: data.transcript,
        isFinal: data.isFinal,
        confidence: data.confidence
      };

      chrome.runtime.sendMessage(message).catch((err) => {
        console.warn('[Content] Failed to forward message to popup:', err);
      });
    }
  });


  // ============================================================================
  // COMMAND QUEUE (Sequential Processing + COOLDOWN)
  // ============================================================================
  class CommandQueue {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
      this.currentCommand = null;
      this.interruptRequested = false;
      // COOLDOWN SYSTEM to prevent echo loops
      this.cooldownActive = false;
      this.cooldownDuration = 2000; // 2 seconds default
      console.log('[Queue] Initialized with cooldown protection');
    }

    /**
     * Add command to queue (with cooldown check)
     */
    enqueue(command, priority = false) {
      // COOLDOWN CHECK: Reject commands during cooldown (except priority)
      if (this.cooldownActive && !priority) {
        console.log('[Queue] ⏳ Cooldown active, ignoring:', command.intent);
        return null;
      }

      const queueItem = {
        command,
        timestamp: Date.now(),
        id: this.generateId()
      };

      if (priority) {
        console.log('[Queue] 🚨 Priority command:', command.intent);
        this.queue.unshift(queueItem);
        if (this.isProcessing) {
          this.interruptRequested = true;
        }
      } else {
        console.log('[Queue] ➕ Enqueued:', command.intent);
        this.queue.push(queueItem);
      }

      if (!this.isProcessing) {
        this.processNext();
      }

      return queueItem.id;
    }

    /**
     * Process next command in queue
     */
    async processNext() {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        this.currentCommand = null;
        console.log('[Queue] ✅ Queue empty');
        return;
      }

      this.isProcessing = true;
      const item = this.queue.shift();
      this.currentCommand = item;
      this.interruptRequested = false;

      console.log('[Queue] 🔄 Processing:', item.command.intent);

      try {
        // START COOLDOWN before executing
        this.startCooldown();

        // Execute command
        await this.executeCommand(item.command);
        console.log('[Queue] ✅ Completed:', item.command.intent);
      } catch (err) {
        console.error('[Queue] ❌ Error:', err);
      } finally {
        this.currentCommand = null;

        if (this.interruptRequested) {
          console.log('[Queue] ⚠️ Interrupted, clearing queue');
          this.queue = [];
          this.interruptRequested = false;
        }

        // Process next with delay
        setTimeout(() => this.processNext(), 50);
      }
    }

    /**
     * START COOLDOWN: Prevent new commands for N seconds
     */
    startCooldown() {
      this.cooldownActive = true;
      console.log('[Queue] ⏳ Cooldown started for', this.cooldownDuration, 'ms');

      setTimeout(() => {
        this.cooldownActive = false;
        console.log('[Queue] ✅ Cooldown ended');
      }, this.cooldownDuration);
    }

    /**
     * Set cooldown duration (in milliseconds)
     */
    setCooldownDuration(ms) {
      this.cooldownDuration = Math.max(500, Math.min(10000, ms)); // 0.5s to 10s
      console.log('[Queue] Cooldown duration set to', this.cooldownDuration, 'ms');
    }

    /**
     * Execute command (delegated to executor)
     */
    async executeCommand(command) {
      return window.__hoda_executor.execute(command);
    }

    /**
     * Stop/interrupt current command
     */
    interrupt() {
      console.log('[Queue] 🛑 Interrupt requested');
      this.interruptRequested = true;
      this.queue = [];

      // Stop speech
      try {
        if (window.__hoda && window.__hoda.feedback && typeof window.__hoda.feedback.stopSpeech === 'function') {
          window.__hoda.feedback.stopSpeech();
          if (window.__hoda.feedback.showStop && typeof window.__hoda.feedback.showStop === 'function') {
            window.__hoda.feedback.showStop();
          }
          console.log('[Queue] Requested feedback.stopSpeech()');
        } else if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          console.log('[Queue] Fallback: speechSynthesis.cancel()');
        }
      } catch (e) {
        console.warn('[Queue] interrupt: error while stopping speech', e);
        try {
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
        } catch (inner) { /* ignore */ }
      }

      this.stopCurrentAction();
    }

    /**
     * Stop ongoing actions
     */
    stopCurrentAction() {
      try {
        if (window.__hoda && window.__hoda.feedback && typeof window.__hoda.feedback.stopSpeech === 'function') {
          try {
            window.__hoda.feedback.stopSpeech();
            console.log('[Queue] Stopped TTS via feedback.stopSpeech()');
          } catch (e) {
            console.warn('[Queue] feedback.stopSpeech() failed:', e);
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
              window.speechSynthesis.cancel();
            }
          }
        } else {
          if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
        }

        // Stop scrolling
        if (this.currentCommand?.command?.intent === 'navigate') {
          window.scrollTo({
            top: window.scrollY,
            behavior: 'auto'
          });
          console.log('[Queue] Stopped scrolling');
        }

        if (window.__hoda && window.__hoda.feedback && typeof window.__hoda.feedback.showStop === 'function') {
          try { window.__hoda.feedback.showStop(); } catch (e) { /* ignore */ }
        }
      } catch (ex) {
        console.error('[Queue] stopCurrentAction error', ex);
      }
    }

    /**
     * Clear all queued commands
     */
    clear() {
      console.log('[Queue] 🗑️ Clearing queue');
      this.queue = [];
      this.interruptRequested = false;
    }

    /**
     * Get queue status
     */
    getStatus() {
      return {
        queueLength: this.queue.length,
        isProcessing: this.isProcessing,
        currentCommand: this.currentCommand?.command?.intent || null,
        interruptRequested: this.interruptRequested,
        cooldownActive: this.cooldownActive
      };
    }

    /**
     * Check if command should have priority
     */
    isPriorityCommand(intent) {
      const priorityIntents = ['stop', 'cancel', 'pause', 'interrupt'];
      return priorityIntents.includes(intent);
    }

    /**
     * Generate unique ID
     */
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }

  // ============================================================================
  // FEEDBACK MANAGER (with cleanup on unload)
  // ============================================================================
  class FeedbackManager {
    constructor() {
      this.audioContext = null;
      this.settings = {
        audioEnabled: true,
        visualEnabled: true,
        ttsVoiceName: null,
        ttsRate: 1.0,
        ttsPitch: 1.0
      };
      this.voices = [];
      this._tts = {
        chunks: [],
        chunkIndex: 0,
        autoContinue: false,
        stopped: false,
        utterance: null
      };
      this._speechCallbacks = {
        onStart: null,
        onEnd: null
      };
      this.isSpeaking = false;
      this.initAudioContext();
      this.loadSettings();
      this.initVoices();
      this._autoRegisterCommonMicManagers();
      this._setupCleanup();
    }

    /**
     * Setup cleanup handlers to stop TTS when page unloads
     */
    _setupCleanup() {
      const cleanup = () => {
        console.log('[Feedback] Page unloading, stopping all TTS');
        this.stopSpeech();
      };

      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('unload', cleanup);
      window.addEventListener('pagehide', cleanup);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          console.log('[Feedback] Tab hidden, stopping TTS');
          this.stopSpeech();
        }
      });
    }

    async loadSettings() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get(['audioFeedback', 'visualFeedback', 'ttsVoiceName', 'ttsRate', 'ttsPitch']);
          this.settings.audioEnabled = result.audioFeedback !== false;
          this.settings.visualEnabled = result.visualFeedback !== false;
          if (result.ttsVoiceName) this.settings.ttsVoiceName = result.ttsVoiceName;
          if (typeof result.ttsRate === 'number') this.settings.ttsRate = result.ttsRate;
          if (typeof result.ttsPitch === 'number') this.settings.ttsPitch = result.ttsPitch;
          console.log('[Feedback] Settings loaded:', this.settings);
        }
      } catch (err) {
        console.warn('[Feedback] Could not load settings:', err);
      }
    }

    async saveSetting(key, val) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.set({ [key]: val });
        }
      } catch (e) {
        console.warn('[Feedback] could not persist setting', key, e);
      }
    }

    initAudioContext() {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) {
        console.warn('[Feedback] Audio unavailable:', err);
      }
    }

    playBeep(type = 'success') {
      if (!this.settings.audioEnabled || !this.audioContext) return;

      try {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        if (type === 'success') {
          osc.frequency.value = 800;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.1);
        } else if (type === 'error') {
          osc.frequency.value = 200;
          osc.type = 'sawtooth';
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.15);
        } else if (type === 'stop') {
          osc.frequency.value = 300;
          gain.gain.value = 0.25;
          osc.start();
          osc.stop(this.audioContext.currentTime + 0.08);
          setTimeout(() => {
            const osc2 = this.audioContext.createOscillator();
            const gain2 = this.audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(this.audioContext.destination);
            osc2.frequency.value = 250;
            gain2.gain.value = 0.25;
            osc2.start();
            osc2.stop(this.audioContext.currentTime + 0.08);
          }, 100);
        }
      } catch (err) {
        console.error('[Feedback] Beep error:', err);
      }
    }

    showOverlay(message, type = 'success') {
      if (!this.settings.visualEnabled) return;

      let overlay = document.getElementById('hoda-feedback-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hoda-feedback-overlay';
        document.body.appendChild(overlay);
      }

      const bgColor = type === 'error'
        ? 'rgba(244, 67, 54, 0.95)'
        : type === 'warning'
          ? 'rgba(245, 158, 11, 0.95)'
          : 'rgba(76, 175, 80, 0.95)';

      Object.assign(overlay.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        backgroundColor: bgColor,
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '2147483647',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '400px',
        pointerEvents: 'none',
        transition: 'opacity 0.3s',
        opacity: '1'
      });

      overlay.textContent = message;

      clearTimeout(overlay._timer);
      overlay._timer = setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }, 1000);
    }

    confirmCommand(command) {
      this.playBeep('success');
      this.showOverlay(`✓ "${command.original || ''}"`, 'success');
    }

    showError(message) {
      this.playBeep('error');
      this.showOverlay('⚠️ ' + message, 'error');
    }

    showStop() {
      this.playBeep('stop');
      this.showOverlay('🛑 Stopped', 'warning');
    }

    registerSpeechCallbacks(onStart, onEnd) {
      this._speechCallbacks.onStart = typeof onStart === 'function' ? onStart : null;
      this._speechCallbacks.onEnd = typeof onEnd === 'function' ? onEnd : null;
    }

    _setSpeaking(state) {
      try {
        this.isSpeaking = !!state;
        if (!window.__hoda) window.__hoda = {};
        window.__hoda.isSpeaking = this.isSpeaking;

        if (this.isSpeaking) {
          if (this._speechCallbacks.onStart) {
            try { this._speechCallbacks.onStart(); } catch (e) { console.warn('[Feedback] onStart callback error', e); }
          }
        } else {
          if (this._speechCallbacks.onEnd) {
            try { this._speechCallbacks.onEnd(); } catch (e) { console.warn('[Feedback] onEnd callback error', e); }
          }
        }
      } catch (e) {
        console.warn('[Feedback] _setSpeaking error', e);
      }
    }

    _autoRegisterCommonMicManagers() {
      try {
        if (window.__hoda && window.__hoda.microphoneManager) {
          const mm = window.__hoda.microphoneManager;
          const pauseFn = mm.pauseListening || mm.pause || mm.stopListening || mm.stop;
          const resumeFn = mm.resumeListening || mm.resume || mm.startListening || mm.start;

          if (pauseFn && resumeFn) {
            this.registerSpeechCallbacks(
              () => {
                try { pauseFn.call(mm); } catch (e) { console.warn('[Feedback] auto pause mic failed', e); }
              },
              () => {
                try { resumeFn.call(mm); } catch (e) { console.warn('[Feedback] auto resume mic failed', e); }
              }
            );
            console.log('[Feedback] Auto-registered mic pause/resume');
            return;
          }
        }

        const maybeRecognition = window.__hoda && (window.__hoda.recognition || window.__hoda.recognitionInstance) || window.recognition;
        if (maybeRecognition && (typeof maybeRecognition.stop === 'function' || typeof maybeRecognition.abort === 'function')) {
          const stopFn = maybeRecognition.stop || maybeRecognition.abort;
          const startFn = maybeRecognition.start;

          this.registerSpeechCallbacks(
            () => {
              try { stopFn.call(maybeRecognition); } catch (e) { console.warn('[Feedback] auto stop recognition failed', e); }
            },
            () => {
              try { if (typeof startFn === 'function') startFn.call(maybeRecognition); } catch (e) { console.warn('[Feedback] auto start recognition failed', e); }
            }
          );
          console.log('[Feedback] Auto-registered recognition stop/start');
        }
      } catch (e) {
        console.warn('[Feedback] _autoRegisterCommonMicManagers error', e);
      }
    }

    initVoices() {
      const updateVoices = () => {
        try {
          const v = window.speechSynthesis.getVoices() || [];
          this.voices = v.map(voice => ({
            name: voice.name,
            lang: voice.lang,
            localService: voice.localService,
            voiceObj: voice
          }));
          console.log('[Feedback] voices loaded', this.voices.length);
        } catch (e) {
          console.warn('[Feedback] initVoices error', e);
          this.voices = [];
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = () => updateVoices();
    }

    listVoices() {
      return this.voices.map(v => ({ name: v.name, lang: v.lang }));
    }

    getPreferredVoice() {
      if (!this.voices || this.voices.length === 0) {
        const v = window.speechSynthesis.getVoices() || [];
        if (v.length) {
          this.voices = v.map(voice => ({ name: voice.name, lang: voice.lang, localService: voice.localService, voiceObj: voice }));
        }
      }

      if (this.settings.ttsVoiceName) {
        const found = this.voices.find(v => v.name === this.settings.ttsVoiceName);
        if (found) return found.voiceObj;
      }

      const localEn = this.voices.find(v => v.localService && v.lang && v.lang.startsWith('en'));
      if (localEn) return localEn.voiceObj;

      return (this.voices[0] && this.voices[0].voiceObj) || null;
    }

    async setTTSVoice(name) {
      this.settings.ttsVoiceName = name || null;
      await this.saveSetting('ttsVoiceName', this.settings.ttsVoiceName);
      console.log('[Feedback] setTTSVoice ->', this.settings.ttsVoiceName);
    }

    async setRatePitch(rate, pitch) {
      if (typeof rate === 'number') {
        this.settings.ttsRate = rate;
        await this.saveSetting('ttsRate', rate);
      }
      if (typeof pitch === 'number') {
        this.settings.ttsPitch = pitch;
        await this.saveSetting('ttsPitch', pitch);
      }
      console.log('[Feedback] setRatePitch ->', this.settings.ttsRate, this.settings.ttsPitch);
    }

    speakShort(text, opts = {}) {
      if (!text) return;

      try {
        const shouldInterruptLongReads = opts.interruptLongReads ?? true;
        if (shouldInterruptLongReads && this._tts.utterance && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
          this.stopSpeech();
        }

        const u = new SpeechSynthesisUtterance(text);
        const voice = this.getPreferredVoice();
        if (voice) u.voice = voice;
        u.rate = opts.rate ?? this.settings.ttsRate ?? 1.0;
        u.pitch = opts.pitch ?? this.settings.ttsPitch ?? 1.0;
        u.volume = opts.volume ?? 0.95;

        this._setSpeaking(true);

        u.onend = () => {
          this._setSpeaking(false);
        };

        u.onerror = (e) => {
          console.warn('[Feedback] speakShort error', e);
          this._setSpeaking(false);
        };

        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn('[Feedback] speakShort failed:', e);
      }
    }

    speakLong(text, onComplete) {
      if (!text) {
        if (onComplete) onComplete();
        return;
      }

      this.stopSpeech();

      const chunks = this._chunkTextToSentences(text, 1600);
      if (!chunks || !chunks.length) {
        if (onComplete) onComplete();
        return;
      }

      this._tts.chunks = chunks;
      this._tts.chunkIndex = 0;
      this._tts.autoContinue = true;
      this._tts.stopped = false;
      this._tts.onAllChunksComplete = onComplete; // Store callback

      this._setSpeaking(true);
      this._speakNextChunk();
    }

    pauseSpeech() {
      try {
        if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          console.log('[Feedback] paused speech');
          return true;
        }
        return false;
      } catch (e) {
        console.warn('[Feedback] pauseSpeech error', e);
        return false;
      }
    }

    resumeSpeech() {
      try {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          console.log('[Feedback] resumed speech');
          return true;
        }

        if (!window.speechSynthesis.speaking && this._tts.chunks && this._tts.chunkIndex < this._tts.chunks.length) {
          this._tts.autoContinue = true;
          this._speakNextChunk();
          return true;
        }

        return false;
      } catch (e) {
        console.warn('[Feedback] resumeSpeech error', e);
        return false;
      }
    }

    /**
     * IMPROVED: Force stop ALL speech
     */
    stopSpeech() {
      try {
        console.log('[Feedback] 🛑 FORCE STOPPING all TTS');

        this._tts.stopped = true;
        this._tts.autoContinue = false;
        this._tts.chunks = [];
        this._tts.chunkIndex = 0;

        if (window.speechSynthesis) {
          try {
            window.speechSynthesis.cancel();
            setTimeout(() => {
              if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
                window.speechSynthesis.cancel();
              }
            }, 50);
          } catch (e) {
            console.warn('[Feedback] speechSynthesis.cancel() error', e);
          }
        }

        this._tts.utterance = null;
        this._tts.readingText = '';

        this._setSpeaking(false);

        console.log('[Feedback] ✅ TTS stopped and cleared');
      } catch (e) {
        console.error('[Feedback] stopSpeech error', e);
        try {
          if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (inner) { /* ignore */ }
      }
    }

    _speakNextChunk() {
      if (this._tts.stopped) {
        console.log('[TTS] Stopped, not continuing');
        // Clear callback on stop
        if (this._tts.onAllChunksComplete) {
          const callback = this._tts.onAllChunksComplete;
          this._tts.onAllChunksComplete = null;
          callback();
        }
        return;
      }

      if (this._tts.chunkIndex >= this._tts.chunks.length) {
        // ALL CHUNKS COMPLETE - MUST CALL THE CALLBACK HERE
        console.log('[TTS] ✅ All chunks complete');
        this._setSpeaking(false);

        // THIS IS CRITICAL - call the completion callback
        if (this._tts.onAllChunksComplete) {
          const callback = this._tts.onAllChunksComplete;
          this._tts.onAllChunksComplete = null; // Clear it
          console.log('[TTS] 🎉 Calling onAllChunksComplete callback');
          callback(); // Call it
        }
        return;
      }

      const chunk = this._tts.chunks[this._tts.chunkIndex];
      console.log(`[TTS] Speaking chunk ${this._tts.chunkIndex + 1}/${this._tts.chunks.length}`);

      const utterance = new SpeechSynthesisUtterance(chunk);

      // ⭐ CRITICAL: Set voice, rate, pitch (was missing!)
      const voice = this.getPreferredVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = this.settings.ttsRate ?? 1.0;
      utterance.pitch = this.settings.ttsPitch ?? 1.0;
      utterance.volume = 0.95;

      // ⭐ CRITICAL: Store utterance so we can track/stop it
      this._tts.utterance = utterance;

      utterance.onend = () => {
        console.log(`[TTS] ✅ Chunk ${this._tts.chunkIndex + 1} finished`);
        this._tts.chunkIndex++;

        // Check if stopped during speech
        if (this._tts.stopped) {
          console.log('[TTS] Detected stop during chunk completion');
          this._setSpeaking(false);
          if (this._tts.onAllChunksComplete) {
            const callback = this._tts.onAllChunksComplete;
            this._tts.onAllChunksComplete = null;
            callback();
          }
          return;
        }

        if (this._tts.autoContinue) {
          // Small delay before next chunk for better pacing
          setTimeout(() => {
            this._speakNextChunk();
          }, 50); // 50ms pause between chunks
        } else {
          console.log('[TTS] autoContinue is false, stopping');
          this._setSpeaking(false);
          if (this._tts.onAllChunksComplete) {
            const callback = this._tts.onAllChunksComplete;
            this._tts.onAllChunksComplete = null;
            callback();
          }
        }
      };

      utterance.onerror = (error) => {
        console.error('[TTS] ❌ Chunk error:', error);
        this._tts.chunkIndex++;

        // Continue to next chunk even on error
        if (this._tts.autoContinue && !this._tts.stopped) {
          setTimeout(() => {
            this._speakNextChunk();
          }, 100);
        } else {
          this._setSpeaking(false);
          if (this._tts.onAllChunksComplete) {
            const callback = this._tts.onAllChunksComplete;
            this._tts.onAllChunksComplete = null;
            callback();
          }
        }
      };

      // Speak the utterance
      window.speechSynthesis.speak(utterance);
    }

    _chunkTextToSentences(text, maxChunkChars = 1600) {
      if (!text) return [];

      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      const chunks = [];
      let current = '';

      for (const s of sentences) {
        if ((current + s).length <= maxChunkChars) {
          current += s + ' ';
        } else {
          if (current.trim()) chunks.push(current.trim());

          if (s.length > maxChunkChars) {
            for (let i = 0; i < s.length; i += maxChunkChars) {
              chunks.push(s.substring(i, i + maxChunkChars).trim());
            }
            current = '';
          } else {
            current = s + ' ';
          }
        }
      }

      if (current.trim()) chunks.push(current.trim());
      return chunks;
    }
  }

  // ============================================================================
  // COMMAND EXECUTOR
  // ============================================================================
  //supporting classes
  class ReadingStateManager {
    constructor(options = {}) {
      this.contentBlocks = [];
      this.currentIndex = 0;
      this.state = 'idle'; // idle, reading, paused, stopped
      this.pausedAt = null;

      console.log('[ReadingStateManager] Initialized');
    }

    /**
     * Load content blocks for reading
     */
    loadContent(blocks) {
      this.contentBlocks = blocks || [];
      this.currentIndex = 0;
      this.state = 'idle';
      this.pausedAt = null;

      console.log(`[ReadingStateManager] Loaded ${this.contentBlocks.length} blocks`);
    }

    /**
     * Start reading from beginning
     */
    startReading() {
      if (this.contentBlocks.length === 0) {
        console.warn('[ReadingStateManager] No content loaded');
        return false;
      }

      this.currentIndex = 0;
      this.state = 'reading';
      this.pausedAt = null;

      console.log('[ReadingStateManager] Started reading');
      return true;
    }

    /**
     * Start reading from current scroll position
     */
    startFromCurrentPosition() {
      if (this.contentBlocks.length === 0) {
        return false;
      }

      // Find first block that's visible or below current scroll
      const scrollTop = window.scrollY;
      const index = this.contentBlocks.findIndex(
        block => block.position.top >= scrollTop - 100
      );

      if (index >= 0) {
        this.currentIndex = index;
      } else {
        this.currentIndex = 0;
      }

      this.state = 'reading';
      this.pausedAt = null;

      console.log(`[ReadingStateManager] Starting from position ${this.currentIndex}`);
      return true;
    }

    /**
     * Pause reading at current position
     */
    pause() {
      if (this.state !== 'reading') {
        return false;
      }

      this.state = 'paused';
      this.pausedAt = this.currentIndex;

      console.log(`[ReadingStateManager] Paused at index ${this.pausedAt}`);
      return true;
    }

    /**
     * Resume reading from paused position
     */
    resume() {
      if (this.state !== 'paused' || this.pausedAt === null) {
        return false;
      }

      this.currentIndex = this.pausedAt;
      this.state = 'reading';
      this.pausedAt = null;

      console.log(`[ReadingStateManager] Resumed from index ${this.currentIndex}`);
      return true;
    }

    /**
     * Stop reading completely
     */
    stop() {
      this.state = 'stopped';
      this.pausedAt = null;

      console.log('[ReadingStateManager] Stopped reading');
      return true;
    }

    /**
     * Get current block being read
     */
    getCurrentBlock() {
      if (this.currentIndex >= this.contentBlocks.length) {
        return null;
      }

      return this.contentBlocks[this.currentIndex];
    }

    /**
     * Move to next block
     */
    nextBlock() {
      if (this.currentIndex < this.contentBlocks.length - 1) {
        this.currentIndex++;
        console.log(`[ReadingStateManager] Next block: ${this.currentIndex}`);
        return this.getCurrentBlock();
      }

      return null;
    }

    /**
     * Move to previous block
     */
    previousBlock() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        console.log(`[ReadingStateManager] Previous block: ${this.currentIndex}`);
        return this.getCurrentBlock();
      }

      return null;
    }

    /**
     * Move to next paragraph (skip headings)
     */
    nextParagraph() {
      let index = this.currentIndex + 1;

      while (index < this.contentBlocks.length) {
        const block = this.contentBlocks[index];
        if (block.type === 'p' || !block.isHeading) {
          this.currentIndex = index;
          console.log(`[ReadingStateManager] Next paragraph: ${this.currentIndex}`);
          return block;
        }
        index++;
      }

      console.log('[ReadingStateManager] No next paragraph found');
      return null;
    }

    /**
     * Move to previous paragraph (skip headings)
     */
    previousParagraph() {
      let index = this.currentIndex - 1;

      while (index >= 0) {
        const block = this.contentBlocks[index];
        if (block.type === 'p' || !block.isHeading) {
          this.currentIndex = index;
          console.log(`[ReadingStateManager] Previous paragraph: ${this.currentIndex}`);
          return block;
        }
        index--;
      }

      console.log('[ReadingStateManager] No previous paragraph found');
      return null;
    }

    /**
     * Check if at end of content
     */
    isAtEnd() {
      return this.currentIndex >= this.contentBlocks.length - 1;
    }

    /**
     * Check if at beginning of content
     */
    isAtBeginning() {
      return this.currentIndex === 0;
    }

    /**
     * Get reading progress
     */
    getProgress() {
      if (this.contentBlocks.length === 0) {
        return {
          current: 0,
          total: 0,
          percentage: 0
        };
      }

      return {
        current: this.currentIndex + 1,
        total: this.contentBlocks.length,
        percentage: Math.round((this.currentIndex / this.contentBlocks.length) * 100)
      };
    }

    /**
     * Get current state info
     */
    getState() {
      return {
        state: this.state,
        currentIndex: this.currentIndex,
        pausedAt: this.pausedAt,
        hasContent: this.contentBlocks.length > 0,
        progress: this.getProgress()
      };
    }

    /**
     * Scroll to current block
     */
    scrollToCurrentBlock() {
      const block = this.getCurrentBlock();
      if (block && block.element) {
        block.element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        return true;
      }
      return false;
    }

    /**
     * Highlight current block visually
     */
    highlightCurrentBlock() {
      // Remove previous highlights
      document.querySelectorAll('.hoda-reading-highlight').forEach(el => {
        el.classList.remove('hoda-reading-highlight');
      });

      // Add highlight to current block
      const block = this.getCurrentBlock();
      if (block && block.element) {
        block.element.classList.add('hoda-reading-highlight');
      }
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
      document.querySelectorAll('.hoda-reading-highlight').forEach(el => {
        el.classList.remove('hoda-reading-highlight');
      });
    }

    /**
     * Reset to initial state
     */
    reset() {
      this.currentIndex = 0;
      this.state = 'idle';
      this.pausedAt = null;
      this.clearHighlights();

      console.log('[ReadingStateManager] Reset');
    }
  }


  class ContentExtractor {
    constructor(options = {}) {
      this.config = {
        minParagraphLength: options.minParagraphLength || 20,
        minWordsPerElement: options.minWordsPerElement || 5,
        excludeSelectors: options.excludeSelectors || [
          'nav', 'header', 'footer', 'aside', '.ad', '.advertisement',
          '.sidebar', '.menu', '.navigation', '.cookie-notice',
          '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
          '.social-share', '.comments', '.related-posts', 'script', 'style'
        ],
        contentSelectors: options.contentSelectors || [
          'article', 'main', '[role="main"]', '.content', '.post-content',
          '.article-content', '.entry-content', '.post-body', '.story-body'
        ]
      };

      console.log('[ContentExtractor] Initialized', this.config);
    }

    /**
     * Extract main readable content from page
     * Returns array of content blocks with metadata
     */
    extractContent() {
      console.log('[ContentExtractor] Extracting content from page...');

      // Try semantic content containers first
      let contentRoot = this.findContentRoot();

      if (!contentRoot) {
        console.log('[ContentExtractor] No semantic container found, using body');
        contentRoot = document.body;
      }

      // Extract text blocks
      const blocks = this.extractTextBlocks(contentRoot);

      console.log(`[ContentExtractor] Extracted ${blocks.length} content blocks`);

      return blocks;
    }

    /**
     * Find the main content container using semantic HTML
     */
    findContentRoot() {
      // Try each content selector in priority order
      for (const selector of this.config.contentSelectors) {
        const element = document.querySelector(selector);
        if (element && this.isValidContentContainer(element)) {
          console.log(`[ContentExtractor] Found content root: ${selector}`);
          return element;
        }
      }

      return null;
    }

    /**
     * Check if element is a valid content container
     */
    isValidContentContainer(element) {
      if (!element) return false;

      // Must have reasonable text content
      const text = element.textContent || '';
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

      return wordCount >= this.config.minWordsPerElement * 3;
    }

    /**
     * Extract text blocks from container
     */
    extractTextBlocks(container) {
      const blocks = [];

      // Get all text-bearing elements
      const elements = this.getTextElements(container);

      for (const element of elements) {
        // Skip excluded elements
        if (this.shouldExclude(element)) {
          continue;
        }

        const block = this.createContentBlock(element);
        if (block) {
          blocks.push(block);
        }
      }

      return blocks;
    }

    /**
     * Get all elements that contain readable text
     */
    getTextElements(container) {
      const elements = [];

      // Target paragraphs, headings, list items
      const selectors = [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'blockquote', 'td', 'th', 'dd', 'dt',
        'figcaption', 'caption'
      ];

      for (const selector of selectors) {
        const found = container.querySelectorAll(selector);
        elements.push(...Array.from(found));
      }

      return elements;
    }

    /**
     * Check if element should be excluded
     */
    shouldExclude(element) {
      if (!element) return true;

      // Check if element or parent matches exclude selectors
      for (const selector of this.config.excludeSelectors) {
        if (element.matches(selector) || element.closest(selector)) {
          return true;
        }
      }

      // Check if hidden
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }

      return false;
    }

    /**
     * Create content block from element
     */
    createContentBlock(element) {
      const text = this.extractText(element);

      if (!text || text.length < this.config.minParagraphLength) {
        return null;
      }

      return {
        text: text,
        type: element.tagName.toLowerCase(),
        element: element,
        isHeading: /^h[1-6]$/i.test(element.tagName),
        position: this.getElementPosition(element)
      };
    }

    /**
     * Extract clean text from element
     */
    extractText(element) {
      if (!element) return '';

      let text = '';

      // Special handling for images - use alt text
      if (element.tagName === 'IMG') {
        const alt = element.getAttribute('alt');
        return alt ? `Image: ${alt}` : '';
      }

      // Get text content
      text = element.textContent || '';

      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();

      // Handle links naturally - don't announce "link" constantly
      // Just read the link text in flow

      return text;
    }

    /**
     * Get element's position on page
     */
    getElementPosition(element) {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        bottom: rect.bottom + window.scrollY,
        isVisible: this.isElementVisible(element)
      };
    }

    /**
     * Check if element is currently visible in viewport
     */
    isElementVisible(element) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    }

    /**
     * Extract content starting from current scroll position
     */
    extractFromCurrentPosition() {
      const blocks = this.extractContent();
      const scrollTop = window.scrollY;

      // Filter blocks that are at or below current scroll position
      return blocks.filter(block => block.position.top >= scrollTop - 100);
    }

    /**
     * Get summary of extracted content
     */
    getContentSummary() {
      const blocks = this.extractContent();

      return {
        totalBlocks: blocks.length,
        paragraphs: blocks.filter(b => b.type === 'p').length,
        headings: blocks.filter(b => b.isHeading).length,
        totalWords: blocks.reduce((sum, b) => {
          return sum + b.text.split(/\s+/).length;
        }, 0),
        estimatedReadingTime: this.estimateReadingTime(blocks)
      };
    }

    /**
     * Estimate reading time in seconds
     * Average reading speed: 200 words per minute
     */
    estimateReadingTime(blocks) {
      const totalWords = blocks.reduce((sum, b) => {
        return sum + b.text.split(/\s+/).length;
      }, 0);

      return Math.ceil(totalWords / 200 * 60); // seconds
    }
  }


  class PageReader {
    constructor(options = {}) {
      this.extractor = new ContentExtractor(options.extraction);
      this.stateManager = new ReadingStateManager();

      // TTS will be injected
      this.tts = null;

      // Reading queue
      this.readingQueue = [];
      this.isProcessingQueue = false;
      this.shouldStopQueue = false;

      // Configuration
      this.config = {
        pauseBetweenBlocks: options.pauseBetweenBlocks || 500, // ms
        scrollToBlock: options.scrollToBlock !== false,
        highlightBlock: options.highlightBlock !== false,
        autoScroll: options.autoScroll !== false
      };

      console.log('[PageReader] Initialized');
    }

    /**
     * Set TTS engine
     */
    setTTS(tts) {
      this.tts = tts;
      console.log('[PageReader] TTS engine connected');
    }

    /**
     * Start reading page from top
     */
    async readPage() {
      console.log('[PageReader] Read page requested');

      // Extract content
      const blocks = this.extractor.extractContent();

      if (blocks.length === 0) {
        return this.announceError('No readable content on this page');
      }

      // Load content into state manager
      this.stateManager.loadContent(blocks);
      this.stateManager.startReading();

      // Announce start
      await this.announce('Reading page');

      // Start reading blocks
      await this.processReadingQueue();

      return { success: true, blocksCount: blocks.length };
    }

    /**
     * Read from current scroll position
     */
    async readFromHere() {
      console.log('[PageReader] Read from here requested');

      // Extract content from current position
      const blocks = this.extractor.extractFromCurrentPosition();

      if (blocks.length === 0) {
        return this.announceError('No readable content from this position');
      }

      this.stateManager.loadContent(blocks);
      this.stateManager.startReading();

      await this.announce('Reading from here');
      await this.processReadingQueue();

      return { success: true, blocksCount: blocks.length };
    }

    /**
     * Pause reading
     */
    async pauseReading() {
      console.log('[PageReader] Pause requested');

      if (this.stateManager.state !== 'reading') {
        return { success: false, reason: 'not-reading' };
      }

      this.shouldStopQueue = true;
      this.stateManager.pause();

      // Stop TTS
      if (this.tts) {
        this.tts.stop();
      }

      await this.announce('Paused');

      return { success: true };
    }

    /**
     * Resume reading
     */
    async resumeReading() {
      console.log('[PageReader] Resume requested');

      if (this.stateManager.state !== 'paused') {
        return { success: false, reason: 'not-paused' };
      }

      this.stateManager.resume();
      await this.announce('Resuming');

      this.shouldStopQueue = false;
      await this.processReadingQueue();

      return { success: true };
    }

    /**
     * Stop reading completely
     */
    async stopReading() {
      console.log('[PageReader] Stop requested');

      this.shouldStopQueue = true;
      this.stateManager.stop();
      this.stateManager.clearHighlights();

      // Stop TTS
      if (this.tts) {
        this.tts.stop();
      }

      return { success: true };
    }

    /**
     * Navigate to next paragraph
     */
    async nextParagraph() {
      console.log('[PageReader] Next paragraph requested');

      const block = this.stateManager.nextParagraph();

      if (!block) {
        if (this.stateManager.isAtEnd()) {
          return this.announceError('End of page');
        }
        return this.announceError('No next paragraph');
      }

      // If reading, continue with new position
      if (this.stateManager.state === 'reading') {
        this.shouldStopQueue = true;
        if (this.tts) {
          this.tts.stop();
        }

        // Small delay then continue
        await this.sleep(300);
        this.shouldStopQueue = false;
        await this.processReadingQueue();
      } else {
        // Just highlight and scroll
        if (this.config.scrollToBlock) {
          this.stateManager.scrollToCurrentBlock();
        }
        if (this.config.highlightBlock) {
          this.stateManager.highlightCurrentBlock();
        }
      }

      return { success: true };
    }

    /**
     * Navigate to previous paragraph
     */
    async previousParagraph() {
      console.log('[PageReader] Previous paragraph requested');

      const block = this.stateManager.previousParagraph();

      if (!block) {
        if (this.stateManager.isAtBeginning()) {
          return this.announceError('At beginning');
        }
        return this.announceError('No previous paragraph');
      }

      // If reading, continue with new position
      if (this.stateManager.state === 'reading') {
        this.shouldStopQueue = true;
        if (this.tts) {
          this.tts.stop();
        }

        await this.sleep(300);
        this.shouldStopQueue = false;
        await this.processReadingQueue();
      } else {
        if (this.config.scrollToBlock) {
          this.stateManager.scrollToCurrentBlock();
        }
        if (this.config.highlightBlock) {
          this.stateManager.highlightCurrentBlock();
        }
      }

      return { success: true };
    }

    /**
     * Process the reading queue
     */
    async processReadingQueue() {
      if (this.isProcessingQueue) {
        console.log('[PageReader] Already processing queue');
        return;
      }

      this.isProcessingQueue = true;
      this.shouldStopQueue = false;

      while (this.stateManager.state === 'reading' && !this.shouldStopQueue) {
        const block = this.stateManager.getCurrentBlock();

        if (!block) {
          // Reached end
          await this.announce('End of page');
          this.stateManager.stop();
          break;
        }

        // Scroll to block
        if (this.config.scrollToBlock) {
          this.stateManager.scrollToCurrentBlock();
        }

        // Highlight block
        if (this.config.highlightBlock) {
          this.stateManager.highlightCurrentBlock();
        }

        // Read block
        await this.readBlock(block);

        // Check if should stop
        if (this.shouldStopQueue) {
          break;
        }

        // Pause between blocks
        await this.sleep(this.config.pauseBetweenBlocks);

        // Move to next block
        const nextBlock = this.stateManager.nextBlock();
        if (!nextBlock) {
          // Reached end
          await this.announce('End of page');
          this.stateManager.stop();
          break;
        }
      }

      this.isProcessingQueue = false;
      this.stateManager.clearHighlights();
    }

    /**
     * Read a single content block
     */
    async readBlock(block) {
      if (!this.tts || !block) {
        return;
      }

      console.log('[PageReader] 📖 Starting block read:', block.text.substring(0, 50) + '...');

      // Prefix headings
      let text = block.text;
      if (block.isHeading) {
        const level = block.type.replace('h', '');
        text = `Heading ${level}. ${text}`;
      }

      // Create promise that ONLY resolves when TTS finishes or errors
      return new Promise((resolve, reject) => {
        let resolved = false;

        // Timeout protection (30 seconds max per block)
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn('[PageReader] ⏱️ Block reading timeout after 30s');
            resolve();
          }
        }, 30000);

        try {
          this.tts.speak(text, {
            onEnd: () => {
              if (!resolved) {
                resolved = true;
                console.log('[PageReader] ✅ Block reading completed');
                clearTimeout(timeout);
                resolve();
              }
            },
            onError: (error) => {
              if (!resolved) {
                resolved = true;
                console.error('[PageReader] ❌ TTS error:', error);
                clearTimeout(timeout);
                resolve(); // Resolve anyway to continue
              }
            }
          });
        } catch (error) {
          if (!resolved) {
            resolved = true;
            console.error('[PageReader] ❌ Exception calling TTS:', error);
            clearTimeout(timeout);
            resolve();
          }
        }
      });
    }

    /**
     * Announce message via TTS
     */
    async announce(message) {
      if (!this.tts) {
        console.log(`[PageReader] Announce: ${message}`);
        return;
      }

      return new Promise((resolve) => {
        this.tts.speak(message, {
          priority: 'high',
          onEnd: () => resolve(),
          onError: () => resolve()
        });
      });
    }

    /**
     * Announce error message
     */
    async announceError(message) {
      await this.announce(message);
      return { success: false, error: message };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current reading state
     */
    getState() {
      return this.stateManager.getState();
    }

    /**
     * Get content summary
     */
    getContentSummary() {
      return this.extractor.getContentSummary();
    }

    /**
     * Stop all activity and reset
     */
    async reset() {
      this.shouldStopQueue = true;

      if (this.tts) {
        this.tts.stop();
      }

      this.stateManager.reset();
      this.readingQueue = [];
      this.isProcessingQueue = false;

      console.log('[PageReader] Reset complete');
    }
  }

  class CommandExecutor {
    constructor(feedback) {
      this.feedback = feedback;
      this.linkList = [];
      this.pageReader = null; // Will be initialized on first use
      console.log('[Executor] Initialized');
    }

    async execute(cmd) {
      const intent = cmd.intent || cmd.normalized?.intent;
      const slots = cmd.slots || cmd.normalized?.slots || {};

      console.log('[Executor] Executing:', intent, slots);

      try {
        let result;

        if (intent === 'stop' || intent === 'cancel') {
          result = await this.doStop();
          if (this.feedback) this.feedback.showStop();
          return result;
        }

        switch (intent) {
          case 'navigate':
            result = await this.doNavigate(slots);
            break;
          case 'zoom':
            result = await this.doZoom(slots);
            break;
          case 'text_scale':
            result = await this.doTextScale(slots);
            break;
          case 'link_action':
            result = await this.doLinkAction(slots);
            break;
          case 'read':
            result = await this.doRead(slots);
            break;
          case 'find_content':
            result = await this.doFindContent(slots);
            break;
          case 'form_action':
            result = await this.doFormAction(slots);
            break;
          case 'help':
            result = await this.doHelp();
            break;
          default:
            result = { success: false, message: `Unknown: ${intent}` };
        }

        if (result.success && this.feedback) {
          this.feedback.confirmCommand(cmd);
        } else if (!result.success && this.feedback) {
          this.feedback.showError(result.message);
        }

        return result;
      } catch (err) {
        console.error('[Executor] Error:', err);
        if (this.feedback) this.feedback.showError(err.message);
        return { success: false, message: err.message };
      }
    }

    async doStop() {
      console.log('[Executor] STOP command');

      if (window.__hoda_queue && typeof window.__hoda_queue.interrupt === 'function') {
        try { window.__hoda_queue.interrupt(); } catch (e) { }
      }

      if (this.feedback) {
        this.feedback.stopSpeech();
      }

      return { success: true, message: 'Stopped' };
    }

    async doLinkAction(slots) {
      const action = slots.action;
      const linkNumber = slots.linkNumber;
      const target = slots.target;

      if (action === 'list' || !action) {
        this.linkList = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => a.offsetParent !== null)
          .map(a => ({
            element: a,
            href: a.href,
            text: this.getLinkText(a)
          }));

        const visible = this.linkList.slice(0, 10);
        this.showLinkList(visible);
        this.readLinkList(visible);

        console.log('[Executor] Found', this.linkList.length, 'links');
        return { success: true, message: `Found ${this.linkList.length} links` };
      }

      if (linkNumber !== undefined && linkNumber !== null) {
        const index = Number(linkNumber) - 1;
        console.log('[Executor] Opening link:', linkNumber, 'index:', index, 'listLength:', this.linkList.length);

        if (!this.linkList || this.linkList.length === 0) {
          return { success: false, message: 'No link list cached. Say "list links" first.' };
        }

        if (index >= 0 && index < this.linkList.length) {
          const linkData = this.linkList[index];
          const linkText = linkData.text;
          const href = linkData.href;

          console.log('[Executor] Navigating to:', href);

          this.dismissLinkOverlay();
          this.speakShort(`Opening link ${linkNumber}: ${linkText}`);

          setTimeout(() => {
            try {
              if (linkData.element && linkData.element.parentNode) {
                linkData.element.focus();
                linkData.element.click();
              } else {
                window.location.href = href;
              }
            } catch (e) {
              console.error('[Executor] Click failed, using href:', e);
              window.location.href = href;
            }
          }, 100);

          return { success: true, message: `Opening link ${linkNumber}` };
        }

        return { success: false, message: `Link ${linkNumber} not found` };
      }

      if (target) {
        const q = target.toLowerCase();
        const found = Array.from(document.querySelectorAll('a[href]')).find(a =>
          ((a.textContent || a.getAttribute('aria-label') || a.href) || '').toLowerCase().includes(q)
        );

        if (found) {
          this.speakShort(`Opening ${target}`);
          setTimeout(() => {
            try { found.focus(); found.click(); } catch (e) { window.location.href = found.href; }
          }, 100);
          return { success: true, message: `Opening ${target}` };
        }

        return { success: false, message: `Link "${target}" not found` };
      }

      return { success: false, message: 'Invalid link action' };
    }

    async doNavigate(slots) {
      const dir = slots.direction;
      const target = slots.target;
      const amount = slots.amount;

      console.log('[Executor] doNavigate:', { dir, target, amount });

      if (this.feedback) {
        this.feedback.stopSpeech();
      }

      if (target === 'top' || dir === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.speakShort('Going to top');
        return { success: true, message: 'Scrolled to top' };
      }

      if (target === 'bottom' || dir === 'bottom') {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        this.speakShort('Going to bottom');
        return { success: true, message: 'Scrolled to bottom' };
      }

      if (dir === 'back') {
        this.speakShort('Going back');
        window.history.back();
        return { success: true, message: 'Going back' };
      }

      if (dir === 'forward') {
        this.speakShort('Going forward');
        window.history.forward();
        return { success: true, message: 'Going forward' };
      }

      if (dir === 'refresh' || target === 'refresh') {
        this.speakShort('Refreshing page');
        window.location.reload();
        return { success: true, message: 'Refreshing' };
      }

      if (dir === 'home' || target === 'home') {
        this.speakShort('Going home');
        const url = new URL(window.location.href);
        window.location.href = `${url.protocol}//${url.host}`;
        return { success: true, message: 'Going home' };
      }

      let scrollAmount;
      if (amount === 'large') {
        scrollAmount = window.innerHeight * 1.5;
      } else if (!isNaN(Number(amount))) {
        scrollAmount = Number(amount);
      } else {
        scrollAmount = window.innerHeight * 0.5;
      }

      const scrollY = dir === 'down' ? scrollAmount : -scrollAmount;
      window.scrollBy({ top: scrollY, behavior: 'smooth' });

      return { success: true, message: `Scrolled ${dir}` };
    }

    readLinkList(links) {
      if (!links || links.length === 0) return;

      const intro = `Found ${links.length} links. `;
      const linkDescriptions = links.map((linkData, i) => {
        return `Link ${i + 1}: ${linkData.text}`;
      }).join('. ');
      const fullText = intro + linkDescriptions + '. Say "open link" followed by a number to open it.';

      if (this.feedback) {
        this.feedback.speakLong(fullText);
      }
    }

    getLinkText(link) {
      const text = (link.textContent || link.getAttribute('aria-label') || '').trim();
      if (text && text.length > 0) {
        return text.substring(0, 100);
      }

      try {
        const url = new URL(link.href);
        return url.pathname.split('/').filter(p => p).pop() || 'link';
      } catch (e) {
        return 'link';
      }
    }

    speakShort(text) {
      if (!text || !this.feedback) return;
      this.feedback.speakShort(text, { interruptLongReads: false });
    }

    dismissLinkOverlay() {
      const overlay = document.getElementById('hoda-link-list');
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }
    }

    showLinkList(links) {
      const overlay = this.createLinkOverlay();

      overlay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
          <span>🔗</span>
          <span>Available Links</span>
          <span style="font-size: 12px; opacity: 0.7; font-weight: normal;">(${links.length} shown)</span>
        </div>
        ${links.map((linkData, i) => {
        const text = linkData.text;
        const href = linkData.href;
        return `
            <div style="margin: 8px 0; padding: 10px; background: rgba(255, 255, 255, 0.06); border-radius: 6px;">
              <strong style="color: #10b981;">${i + 1}.</strong> ${text}
              <div style="font-size: 11px; opacity: 0.6; margin-top: 4px; word-break: break-all;">${href.substring(0, 60)}${href.length > 60 ? '...' : ''}</div>
            </div>
          `;
      }).join('')}
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; opacity: 0.7;">
          Say "open link [number]" to navigate
        </div>
      `;

      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 500);
        }
      }, 20000);
    }

    createLinkOverlay() {
      const id = 'hoda-link-list';
      const existing = document.getElementById(id);
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = id;

      Object.assign(overlay.style, {
        position: 'fixed',
        bottom: '80px',
        left: '10%',
        transform: 'translateX(-10%)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '50vh',
        overflowY: 'auto',
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.96)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        zIndex: '2147483645',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        border: '2px solid rgba(16, 185, 129, 0.4)',
        opacity: '1',
        transition: 'opacity 0.3s ease',
        backdropFilter: 'blur(10px)'
      });

      overlay.style.cssText += `
      scrollbar-width: thin;
      scrollbar-color: rgba(16, 185, 129, 0.5) rgba(255, 255, 255, 0.1);
    `;

      document.body.appendChild(overlay);
      return overlay;
    }


    applyZoom(zoomVal) {
      const z = Math.max(0.5, Math.min(3.0, zoomVal || 1.0));
      document.documentElement.style.zoom = z;

      try {
        const hadEffect =
          Math.abs((parseFloat(getComputedStyle(document.documentElement).zoom) || 1) - z) < 0.001;

        if (!hadEffect) {
          document.documentElement.style.transformOrigin = '0 0';
          document.documentElement.style.transform = `scale(${z})`;
          document.documentElement.style.width = `${100 / z}%`;
        } else {
          document.documentElement.style.transform = '';
          document.documentElement.style.width = '';
        }
      } catch (_) { /* ignore */ }

      try {
        if (chrome?.storage?.local) {
          const key = 'hoda_voice_zoom_' + (location.origin || 'page');
          chrome.storage.local.set({ [key]: z }).catch?.(() => { });
        }
      } catch (_) { /* ignore */ }

      return z;
    }

    async restoreZoomIfAny() {
      try {
        if (chrome?.storage?.local) {
          const key = 'hoda_voice_zoom_' + (location.origin || 'page');
          const res = await chrome.storage.local.get([key]);
          const saved = parseFloat(res?.[key]);
          if (!isNaN(saved)) this.applyZoom(saved);
        }
      } catch (_) { /* ignore */ }
    }

    /**
     * Detect if current page is a PDF
     * PDFs are typically rendered in <embed> or use PDF.js viewer
     */
    isPDF() {
      // Check for PDF mime type in embeds
      const embed = document.querySelector('embed[type="application/pdf"]');
      if (embed) return true;

      // Check for Chrome's PDF viewer
      if (document.querySelector('embed[name="plugin"]')) return true;

      // Check URL extension
      if (window.location.pathname.toLowerCase().endsWith('.pdf')) return true;

      // Check for Firefox PDF.js viewer
      if (document.getElementById('viewerContainer')) return true;

      return false;
    }

    /**
     * Get current zoom for PDFs via chrome API
     * Must be called from popup/background context
     */
    async getPDFZoom() {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'GET_PDF_ZOOM' },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.success) {
              resolve(response.zoom);
            } else {
              reject(new Error(response?.error || 'Failed to get PDF zoom'));
            }
          }
        );
      });
    }

    /**
     * Set zoom for PDFs via chrome API
     * Must be called from popup/background context
     */
    async setPDFZoom(zoomLevel) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'SET_PDF_ZOOM', zoom: zoomLevel },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.success) {
              resolve(response.zoom);
            } else {
              reject(new Error(response?.error || 'Failed to set PDF zoom'));
            }
          }
        );
      });
    }

    /**
     * Handle zoom for PDF documents using Chrome tabs API
     * PDFs don't support CSS zoom, so we use browser-level zoom instead
     */
    async doZoomPDF(slots, MIN_ZOOM, MAX_ZOOM) {
      const action = (slots?.action || '').toLowerCase();

      try {
        // Get current PDF zoom via chrome API
        const current = await this.getPDFZoom();
        console.log('[Executor] Current PDF zoom:', current);

        // Parse step amount
        const raw = (slots?.amount ?? '').toString().trim();
        let step = 0.1;

        if (raw) {
          if (raw.endsWith('%')) {
            const pct = parseFloat(raw.slice(0, -1));
            if (!isNaN(pct)) step = pct / 100;
          } else {
            const num = parseFloat(raw);
            if (!isNaN(num)) {
              step = num > 1.5 ? num / 100 : num;
            }
          }
        }

        // Calculate target zoom
        let target = current;

        if (action === 'in' || action === 'bigger') {
          target = current + step;
        } else if (action === 'out' || action === 'smaller') {
          target = current - step;
        } else if (action === 'reset' || action === 'normal') {
          target = 1.0;
        } else if (action === 'set') {
          target = raw
            ? (raw.endsWith('%') ? parseFloat(raw) / 100
              : (parseFloat(raw) > 1.5 ? parseFloat(raw) / 100 : parseFloat(raw)))
            : current;
        } else {
          target = current + step;
        }

        // Check boundaries
        const atMinLimit = current <= MIN_ZOOM && (action === 'out' || action === 'smaller');
        const atMaxLimit = current >= MAX_ZOOM && (action === 'in' || action === 'bigger');
        const wouldHitMinLimit = target < MIN_ZOOM;
        const wouldHitMaxLimit = target > MAX_ZOOM;

        // Clamp target
        target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target));

        // Apply zoom via chrome API
        const applied = await this.setPDFZoom(target);
        console.log('[Executor] PDF zoom applied:', applied);

        // Provide feedback
        if (this.feedback) {
          if (atMinLimit || wouldHitMinLimit) {
            this.feedback.speakShort('Already at minimum zoom', { interruptLongReads: true });
            this.feedback.showOverlay(`🔎 PDF Zoom: ${Math.round(applied * 100)}% (Minimum)`, 'warning');
          }
          else if (atMaxLimit || wouldHitMaxLimit) {
            this.feedback.speakShort('Already at maximum zoom', { interruptLongReads: true });
            this.feedback.showOverlay(`🔎 PDF Zoom: ${Math.round(applied * 100)}% (Maximum)`, 'warning');
          }
          else {
            this.feedback.speakShort(`Zoom ${Math.round(applied * 100)} percent`, { interruptLongReads: true });
            this.feedback.showOverlay(`🔎 PDF Zoom: ${Math.round(applied * 100)}%`, 'success');
          }
        }

        return { success: true, message: `PDF Zoom: ${Math.round(applied * 100)}%` };

      } catch (error) {
        console.error('[Executor] PDF zoom failed:', error);

        if (this.feedback) {
          this.feedback.speakShort('Zoom failed for PDF', { interruptLongReads: true });
          this.feedback.showOverlay('⚠️ PDF zoom unavailable', 'error');
        }

        return { success: false, message: error.message };
      }
    }

    async doZoom(slots) {
      const MIN_ZOOM = 0.5;  // 50%
      const MAX_ZOOM = 3.0;  // 300%

      // ============================================================================
      // PDF DETECTION - Use Chrome tabs API for PDFs
      // ============================================================================
      const isPDF = this.isPDF();

      if (isPDF) {
        console.log('[Executor] PDF detected, using Chrome tabs API for zoom');
        return await this.doZoomPDF(slots, MIN_ZOOM, MAX_ZOOM);
      }

      // ============================================================================
      // REGULAR WEBPAGE ZOOM 
      // ============================================================================
      const action = (slots?.action || '').toLowerCase();

      let current =
        parseFloat(document.documentElement.style.zoom) ||
        parseFloat(getComputedStyle(document.documentElement).zoom) ||
        1.0;

      const raw = (slots?.amount ?? '').toString().trim();
      let step = 0.1;

      if (raw) {
        if (raw.endsWith('%')) {
          const pct = parseFloat(raw.slice(0, -1));
          if (!isNaN(pct)) step = pct / 100;
        } else {
          const num = parseFloat(raw);
          if (!isNaN(num)) {
            step = num > 1.5 ? num / 100 : num;
          }
        }
      }

      let target = current;

      if (action === 'in' || action === 'bigger') {
        target = current + step;
      } else if (action === 'out' || action === 'smaller') {
        target = current - step;
      } else if (action === 'reset' || action === 'normal') {
        target = 1.0;
      } else if (action === 'set') {
        target = raw
          ? (raw.endsWith('%') ? parseFloat(raw) / 100
            : (parseFloat(raw) > 1.5 ? parseFloat(raw) / 100 : parseFloat(raw)))
          : current;
      } else {
        target = current + step;
      }

      const atMinLimit = current <= MIN_ZOOM && (action === 'out' || action === 'smaller');
      const atMaxLimit = current >= MAX_ZOOM && (action === 'in' || action === 'bigger');
      const wouldHitMinLimit = target < MIN_ZOOM;
      const wouldHitMaxLimit = target > MAX_ZOOM;

      const applied = this.applyZoom(target);

      if (this.feedback) {
        if (atMinLimit || wouldHitMinLimit) {
          this.feedback.speakShort('Already at minimum zoom', { interruptLongReads: true });
          this.feedback.showOverlay(`🔎 Zoom: ${Math.round(applied * 100)}% (Minimum)`, 'warning');
        }
        else if (atMaxLimit || wouldHitMaxLimit) {
          this.feedback.speakShort('Already at maximum zoom', { interruptLongReads: true });
          this.feedback.showOverlay(`🔎 Zoom: ${Math.round(applied * 100)}% (Maximum)`, 'warning');
        }
        else {
          this.feedback.speakShort(`Zoom ${Math.round(applied * 100)} percent`, { interruptLongReads: true });
          this.feedback.showOverlay(`🔎 Zoom: ${Math.round(applied * 100)}%`, 'success');
        }
      }

      return { success: true, message: `Zoom: ${Math.round(applied * 100)}%` };
    }


    applyTextScale(scaleVal) {
      const s = Math.max(0.5, Math.min(2.5, scaleVal || 1.0));
      const html = document.documentElement;

      if (!this._textScaleBasePx) {
        try {
          const cs = getComputedStyle(html).fontSize;
          this._textScaleBasePx = parseFloat(cs) || 16;
        } catch (_) {
          this._textScaleBasePx = 16;
        }
      }

      const newPx = this._textScaleBasePx * s;
      html.style.fontSize = `${newPx}px`;
      html.setAttribute('data-hoda-text-scale', String(s));

      try {
        if (chrome?.storage?.local) {
          const key = 'hoda_text_scale_' + (location.origin || 'page');
          chrome.storage.local.set({ [key]: s }).catch?.(() => { });
        }
      } catch (_) { /* ignore */ }

      return s;
    }

    async restoreTextScaleIfAny() {
      try {
        const cs = getComputedStyle(document.documentElement).fontSize;
        this._textScaleBasePx = parseFloat(cs) || 16;
      } catch (_) {
        this._textScaleBasePx = 16;
      }

      try {
        if (chrome?.storage?.local) {
          const key = 'hoda_text_scale_' + (location.origin || 'page');
          const res = await chrome.storage.local.get([key]);
          const saved = parseFloat(res?.[key]);
          if (!isNaN(saved)) this.applyTextScale(saved);
        }
      } catch (_) { /* ignore */ }
    }

    async doTextScale(slots) {
      const action = (slots?.action || '').toLowerCase();

      let current = 1.0;
      const html = document.documentElement;
      const attr = parseFloat(html.getAttribute('data-hoda-text-scale'));
      if (!isNaN(attr) && attr > 0) {
        current = attr;
      } else {
        try {
          const cs = getComputedStyle(html).fontSize;
          const px = parseFloat(cs) || 16;
          const base = this._textScaleBasePx || 16;
          current = px / base;
        } catch (_) {
          current = 1.0;
        }
      }

      const raw = (slots?.amount ?? '').toString().trim();
      let step = 0.1; // default 10%
      if (raw) {
        if (raw.endsWith('%')) {
          const pct = parseFloat(raw.slice(0, -1));
          if (!isNaN(pct)) step = pct / 100;
        } else {
          const num = parseFloat(raw);
          if (!isNaN(num)) step = num > 1.5 ? num / 100 : num;
        }
      }

      let target = current;

      if (action === 'in' || action === 'bigger') {
        target = current + step;
      } else if (action === 'out' || action === 'smaller') {
        target = current - step;
      } else if (action === 'reset' || action === 'normal') {
        target = 1.0;
      } else if (action === 'set') {
        target = raw
          ? (raw.endsWith('%') ? parseFloat(raw) / 100
            : (parseFloat(raw) > 1.5 ? parseFloat(raw) / 100 : parseFloat(raw)))
          : current;
      } else {
        target = current + step;
      }

      const applied = this.applyTextScale(target);

      if (this.feedback) {
        this.feedback.speakShort(`Text ${Math.round(applied * 100)} percent`, { interruptLongReads: true });
        this.feedback.showOverlay(`🅰️ Text: ${Math.round(applied * 100)}%`, 'success');
      }

      return { success: true, message: `Text: ${Math.round(applied * 100)}%` };
    }


    findAndHighlight(query) {
      if (!query) return { success: false, message: 'No search query provided' };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const lowerQuery = query.toLowerCase();
      let node;

      while ((node = walker.nextNode())) {
        const text = node.nodeValue.toLowerCase();
        const idx = text.indexOf(lowerQuery);

        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + query.length);

          let highlight = document.createElement('mark');
          highlight.style.background = 'yellow';
          highlight.style.color = 'black';

          try {
            range.surroundContents(highlight);
          } catch (e) {
            try {
              const parent = node.parentNode;
              const before = node.nodeValue.substring(0, idx);
              const matchText = node.nodeValue.substring(idx, idx + query.length);
              const after = node.nodeValue.substring(idx + query.length);

              const beforeNode = document.createTextNode(before);
              const afterNode = document.createTextNode(after);
              const matchNode = document.createElement('mark');
              matchNode.textContent = matchText;
              matchNode.style.background = 'yellow';

              parent.insertBefore(beforeNode, node);
              parent.insertBefore(matchNode, node);
              parent.insertBefore(afterNode, node);
              parent.removeChild(node);

              highlight = matchNode;
            } catch (innerErr) {
              console.error('[Executor] highlight fallback failed', innerErr);
            }
          }

          try { highlight.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }

          setTimeout(() => {
            try {
              if (highlight && highlight.parentNode) {
                const txt = document.createTextNode(highlight.textContent);
                highlight.parentNode.replaceChild(txt, highlight);
              }
            } catch (e) { }
          }, 4000);

          return { success: true, message: `Found "${query}"` };
        }
      }

      return { success: false, message: `"${query}" not found` };
    }

    async doFindContent(slots) {
      const q = (slots.query || '').trim();
      if (!q) return { success: false, message: 'No search query provided' };

      try { return this.findAndHighlight(q); } catch (err) { return { success: false, message: 'Search error' }; }
    }

    /**
     * Initialize PageReader on first use
     */
    async initializePageReader() {
      if (this.pageReader) {
        return this.pageReader;
      }

      try {
        console.log('[Executor] Initializing PageReader');

        // Create PageReader instance (classes are in same file now)
        this.pageReader = new PageReader({
          scrollToBlock: true,
          highlightBlock: true,
          pauseBetweenBlocks: 500
        });

        // Create TTS adapter for PageReader
        const ttsAdapter = {
          speak: (text, options = {}) => {
            console.log('[TTS Adapter] 🔊 Speaking:', text.substring(0, 50) + '...');

            if (!this.feedback) {
              console.error('[TTS Adapter] ❌ No feedback system available');
              if (options.onError) {
                options.onError(new Error('TTS not available'));
              }
              return;
            }

            try {
              // CRITICAL: The callback MUST be called when speech actually finishes
              // speakLong should call the callback when TTS completes
              this.feedback.speakLong(text, () => {
                console.log('[TTS Adapter] ✅ Speech completed callback fired');
                if (options.onEnd) {
                  options.onEnd();
                }
              });
            } catch (error) {
              console.error('[TTS Adapter] ❌ Speech error:', error);
              if (options.onError) {
                options.onError(error);
              }
            }
          },

          stop: () => {
            console.log('[TTS Adapter] 🛑 Stopping speech');
            if (this.feedback) {
              this.feedback.stopSpeech();
            }
          }
        };

        this.pageReader.setTTS(ttsAdapter);

        console.log('[Executor] ✅ PageReader initialized with TTS adapter');
        return this.pageReader;
      } catch (error) {
        console.error('[Executor] ❌ Failed to initialize PageReader:', error);
        throw error;
      }
    }

    async doRead(slots) {
      const action = (slots.action || '').toLowerCase();
      const scope = (slots.scope || slots.target || '').toLowerCase();

      console.log('[Executor] doRead called:', { action, scope, slots });

      try {
        // Initialize PageReader if needed
        const reader = await this.initializePageReader();
        console.log('[Executor] PageReader ready');

        // Handle stop command
        if (action === 'stop') {
          console.log('[Executor] Stopping reading');
          await reader.stopReading();
          this.speakShort('Stopped reading');
          return { success: true, message: 'Stopped reading' };
        }

        // Handle pause command
        if (action === 'pause') {
          console.log('[Executor] Pausing reading');
          const result = await reader.pauseReading();
          if (result.success) {
            return { success: true, message: 'Paused' };
          }
          this.speakShort('Nothing to pause');
          return { success: false, message: 'Not currently reading' };
        }

        // Handle resume command
        if (action === 'resume' || action === 'continue') {
          console.log('[Executor] Resuming reading');
          const result = await reader.resumeReading();
          if (result.success) {
            return { success: true, message: 'Resumed' };
          }
          this.speakShort('Nothing to resume');
          return { success: false, message: 'Nothing to resume' };
        }

        // Handle next paragraph
        if (action === 'next' && (scope === 'paragraph' || !scope)) {
          console.log('[Executor] Next paragraph');
          const result = await reader.nextParagraph();
          if (result.success) {
            return { success: true, message: 'Next paragraph' };
          }
          return { success: false, message: result.error || 'No next paragraph' };
        }

        // Handle previous paragraph
        if (action === 'previous' && (scope === 'paragraph' || !scope)) {
          console.log('[Executor] Previous paragraph');
          const result = await reader.previousParagraph();
          if (result.success) {
            return { success: true, message: 'Previous paragraph' };
          }
          return { success: false, message: result.error || 'No previous paragraph' };
        }

        // Handle read from here
        if (scope === 'here' || action === 'here') {
          console.log('[Executor] Reading from current position');
          const result = await reader.readFromHere();
          if (result.success) {
            return { success: true, message: 'Reading from here' };
          }
          this.speakShort(result.error || 'No content to read');
          return { success: false, message: result.error || 'No content to read' };
        }

        // Handle read visible area
        if (scope === 'this' || scope === 'visible' || scope === 'screen') {
          console.log('[Executor] Reading visible area');
          const text = this.getViewportText();

          if (!text) {
            this.speakShort('No visible text found');
            return { success: false, message: 'No visible text found' };
          }

          if (this.feedback) {
            this.feedback.speakLong(text);
          }

          return { success: true, message: 'Reading visible area' };
        }

        // Default: read page from top
        console.log('[Executor] Reading full page');
        const result = await reader.readPage();

        if (result.success) {
          console.log('[Executor] Started reading', result.blocksCount, 'blocks');
          return { success: true, message: `Reading page (${result.blocksCount} sections)` };
        }

        this.speakShort(result.error || 'No content to read');
        return { success: false, message: result.error || 'No content to read' };

      } catch (error) {
        console.error('[Executor] ❌ doRead error:', error);

        // Fallback to simple text reading
        console.log('[Executor] Falling back to simple text extraction');

        let text = '';
        if (scope === 'this' || scope === 'visible') {
          text = this.getViewportText();
        } else {
          text = this.extractPageText();
        }

        if (!text) {
          this.speakShort('No readable text found on page');
          return { success: false, message: 'No text found' };
        }

        if (this.feedback) {
          this.feedback.speakLong(text);
        }

        return {
          success: true,
          message: `Reading ${scope === 'this' ? 'visible area' : 'page'} (fallback mode)`,
          fallback: true
        };
      }
    }

    async doHelp() {
      const helpText = `Voice Commands:
      - Navigation: scroll, go to top/bottom, back, forward
      - Reading: read page, stop, pause, resume
      - Zoom: zoom in/out, reset zoom
      - Links: list links, open link 1
      - Search: find [text]
      - Stop: say "stop" to interrupt`;

      this.showHelpOverlay(helpText);
      return { success: true, message: 'Help shown' };
    }
    // ============================================================================
    // FORM FILLING METHODS
    // ============================================================================

    /**
     * Execute form actions (fill, select, submit, list)
     */
    async doFormAction(slots) {
      const action = slots.action;
      const field = slots.field;
      const value = slots.value;
      const target = slots.target;

      console.log('[Executor] Form action:', { action, field, value, target });

      try {
        // Detect all forms on page
        const forms = this.detectForms();

        if (forms.length === 0) {
          this.speakShort('No forms found on page');
          return {
            success: false,
            message: 'No forms found on page'
          };
        }

        // Get all form fields
        const allFields = this.getAllFormFields(forms);

        // Handle "list fields" command
        if (action === 'list' || (field && field.toLowerCase() === 'fields')) {
          this.showFieldList(allFields);
          this.speakShort(`Found ${allFields.length} form fields`);
          return {
            success: true,
            message: `Found ${allFields.length} form fields`
          };
        }

        // Handle form submission
        if (action === 'submit') {
          return await this.handleFormSubmission(forms[0]);
        }

        // Handle field filling
        if (action === 'fill' && field) {
          return await this.handleFieldFill(allFields, field, value);
        }

        // Handle selection controls (checkbox, radio, dropdown)
        if ((action === 'select' || action === 'check' || action === 'uncheck') && (field || target)) {
          return await this.handleFieldSelection(allFields, field || target, action);
        }

        return {
          success: false,
          message: 'Invalid form action'
        };

      } catch (err) {
        console.error('[Executor] Form action error:', err);
        this.speakShort('Form action failed');
        return {
          success: false,
          message: err.message || 'Form action failed'
        };
      }
    }

    /**
     * Detect all forms on the page
     */
    detectForms() {
      const forms = Array.from(document.querySelectorAll('form'));
      console.log(`[Executor] Found ${forms.length} forms`);
      return forms;
    }

    /**
     * Get all visible form fields from all forms
     */
    getAllFormFields(forms) {
      const fields = [];

      forms.forEach(form => {
        const inputs = form.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]), select, textarea'
        );

        inputs.forEach(input => {
          // Skip hidden or disabled fields
          if (input.offsetParent === null || input.disabled) return;

          const label = this.getFieldLabel(input);
          const fieldInfo = {
            element: input,
            label: label,
            name: input.name || input.id || '',
            type: input.type || input.tagName.toLowerCase(),
            id: input.id
          };

          fields.push(fieldInfo);
        });
      });

      console.log(`[Executor] Found ${fields.length} visible fields`);
      return fields;
    }

    /**
     * Get label text for a form field
     */
    getFieldLabel(input) {
      // Try to find associated label
      if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent.trim();
      }

      // Try parent label
      const parentLabel = input.closest('label');
      if (parentLabel) {
        return parentLabel.textContent.replace(input.value, '').trim();
      }

      // Try aria-label
      if (input.getAttribute('aria-label')) {
        return input.getAttribute('aria-label');
      }

      // Try aria-labelledby
      if (input.getAttribute('aria-labelledby')) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelElement = document.getElementById(labelId);
        if (labelElement) return labelElement.textContent.trim();
      }

      // Try placeholder
      if (input.placeholder) {
        return input.placeholder;
      }

      // Try name/id as fallback
      return input.name || input.id || 'Unknown field';
    }

    /**
     * Find form field by name/label with fuzzy matching
     */
    findFormField(fields, fieldName) {
      const lowerName = fieldName.toLowerCase();

      // Try exact match first
      let field = fields.find(f =>
        f.label.toLowerCase() === lowerName ||
        f.name.toLowerCase() === lowerName ||
        f.id.toLowerCase() === lowerName
      );

      if (field) return field;

      // Try partial match
      field = fields.find(f =>
        f.label.toLowerCase().includes(lowerName) ||
        f.name.toLowerCase().includes(lowerName) ||
        f.id.toLowerCase().includes(lowerName) ||
        lowerName.includes(f.label.toLowerCase()) ||
        lowerName.includes(f.name.toLowerCase())
      );

      return field || null;
    }

    /**
     * Handle field filling
     */
    async handleFieldFill(fields, fieldName, value) {
      const field = this.findFormField(fields, fieldName);

      if (!field) {
        this.speakShort(`Field ${fieldName} not found. Say list fields to see available fields.`);
        return {
          success: false,
          message: `Field "${fieldName}" not found. Say "list fields" to see available fields.`
        };
      }

      // Show field found overlay
      this.showFieldFoundOverlay(field);

      // If no value provided, just focus the field and wait
      if (!value) {
        field.element.focus();
        this.speakShort(`Found ${field.label} field. Say the value to fill.`);
        return {
          success: true,
          message: `Found "${field.label}" field. Ready to fill.`,
          requiresValue: true,
          pendingField: field
        };
      }

      // Fill the field
      field.element.value = value;
      field.element.focus();

      // Trigger events for React/Vue reactivity
      field.element.dispatchEvent(new Event('input', { bubbles: true }));
      field.element.dispatchEvent(new Event('change', { bubbles: true }));
      field.element.dispatchEvent(new Event('blur', { bubbles: true }));

      this.speakShort(`Filled ${field.label} with ${value}`);

      return {
        success: true,
        message: `Filled "${field.label}" with "${value}"`
      };
    }

    /**
     * Handle field selection (checkbox, radio, dropdown)
     */
    async handleFieldSelection(fields, fieldName, action) {
      const field = this.findFormField(fields, fieldName);

      if (!field) {
        this.speakShort(`Field ${fieldName} not found.`);
        return {
          success: false,
          message: `Field "${fieldName}" not found. Say "list fields" to see available fields.`
        };
      }

      const element = field.element;

      // Handle checkbox
      if (element.type === 'checkbox') {
        if (action === 'uncheck') {
          element.checked = false;
        } else {
          element.checked = !element.checked;
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));

        this.speakShort(`${element.checked ? 'Checked' : 'Unchecked'} ${field.label}`);

        return {
          success: true,
          message: `${element.checked ? 'Checked' : 'Unchecked'} "${field.label}"`
        };
      }

      // Handle radio
      if (element.type === 'radio') {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));

        this.speakShort(`Selected ${field.label}`);

        return {
          success: true,
          message: `Selected "${field.label}"`
        };
      }

      // Handle select dropdown
      if (element.tagName.toLowerCase() === 'select') {
        // Show options
        const options = Array.from(element.options).map((opt, i) => ({
          index: i,
          text: opt.text,
          value: opt.value
        }));

        this.showSelectOptions(field, options);
        this.speakShort(`Showing options for ${field.label}. Say the option number.`);

        return {
          success: true,
          message: `Showing options for "${field.label}". Say the option number.`,
          requiresSelection: true,
          pendingField: field,
          options: options
        };
      }

      return {
        success: false,
        message: `Cannot select field type: ${field.type}`
      };
    }

    /**
     * Handle form submission with validation
     */
    async handleFormSubmission(form) {
      // Validate form first
      const isValid = form.checkValidity();

      if (!isValid) {
        // Find first invalid field
        const invalidFields = Array.from(form.querySelectorAll(':invalid'));

        if (invalidFields.length > 0) {
          const firstInvalid = invalidFields[0];
          const label = this.getFieldLabel(firstInvalid);
          const validationMsg = firstInvalid.validationMessage;

          this.showValidationError(label, validationMsg);
          this.speakShort(`Validation error: ${label}. ${validationMsg}`);

          return {
            success: false,
            message: `Validation error: ${label} - ${validationMsg}`
          };
        }
      }

      // Count filled fields
      const fields = form.querySelectorAll('input, select, textarea');
      const filledCount = Array.from(fields).filter(f => f.value).length;

      // Show confirmation
      this.showSubmitConfirmation(form, filledCount);
      this.speakShort(`Ready to submit form with ${filledCount} fields filled. Say confirm to proceed.`);

      // Actually submit (you might want to add confirmation logic here)
      // form.submit();

      return {
        success: true,
        message: `Ready to submit form with ${filledCount} fields. Say "confirm" to proceed.`,
        requiresConfirmation: true,
        pendingForm: form
      };
    }

    /**
     * Show list of form fields
     */
    showFieldList(fields) {
      const overlay = this.createFormOverlay('hoda-field-list');

      const fieldsByType = {
        text: fields.filter(f => ['text', 'email', 'password', 'tel', 'url', 'number', 'textarea'].includes(f.type)),
        checkbox: fields.filter(f => f.type === 'checkbox'),
        radio: fields.filter(f => f.type === 'radio'),
        select: fields.filter(f => f.type === 'select')
      };

      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 12px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
      <span>📋</span>
      <span>Form Fields (${fields.length} total)</span>
    </div>
    ${fieldsByType.text.length > 0 ? `
      <div style="margin: 10px 0;">
        <strong style="color: #10b981;">Text Fields:</strong>
        <ul style="margin: 5px 0; padding-left: 20px; list-style: none;">
          ${fieldsByType.text.map(f => `<li style="padding: 3px 0;">• ${f.label}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${fieldsByType.checkbox.length > 0 ? `
      <div style="margin: 10px 0;">
        <strong style="color: #10b981;">Checkboxes:</strong>
        <ul style="margin: 5px 0; padding-left: 20px; list-style: none;">
          ${fieldsByType.checkbox.map(f => `<li style="padding: 3px 0;">• ${f.label}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${fieldsByType.select.length > 0 ? `
      <div style="margin: 10px 0;">
        <strong style="color: #10b981;">Dropdowns:</strong>
        <ul style="margin: 5px 0; padding-left: 20px; list-style: none;">
          ${fieldsByType.select.map(f => `<li style="padding: 3px 0;">• ${f.label}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    <div style="font-size: 12px; opacity: 0.8; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
      Say "fill [field name]" to enter data
    </div>
  `;
    }

    /**
     * Show field found overlay
     */
    showFieldFoundOverlay(field) {
      const overlay = this.createFormOverlay('hoda-field-found');
      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
      <span>✏️</span>
      <span>Field Found</span>
    </div>
    <div style="margin: 10px 0; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">
      <strong style="color: #10b981;">${field.label}</strong>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 5px;">
        Type: ${field.type}
      </div>
    </div>
    <div style="font-size: 12px; opacity: 0.8;">
      Say the value to fill
    </div>
  `;

      // Highlight the field
      field.element.style.outline = '3px solid #10b981';
      field.element.style.outlineOffset = '2px';
      field.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        field.element.style.outline = '';
        field.element.style.outlineOffset = '';
      }, 3000);
    }

    /**
     * Show select dropdown options
     */
    showSelectOptions(field, options) {
      const overlay = this.createFormOverlay('hoda-select-options');
      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
      <span>📋</span>
      <span>${field.label} Options</span>
    </div>
    <ul style="margin: 10px 0; padding-left: 0; max-height: 300px; overflow-y: auto; list-style: none;">
      ${options.slice(0, 10).map(opt =>
        `<li style="margin: 6px 0; padding: 8px; background: rgba(255, 255, 255, 0.06); border-radius: 4px;">
          <strong style="color: #10b981;">${opt.index + 1}.</strong> ${opt.text}
        </li>`
      ).join('')}
    </ul>
    <div style="font-size: 12px; opacity: 0.8; margin-top: 10px;">
      Say "option" followed by a number (1-${Math.min(options.length, 10)})
    </div>
  `;
    }

    /**
     * Show submit confirmation overlay
     */
    showSubmitConfirmation(form, filledCount) {
      const overlay = this.createFormOverlay('hoda-submit-confirm');

      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; font-size: 16px; display: flex; align-items: center; gap: 8px;">
      <span>✅</span>
      <span>Ready to Submit</span>
    </div>
    <div style="margin: 10px 0; padding: 12px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">
      <div style="color: #10b981; font-weight: 500;">${filledCount} fields filled</div>
    </div>
    <div style="font-size: 12px; opacity: 0.8;">
      Say "confirm" to submit, or "cancel"
    </div>
  `;
    }

    /**
     * Show validation error overlay
     */
    showValidationError(fieldLabel, message) {
      const overlay = this.createFormOverlay('hoda-validation-error');
      overlay.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; color: #ef4444; display: flex; align-items: center; gap: 8px;">
      <span>❌</span>
      <span>Validation Error</span>
    </div>
    <div style="margin: 10px 0; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3);">
      <strong style="color: #ef4444;">${fieldLabel}</strong>
      <div style="margin-top: 6px; font-size: 13px;">${message}</div>
    </div>
    <div style="font-size: 12px; opacity: 0.8;">
      Say "fill ${fieldLabel}" to correct
    </div>
  `;
    }

    /**
     * Create form-specific overlay
     */
    createFormOverlay(id) {
      // Remove existing
      const existing = document.getElementById(id);
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = id;

      Object.assign(overlay.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        zIndex: '2147483646',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        maxWidth: '420px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)'
      });

      document.body.appendChild(overlay);

      // Auto-hide after 10 seconds
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => overlay.remove(), 500);
      }, 10000);

      return overlay;
    }

    getViewportText() {
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const rect = parent.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        const parts = [];
        let n;

        while ((n = walker.nextNode())) {
          parts.push(n.nodeValue.trim());
          if (parts.length >= 200) break;
        }

        return parts.join(' ').replace(/\s+/g, ' ').trim();
      } catch (e) {
        return '';
      }
    }

    extractPageText() {
      const main = document.querySelector('main, article, .content, [role="main"]');
      const target = main || document.body;
      const clone = target.cloneNode(true);
      clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
      return clone.textContent.trim().substring(0, 5000);
    }

    showHelpOverlay(text) {
      const overlay = this.createOverlay('hoda-help');
      overlay.innerHTML = `<div style="font-weight: bold; margin-bottom: 10px;">🎤 Hoda Voice Commands</div><pre style="white-space: pre-wrap; font-family: system-ui; font-size: 13px;">${text}</pre>`;
      overlay.style.maxWidth = '500px';
    }

    createOverlay(id) {
      const existing = document.getElementById(id);
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = id;

      Object.assign(overlay.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        zIndex: '2147483646',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      });

      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s';
        setTimeout(() => overlay.remove(), 500);
      }, 8000);

      return overlay;
    }
  }

  // ============================================================================
  // MESSAGE HANDLER - Handles messages from popup
  // ============================================================================
  // Internal logic: ALWAYS respond immediately to prevent Chrome from closing channel

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] 📨 Received message:', message.type);

    // PING
    if (message.type === 'PING') {
      sendResponse({
        ok: true,
        speechReady: speechReady,
        speechInjected: speechInjected,
        url: location.href
      });
      return false;
    }

    // START_SPEECH
    if (message.type === 'START_SPEECH') {
      console.log('[Content] START_SPEECH requested');

      sendResponse({ success: true });

      if (!speechInjected) {
        console.log('[Content] Speech not injected, injecting now...');
        injectSpeechIntoPage();
      }

      if (speechReady) {
        console.log('[Content] Speech ready, starting now');
        isListening = true;
        window.postMessage({ type: 'HODA_START_SPEECH' }, '*');
      } else {
        console.log('[Content] Speech not ready, queueing start...');
        pendingStart = true;
        window.postMessage({ type: 'HODA_CHECK_READY' }, '*');

        setTimeout(() => {
          if (!speechReady && pendingStart) {
            console.error('[Content] Speech not ready after timeout');
            pendingStart = null;

            chrome.runtime.sendMessage({
              type: 'SPEECH_ERROR',
              error: 'not-ready',
              message: 'Speech recognition not initialized. Please reload the page.'
            }).catch(() => { });
          }
        }, 1000);
      }

      return false;
    }

    // STOP_SPEECH
    if (message.type === 'STOP_SPEECH') {
      console.log('[Content] STOP_SPEECH requested');

      sendResponse({ success: true });

      isListening = false;
      window.postMessage({ type: 'HODA_STOP_SPEECH' }, '*');

      return false;
    }

    // CHECK_SPEECH_READY
    if (message.type === 'CHECK_SPEECH_READY') {
      sendResponse({
        success: true,
        ready: speechReady,
        injected: speechInjected
      });
      return false;
    }

    // EXECUTE_COMMAND
    if (message.type === 'EXECUTE_COMMAND') {
      console.log('[Content] EXECUTE_COMMAND:', message.command.intent);

      sendResponse({ ok: true });

      // Queue command
      if (window.__hoda_queue) {
        const priority = window.__hoda_queue.isPriorityCommand(message.command.intent);
        window.__hoda_queue.enqueue(message.command, priority);
      } else {
        console.warn('[Content] Queue not initialized, cannot execute command');
      }

      return false;
    }

    // GET_QUEUE_STATUS
    if (message.type === 'GET_QUEUE_STATUS') {
      if (window.__hoda_queue) {
        sendResponse({ ok: true, status: window.__hoda_queue.getStatus() });
      } else {
        sendResponse({ ok: true, status: { queueLength: 0, isProcessing: false } });
      }
      return false;
    }

    // TEST_COMMAND - Direct execution for debugging (bypasses queue)
    if (message.type === 'TEST_COMMAND') {
      console.log('[Debug] 🧪 Testing command:', message.command);

      (async () => {
        try {
          // Validate command format
          if (!message.command || typeof message.command !== 'object') {
            throw new Error('Invalid command format. Use: {intent: "zoom", slots: {action: "in"}}');
          }

          if (!message.command.intent) {
            throw new Error('Command must have "intent" property');
          }

          // Execute command directly (bypass queue for testing)
          console.log('[Debug] ⚡ Executing command:', message.command.intent, message.command.slots || {});
          const result = await executor.execute(message.command);

          console.log('[Debug] ✅ Command executed:', result);

          // Send response back to popup
          chrome.runtime.sendMessage({
            type: 'TEST_COMMAND_RESPONSE',
            requestId: message.requestId,
            success: true,
            result: result
          }).catch(() => { });

        } catch (error) {
          console.error('[Debug] ❌ Command failed:', error);

          // Send error response back to popup
          chrome.runtime.sendMessage({
            type: 'TEST_COMMAND_RESPONSE',
            requestId: message.requestId,
            success: false,
            error: error.message
          }).catch(() => { });
        }
      })();

      sendResponse({ ok: true });
      return false;
    }

    return false;
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Inject CSS for page reading highlights
  function injectReadingCSS() {
    const style = document.createElement('style');
    style.id = 'hoda-reading-styles';
    style.textContent = `
      /* Hoda Page Reading Highlight Styles */
      .hoda-reading-highlight {
        background-color: rgba(255, 255, 0, 0.3) !important;
        outline: 2px solid #ffcc00 !important;
        outline-offset: 2px !important;
        transition: all 0.3s ease !important;
        animation: hoda-pulse 0.5s ease-in-out !important;
      }

      @keyframes hoda-pulse {
        0% { background-color: rgba(255, 255, 0, 0.5); }
        50% { background-color: rgba(255, 255, 0, 0.2); }
        100% { background-color: rgba(255, 255, 0, 0.3); }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .hoda-reading-highlight {
          background-color: rgba(255, 255, 0, 0.2) !important;
          outline-color: #ccaa00 !important;
        }
      }
    `;

    if (!document.getElementById('hoda-reading-styles')) {
      (document.head || document.documentElement).appendChild(style);
      console.log('[Content] Reading highlight CSS injected');
    }
  }

  // Inject CSS when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectReadingCSS);
  } else {
    injectReadingCSS();
  }

  // Initialize feedback and executor
  const feedback = new FeedbackManager();
  const executor = new CommandExecutor(feedback);
  const queue = new CommandQueue();

  executor.restoreZoomIfAny?.();
  executor.restoreTextScaleIfAny?.();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[content.js] 📩 Received message:', message);

    if (message.action === 'executeIntent') {
      const intent = message.intent;

      console.log('[content.js] 🎯 Executing:', intent.intent, intent.slots);

      try {
        // ✅ FIXED: Use "executor" (matches line 1689)
        const result = executor.execute(intent);

        console.log('[content.js] ✅ Success');
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[content.js] ❌ Failed:', error);
        sendResponse({ success: false, error: error.message });
      }

      return true; // Keep channel open
    }

    if (message.action === 'ping') {
      sendResponse({ success: true, status: 'ready' });
      return true;
    }

    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  });

  console.log('[content.js] 📡 Message listener active');

  // Expose globally for queue to access
  window.__hoda = window.__hoda || {};
  window.__hoda.feedback = feedback;
  window.__hoda_executor = executor;
  window.__hoda_queue = queue;

  console.log('[Content] ✅ Content script ready');
  console.log('[Content] Speech injected:', speechInjected);
  console.log('[Content] Speech ready:', speechReady);
  console.log('[Content] Queue, Feedback, Executor initialized');

})();