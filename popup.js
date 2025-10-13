// popup.js - Web Speech API with Rate Limiting & Wake Word
import { IntentResolver } from './services/stt/src/intentResolver.js';

// ============================================================================
// WAKE WORD DETECTOR (INLINE - NO IMPORT)
// ============================================================================
class WakeWordDetector {
  constructor(options = {}) {
    this.wakeWords = options.wakeWords || ['hoda', 'hey hoda'];
    this.requireWakeWord = options.requireWakeWord || false;
    this.isAwake = false;
    this.awakeTimer = null;
    this.commandTimeout = options.commandTimeout || 5000;
    console.log('[WakeWord] Initialized. Required:', this.requireWakeWord);
  }

  process(text) {
    const cleanText = text.toLowerCase().trim();
    const hasWakeWord = this.detectWakeWord(cleanText);

    if (hasWakeWord) {
      const command = this.extractCommand(cleanText);
      this.wake();

      if (command) {
        // "Hoda scroll down" - immediate command
        console.log('[WakeWord] Wake + command:', command);
        return {
          type: 'wake_and_command',
          isWake: true,
          command: command,
          original: text
        };
      } else {
        // Just "Hoda" - waiting for command
        console.log('[WakeWord] Wake word only, waiting...');
        return {
          type: 'wake',
          isWake: true,
          command: null,
          original: text
        };
      }
    } else if (this.isAwake) {
      // Already awake, process as command
      console.log('[WakeWord] Processing awake command:', cleanText);
      this.sleep();
      return {
        type: 'command_after_wake',
        isWake: false,
        command: cleanText,
        original: text
      };
    } else if (!this.requireWakeWord) {
      // Wake word not required, direct command
      console.log('[WakeWord] Direct command (no wake needed):', cleanText);
      return {
        type: 'direct_command',
        isWake: false,
        command: cleanText,
        original: text
      };
    } else {
      // Wake word required but not detected - ignore
      console.log('[WakeWord] Ignored (wake word required)');
      return {
        type: 'ignored',
        isWake: false,
        command: null,
        original: text,
        reason: 'wake_word_required'
      };
    }
  }

