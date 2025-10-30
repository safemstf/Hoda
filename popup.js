/**
 * ============================================================================
 * HODA VOICE ASSISTANT - OBJECT-ORIENTED ARCHITECTURE
 * ============================================================================
 */

import { IntentResolver } from './services/stt/src/intentResolver.js';

// ============================================================================
// SERVICE LOADER - Handles Optional Module Loading
// ============================================================================
class ServiceLoader {
  static async loadWebLLM() {
    try {
      const { createService } = await import('./services/webllm/src/index.js');
      console.log('[ServiceLoader] ✅ WebLLM module loaded');
      return createService;
    } catch (error) {
      console.log('[ServiceLoader] ⚠️ WebLLM not available (optional)');
      return null;
    }
  }

  static async loadTTS() {
    try {
      const { createTTSService } = await import('./services/tts/src/index.js');
      console.log('[ServiceLoader] ✅ TTS module loaded');
      return createTTSService;
    } catch (error) {
      console.log('[ServiceLoader] ⚠️ TTS not available (optional)');
      return null;
    }
  }
}

// ============================================================================
// WAKE WORD DETECTOR
// ============================================================================
class WakeWordDetector {
  constructor(options = {}) {
    this.wakeWords = options.wakeWords || ['hoda', 'hey hoda'];
    this.requireWakeWord = options.requireWakeWord || false;
    this.isAwake = false;
    this.awakeTimer = null;
    this.commandTimeout = options.commandTimeout || 5000;
    console.log('[WakeWord] Initialized');
  }

  process(text) {
    const cleanText = text.toLowerCase().trim();
    const hasWakeWord = this.detectWakeWord(cleanText);

    if (hasWakeWord) {
      const command = this.extractCommand(cleanText);
      this.wake();
      if (command) {
        return { type: 'wake_and_command', isWake: true, command, original: text };
      } else {
        return { type: 'wake', isWake: true, command: null, original: text };
      }
    } else if (this.isAwake) {
      this.sleep();
      return { type: 'command_after_wake', isWake: false, command: cleanText, original: text };
    } else if (!this.requireWakeWord) {
      return { type: 'direct_command', isWake: false, command: cleanText, original: text };
    } else {
      return { type: 'ignored', isWake: false, command: null, original: text, reason: 'wake_word_required' };
    }
  }

  detectWakeWord(text) {
    for (const wakeWord of this.wakeWords) {
      if (text === wakeWord || text.startsWith(wakeWord + ' ')) return true;
      const regex = new RegExp('\\b' + wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(text)) return true;
    }
    return false;
  }

