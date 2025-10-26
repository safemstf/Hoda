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

    speakLong(text) {
      if (!text) return;

      this.stopSpeech();

      const chunks = this._chunkTextToSentences(text, 1600);
      if (!chunks || !chunks.length) return;

      this._tts.chunks = chunks;
      this._tts.chunkIndex = 0;
      this._tts.autoContinue = true;
      this._tts.stopped = false;

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
      if (this._tts.stopped) return;

      const idx = this._tts.chunkIndex;
      if (!this._tts.chunks || idx >= this._tts.chunks.length) {
        this._tts.utterance = null;
        this._tts.autoContinue = false;
        this._setSpeaking(false);
        console.log('[Feedback] finished all chunks');
        return;
      }

      const chunk = this._tts.chunks[idx];
      const u = new SpeechSynthesisUtterance(chunk);

      try {
        const voice = this.getPreferredVoice();
        if (voice) u.voice = voice;
      } catch (e) {
        console.warn('[Feedback] failed to set voice for chunk', e);
      }

      u.rate = this.settings.ttsRate ?? 0.95;
      u.pitch = this.settings.ttsPitch ?? 1.0;
      u.volume = 0.95;

      u.onend = () => {
        if (this._tts.stopped) {
          this._tts.utterance = null;
          this._setSpeaking(false);
          return;
        }

        this._tts.chunkIndex += 1;
        this._tts.utterance = null;

        if (this._tts.autoContinue && this._tts.chunkIndex < this._tts.chunks.length) {
          setTimeout(() => {
            if (!this._tts.stopped) this._speakNextChunk();
          }, 200);
        } else {
          this._tts.autoContinue = false;
          this._tts.utterance = null;
          this._setSpeaking(false);
        }
      };

      u.onerror = (e) => {
        console.error('[Feedback] TTS chunk error', e);
        this._tts.utterance = null;
        this._tts.autoContinue = false;
        this._setSpeaking(false);
      };

      this._tts.utterance = u;

      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error('[Feedback] speak failed', e);
        this._setSpeaking(false);
      }
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
  class CommandExecutor {
    constructor(feedback) {
      this.feedback = feedback;
      this.linkList = [];
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
          case 'link_action':
            result = await this.doLinkAction(slots);
            break;
          case 'read':
            result = await this.doRead(slots);
            break;
          case 'find_content':
            result = await this.doFindContent(slots);
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
            <div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.06); border-radius: 6px;">
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
        left: '50%',
        transform: 'translateX(-50%)',
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

    async doZoom(slots) {
      const action = slots.action;
      const amount = parseFloat(slots.amount) || 0.1;

      let currentZoom = parseFloat(document.body.style.zoom) || 1.0;

      if (action === 'in' || action === 'bigger') {
        currentZoom += amount;
      } else if (action === 'out' || action === 'smaller') {
        currentZoom -= amount;
      } else if (action === 'reset' || action === 'normal') {
        currentZoom = 1.0;
      }

      currentZoom = Math.max(0.5, Math.min(3.0, currentZoom));
      document.body.style.zoom = currentZoom;

      return { success: true, message: `Zoom: ${Math.round(currentZoom * 100)}%` };
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

    async doRead(slots) {
      const action = (slots.action || '').toLowerCase();
      const scope = (slots.scope || slots.target || '').toLowerCase();

      if (action === 'stop') {
        if (this.feedback) {
          this.feedback.stopSpeech();
          return { success: true, message: 'Stopped reading' };
        }
        return { success: false, message: 'Not reading' };
      }

      if (action === 'pause') {
        if (this.feedback && this.feedback.pauseSpeech()) {
          return { success: true, message: 'Paused' };
        }
        return { success: false, message: 'Not currently speaking' };
      }

      if (action === 'resume') {
        if (this.feedback && this.feedback.resumeSpeech()) {
          return { success: true, message: 'Resumed' };
        }
        return { success: false, message: 'Nothing to resume' };
      }

      let text = '';
      if (scope === 'this' || scope === 'visible') {
        text = this.getViewportText();
      } else {
        text = this.extractPageText();
      }

      if (!text) return { success: false, message: 'No text found' };

      if (this.feedback) {
        this.feedback.speakLong(text);
      }

      return { success: true, message: `Reading (${scope === 'this' ? 'visible area' : 'page'})` };
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
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Initialize feedback and executor
  const feedback = new FeedbackManager();
  const executor = new CommandExecutor(feedback);
  const queue = new CommandQueue();

  // ============================================================================
  // MESSAGE LISTENER - Bridge to popup.js
  // ============================================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[content.js] 📩 Received message:', message);

    if (message.action === 'executeIntent') {
      const intent = message.intent;

      console.log('[content.js] 🎯 Executing:', intent.intent, intent.slots);

      try {
        // CRITICAL: Use "executor" not "commandExecutor"
        const result = executor.execute(intent);

        console.log('[content.js] ✅ Success');
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('[content.js] ❌ Failed:', error);
        sendResponse({ success: false, error: error.message });
      }

      return true;
    }

    if (message.action === 'ping') {
      console.log('[content.js] 🏓 Ping received');
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