  detectWakeWord(text) {
    for (const wakeWord of this.wakeWords) {
      // Exact match or starts with wake word
      if (text === wakeWord || text.startsWith(wakeWord + ' ')) {
        return true;
      }
      // Also check if wake word appears as whole word anywhere
      const regex = new RegExp('\\b' + wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  extractCommand(text) {
    for (const wakeWord of this.wakeWords) {
      // If starts with wake word, extract what comes after
      if (text.startsWith(wakeWord + ' ')) {
        return text.substring(wakeWord.length + 1).trim();
      } else if (text === wakeWord) {
        return null; // Just the wake word, no command
      } else {
        // Try removing wake word from anywhere in text
        const regex = new RegExp('\\b' + wakeWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b\\s*', 'i');
        const command = text.replace(regex, '').trim();
        if (command && command !== text) {
          return command;
        }
      }
    }
    return null;
  }

  wake() {
    if (this.isAwake) {
      this.resetTimer();
      return;
    }
    console.log('[WakeWord] 🔔 Wake word detected - listening for command...');
    this.isAwake = true;
    this.resetTimer();
  }

  sleep() {
    if (!this.isAwake) return;
    console.log('[WakeWord] 💤 Going to sleep');
    this.isAwake = false;
    this.clearTimer();
  }

  resetTimer() {
    this.clearTimer();
    this.awakeTimer = setTimeout(() => {
      console.log('[WakeWord] ⏰ Timeout - going to sleep');
      this.sleep();
    }, this.commandTimeout);
  }

  clearTimer() {
    if (this.awakeTimer) {
      clearTimeout(this.awakeTimer);
      this.awakeTimer = null;
    }
  }

  setWakeWordRequired(required) {
    this.requireWakeWord = required;
    if (!required && this.isAwake) {
      this.sleep();
    }
    console.log('[WakeWord] Wake word required:', required);
  }

  getState() {
    return {
      isAwake: this.isAwake,
      requireWakeWord: this.requireWakeWord
    };
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================
const RATE_LIMIT = {
  maxRequestsPerMinute: 10,
  maxRequestsPerDay: 40,
  requests: [],
  dailyCount: 0,
  lastReset: Date.now(),
  
  checkDailyReset() {
    const now = Date.now();
    const dayInMs = 86400000;
    
    if (now - this.lastReset > dayInMs) {
      console.log('[RateLimit] Daily quota reset');
      this.dailyCount = 0;
      this.lastReset = now;
      chrome.storage.local.set({ 
        rateLimitReset: now,
        dailyUsage: 0 
      });
    }
  },
  
  canMakeRequest() {
    this.checkDailyReset();
    const now = Date.now();
    
    this.requests = this.requests.filter(time => now - time < 60000);
    if (this.requests.length >= this.maxRequestsPerMinute) {
      console.warn('[RateLimit] ⚠️ Minute limit reached');
      return { ok: false, reason: 'minute_limit' };
    }
    
    if (this.dailyCount >= this.maxRequestsPerDay) {
      console.warn('[RateLimit] ⚠️ Daily limit reached');
      return { ok: false, reason: 'daily_limit' };
    }
    
    this.requests.push(now);
    this.dailyCount++;
    chrome.storage.local.set({ dailyUsage: this.dailyCount });
    
    console.log(`[RateLimit] ✅ ${this.dailyCount}/${this.maxRequestsPerDay} today`);
    return { ok: true };
  },
  
  getStatus() {
    this.checkDailyReset();
    return {
      dailyCount: this.dailyCount,
      dailyLimit: this.maxRequestsPerDay,
      remaining: this.maxRequestsPerDay - this.dailyCount,
      resetTime: new Date(this.lastReset + 86400000).toLocaleString()
    };
  }
};

// ============================================================================
// STATE
// ============================================================================
const state = {
  isListening: false,
  currentTabId: null,
  recognition: null,
  networkErrorCount: 0,
  lastCommand: null, // Track for context
  stats: {
    totalCommands: 0,
    recognizedCommands: 0
  }
};

// ============================================================================
// UI ELEMENTS
// ============================================================================
const UI = {
  micBtn: document.getElementById('micBtn'),
  statusText: document.getElementById('statusText'),
  transcript: document.getElementById('transcript'),
  commandResult: document.getElementById('commandResult'),
  statTotal: document.getElementById('statTotal'),
  statRecognized: document.getElementById('statRecognized'),
  quotaBar: document.getElementById('quotaBar'),
  quotaText: document.getElementById('quotaText')
};

// ============================================================================
// INITIALIZE INTENT RESOLVER & WAKE WORD DETECTOR
// ============================================================================
const resolver = new IntentResolver({
  useNormalizerFirst: true,  // Try fast path first
  llmFallback: true,          // Use LLM if normalizer fails
  enableLLM: false,           // Will enable in next sprint
  enableLogging: true         // Log for debugging
});

const wakeWordDetector = new WakeWordDetector({
  wakeWords: ['hoda', 'hey hoda'],
  requireWakeWord: false, // Start with optional wake word
  commandTimeout: 5000
});

console.log('[Popup] Resolver initialized. LLM enabled:', resolver.config.enableLLM);

// ============================================================================
// WEB SPEECH API SETUP
// ============================================================================
function initializeSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('[Popup] Web Speech API not supported');
    updateStatus('⚠️ Speech recognition not supported');
    UI.micBtn.disabled = true;
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const displayText = finalTranscript || interimTranscript;
    if (displayText.trim()) {
      UI.transcript.textContent = displayText;
      UI.transcript.classList.remove('empty');
    }

    if (finalTranscript.trim()) {
      const confidence = event.results[event.results.length - 1][0].confidence || 0.9;
      handleFinalTranscript(finalTranscript.trim(), confidence);
    }
  };

  recognition.onerror = (event) => {
    console.error('[Popup] Speech error:', event.error);
    
    if (event.error === 'not-allowed') {
      updateStatus('⚠️ Microphone permission denied');
      showCommandResult('Please allow microphone access', true);
      stopListening();
    } else if (event.error === 'network') {
      state.networkErrorCount++;
      updateStatus('⚠️ Network error - Rate limit');
      showCommandResult(`Network error. ${RATE_LIMIT.dailyCount}/${RATE_LIMIT.maxRequestsPerDay} used`, true);
      stopListening();
    } else if (event.error === 'no-speech') {
      console.log('[Popup] No speech detected');
    } else if (event.error === 'aborted') {
      console.log('[Popup] Recognition aborted');
    } else {
      updateStatus('⚠️ Error: ' + event.error);
      showCommandResult('Speech error: ' + event.error, true);
    }
  };

  recognition.onend = () => {
    console.log('[Popup] Recognition ended');
    
    if (state.isListening && state.networkErrorCount === 0) {
      const limitCheck = RATE_LIMIT.canMakeRequest();
      
      if (limitCheck.ok) {
        try {
          recognition.start();
        } catch (e) {
          console.error('[Popup] Restart failed:', e);
          stopListening();
        }
      } else {
        stopListening();
        if (limitCheck.reason === 'daily_limit') {
          showCommandResult(`Daily limit reached`, true);
        } else {
          showCommandResult('Rate limit - wait 1 minute', true);
        }
      }
    }
  };

  recognition.onstart = () => {
    console.log('[Popup] Recognition started');
    state.networkErrorCount = 0;
    
    const status = RATE_LIMIT.getStatus();
    updateStatus(`Listening... 🎤 (${status.remaining} left)`);
    updateQuotaUI();
  };

  return recognition;
}

// ============================================================================
// TRANSCRIPT HANDLING WITH WAKE WORD
// ============================================================================
async function handleFinalTranscript(text, confidence) {
  console.log('[Popup] 🎤 Final transcript:', text);

  // STEP 1: Process through wake word detector
  const wakeResult = wakeWordDetector.process(text);
  console.log('[Popup] Wake result:', wakeResult.type);

  // STEP 2: Handle wake-only (no command yet)
  if (wakeResult.type === 'wake') {
    showCommandResult('👂 Listening for command...', false);
    return;
  }

  // STEP 3: Handle ignored (wake word required but missing)
  if (wakeResult.type === 'ignored') {
    showCommandResult('💤 Say "Hoda" first to activate', false);
    return;
  }

  // STEP 4: Extract command text
  const commandText = wakeResult.command || text;
  
  // STEP 5: Resolve intent using IntentResolver (with context!)
  const normalized = await resolver.resolve(commandText, {
    previousCommand: state.lastCommand,
    currentUrl: await getCurrentTabUrl(),
    timestamp: Date.now()
  });
  
  console.log('[Popup] Resolved:', normalized.intent, 'from:', normalized.source);
  
  // Save as last command for context
  state.lastCommand = {
    intent: normalized.intent,
    slots: normalized.slots,
    text: commandText,
    timestamp: Date.now()
  };
  
  // STEP 6: Update stats
  state.stats.totalCommands++;
  if (normalized.intent !== 'unknown') {
    state.stats.recognizedCommands++;
  }
  saveStats();
  updateStatsUI();

  // STEP 7: Execute or show error
  if (normalized.intent === 'unknown') {
    const suggestions = resolver.getSuggestions(commandText);
    const suggestionText = suggestions.length > 0
      ? `Try: ${suggestions[0].example}`
      : 'Say "help" for commands';
    
    showCommandResult(`❓ Unknown: "${commandText}". ${suggestionText}`, true);
  } else {
    // Show what was recognized
    const prefix = wakeResult.type === 'wake_and_command' ? '🔔 ' : '';
    const sourceTag = normalized.source === 'llm' ? ' [AI]' : '';
    showCommandResult(`${prefix}✓ "${commandText}"${sourceTag}`, false);
    
    // Execute command
    executeCommand(normalized);
  }

  // STEP 8: Save to storage
  saveTranscript({ 
    text, 
    confidence, 
    intent: normalized.intent,
    source: normalized.source,
    timestamp: Date.now() 
  });
}

// ============================================================================
// COMMAND EXECUTION
// ============================================================================
async function executeCommand(normalized) {
  if (!state.currentTabId) {
    console.error('[Popup] No active tab');
    return;
  }

  console.log('[Popup] 📤 Sending command:', normalized.intent);

  try {
    await chrome.tabs.sendMessage(state.currentTabId, {
      type: 'EXECUTE_COMMAND',
      command: normalized
    });
    
    console.log('[Popup] ✅ Command sent successfully');
  } catch (err) {
    console.error('[Popup] ❌ Send failed:', err);
    
    if (err.message.includes('Could not establish connection')) {
      console.log('[Popup] 💉 Injecting content script...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: state.currentTabId },
          files: ['content.js']
        });
        
        // Retry after injection
        setTimeout(async () => {
          await chrome.tabs.sendMessage(state.currentTabId, {
            type: 'EXECUTE_COMMAND',
            command: normalized
          });
        }, 200);
      } catch (injectErr) {
        console.error('[Popup] Inject failed:', injectErr);
        showCommandResult('Error: Could not communicate with page', true);
      }
    }
  }
}

// ============================================================================
// LISTENING CONTROL
// ============================================================================
async function startListening() {
  console.log('[Popup] Starting...');
  
  const limitCheck = RATE_LIMIT.canMakeRequest();
  if (!limitCheck.ok) {
    const status = RATE_LIMIT.getStatus();
    if (limitCheck.reason === 'daily_limit') {
      updateStatus(`⚠️ Daily limit (${status.dailyCount}/${status.dailyLimit})`);
      showCommandResult(`Daily limit reached`, true);
    } else {
      updateStatus('⚠️ Rate limit - wait 1 minute');
      showCommandResult('Wait 1 minute', true);
    }
    return;
  }
  
  const tabOk = await checkActiveTab();
  if (!tabOk) return;

  if (!state.recognition) {
    state.recognition = initializeSpeechRecognition();
    if (!state.recognition) return;
  }

  try {
    state.recognition.start();
    state.isListening = true;
    
    UI.statusText.classList.add('active');
    UI.micBtn.classList.add('listening');
    UI.micBtn.textContent = '🔴';
    
    UI.transcript.textContent = 'Listening...';
    UI.transcript.classList.remove('empty');
    
    console.log('[Popup] ✅ Started');
  } catch (err) {
    console.error('[Popup] Start failed:', err);
    updateStatus('Error: ' + err.message);
  }
}

function stopListening() {
  console.log('[Popup] Stopping...');
  
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {
      console.error('[Popup] Stop error:', e);
    }
  }
  
  state.isListening = false;
  state.networkErrorCount = 0;
  wakeWordDetector.sleep();
  
  const status = RATE_LIMIT.getStatus();
  updateStatus(`Stopped - ${status.remaining}/${status.dailyLimit} left`);
  UI.statusText.classList.remove('active');
  UI.micBtn.classList.remove('listening');
  UI.micBtn.textContent = '🎤';
  
  UI.transcript.textContent = 'Click mic to start';
  UI.transcript.classList.add('empty');
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  const stored = await chrome.storage.local.get(['rateLimitReset', 'dailyUsage', 'wakeWordRequired']);
  if (stored.rateLimitReset) {
    RATE_LIMIT.lastReset = stored.rateLimitReset;
    RATE_LIMIT.dailyCount = stored.dailyUsage || 0;
  }
  RATE_LIMIT.checkDailyReset();
  
  // Load wake word setting
  if (stored.wakeWordRequired !== undefined) {
    wakeWordDetector.setWakeWordRequired(stored.wakeWordRequired);
  }
  
  await checkActiveTab();
  await loadStats();
  setupEventListeners();
  
  const hasSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  if (hasSupport) {
    const status = RATE_LIMIT.getStatus();
    updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
    updateQuotaUI();
    UI.micBtn.disabled = false;
    
    // Log resolver info
    console.log('[Popup] Resolver stats:', resolver.getStats());
    
    if (status.remaining < 5) {
      showCommandResult(`⚠️ Only ${status.remaining} left today!`, true);
    }
  } else {
    updateStatus('⚠️ Speech recognition not supported');
    UI.micBtn.disabled = true;
  }
});