  extractCommand(text) {
    for (const wakeWord of this.wakeWords) {
      if (text.startsWith(wakeWord + ' ')) {
        return text.substring(wakeWord.length + 1).trim();
      } else if (text === wakeWord) {
        return null;
      } else {
        const regex = new RegExp('\\b' + wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b\\s*', 'i');
        const command = text.replace(regex, '').trim();
        if (command && command !== text) return command;
      }
    }
    return null;
  }

  wake() {
    if (this.isAwake) {
      this.resetTimer();
      return;
    }
    console.log('[WakeWord] 🔔 Detected');
    this.isAwake = true;
    this.resetTimer();
  }

  sleep() {
    if (!this.isAwake) return;
    this.isAwake = false;
    this.clearTimer();
  }

  resetTimer() {
    this.clearTimer();
    this.awakeTimer = setTimeout(() => this.sleep(), this.commandTimeout);
  }

  clearTimer() {
    if (this.awakeTimer) {
      clearTimeout(this.awakeTimer);
      this.awakeTimer = null;
    }
  }

  setWakeWordRequired(required) {
    this.requireWakeWord = required;
    if (!required && this.isAwake) this.sleep();
  }

  getState() {
    return { isAwake: this.isAwake, requireWakeWord: this.requireWakeWord };
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================
class RateLimiter {
  constructor(options = {}) {
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 10;
    this.maxRequestsPerDay = options.maxRequestsPerDay || 100;
    this.requests = [];
    this.dailyCount = 0;
    this.lastReset = Date.now();
    console.log('[RateLimiter] Initialized');
  }

  checkDailyReset() {
    const now = Date.now();
    const dayInMs = 86400000;
    if (now - this.lastReset > dayInMs) {
      this.dailyCount = 0;
      this.lastReset = now;
      chrome.storage.local.set({ rateLimitReset: now, dailyUsage: 0 });
    }
  }

  canMakeRequest() {
    this.checkDailyReset();
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);

    if (this.requests.length >= this.maxRequestsPerMinute) {
      return { ok: false, reason: 'minute_limit' };
    }
    if (this.dailyCount >= this.maxRequestsPerDay) {
      return { ok: false, reason: 'daily_limit' };
    }

    this.requests.push(now);
    this.dailyCount++;
    chrome.storage.local.set({ dailyUsage: this.dailyCount });
    return { ok: true };
  }

  getStatus() {
    this.checkDailyReset();
    return {
      dailyCount: this.dailyCount,
      dailyLimit: this.maxRequestsPerDay,
      remaining: this.maxRequestsPerDay - this.dailyCount,
      resetTime: new Date(this.lastReset + 86400000).toLocaleString()
    };
  }

  async loadFromStorage() {
    const stored = await chrome.storage.local.get(['rateLimitReset', 'dailyUsage']);
    if (stored.rateLimitReset) {
      this.lastReset = stored.rateLimitReset;
    }
    if (stored.dailyUsage !== undefined) {
      this.dailyCount = stored.dailyUsage;
    } else {
      await chrome.storage.local.set({
        rateLimitReset: this.lastReset,
        dailyUsage: 0
      });
    }
    this.checkDailyReset();
  }
}

// ============================================================================
// STORAGE MANAGER
// ============================================================================
class StorageManager {
  constructor() {
    console.log('[StorageManager] Initialized');
  }

  async saveTranscript(transcript) {
    try {
      const result = await chrome.storage.local.get(['transcripts']);
      let transcripts = result.transcripts || [];
      transcripts.push(transcript);
      if (transcripts.length > 50) transcripts = transcripts.slice(-50);
      await chrome.storage.local.set({ transcripts });
    } catch (err) {
      console.error('[StorageManager] Failed to save transcript:', err);
    }
  }

  async getRecentTranscripts(count = 5) {
    try {
      const result = await chrome.storage.local.get(['transcripts']);
      const transcripts = result.transcripts || [];
      return transcripts.slice(-count);
    } catch (err) {
      console.error('[StorageManager] Failed to get transcripts:', err);
      return [];
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['stats']);
      return result.stats || { totalCommands: 0, recognizedCommands: 0 };
    } catch (err) {
      console.error('[StorageManager] Failed to load stats:', err);
      return { totalCommands: 0, recognizedCommands: 0 };
    }
  }

  async saveStats(stats) {
    try {
      await chrome.storage.local.set({ stats });
    } catch (err) {
      console.error('[StorageManager] Failed to save stats:', err);
    }
  }

  async loadPreferences() {
    try {
      return await chrome.storage.local.get(['wakeWordRequired', 'ttsEnabled']);
    } catch (err) {
      console.error('[StorageManager] Failed to load preferences:', err);
      return {};
    }
  }
}

// ============================================================================
// TAB MANAGER
// ============================================================================
class TabManager {
  constructor() {
    this.currentTabId = null;
    console.log('[TabManager] Initialized');
  }

  async checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
        this.currentTabId = null;
        return { success: false, reason: 'Navigate to a webpage' };
      }

      this.currentTabId = tab.id;
      return { success: true, tabId: tab.id };
    } catch (err) {
      this.currentTabId = null;
      return { success: false, reason: err.message };
    }
  }

  async getCurrentTabUrl() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.url || null;
    } catch (err) {
      return null;
    }
  }

  async sendMessageToTab(message) {
    if (!this.currentTabId) {
      throw new Error('No active tab');
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTabId, message);
      return response;
    } catch (err) {
      console.error('[TabManager] Failed to send message:', err);
      throw err;
    }
  }
}

