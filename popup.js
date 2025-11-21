/**
 * ============================================================================
 * HODA VOICE ASSISTANT - OBJECT-ORIENTED ARCHITECTURE no network error
 * Author: arkaan
 * ============================================================================
 */

import { IntentResolver } from './services/stt/src/intentResolver.js';
import { TutorialManager } from './tutorial.js';

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

    // Add volume visualizer
    this.volumeVisualizer = new window.VolumeVisualizer();

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

  startVolumeVisualizer(stream) {
    if (this.volumeVisualizer && stream) {
      this.volumeVisualizer.start(stream);
    }
  }

  stopVolumeVisualizer() {
    if (this.volumeVisualizer) {
      this.volumeVisualizer.stop();
    }
  }
}

// ============================================================================
// SPEECH RECOGNITION SERVICE - With TTS coordination
// ============================================================================
class SpeechRecognitionService {
  constructor(options = {}) {
    this.recognition = null;
    this.isListening = false;
    this.networkErrorCount = 0;
    this.maxNetworkErrors = options.maxNetworkErrors || 3;

    // ✅ TTS coordination properties
    this.isPausedForTTS = false;
    this.wasListeningBeforeTTS = false;

    this.callbacks = {
      onStart: options.onStart || (() => { }),
      onResult: options.onResult || (() => { }),
      onError: options.onError || (() => { }),
      onEnd: options.onEnd || (() => { }),
      onStreamAvailable: options.onStreamAvailable || (() => { })  // ✅ ADD THIS LINE
    };

    this.initRecognition();
    console.log('[SpeechRecognition] ✅ Initialized with TTS coordination');
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
      console.log('[SpeechRecognition] 🔄 Ended, isListening:', this.isListening, 'isPausedForTTS:', this.isPausedForTTS);

      // ✅ Don't auto-restart if paused for TTS
      if (this.isPausedForTTS) {
        console.log('[SpeechRecognition] Paused for TTS, waiting for resume signal');
        return;
      }

      // Auto-restart if we're supposed to be listening
      if (this.isListening) {
        console.log('[SpeechRecognition] ↻ Auto-restarting...');
        setTimeout(() => {
          if (this.recognition && this.isListening && !this.isPausedForTTS) {
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

  // ✅ IMPROVED: Pause recognition for TTS output
  pauseForTTS() {
    // ✅ If already paused, don't reset the flag
    if (this.isPausedForTTS) {
      console.log('[SpeechRecognition] ⚠️ Already paused for TTS, ignoring duplicate pause request');
      return;
    }

    if (!this.isListening || !this.recognition) {
      console.log('[SpeechRecognition] Not listening, nothing to pause for TTS');
      return;
    }

    console.log('[SpeechRecognition] ⏸️ Pausing for TTS');
    this.wasListeningBeforeTTS = true;
    this.isPausedForTTS = true;
    this.isListening = false;

    // Stop recognition (will not auto-restart due to isPausedForTTS flag)
    try {
      this.recognition.stop();
    } catch (err) {
      console.error('[SpeechRecognition] Error pausing:', err);
    }
  }

  // ✅ IMPROVED: Resume recognition after TTS completes
  resumeAfterTTS() {
    console.log('[SpeechRecognition] Resume request - wasListeningBeforeTTS:', this.wasListeningBeforeTTS, 'isPausedForTTS:', this.isPausedForTTS);

    if (!this.wasListeningBeforeTTS) {
      console.log('[SpeechRecognition] Was not listening before TTS, not resuming');
      return;
    }

    // ✅ Only resume if we're actually paused
    if (!this.isPausedForTTS) {
      console.log('[SpeechRecognition] ⚠️ Not currently paused, ignoring resume request');
      return;
    }

    console.log('[SpeechRecognition] ▶️ Resuming after TTS');
    this.isPausedForTTS = false;
    this.wasListeningBeforeTTS = false;

    // Restart recognition after small delay
    setTimeout(() => {
      if (!this.isListening && this.recognition) {
        try {
          this.isListening = true;
          this.recognition.start();
          console.log('[SpeechRecognition] ✅ Resumed successfully');
        } catch (error) {
          console.error('[SpeechRecognition] Resume failed:', error);
          this.isListening = false;
        }
      } else {
        console.log('[SpeechRecognition] ⚠️ Cannot resume - isListening:', this.isListening, 'recognition:', !!this.recognition);
      }
    }, 100);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pass to UI Manager
      if (this.callbacks.onStreamAvailable) {
        this.callbacks.onStreamAvailable(stream);
      }
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
      isSupported: this.isSupported(),
      isPausedForTTS: this.isPausedForTTS
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
    this.uiManager = options.uiManager;
    this.ttsService = null;
    this.tutorialManager = null; // Will be set after tutorial manager initializes - Author: arkaan
    this.stats = { totalCommands: 0, recognizedCommands: 0 };

    console.log('[CommandProcessor] Initialized');
  }

  setTTSService(ttsService) {
    this.ttsService = ttsService;
  }

  /**
   * Set tutorial manager reference - Author: arkaan
   */
  setTutorialManager(tutorialManager) {
    this.tutorialManager = tutorialManager;
    console.log('[CommandProcessor] Tutorial manager linked');
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
      const intentResult = await this.resolver.resolve(commandText);
      console.log('[CommandProcessor] Intent resolved:', intentResult);

      // ✅ FREE RESPONSE - Just speak LLM's text
      if (intentResult.intent === 'free_response' && intentResult.text) {
        await this.speak(intentResult.text, false);
        this.stats.recognizedCommands++;
        return { success: true, intent: intentResult, message: intentResult.text };
      }

      // ✅ UNKNOWN - Speak error
      if (intentResult.intent === 'unknown') {
        await this.speak('I did not understand that command', true);
        return { success: false, reason: 'unknown_command' };
      }

      // ✅ TUTORIAL - Handle tutorial command - Author: arkaan
      if (intentResult.intent === 'tutorial') {
        if (!this.tutorialManager || !this.ttsService) {
          await this.speak('Tutorial not ready yet. Please wait a moment.', true);
          return { success: false, reason: 'tutorial_not_ready' };
        }

        try {
          // Speech recognition should already be running (user just spoke a command)
          // But we verify it's running for skip detection
          // The tutorial manager will set up skip listener which requires speech recognition
          const tutorialResult = await this.tutorialManager.replayTutorial();
          this.stats.recognizedCommands++;
          
          if (this.uiManager) {
            // Show appropriate message based on whether tutorial was skipped - Author: arkaan
            if (tutorialResult && tutorialResult.skipped) {
              this.uiManager.showCommandResult('✓ Tutorial skipped', false);
            } else {
              this.uiManager.showCommandResult('✓ Tutorial started', false);
            }
          }
          
          const message = (tutorialResult && tutorialResult.skipped) ? 'Tutorial skipped' : 'Tutorial started';
          return { success: true, intent: intentResult, message: message };
        } catch (error) {
          console.error('[CommandProcessor] Tutorial error:', error);
          await this.speak('Could not start tutorial', true);
          return { success: false, reason: 'tutorial_error', error: error.message };
        }
      }

      // ✅ BROWSER COMMANDS - Execute silently (or brief visual feedback)
      this.stats.recognizedCommands++;

      // ✅ ADD THIS: Show visual confirmation
      if (this.uiManager) {
        this.uiManager.showCommandResult(`✓ ${intentResult.intent}`, false);
      }

      // NO TTS HERE - just execute
      await this.executeCommand(intentResult);

      // Visual feedback only
      return { success: true, intent: intentResult };

    } catch (error) {
      console.error('[CommandProcessor] Process error:', error);
      await this.speak('Command failed', true);
      return { success: false, reason: 'execution_error', error: error.message };
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

      // ============================================================================
      // IMPROVED: Check if content script is not available
      // ============================================================================
      const isConnectionError = err.message?.includes('Receiving end does not exist') ||
        err.message?.includes('Could not establish connection');

      if (isConnectionError) {
        console.warn('[CommandProcessor] Content script not loaded on this page');

        // More helpful error message
        await this.speak('Content script not ready. Please refresh the page.', true);

        if (this.uiManager) {
          this.uiManager.showCommandResult('⚠️ Refresh page and try again', true);
        }

        return {
          success: false,
          reason: 'content_script_not_loaded',
          message: 'Content script not ready. Refresh the page and try again.'
        };
      }

      // ============================================================================
      // Handle zoom on restricted pages (chrome://)
      // ============================================================================
      if (intentResult.intent === 'zoom') {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (tab?.url?.startsWith('chrome://')) {
            console.log('[CommandProcessor] Detected chrome:// page for zoom command');
            return await this.handleRestrictedPageZoom(intentResult, tab);
          }
        } catch (tabError) {
          console.warn('[CommandProcessor] Failed to check tab URL:', tabError);
        }
      }

      throw err;
    }
  }

  /**
   * Handle zoom command on restricted pages (chrome://)
   * Provides TTS feedback via background script since content script can't inject
   * 
   * @param {Object} intentResult - Command intent with intent and slots
   * @param {Object} tab - Chrome tab object with URL and ID
   * @returns {Promise<Object>} Failure result with user-friendly message
   */
  async handleRestrictedPageZoom(intentResult, tab) {
    console.log('[CommandProcessor] Handling restricted page zoom on:', tab.url);

    // Send to background script for TTS/notification
    try {
      await chrome.runtime.sendMessage({
        type: 'RESTRICTED_PAGE_ZOOM',
        tabId: tab.id,
        intent: intentResult.intent,
        slots: intentResult.slots,
        url: tab.url
      });
    } catch (err) {
      console.error('[CommandProcessor] Failed to send to background:', err);
    }

    return {
      success: false,
      message: 'Zoom not available, try another command'
    };
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
      enableLLM: true,
      enableLogging: true
    });

    // Initialize command processor
    this.commandProcessor = new CommandProcessor({
      resolver: this.resolver,
      tabManager: this.tabManager,
      rateLimiter: this.rateLimiter,
      storageManager: this.storageManager,
      wakeWordDetector: this.wakeWordDetector,
      uiManager: this.uiManager
    });

    // Initialize speech recognition
    this.speechService = new SpeechRecognitionService({
      maxNetworkErrors: 3,
      retryDelay: 1000,
      onStart: () => this.handleSpeechStart(),
      onResult: (result) => this.handleSpeechResult(result),
      onError: (error) => this.handleSpeechError(error),
      onEnd: () => this.handleSpeechEnd(),
      onStreamAvailable: (stream) => this.handleStreamAvailable(stream)  // ✅ ADD THIS LINE
    });

    // State
    this.ttsService = null;
    this.isLLMReady = false;
    this.isTTSReady = false;
    this.ttsEnabled = true;
    this.tutorialManager = null; // Will be initialized after TTS loads
    
    // Extension toggle state - Author: arkaan
    this.extensionEnabled = true; // Will be loaded from storage

    console.log('[HodaVoiceAssistant] Core systems initialized');
  }

  async initialize() {
    console.log('[HodaVoiceAssistant] Starting initialization...');

    // Load toggle state on startup - Author: arkaan
    await this.loadToggleState();

    // Load rate limiter data
    await this.rateLimiter.loadFromStorage();

    // Check first-time user status for tutorial
    // Note: TutorialManager will be initialized after TTS loads
    // We'll check and mark pending here, then initialize tutorial manager later
    // Author: arkaan
    const tutorialStatus = await this.checkTutorialStatus();
    if (tutorialStatus.isFirstTime && !tutorialStatus.isPending) {
      // Mark tutorial as pending for auto-start on first mic click
      try {
        await chrome.storage.local.set({ tutorialPending: true });
        console.log('[HodaVoiceAssistant] Marked tutorial as pending for first-time user');
      } catch (error) {
        console.error('[HodaVoiceAssistant] Error marking tutorial pending:', error);
      }
    }

    // Update UI
    this.updateQuotaDisplay();
    const status = this.rateLimiter.getStatus();
    this.uiManager.updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
    this.uiManager.elements.micBtn.disabled = false;
    
    // Initialize toggle button UI - Author: arkaan
    this.updateToggleButtonUI(this.extensionEnabled);

    // Setup event listeners
    this.setupEventListeners();

    console.log('[HodaVoiceAssistant] ✅ Ready');
    console.log('[HodaVoiceAssistant] IntentResolver stats:', this.resolver.getStats());

    // Load optional services (non-blocking)
    this.loadOptionalServices();
  }

  /**
   * Check tutorial status (helper method)
   * Author: arkaan
   */
  async checkTutorialStatus() {
    try {
      const result = await chrome.storage.local.get(['tutorialCompleted', 'tutorialPending']);
      return {
        isFirstTime: !result.tutorialCompleted,
        isPending: result.tutorialPending || false,
        isCompleted: result.tutorialCompleted || false
      };
    } catch (error) {
      console.error('[HodaVoiceAssistant] Error checking tutorial status:', error);
      return { isFirstTime: false, isPending: false, isCompleted: true };
    }
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
              rate: 1.0,
              postSpeechDelay: 500
            }
          });

          if (this.ttsService.speaker) {
            this.ttsService.speaker.setSpeechRecognitionService(this.speechService);
            console.log('[HodaVoiceAssistant] ✅ TTS linked to speech recognition');

            // Initialize TutorialManager now that TTS is ready
            // Author: arkaan
            this.tutorialManager = new TutorialManager({
              ttsService: this.ttsService,
              speechService: this.speechService
            });
            console.log('[HodaVoiceAssistant] ✅ TutorialManager initialized');
            
            // Link tutorial manager to command processor
            if (this.commandProcessor) {
              this.commandProcessor.setTutorialManager(this.tutorialManager);
            }

            // ✅ Load saved voice preference FIRST
            const stored = await chrome.storage.local.get(['preferredVoice']);
            if (stored.preferredVoice) {
              const voice = this.ttsService.speaker.findVoiceByName(stored.preferredVoice);
              if (voice) {
                this.ttsService.speaker.voice = voice;
                console.log('[HodaVoiceAssistant] ✅ Loaded saved voice:', voice.name);
              } else {
                // Saved voice not found, select best
                const bestVoice = await this.ttsService.speaker.selectBestVoice();
                if (bestVoice) {
                  this.ttsService.speaker.voice = bestVoice;
                  console.log('[HodaVoiceAssistant] ✅ Using voice:', bestVoice.name);
                }
              }
            } else {
              // No saved preference, select best
              const bestVoice = await this.ttsService.speaker.selectBestVoice();
              if (bestVoice) {
                this.ttsService.speaker.voice = bestVoice;
                console.log('[HodaVoiceAssistant] ✅ Using voice:', bestVoice.name);
              }
            }

            // ✅ Populate voice selector UI
            await this.populateVoiceSelector();
          }

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
          // ✅ FIX: Add opening parenthesis for template literal
          this.uiManager.updateStatus(`Ready ✨ - ${status.remaining}/${status.dailyLimit} left`);
          this.uiManager.showCommandResult('🤖 AI commands ready', false);

          console.log('[HodaVoiceAssistant] ✅ WebLLM injected into IntentResolver');
          console.log('[HodaVoiceAssistant] IntentResolver stats:', this.resolver.getStats());
        } catch (err) {
          console.log('[HodaVoiceAssistant] WebLLM init failed:', err.message);
          const status = this.rateLimiter.getStatus();
          // ✅ FIX: Add opening parenthesis for template literal
          this.uiManager.updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
        }
      }
    });
  }

  async setupEventListeners() {
    // Listen for toggle state changes from background - Author: arkaan
    chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
      if (msg.type === 'TOGGLE_STATE_CHANGED') {
        this.extensionEnabled = msg.enabled;
        if (msg.enabled) {
          // Say "Assistant on" when toggling ON - Author: arkaan
          if (this.ttsService && this.ttsService.speaker) {
            try {
              await this.ttsService.speaker.speak('Assistant on');
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
              // Fallback to chrome.tts
              try {
                chrome.tts.speak('Assistant on', { rate: 1.0, pitch: 1.0, volume: 0.9 });
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (ttsError) {
                console.warn('[HodaVoiceAssistant] TTS failed:', ttsError);
              }
            }
          } else {
            // Fallback to chrome.tts if TTS service not loaded
            try {
              chrome.tts.speak('Assistant on', { rate: 1.0, pitch: 1.0, volume: 0.9 });
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (ttsError) {
              console.warn('[HodaVoiceAssistant] Chrome TTS failed:', ttsError);
            }
          }
          
          await this.startListening();
        } else {
          // Say "Assistant off" before stopping - Author: arkaan
          if (this.ttsService && this.ttsService.speaker) {
            try {
              await this.ttsService.speaker.speak('Assistant off');
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
              // Fallback to chrome.tts
              try {
                chrome.tts.speak('Assistant off', { rate: 1.0, pitch: 1.0, volume: 0.9 });
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (ttsError) {
                console.warn('[HodaVoiceAssistant] TTS failed:', ttsError);
              }
            }
          } else {
            // Fallback to chrome.tts if TTS service not loaded
            try {
              chrome.tts.speak('Assistant off', { rate: 1.0, pitch: 1.0, volume: 0.9 });
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (ttsError) {
              console.warn('[HodaVoiceAssistant] Chrome TTS failed:', ttsError);
            }
          }
          
          this.stopListening();
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        }
        this.uiManager.updateStatus(msg.enabled ? '✅ Active - Listening enabled' : '⏸️ Inactive - Extension disabled');
        
        // Update toggle button UI - Author: arkaan
        this.updateToggleButtonUI(msg.enabled);
      }
    });

    // Toggle button click - Author: arkaan
    const toggleBtn = document.getElementById('toggleExtensionBtn');
    
    if (toggleBtn) {
      // Click handler
      toggleBtn.addEventListener('click', async () => {
        const newState = await this.toggleExtension();
        this.updateToggleButtonUI(newState);
        
        // Notify background to update icon badge - Author: arkaan
        try {
          chrome.runtime.sendMessage({
            type: 'UPDATE_TOGGLE_ICON',
            enabled: newState
          });
        } catch (e) {
          console.warn('[HodaVoiceAssistant] Could not notify background:', e);
        }
      });
    }

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

    // ✅ NEW: Voice selector
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', async (e) => {
        const selectedVoiceName = e.target.value;
        if (selectedVoiceName && this.ttsService?.speaker) {
          const voice = this.ttsService.speaker.findVoiceByName(selectedVoiceName);
          if (voice) {
            this.ttsService.speaker.voice = voice;
            // Save preference
            await chrome.storage.local.set({ preferredVoice: voice.name });
            console.log('[HodaVoiceAssistant] Voice changed to:', voice.name);
          }
        }
      });
    }

    // ✅ NEW: Test voice button
    const voiceTestBtn = document.getElementById('voiceTestBtn');
    if (voiceTestBtn) {
      voiceTestBtn.addEventListener('click', async () => {
        if (this.ttsService) {
          await this.ttsService.speakResult('Hello, this is a voice test. How do I sound?');
        }
      });
    }

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

    // Tutorial button - Author: arkaan
    document.getElementById('btnTutorial')?.addEventListener('click', async () => {
      if (!this.tutorialManager || !this.ttsService) {
        this.uiManager.showCommandResult('Tutorial not ready yet. Please wait a moment.', true);
        return;
      }

      try {
        // Start speech recognition if not already running (needed for skip detection)
        if (!this.speechService.isListening) {
          const tabCheck = await this.tabManager.checkActiveTab();
          if (!tabCheck.success) {
            this.uiManager.showCommandResult('Please navigate to a webpage first.', true);
            return;
          }
          this.speechService.start();
          // Small delay to ensure speech recognition is ready
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Start tutorial replay - Author: arkaan
        const tutorialResult = await this.tutorialManager.replayTutorial();
        
        // Show appropriate message based on whether tutorial was skipped
        if (tutorialResult && tutorialResult.success) {
          if (tutorialResult.skipped) {
            this.uiManager.showCommandResult('✓ Tutorial skipped', false);
          } else {
            this.uiManager.showCommandResult('✓ Tutorial started', false);
          }
        }
      } catch (error) {
        console.error('[HodaVoiceAssistant] Failed to replay tutorial:', error);
        this.uiManager.showCommandResult('Could not start tutorial', true);
      }
    });

    document.getElementById('openTests')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('tests/index.html') });
    });
  }

  async startListening() {
    // Check if extension is enabled - Author: arkaan
    const state = await this.loadToggleState();
    if (!state) {
      console.log('[HodaVoiceAssistant] Extension is disabled, not starting');
      this.uiManager.updateStatus('⏸️ Extension is OFF - Press Alt+Shift+A to enable');
      return;
    }
    
    // Check active tab
    const tabCheck = await this.tabManager.checkActiveTab();
    if (!tabCheck.success) {
      this.uiManager.updateStatus('⚠️ ' + tabCheck.reason);
      this.uiManager.showCommandResult(tabCheck.reason, true);
      return;
    }

    // Check if tutorial is pending (first-time user) - Author: arkaan
    const tutorialStatus = await this.checkTutorialStatus();
    if (tutorialStatus.isPending) {
      // Tutorial is pending, but services might not be ready yet
      if (!this.tutorialManager || !this.ttsService) {
        console.log('[HodaVoiceAssistant] Tutorial pending but services not ready, waiting...');
        this.uiManager.updateStatus('⏳ Loading tutorial...');
        
        // Wait for TTS to load (with timeout)
        let waitCount = 0;
        while ((!this.tutorialManager || !this.ttsService) && waitCount < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        // If still not ready after 5 seconds, show error
        if (!this.tutorialManager || !this.ttsService) {
          this.uiManager.updateStatus('⚠️ Tutorial not ready');
          this.uiManager.showCommandResult('Tutorial is loading. Please wait a moment and try again.', true);
          return;
        }
      }
      
      // Services are ready, start tutorial
      console.log('[HodaVoiceAssistant] Tutorial pending, auto-starting tutorial');
      
      try {
        // Start speech recognition first (needed for skip detection)
        // TTS service will automatically pause it during tutorial playback
        this.speechService.start();
        
        // Small delay to ensure speech recognition is ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Start tutorial (will set up skip listener) - Author: arkaan
        const tutorialResult = await this.tutorialManager.startTutorial(true);
        
        // Show appropriate message based on whether tutorial was skipped
        if (tutorialResult && tutorialResult.success) {
          if (tutorialResult.skipped) {
            this.uiManager.showCommandResult('✓ Tutorial skipped', false);
          } else {
            this.uiManager.showCommandResult('✓ Tutorial started', false);
          }
        }
      } catch (error) {
        console.error('[HodaVoiceAssistant] Failed to start tutorial:', error);
        this.uiManager.updateStatus('⚠️ Failed to start tutorial');
        this.uiManager.showCommandResult('Could not start tutorial', true);
      }
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

  async populateVoiceSelector() {
    if (!this.ttsService?.speaker) {
      console.log('[HodaVoiceAssistant] TTS not ready, skipping voice selector');
      return;
    }

    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) {
      console.log('[HodaVoiceAssistant] Voice selector element not found');
      return;
    }

    try {
      // Get all English voices
      const voices = await this.ttsService.speaker.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en-'));

      // Clear existing options
      voiceSelect.innerHTML = '';

      // Group by gender/type
      const categories = {
        'Female Voices': englishVoices.filter(v =>
          v.name.includes('Female') ||
          ['Zira', 'Samantha', 'Karen', 'Moira', 'Victoria', 'Tessa'].some(n => v.name.includes(n))
        ),
        'Male Voices': englishVoices.filter(v =>
          v.name.includes('Male') ||
          ['David', 'Alex', 'Mark', 'Daniel', 'Fred'].some(n => v.name.includes(n))
        ),
        'Other Voices': []
      };

      // Catch remaining voices
      categories['Other Voices'] = englishVoices.filter(v =>
        !categories['Female Voices'].includes(v) &&
        !categories['Male Voices'].includes(v)
      );

      // Add voices by category
      for (const [category, categoryVoices] of Object.entries(categories)) {
        if (categoryVoices.length === 0) continue;

        const optgroup = document.createElement('optgroup');
        optgroup.label = category;

        categoryVoices.forEach(voice => {
          const option = document.createElement('option');
          option.value = voice.name;
          option.textContent = `${voice.name}`;

          // Select current voice
          if (this.ttsService.speaker.voice?.name === voice.name) {
            option.selected = true;
          }

          optgroup.appendChild(option);
        });

        voiceSelect.appendChild(optgroup);
      }

      // Load saved preference
      const stored = await chrome.storage.local.get(['preferredVoice']);
      if (stored.preferredVoice) {
        voiceSelect.value = stored.preferredVoice;
      }

      console.log('[HodaVoiceAssistant] ✅ Voice selector populated with', englishVoices.length, 'voices');
    } catch (err) {
      console.error('[HodaVoiceAssistant] Failed to populate voice selector:', err);
    }
  }

  stopListening() {
    this.speechService.stop();
  }

  // ============================================================================
  // EXTENSION TOGGLE - Simple on/off control
  // Author: arkaan
  // ============================================================================
  
  async loadToggleState() {
    const result = await chrome.storage.local.get(['extensionEnabled']);
    this.extensionEnabled = result.extensionEnabled !== false; // Default to true
    console.log('[HodaVoiceAssistant] Extension state loaded:', this.extensionEnabled ? 'ON' : 'OFF');
    return this.extensionEnabled;
  }
  
  async toggleExtension() {
    // Flip the state
    this.extensionEnabled = !this.extensionEnabled;
    
    // Save to storage
    await chrome.storage.local.set({ extensionEnabled: this.extensionEnabled });
    
    // Start or stop based on state
    if (this.extensionEnabled) {
      console.log('[HodaVoiceAssistant] Toggling ON - starting listening');
      
      // Say "Assistant on" when toggling ON - Author: arkaan
      if (this.ttsService && this.ttsService.speaker) {
        try {
          await this.ttsService.speaker.speak('Assistant on');
          // Wait a moment for speech to finish
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.warn('[HodaVoiceAssistant] Could not speak confirmation:', e);
          // Fallback to chrome.tts if TTS service not available
          try {
            chrome.tts.speak('Assistant on', {
              rate: 1.0,
              pitch: 1.0,
              volume: 0.9
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (ttsError) {
            console.warn('[HodaVoiceAssistant] Chrome TTS also failed:', ttsError);
          }
        }
      } else {
        // Fallback to chrome.tts if TTS service not loaded yet
        try {
          chrome.tts.speak('Assistant on', {
            rate: 1.0,
            pitch: 1.0,
            volume: 0.9
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (ttsError) {
          console.warn('[HodaVoiceAssistant] Chrome TTS failed:', ttsError);
        }
      }
      
      await this.startListening();
    } else {
      console.log('[HodaVoiceAssistant] Toggling OFF - stopping everything');
      
      // Say "Assistant off" before stopping - Author: arkaan
      if (this.ttsService && this.ttsService.speaker) {
        try {
          await this.ttsService.speaker.speak('Assistant off');
          // Wait a moment for speech to finish
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.warn('[HodaVoiceAssistant] Could not speak confirmation:', e);
          // Fallback to chrome.tts if TTS service not available
          try {
            chrome.tts.speak('Assistant off', {
              rate: 1.0,
              pitch: 1.0,
              volume: 0.9
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (ttsError) {
            console.warn('[HodaVoiceAssistant] Chrome TTS also failed:', ttsError);
          }
        }
      } else {
        // Fallback to chrome.tts if TTS service not loaded yet
        try {
          chrome.tts.speak('Assistant off', {
            rate: 1.0,
            pitch: 1.0,
            volume: 0.9
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (ttsError) {
          console.warn('[HodaVoiceAssistant] Chrome TTS failed:', ttsError);
        }
      }
      
      // Stop everything
      this.stopListening();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
    
    // Update UI with better feedback - Author: arkaan
    this.uiManager.updateStatus(this.extensionEnabled ? '✅ Active - Listening enabled' : '⏸️ Inactive - Extension disabled');
    
    return this.extensionEnabled;
  }

  // Update toggle button UI - Author: arkaan
  updateToggleButtonUI(enabled) {
    const toggleBtn = document.getElementById('toggleExtensionBtn');
    const toggleStatus = document.getElementById('toggleStatus');
    
    if (!toggleBtn || !toggleStatus) return;
    
    // Update ARIA attributes
    toggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', 
      enabled 
        ? 'Toggle extension on or off. Currently on.' 
        : 'Toggle extension on or off. Currently off.'
    );
    
    // Update visual state
    toggleStatus.textContent = enabled ? 'ON' : 'OFF';
    
    console.log('[HodaVoiceAssistant] Toggle button updated:', enabled ? 'ON' : 'OFF');
  }

  handleSpeechStart() {
    this.uiManager.updateStatus('🎤 Listening...');
    this.uiManager.setListeningState(true);
  }

  handleStreamAvailable(stream) {
    console.log('[HodaVoiceAssistant] 🎵 Audio stream available');
    this.uiManager.startVolumeVisualizer(stream);
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
      isTTSReady: this.isTTSReady,
      ttsStatus: this.ttsService?.getStatus?.() || null
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
      /**
       * Test command - Developer tool for testing commands without voice
       * Usage: __hoda.testCommand({intent: "zoom", slots: {action: "in"}})
       * 
       * This sends the command to the content script for direct execution.
       * Works from popup console only.
       * 
       * @param {Object} command - Command object with intent and slots
       * @returns {Promise<Object>} Execution result
       */
      async testCommand(command) {
        if (!command || typeof command !== 'object') {
          console.error('[Debug] testCommand requires a command object');
          console.log('Usage: __hoda.testCommand({intent: "zoom", slots: {action: "in"}})');
          return { success: false, error: 'Invalid command format' };
        }

        if (!command.intent) {
          console.error('[Debug] Command must have "intent" property');
          return { success: false, error: 'Command must have "intent" property' };
        }

        console.log('[Debug] 🧪 Testing command:', command.intent, command.slots || {});

        let tab; // Declare outside try block for use in catch
        try {
          // Get active tab
          tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
          if (!tab?.id) {
            throw new Error('No active tab found');
          }

          // Generate unique request ID
          const requestId = 'test_' + Date.now() + '_' + Math.random();

          // Set up response listener
          const responsePromise = new Promise((resolve, reject) => {
            const listener = (msg) => {
              if (msg.type === 'TEST_COMMAND_RESPONSE' && msg.requestId === requestId) {
                chrome.runtime.onMessage.removeListener(listener);
                if (msg.success) {
                  resolve(msg.result);
                } else {
                  reject(new Error(msg.error));
                }
              }
            };
            chrome.runtime.onMessage.addListener(listener);

            // Timeout after 5 seconds
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(listener);
              reject(new Error('Command timeout'));
            }, 5000);
          });

          // Send command to content script
          await chrome.tabs.sendMessage(tab.id, {
            type: 'TEST_COMMAND',
            requestId: requestId,
            command: command
          });

          // Wait for response
          const result = await responsePromise;
          console.log('[Debug] ✅ Command executed:', result);
          return result;

        } catch (error) {
          console.error('[Debug] ❌ Command failed:', error);

          // Check if it's a restricted page error for zoom commands
          const isRestrictedPageError = error.message?.includes('Receiving end does not exist') ||
            error.message?.includes('Could not establish connection');

          if (isRestrictedPageError && command.intent === 'zoom') {
            try {
              // Get current tab to check URL (if not already available)
              if (!tab) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                tab = tabs[0];
              }

              // Check if it's a chrome:// page (content scripts can't inject)
              if (tab?.url?.startsWith('chrome://')) {
                console.log('[Debug] Detected chrome:// page for zoom command');

                // Use app's commandProcessor to handle restricted page zoom
                if (app?.commandProcessor) {
                  return await app.commandProcessor.handleRestrictedPageZoom(
                    { intent: command.intent, slots: command.slots },
                    tab
                  );
                }
              }
            } catch (tabError) {
              console.warn('[Debug] Failed to check tab URL:', tabError);
            }
          }

          return { success: false, error: error.message };
        }
      },
      // Helper functions for common commands
      zoomIn() {
        return this.testCommand({ intent: 'zoom', slots: { action: 'in' } });
      },
      zoomOut() {
        return this.testCommand({ intent: 'zoom', slots: { action: 'out' } });
      },
      zoomReset() {
        return this.testCommand({ intent: 'zoom', slots: { action: 'reset' } });
      },
      scrollDown() {
        return this.testCommand({ intent: 'navigate', slots: { direction: 'down' } });
      },
      scrollUp() {
        return this.testCommand({ intent: 'navigate', slots: { direction: 'up' } });
      },
      scrollToTop() {
        return this.testCommand({ intent: 'navigate', slots: { target: 'top' } });
      },
      readPage() {
        return this.testCommand({ intent: 'read', slots: { action: 'start' } });
      },
      stopReading() {
        return this.testCommand({ intent: 'read', slots: { action: 'stop' } });
      },
      listLinks() {
        return this.testCommand({ intent: 'link_action', slots: { action: 'list' } });
      },
      help() {
        return this.testCommand({ intent: 'help' });
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