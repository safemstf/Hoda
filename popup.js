// popup.js - Voice command interface for Hoda extension
// Updated for main thread Whisper (no worker)

import { VoiceCommandCoordinator } from './services/stt/src/voiceCommandCoordinator.js';

// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH - The Coordinator
// -----------------------------------------------------------------------------
let coordinator = null;

// UI elements
const UI = {
  micBtn: document.getElementById('micBtn'),
  statusText: document.getElementById('statusText'),
  transcript: document.getElementById('transcript'),
  commandResult: document.getElementById('commandResult'),
  statTotal: document.getElementById('statTotal'),
  statRecognized: document.getElementById('statRecognized'),
  
  // Dynamic buttons (created at runtime)
  enableMicBtn: null,
  openSettingsBtn: null,
  openGrantTabBtn: null
};

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initializing...');
  
  // Create coordinator (singleton)
  // Web Speech API - no workers, models, or WASM needed!
  coordinator = VoiceCommandCoordinator.getInstance({
    language: 'en-US',
    defaultConfidence: 0.92,
    continuous: true,
    interimResults: true
  });
  
  // Setup callbacks
  setupCoordinatorCallbacks();
  
  // Setup UI event listeners
  setupEventListeners();
  
  // Check permissions and update UI
  await checkPermissionsAndUpdateUI();
});

// -----------------------------------------------------------------------------
// Coordinator callbacks
// -----------------------------------------------------------------------------
function setupCoordinatorCallbacks() {
  // Transcript updates
  coordinator.onTranscript((data) => {
    UI.transcript.textContent = data.text || 'Listening...';
    UI.transcript.classList.remove('empty');
  });

  // Command recognition
  coordinator.onCommand((commandData) => {
    handleCommand(commandData);
  });

  // Errors
  coordinator.onError((errorData) => {
    console.error('[Popup] Error from coordinator:', errorData);
    showCommandResult('Error: ' + errorData.message, true);
  });

  // Status changes
  coordinator.onStatus((status, data) => {
    console.log('[Popup] Status:', status, data);
    
    switch (status) {
      case 'initializing':
      case 'initializing_mic':
      case 'initializing_speech':
        updateStatus(data.message || 'Initializing...');
        break;
        
      case 'requesting_permission':
        updateStatus('Requesting microphone permission...');
        break;
        
      case 'loading_model':
        updateStatus(data.message || 'Initializing speech recognition...');
        break;
        
      case 'loading_wasm':
        // Not used with Web Speech API, but keep for compatibility
        updateStatus(data.message || 'Initializing...');
        break;
        
      case 'ready':
        updateStatus('Ready! Click mic to start');
        UI.micBtn.disabled = false;
        removeDynamicButtons();
        break;
        
      case 'listening':
        updateStatus('Listening... 🎤');
        UI.statusText.classList.add('active');
        UI.micBtn.classList.add('listening');
        UI.micBtn.textContent = '🔴';
        break;
        
      case 'stopped':
        updateStatus('Stopped - Click to restart');
        UI.statusText.classList.remove('active');
        UI.micBtn.classList.remove('listening');
        UI.micBtn.textContent = '🎤';
        break;
    }
  });
}

// -----------------------------------------------------------------------------
// Permission handling
// -----------------------------------------------------------------------------
async function checkPermissionsAndUpdateUI() {
  try {
    updateStatus('Checking microphone permission...');
    
    const permState = await coordinator.getPermissionStatus();
    
    removeDynamicButtons();
    
    if (permState === 'granted') {
      updateStatus('Microphone granted. Click mic to initialize.');
      UI.micBtn.disabled = false;
      
    } else if (permState === 'prompt' || permState === 'unknown') {
      updateStatus('Microphone permission required. Click "Enable Microphone" to allow.');
      UI.micBtn.disabled = true;
      showEnableMicButton();
      
    } else if (permState === 'denied') {
      updateStatus('Microphone access is blocked. Please allow it in browser settings.');
      UI.micBtn.disabled = true;
      showSettingsButtons();
      
    } else {
      updateStatus('Microphone permission status: ' + permState);
      UI.micBtn.disabled = true;
    }
  } catch (err) {
    console.error('[Popup] Permission check failed:', err);
    updateStatus('Could not determine permission: ' + (err.message || err));
    UI.micBtn.disabled = true;
  }
}

// -----------------------------------------------------------------------------
// UI Helpers
// -----------------------------------------------------------------------------
function updateStatus(text) {
  UI.statusText.textContent = text;
}

function removeDynamicButtons() {
  [UI.enableMicBtn, UI.openSettingsBtn, UI.openGrantTabBtn].forEach(btn => {
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  });
  UI.enableMicBtn = UI.openSettingsBtn = UI.openGrantTabBtn = null;
}

function showEnableMicButton() {
  UI.enableMicBtn = document.createElement('button');
  UI.enableMicBtn.textContent = 'Enable Microphone';
  UI.enableMicBtn.className = 'quick-btn';
  UI.enableMicBtn.style.width = '100%';
  UI.enableMicBtn.style.marginTop = '8px';
  UI.enableMicBtn.addEventListener('click', async () => {
    UI.enableMicBtn.disabled = true;
    updateStatus('Initializing...');
    
    const success = await coordinator.initialize();
    
    UI.enableMicBtn.disabled = false;
    
    if (!success) {
      showGrantTabButton();
    }
  });
  UI.statusText.parentNode.appendChild(UI.enableMicBtn);
}