// ============================================================================
// UI MANAGER
// ============================================================================
class UIManager {
  constructor() {
    this.elements = {
      micBtn: document.getElementById('micBtn'),
      statusText: document.getElementById('statusText'),
      transcript: document.getElementById('transcript'),
      commandResult: document.getElementById('commandResult'),
      statTotal: document.getElementById('statTotal'),
      statRecognized: document.getElementById('statRecognized'),
      quotaBar: document.getElementById('quotaBar'),
      quotaText: document.getElementById('quotaText')
    };
    console.log('[UIManager] Initialized');
  }

  updateStatus(text) {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
  }

  updateTranscript(text) {
    if (this.elements.transcript) {
      this.elements.transcript.textContent = text;
    }
  }

  showCommandResult(message, isError = false) {
    if (!this.elements.commandResult) return;

    this.elements.commandResult.textContent = message;
    this.elements.commandResult.className = 'command-result show' + (isError ? ' error' : ' success');

    setTimeout(() => {
      this.elements.commandResult.classList.remove('show');
    }, 5000);
  }

  updateStats(stats) {
    if (this.elements.statTotal) {
      this.elements.statTotal.textContent = stats.totalCommands;
    }
    if (this.elements.statRecognized) {
      this.elements.statRecognized.textContent = stats.recognizedCommands;
    }
  }

  updateQuota(status) {
    if (this.elements.quotaBar) {
      const percent = (status.remaining / status.dailyLimit) * 100;
      this.elements.quotaBar.style.width = percent + '%';

      if (percent < 25) {
        this.elements.quotaBar.style.background = 'linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.9))';
      } else if (percent < 50) {
        this.elements.quotaBar.style.background = 'linear-gradient(90deg, #f59e0b, rgba(245, 158, 11, 0.9))';
      } else {
        this.elements.quotaBar.style.background = 'linear-gradient(90deg, #10b981, rgba(255, 255, 255, 0.9))';
      }
    }

    if (this.elements.quotaText) {
      this.elements.quotaText.textContent = `${status.remaining}/${status.dailyLimit} requests left`;
    }
  }

  setListeningState(isListening) {
    if (this.elements.micBtn) {
      if (isListening) {
        this.elements.micBtn.classList.add('listening');
      } else {
        this.elements.micBtn.classList.remove('listening');
      }
    }
  }

  setMicButtonEnabled(enabled) {
    if (this.elements.micBtn) {
      this.elements.micBtn.disabled = !enabled;
    }
  }
}

// ============================================================================
// SPEECH RECOGNITION SERVICE - Fixed with readiness checks
// ============================================================================
class SpeechRecognitionService {
  constructor(options = {}) {
    this.recognition = null;
    this.isListening = false;
    this.networkErrorCount = 0;
    this.maxNetworkErrors = options.maxNetworkErrors || 3;

    this.callbacks = {
      onStart: options.onStart || (() => { }),
      onResult: options.onResult || (() => { }),
      onError: options.onError || (() => { }),
      onEnd: options.onEnd || (() => { })
    };

    this.initRecognition();
    console.log('[SpeechRecognition] ✅ Initialized (direct mode - WORKING!)');
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('[SpeechRecognition] ❌ API not supported');
      this.callbacks.onError({
        type: 'not-supported',
        userMessage: 'Speech recognition not supported in this browser',
        statusMessage: '⚠️ Not supported'
      });
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[SpeechRecognition] 🎤 Started successfully!');
      this.isListening = true;
      this.networkErrorCount = 0;
      this.callbacks.onStart();
    };

    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      
      console.log('[SpeechRecognition] 📝 Result:', result[0].transcript, 'Final:', result.isFinal);
      
