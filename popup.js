// popup.js - IntentResolver PRIMARY + Safe Optional Enhancements
// NO top-level await - everything loads properly!

import { IntentResolver } from './services/stt/src/intentResolver.js';

// ============================================================================
// OPTIONAL ENHANCEMENT LOADERS (Called After DOM Ready)
// ============================================================================
let webllmService = null;
let ttsService = null;

async function tryLoadWebLLM() {
  try {
    const { createService } = await import('./services/webllm/src/integration.js');
    console.log('[Import] ✅ WebLLM module loaded');
    return createService;
  } catch (error) {
    console.log('[Import] ⚠️ WebLLM not available (optional)');
    return null;
  }
}

async function tryLoadTTS() {
  try {
    const { createTTSService } = await import('./services/tts/src/index.js');
    console.log('[Import] ✅ TTS module loaded');
    return createTTSService;
  } catch (error) {
    console.log('[Import] ⚠️ TTS not available (optional)');
    return null;
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
// RATE LIMITING
// ============================================================================
const RATE_LIMIT = {
  maxRequestsPerMinute: 10,
  maxRequestsPerDay: 100,
  requests: [],
  dailyCount: 0,
  lastReset: Date.now(),

  checkDailyReset() {
    const now = Date.now();
    const dayInMs = 86400000;
    if (now - this.lastReset > dayInMs) {
      this.dailyCount = 0;
      this.lastReset = now;
      chrome.storage.local.set({ rateLimitReset: now, dailyUsage: 0 });
    }
  },

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
  lastCommand: null,
  stats: { totalCommands: 0, recognizedCommands: 0 },
  isLLMReady: false,
  isTTSReady: false,
  ttsEnabled: true
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
// TTS HELPERS (Safe - Only Work If TTS Loaded)
// ============================================================================
async function speak(message, isError = false) {
  if (!state.isTTSReady || !state.ttsEnabled || !ttsService) return false;
  try {
    await ttsService.speakResult(message, isError);
    return true;
  } catch (error) {
    return false;
  }
}

async function confirmCommand(intentResult) {
  if (!state.isTTSReady || !state.ttsEnabled || !ttsService) return false;
  try {
    await ttsService.confirmCommand(intentResult);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// CORE SYSTEM (Always Works)
// ============================================================================
const resolver = new IntentResolver({
  useNormalizerFirst: true,
  llmFallback: true,
  enableLLM: false,
  enableLogging: true
});

const wakeWordDetector = new WakeWordDetector({
  wakeWords: ['hoda', 'hey hoda'],
  requireWakeWord: false,
  commandTimeout: 5000
});

console.log('[Popup] Core systems initialized');

// ============================================================================
// SPEECH RECOGNITION
// ============================================================================
function startListening() {
  return new Promise(async (resolve, reject) => {
    const hasTab = await checkActiveTab();
    if (!hasTab) {
      updateStatus('⚠️ Navigate to a webpage first');
      showCommandResult('No valid webpage', true);
      return reject(new Error('No valid tab'));
    }

    const rateCheck = RATE_LIMIT.canMakeRequest();
    if (!rateCheck.ok) {
      const msg = rateCheck.reason === 'daily_limit' ? '❌ Daily limit reached' : '❌ Too many requests';
      updateStatus(msg);
      showCommandResult(msg, true);
      return reject(new Error(msg));
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) throw new Error('Speech recognition not supported');

      state.recognition = new SpeechRecognition();
      state.recognition.lang = 'en-US';
      state.recognition.continuous = false;
      state.recognition.interimResults = false;
      state.recognition.maxAlternatives = 1;

      state.recognition.onstart = () => {
        state.isListening = true;
        updateStatus('🎤 Listening...');
        UI.micBtn.classList.add('listening');
        resolve();
      };

      state.recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;

        console.log('[Speech] Transcript:', transcript);

        if (UI.transcript) {
          UI.transcript.textContent = transcript;
          UI.transcript.classList.remove('empty');
        }

        state.stats.totalCommands++;
        updateStatsUI();

        const wakeResult = wakeWordDetector.process(transcript);

        if (wakeResult.type === 'ignored') {
          showCommandResult('Say "Hoda" first', true);
          await speak('Say Hoda first', true);
          stopListening();
          return;
        }

        if (wakeResult.type === 'wake') {
          showCommandResult('🔔 Ready...', false);
          await speak('Ready', false);
          return;
        }

        const commandText = wakeResult.command || transcript;

        if (!commandText || commandText.trim().length === 0) {
          stopListening();
          return;
        }

        await saveTranscript({
          text: commandText,
          original: transcript,
          timestamp: Date.now(),
          confidence
        });

        // COMMAND PROCESSING: IntentResolver PRIMARY → WebLLM FALLBACK
        let result;
        try {
          console.log('[Command] Processing with IntentResolver');
          result = await resolver.resolve(commandText);

          // If unknown AND WebLLM available → Try fallback
          if ((!result || result.intent === 'unknown') && state.isLLMReady && webllmService) {
            console.log('[Command] Trying WebLLM fallback');
            const currentUrl = await getCurrentTabUrl();
            
            result = await webllmService.processCommand(commandText, {
              url: currentUrl,
              context: {
                previousCommand: state.lastCommand,
                recentTranscripts: await getRecentTranscripts(3)
              }
            });
          }

          if (result && result.intent && result.intent !== 'unknown') {
            state.stats.recognizedCommands++;
            state.lastCommand = {
              text: commandText,
              result,
              timestamp: Date.now()
            };

            await confirmCommand(result);
            await executeCommand(result);
            showCommandResult(`✓ ${result.intent}`, false);
          } else {
            const msg = 'Command not recognized';
            showCommandResult(msg, true);
            await speak(msg, true);
          }

          updateStatsUI();
          await saveStats();

        } catch (error) {
          console.error('[Command] Error:', error);
          showCommandResult('Error processing', true);
        }

        stopListening();
      };

      state.recognition.onerror = (event) => {
        console.error('[Speech] Error:', event.error);
        if (event.error !== 'no-speech') {
          showCommandResult(`Error: ${event.error}`, true);
        }
        stopListening();
        reject(new Error(event.error));
      };

      state.recognition.onend = () => {
        stopListening();
      };

      state.recognition.start();

    } catch (err) {
      console.error('[Speech] Setup failed:', err);
      updateStatus('❌ Failed to start');
      showCommandResult('Microphone access denied', true);
      reject(err);
    }
  });
}

function stopListening() {
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (err) {}
    state.recognition = null;
  }

  state.isListening = false;
  UI.micBtn.classList.remove('listening');

  const status = RATE_LIMIT.getStatus();
  updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
  updateQuotaUI();
}

// ============================================================================
// COMMAND EXECUTION
// ============================================================================
async function executeCommand(result) {
  if (!state.currentTabId) return;

  try {
    const response = await chrome.tabs.sendMessage(state.currentTabId, {
      action: 'executeIntent',
      intent: result
    });

    if (response && !response.success) {
      showCommandResult(response.error || 'Failed', true);
    }
  } catch (err) {
    console.error('[Execute] Failed:', err);
    showCommandResult('Could not execute', true);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Starting...');

  // Load storage
  const stored = await chrome.storage.local.get([
    'rateLimitReset',
    'dailyUsage',
    'wakeWordRequired',
    'ttsEnabled'
  ]);

  if (stored.rateLimitReset) {
    RATE_LIMIT.lastReset = stored.rateLimitReset;
  }

  if (stored.dailyUsage !== undefined) {
    RATE_LIMIT.dailyCount = stored.dailyUsage;
  } else {
    await chrome.storage.local.set({
      rateLimitReset: RATE_LIMIT.lastReset,
      dailyUsage: 0
    });
  }

  RATE_LIMIT.checkDailyReset();
  updateQuotaUI();

  if (stored.wakeWordRequired !== undefined) {
    wakeWordDetector.setWakeWordRequired(stored.wakeWordRequired);
  }

  if (stored.ttsEnabled !== undefined) {
    state.ttsEnabled = stored.ttsEnabled;
  }

  await checkActiveTab();
  await loadStats();
  setupEventListeners();

  const hasSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  if (hasSupport) {
    const status = RATE_LIMIT.getStatus();
    updateStatus(`Ready - ${status.remaining}/${status.dailyLimit} left`);
    UI.micBtn.disabled = false;

    console.log('[Popup] ✅ Ready');
    console.log('[Popup] Stats:', resolver.getStats());

    if (status.remaining < 5) {
      showCommandResult(`⚠️ Only ${status.remaining} left!`, true);
    }

    // Try to load optional enhancements (non-blocking)
    tryLoadTTS().then(async (createTTSService) => {
      if (createTTSService) {
        try {
          ttsService = await createTTSService({
            speaker: {
              enabled: state.ttsEnabled,
              volume: 1.0,
              rate: 1.0
            }
          });
          state.isTTSReady = true;
          console.log('[Popup] ✨ TTS enabled');
        } catch (err) {
          console.log('[Popup] TTS init failed:', err.message);
        }
      }
    });

    tryLoadWebLLM().then(async (createWebLLMService) => {
      if (createWebLLMService) {
        try {
          webllmService = await createWebLLMService({
            privacy: {
              enableAnalytics: false,
              enableLogging: true,
              allowRemoteModels: false
            }
          });
          state.isLLMReady = true;
          console.log('[Popup] ✨ WebLLM fallback ready');
          showCommandResult('🤖 AI fallback loaded', false);
        } catch (err) {
          console.log('[Popup] WebLLM init failed:', err.message);
        }
      }
    });

  } else {
    updateStatus('⚠️ Speech not supported');
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

    if (percent < 25) {
      UI.quotaBar.style.background = 'linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.9))';
    } else if (percent < 50) {
      UI.quotaBar.style.background = 'linear-gradient(90deg, #f59e0b, rgba(245, 158, 11, 0.9))';
    } else {
      UI.quotaBar.style.background = 'linear-gradient(90deg, #10b981, rgba(255, 255, 255, 0.9))';
    }
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
// STORAGE
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
    return true;
  } catch (err) {
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
  } catch (err) {}
}

async function getRecentTranscripts(count = 5) {
  try {
    const result = await chrome.storage.local.get(['transcripts']);
    const transcripts = result.transcripts || [];
    return transcripts.slice(-count);
  } catch (err) {
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
  } catch (err) {}
}

async function saveStats() {
  try {
    await chrome.storage.local.set({ stats: state.stats });
  } catch (err) {}
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

  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
      e.preventDefault();
      if (!state.isListening) {
        await startListening();
      } else {
        stopListening();
      }
    }
  });

  document.getElementById('btnScrollDown')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      const intent = { intent: 'navigate', slots: { direction: 'down' }, original: 'scroll down' };
      await confirmCommand(intent);
      executeCommand(intent);
      showCommandResult('✓ Scrolled down', false);
    }
  });

  document.getElementById('btnScrollUp')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      const intent = { intent: 'navigate', slots: { direction: 'up' }, original: 'scroll up' };
      await confirmCommand(intent);
      executeCommand(intent);
      showCommandResult('✓ Scrolled up', false);
    }
  });

  document.getElementById('btnListLinks')?.addEventListener('click', async () => {
    await checkActiveTab();
    if (state.currentTabId) {
      const intent = { intent: 'link_action', slots: { action: 'list' }, original: 'list links' };
      await confirmCommand(intent);
      executeCommand(intent);
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

// Debug
window.__hoda_popup = {
  resolver,
  wakeWordDetector,
  state,
  showStats() {
    console.log('Resolver:', resolver.getStats());
    console.log('State:', state);
  },
  async testResolver() {
    const result = await resolver.resolve('scroll down');
    console.log('Result:', result);
    return result;
  }
};

console.log('[Popup] ✅ Loaded - IntentResolver + Optional Enhancements');