function showSettingsButtons() {
  // Settings button
  UI.openSettingsBtn = document.createElement('button');
  UI.openSettingsBtn.textContent = 'Open Microphone Settings';
  UI.openSettingsBtn.className = 'quick-btn';
  UI.openSettingsBtn.style.width = '100%';
  UI.openSettingsBtn.style.marginTop = '8px';
  UI.openSettingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
  });
  UI.statusText.parentNode.appendChild(UI.openSettingsBtn);
  
  showGrantTabButton();
}

function showGrantTabButton() {
  if (UI.openGrantTabBtn) return;
  
  UI.openGrantTabBtn = document.createElement('button');
  UI.openGrantTabBtn.textContent = 'Open Extension Page to Grant Mic';
  UI.openGrantTabBtn.className = 'quick-btn';
  UI.openGrantTabBtn.style.width = '100%';
  UI.openGrantTabBtn.style.marginTop = '8px';
  UI.openGrantTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('tests/index.html') });
  });
  UI.statusText.parentNode.appendChild(UI.openGrantTabBtn);
}

// -----------------------------------------------------------------------------
// Command handling
// -----------------------------------------------------------------------------
function handleCommand(commandData) {
  const { raw, normalized } = commandData;
  
  console.log('[Popup] Command received:', {
    text: raw.text,
    intent: normalized.intent,
    confidence: raw.confidence
  });
  
  updateStats();
  
  // NOTE: content.js handles command execution and sends back confirmations
  // We just display the recognized command here
  if (normalized.intent === 'unknown') {
    const suggestions = coordinator.getSuggestions(raw.text);
    const suggestionText = suggestions.length > 0
      ? `Try: ${suggestions[0].example}`
      : 'Say "help" for commands';
    
    showCommandResult(`❓ Unknown: "${raw.text}". ${suggestionText}`, true);
  } else {
    showCommandResult(`🎤 Heard: "${raw.text}"`, false);
  }
}

// NOTE: executeCommand removed - content.js handles all command execution!
// The content script executes commands and sends confirmations back

function showCommandResult(message, isError) {
  UI.commandResult.textContent = message;
  UI.commandResult.className = 'command-result show' + (isError ? ' error' : '');
  
  setTimeout(() => {
    UI.commandResult.classList.remove('show');
  }, 3000);
}

function updateStats() {
  const stats = coordinator.getStats();
  UI.statTotal.textContent = stats.totalCommands;
  UI.statRecognized.textContent = stats.recognizedCommands;
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
function setupEventListeners() {
  // Quick action buttons
  document.getElementById('btnScrollDown')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { cmd: 'scroll down' });
    showCommandResult('✓ Scrolled down', false);
  });
  
  document.getElementById('btnScrollUp')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { cmd: 'scroll up' });
    showCommandResult('✓ Scrolled up', false);
  });
  
  document.getElementById('btnListLinks')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { cmd: 'list links' });
    showCommandResult('✓ Listing links', false);
  });
  
  document.getElementById('btnHelp')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { cmd: 'help' });
  });
  
  document.getElementById('openTests')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('tests/index.html') });
  });
  
  // MAIN MIC BUTTON - single handler
  UI.micBtn?.addEventListener('click', handleMicButtonClick);
}

async function handleMicButtonClick() {
  try {
    const state = coordinator.getState();
    
    // If not initialized, initialize first
    if (!state.isInitialized) {
      UI.micBtn.disabled = true;
      updateStatus('Initializing...');
      
      const success = await coordinator.initialize();
      
      UI.micBtn.disabled = false;
      
      if (!success) {
        return;
      }
    }
    
    // Toggle listening
    if (!state.isListening) {
      await coordinator.startListening();
    } else {
      coordinator.stopListening();
    }
  } catch (err) {
    console.error('[Popup] Mic button error:', err);
    updateStatus('Error: ' + (err.message || err));
    UI.micBtn.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------
window.addEventListener('beforeunload', () => {
  console.log('[Popup] Cleaning up...');
  if (coordinator) {
    coordinator.destroy();
  }
});

// Listen for messages from tests page AND content script
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !msg.type && !msg.cmd) return;
  
  // Handle mic permission messages from tests page
  if (msg.type === 'mic-permission') {
    if (msg.granted) {
      console.log('[Popup] Received mic granted message');
      updateStatus('Permission granted. Click mic to initialize.');
      checkPermissionsAndUpdateUI();
    } else {
      console.warn('[Popup] Received mic denied message:', msg.error);
      updateStatus('Permission denied: ' + (msg.error || ''));
    }
  }
  
  // Handle messages from content script (transcript confirmations, etc.)
  if (msg.cmd) {
    console.log('[Popup] Message from content script:', msg);
    
    // Pass to speech service to update stats
    if (coordinator && coordinator.state && coordinator.state.speechRecognition) {
      coordinator.state.speechRecognition.handleContentScriptMessage(msg);
    }
    
    // Show in UI
    if (msg.text) {
      showCommandResult('✓ ' + msg.text, false);
    }
  }
});