      this.callbacks.onResult({
        transcript: result[0].transcript.trim(),
        isFinal: result.isFinal,
        confidence: result[0].confidence || 0.9
      });
    };

    this.recognition.onerror = (event) => {
      console.error('[SpeechRecognition] ❌ Error:', event.error);
      this.handleError(event.error, event.message);
    };

    this.recognition.onend = () => {
      console.log('[SpeechRecognition] 🔄 Ended, isListening:', this.isListening);
      
      // Auto-restart if we're supposed to be listening
      if (this.isListening) {
        console.log('[SpeechRecognition] ↻ Auto-restarting...');
        setTimeout(() => {
          if (this.recognition && this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              console.error('[SpeechRecognition] ❌ Auto-restart failed:', e);
              this.isListening = false;
              this.callbacks.onEnd();
            }
          }
        }, 100);
      } else {
        this.callbacks.onEnd();
      }
    };

    console.log('[SpeechRecognition] ✅ Recognition ready');
  }

  handleError(errorType, errorMessage) {
    const errorInfo = {
      type: errorType,
      message: errorMessage || '',
      recoverable: false
    };

    switch (errorType) {
      case 'not-allowed':
        errorInfo.userMessage = 'Please allow microphone access';
        errorInfo.statusMessage = '⚠️ Microphone denied';
        this.isListening = false;
        break;

      case 'not-supported':
        errorInfo.userMessage = 'Speech recognition not supported';
        errorInfo.statusMessage = '⚠️ Not supported';
        this.isListening = false;
        break;

      case 'no-speech':
        // Don't show error for no-speech
        return;

      case 'audio-capture':
        errorInfo.userMessage = 'No microphone detected';
        errorInfo.statusMessage = '⚠️ No microphone';
        this.isListening = false;
        break;

      case 'network':
        this.networkErrorCount++;
        if (this.networkErrorCount < this.maxNetworkErrors) {
          console.log('[SpeechRecognition] Network error, will retry...');
          errorInfo.recoverable = true;
          return;
        }
        errorInfo.userMessage = 'Network error - check connection';
        errorInfo.statusMessage = '⚠️ Network issues';
        this.isListening = false;
        break;

      case 'aborted':
        // Normal stop, don't show error
        return;

      default:
        errorInfo.userMessage = `Error: ${errorType}`;
        errorInfo.statusMessage = '⚠️ Speech error';
        this.isListening = false;
    }

    this.callbacks.onError(errorInfo);
  }

  async start() {
    if (this.isListening) {
      console.warn('[SpeechRecognition] ⚠️ Already listening');
      return;
    }

    if (!this.recognition) {
      const error = {
        type: 'initialization',
        userMessage: 'Speech recognition not initialized',
        statusMessage: '⚠️ Not initialized'
      };
      this.callbacks.onError(error);
      throw new Error(error.userMessage);
    }

    try {
      console.log('[SpeechRecognition] 🚀 Starting...');
      this.isListening = true;
      this.recognition.start();
      console.log('[SpeechRecognition] ✅ Start command sent');
      
    } catch (error) {
      console.error('[SpeechRecognition] ❌ Start error:', error);
      this.isListening = false;
      
      const errorInfo = {
        type: 'start-failed',
        message: error.message,
        userMessage: error.message || 'Failed to start speech recognition',
        statusMessage: '⚠️ Start failed'
      };
      
      this.callbacks.onError(errorInfo);
      throw error;
    }
  }

  stop() {
    if (!this.isListening || !this.recognition) {
      console.log('[SpeechRecognition] ℹ️ Not listening or no recognition');
      return;
    }

    console.log('[SpeechRecognition] 🛑 Stopping...');
    this.isListening = false;
    
    try {
      this.recognition.stop();
    } catch (err) {
      console.error('[SpeechRecognition] ❌ Stop error:', err);
    }
  }

  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  getState() {
    return {
      isListening: this.isListening,
      networkErrorCount: this.networkErrorCount,
      isSupported: this.isSupported()
    };
  }
}
// ============================================================================
// COMMAND PROCESSOR
// ============================================================================
class CommandProcessor {
  constructor(options = {}) {
    this.resolver = options.resolver;
    this.tabManager = options.tabManager;
    this.rateLimiter = options.rateLimiter;
    this.storageManager = options.storageManager;
    this.wakeWordDetector = options.wakeWordDetector;
    this.ttsService = null;
    this.stats = { totalCommands: 0, recognizedCommands: 0 };

    console.log('[CommandProcessor] Initialized');
  }

  setTTSService(ttsService) {
    this.ttsService = ttsService;
  }

  async speak(message, isError = false) {
    if (!this.ttsService) return false;

    try {
      await this.ttsService.speakResult(message, isError);
      return true;
    } catch (error) {
      console.error('[CommandProcessor] TTS error:', error);
      return false;
    }
  }