// ============================================================================
// UI UPDATES
// ============================================================================
function updateQuotaUI() {
  const status = RATE_LIMIT.getStatus();
  
  if (UI.quotaBar) {
    const percent = (status.remaining / status.dailyLimit) * 100;
    UI.quotaBar.style.width = percent + '%';
  }
  
  if (UI.quotaText) {
    UI.quotaText.textContent = `${status.remaining}/${status.dailyLimit} requests left`;
  }
}

function updateStatus(text) {
  if (UI.statusText) UI.statusText.textContent = text;
}

function showCommandResult(message, isError) {
  if (!UI.commandResult) return;
  UI.commandResult.textContent = message;
  UI.commandResult.className = 'command-result show' + (isError ? ' error' : ' success');
  setTimeout(() => UI.commandResult.classList.remove('show'), 5000);
}

function updateStatsUI() {
  if (UI.statTotal) UI.statTotal.textContent = state.stats.totalCommands;
  if (UI.statRecognized) UI.statRecognized.textContent = state.stats.recognizedCommands;
}

// ============================================================================
// TAB & STORAGE
// ============================================================================
async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    if (!tab.url || !/^https?:\/\//i.test(tab.url)) {
      updateStatus('⚠️ Navigate to a webpage');
      state.currentTabId = null;
      return false;
    }
    state.currentTabId = tab.id;
    console.log('[Popup] Active tab:', tab.id);
    return true;
  } catch (err) {
    console.error('[Popup] Tab check failed:', err);
    state.currentTabId = null;
    return false;
  }
}