  async confirmCommand(intentResult) {
    if (!this.ttsService) return false;

    try {
      await this.ttsService.confirmCommand(intentResult);
      return true;
    } catch (error) {
      console.error('[CommandProcessor] TTS confirmation error:', error);
      return false;
    }
  }

  async processTranscript(transcript, url) {
    console.log('[CommandProcessor] Processing transcript:', transcript);

    // Save transcript
    await this.storageManager.saveTranscript({
      text: transcript,
      timestamp: Date.now(),
      url: url
    });

    // Check wake word
    const wakeResult = this.wakeWordDetector.process(transcript);
    console.log('[CommandProcessor] Wake word result:', wakeResult);

    if (wakeResult.type === 'ignored') {
      console.log('[CommandProcessor] Ignored - wake word required');
      return {
        success: false,
        reason: 'wake_word_required',
        message: 'Say "hey hoda" first'
      };
    }

    const commandText = wakeResult.command || transcript;

    if (!commandText) {
      return {
        success: false,
        reason: 'no_command',
        message: 'No command detected'
      };
    }

    // Process command
    return await this.processCommand(commandText);
  }

  async processCommand(commandText) {
    console.log('[CommandProcessor] Processing command:', commandText);

    // Check rate limit
    const rateCheck = this.rateLimiter.canMakeRequest();
    if (!rateCheck.ok) {
      const message = rateCheck.reason === 'minute_limit'
        ? '⚠️ Too many requests (10/minute limit)'
        : '⚠️ Daily limit reached';

      await this.speak(message, true);

      return {
        success: false,
        reason: rateCheck.reason,
        message: message
      };
    }

    // Update stats
    this.stats.totalCommands++;

    try {
      // Resolve intent
      const intentResult = await this.resolver.resolve(commandText);
      console.log('[CommandProcessor] Intent resolved:', intentResult);

      if (intentResult.intent === 'unknown') {
        await this.speak('I did not understand that command', true);
        return {
          success: false,
          reason: 'unknown_command',
          message: '❓ Unknown command'
        };
      }

      // Command recognized
      this.stats.recognizedCommands++;

      // Confirm and execute
      await this.confirmCommand(intentResult);
      await this.executeCommand(intentResult);

      return {
        success: true,
        intent: intentResult
      };

    } catch (error) {
      console.error('[CommandProcessor] Process error:', error);
      await this.speak('Command failed', true);

      return {
        success: false,
        reason: 'execution_error',
        message: '⚠️ Command failed',
        error: error.message
      };
    } finally {
      await this.storageManager.saveStats(this.stats);
    }
  }

  async executeCommand(intentResult) {
    try {
      const response = await this.tabManager.sendMessageToTab({
        action: 'executeIntent',
        intent: intentResult
      });

      if (response && !response.success) {
        throw new Error(response.error || 'Command execution failed');
      }

      return { success: true };
    } catch (err) {
      console.error('[CommandProcessor] Execute failed:', err);
      throw err;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  setStats(stats) {
    this.stats = stats;
  }
}

// ============================================================================
// MAIN APPLICATION CLASS
// ============================================================================
class HodaVoiceAssistant {
  constructor() {
    console.log('[HodaVoiceAssistant] Initializing...');

    // Initialize all managers
    this.uiManager = new UIManager();
    this.storageManager = new StorageManager();
    this.tabManager = new TabManager();
    this.rateLimiter = new RateLimiter();

    // Initialize wake word detector
    this.wakeWordDetector = new WakeWordDetector({
      wakeWords: ['hoda', 'hey hoda'],
      requireWakeWord: false,
      commandTimeout: 5000
    });

    // Initialize intent resolver
    this.resolver = new IntentResolver({
      useNormalizerFirst: true,
      llmFallback: true,
      enableLLM: false,
      enableLogging: true
    });

    // Initialize command processor
    this.commandProcessor = new CommandProcessor({
      resolver: this.resolver,
      tabManager: this.tabManager,
      rateLimiter: this.rateLimiter,
      storageManager: this.storageManager,
      wakeWordDetector: this.wakeWordDetector
    });

    // Initialize speech recognition
    this.speechService = new SpeechRecognitionService({
      maxNetworkErrors: 3,
      retryDelay: 1000,
      onStart: () => this.handleSpeechStart(),
      onResult: (result) => this.handleSpeechResult(result),
      onError: (error) => this.handleSpeechError(error),
      onEnd: () => this.handleSpeechEnd()
    });

    // State
    this.ttsService = null;
    this.isLLMReady = false;
    this.isTTSReady = false;
    this.ttsEnabled = true;

    console.log('[HodaVoiceAssistant] Core systems initialized');
  }

  async initialize() {
    console.log('[HodaVoiceAssistant] Starting initialization...');

    // Initialize speech service (NO initialize() call needed)
    this.speechService = new SpeechRecognitionService({
      onStart: () => this.handleSpeechStart(),
      onResult: (result) => this.handleSpeechResult(result),
      onError: (error) => this.handleSpeechError(error),
      onEnd: () => this.handleSpeechEnd()
    });

    // Load rate limiter data
    await this.rateLimiter.loadFromStorage();

    // Update UI
    this.updateQuotaDisplay();
    const status = this.rateLimiter.getStatus();
    this.uiManager.updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
    this.uiManager.elements.micBtn.disabled = false;

    // Setup event listeners
    this.setupEventListeners();

    console.log('[HodaVoiceAssistant] ✅ Ready');
    console.log('[HodaVoiceAssistant] IntentResolver stats:', this.resolver.getStats());

    // Load optional services (non-blocking)
    this.loadOptionalServices();
  }

  async loadOptionalServices() {
    // Load TTS
    ServiceLoader.loadTTS().then(async (createTTSService) => {
      if (createTTSService) {
        try {
          this.ttsService = await createTTSService({
            speaker: {
              enabled: this.ttsEnabled,
              volume: 1.0,
              rate: 1.0
            }
          });
          this.isTTSReady = true;
          this.commandProcessor.setTTSService(this.ttsService);
          console.log('[HodaVoiceAssistant] ✅ TTS enabled');
        } catch (err) {
          console.log('[HodaVoiceAssistant] TTS init failed:', err.message);
        }
      }
    });

    // Load WebLLM
    ServiceLoader.loadWebLLM().then(async (createWebLLMService) => {
      if (createWebLLMService) {
        try {
          console.log('[HodaVoiceAssistant] 🔄 Loading AI model (10-30 seconds)...');
          this.uiManager.updateStatus('⏳ Loading AI model...');
          this.uiManager.showCommandResult('Basic commands work now', false);

          const webllmService = await createWebLLMService({
            privacy: {
              enableAnalytics: false,
              enableLogging: true,
              allowRemoteModels: false
            }
          });

          await this.resolver.initializeLLM(webllmService);
          this.isLLMReady = true;

          const status = this.rateLimiter.getStatus();
          this.uiManager.updateStatus(`Ready ✨ - ${status.remaining}/${status.dailyLimit} left`);
          this.uiManager.showCommandResult('🤖 AI commands ready', false);

          console.log('[HodaVoiceAssistant] ✅ WebLLM injected into IntentResolver');
          console.log('[HodaVoiceAssistant] IntentResolver stats:', this.resolver.getStats());
        } catch (err) {
          console.log('[HodaVoiceAssistant] WebLLM init failed:', err.message);
          const status = this.rateLimiter.getStatus();
          this.uiManager.updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
        }
      }
    });
  }

  setupEventListeners() {
    // Microphone button
    this.uiManager.elements.micBtn?.addEventListener('click', async () => {
      if (!this.speechService.isListening) {
        await this.startListening();
      } else {
        this.stopListening();
      }
    });

    // Keyboard shortcut
    document.addEventListener('keydown', async (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        if (!this.speechService.isListening) {
          await this.startListening();
        } else {
          this.stopListening();
        }
      }
    });

    // Quick action buttons
    document.getElementById('btnScrollDown')?.addEventListener('click', () =>
      this.executeQuickAction({ intent: 'navigate', slots: { direction: 'down' }, original: 'scroll down' })
    );

    document.getElementById('btnScrollUp')?.addEventListener('click', () =>
      this.executeQuickAction({ intent: 'navigate', slots: { direction: 'up' }, original: 'scroll up' })
    );

    document.getElementById('btnListLinks')?.addEventListener('click', () =>
      this.executeQuickAction({ intent: 'link_action', slots: { action: 'list' }, original: 'list links' })
    );

    document.getElementById('btnHelp')?.addEventListener('click', () =>
      this.executeQuickAction({ intent: 'help', original: 'help' })
    );

    document.getElementById('openTests')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('tests/index.html') });
    });
  }

  async startListening() {
    // Check active tab
    const tabCheck = await this.tabManager.checkActiveTab();
    if (!tabCheck.success) {
      this.uiManager.updateStatus('⚠️ ' + tabCheck.reason);
      this.uiManager.showCommandResult(tabCheck.reason, true);
      return;
    }

    try {
      this.speechService.start();
    } catch (error) {
      console.error('[HodaVoiceAssistant] Failed to start listening:', error);
      this.uiManager.updateStatus('⚠️ Failed to start');
      this.uiManager.showCommandResult('Could not start speech recognition', true);

      if (error.name === 'NotAllowedError') {
        this.uiManager.showCommandResult('Microphone permission denied', true);
        await this.commandProcessor.speak('Please allow microphone access', true);
      }
    }
  }

  stopListening() {
    this.speechService.stop();
  }

  handleSpeechStart() {
    this.uiManager.updateStatus('🎤 Listening...');
    this.uiManager.setListeningState(true);
  }

  async handleSpeechResult(result) {
    this.uiManager.updateTranscript(result.transcript);

    if (result.isFinal) {
      const url = await this.tabManager.getCurrentTabUrl();
      const processResult = await this.commandProcessor.processTranscript(result.transcript, url);

      if (!processResult.success) {
        this.uiManager.showCommandResult(processResult.message, true);
      }

      // Update stats and quota
      this.uiManager.updateStats(this.commandProcessor.getStats());
      this.updateQuotaDisplay();
      this.uiManager.updateStatus('🎤 Listening...');
    }
  }

  handleSpeechError(error) {
    if (error.statusMessage) {
      this.uiManager.updateStatus(error.statusMessage);
    }
    if (error.userMessage) {
      this.uiManager.showCommandResult(error.userMessage, true);
      this.commandProcessor.speak(error.userMessage, true);
    }
  }

  handleSpeechEnd() {
    this.uiManager.setListeningState(false);
    this.uiManager.updateStatus('Ready');
    this.uiManager.updateTranscript('Click mic or press Ctrl+Shift+H');
  }

  updateQuotaDisplay() {
    const status = this.rateLimiter.getStatus();
    this.uiManager.updateQuota(status);
  }

  async executeQuickAction(intent) {
    const tabCheck = await this.tabManager.checkActiveTab();
    if (tabCheck.success) {
      await this.commandProcessor.confirmCommand(intent);
      const result = await this.commandProcessor.executeCommand(intent);
      if (result.success) {
        this.uiManager.showCommandResult('✓ Done', false);
      }
    }
  }

  // Debug interface
  getDebugInfo() {
    return {
      speech: this.speechService.getState(),
      wakeWord: this.wakeWordDetector.getState(),
      stats: this.commandProcessor.getStats(),
      quota: this.rateLimiter.getStatus(),
      resolver: this.resolver.getStats(),
      isLLMReady: this.isLLMReady,
      isTTSReady: this.isTTSReady
    };
  }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    app = new HodaVoiceAssistant();
    await app.initialize();

    // Expose debug interface
    window.__hoda = {
      app,
      showStats() {
        console.log('Debug Info:', app.getDebugInfo());
      },
      async testCommand(text) {
        const result = await app.resolver.resolve(text);
        console.log('Test Result:', result);
        return result;
      }
    };

    console.log('[HodaVoiceAssistant] ✅ Loaded - OOP Architecture');
  } catch (error) {
    console.error('[HodaVoiceAssistant] Initialization failed:', error);
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HodaVoiceAssistant,
    SpeechRecognitionService,
    CommandProcessor,
    RateLimiter,
    StorageManager,
    TabManager,
    UIManager,
    WakeWordDetector
  };
}