async function getCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || null;
  } catch (err) {
    return null;
  }
}

async function saveTranscript(transcript) {
  try {
    const result = await chrome.storage.local.get(['transcripts']);
    let transcripts = result.transcripts || [];
    transcripts.push(transcript);
    if (transcripts.length > 50) transcripts = transcripts.slice(-50);
    await chrome.storage.local.set({ transcripts });
  } catch (err) {
    console.error('[Popup] Save failed:', err);
  }
}

async function getRecentTranscripts(count = 5) {
  try {
    const result = await chrome.storage.local.get(['transcripts']);
    const transcripts = result.transcripts || [];
    return transcripts.slice(-count); // Last N transcripts
  } catch (err) {
    console.error('[Popup] Get transcripts failed:', err);
    return [];
  }
}

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['stats']);
    if (result.stats) {
      state.stats = result.stats;
      updateStatsUI();
    }
  } catch (err) {
    console.error('[Popup] Load stats failed:', err);
  }
}

async function saveStats() {
  try {
    await chrome.storage.local.set({ stats: state.stats });
  } catch (err) {
    console.error('[Popup] Save stats failed:', err);
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  UI.micBtn?.addEventListener('click', async () => {
    if (!state.isListening) {
      await startListening();
    } else {
      stopListening();
    }
  });
  
  document.getElementById('btnScrollDown')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      executeCommand({ 
        intent: 'navigate', 
        slots: { direction: 'down' }, 
        original: 'scroll down' 
      });
      showCommandResult('✓ Scrolled down', false);
    }
  });
  
  document.getElementById('btnScrollUp')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      executeCommand({ 
        intent: 'navigate', 
        slots: { direction: 'up' }, 
        original: 'scroll up' 
      });
      showCommandResult('✓ Scrolled up', false);
    }
  });
  
  document.getElementById('btnListLinks')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      executeCommand({ 
        intent: 'link_action', 
        slots: { action: 'list' }, 
        original: 'list links' 
      });
      showCommandResult('✓ Listing links', false);
    }
  });
  
  document.getElementById('btnHelp')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      executeCommand({ intent: 'help', original: 'help' });
    }
  });
  
  document.getElementById('openTests')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('tests/index.html') });
  });
}

// ============================================================================
// CLEANUP
// ============================================================================
window.addEventListener('beforeunload', () => {
  if (state.isListening) stopListening();
});

// Debug: Expose resolver for testing
window.__hoda_popup = {
  resolver,
  wakeWordDetector,
  state,
  
  // Show resolver stats
  showStats() {
    console.log('Resolver Stats:', resolver.getStats());
    console.log('State:', state);
    console.log('Wake Word:', wakeWordDetector.getState());
  },
  
  // Test LLM integration (next sprint)
  async testLLM() {
    console.log('Testing LLM integration...');
    const result = await resolver.resolve('find the login button and click it');
    console.log('Result:', result);
  }
};

console.log('[Popup] ✅ Loaded with IntentResolver');