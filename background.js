// background.js - Service worker for Hoda extension
// Handles message routing and transcript storage

console.log('[Background] Service worker started');

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[Background] Message received:', msg.type, msg);

  // Handle transcript from content script
  if (msg.type === 'TRANSCRIPT') {
    handleTranscript(msg, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  // Handle STT errors from content script
  if (msg.type === 'STT_ERROR') {
    handleSTTError(msg, sender, sendResponse);
    return true;
  }

  // Handle restricted page zoom commands (chrome:// pages)
  if (msg.type === 'RESTRICTED_PAGE_ZOOM') {
    handleRestrictedPageZoom(msg, sender, sendResponse);
    return true; // Keep channel open for async response
  }

  // Handle toggle icon update from popup - Author: arkaan
  if (msg.type === 'UPDATE_TOGGLE_ICON') {
    (async () => {
      await setToggleState(msg.enabled);
      await updateIcon(msg.enabled);
      sendResponse({ ok: true });
    })();
    return true;
  }

  // Handle other messages (future commands, etc.)
  return false;
});

/**
 * Handle STT error from content script
 * Forward to popup for user notification
 */
async function handleSTTError(msg, sender, sendResponse) {
  console.error('[Background] STT Error:', msg.error, msg.message);
  
  // Forward to popup (if open)
  try {
    const views = chrome.extension.getViews({ type: 'popup' });
    
    if (views.length > 0) {
      console.log('[Background] Forwarding error to popup');
      
      // Try runtime message
      try {
        await chrome.runtime.sendMessage({
          type: 'STT_ERROR',
          error: msg.error,
          message: msg.message
        });
      } catch (e) {
        // Ignore if no receivers
      }
    }
  } catch (err) {
    console.warn('[Background] Could not forward error to popup:', err);
  }
  
  sendResponse({ ok: true });
}

/**
 * Handle transcript from content script
 * Saves to storage and forwards to popup
 */
async function handleTranscript(msg, sender, sendResponse) {
  try {
    const transcript = {
      text: msg.text,
      confidence: msg.confidence || 0.92,
      timestamp: Date.now(),
      tabId: sender.tab?.id,
      url: sender.tab?.url
    };

    console.log('[Background] Processing transcript:', transcript.text);

    // Save to storage (keep last 50 transcripts)
    await saveTranscript(transcript);

    // Forward to popup (if it's open)
    await forwardToPopup(transcript);

    // Send success response back to content script
    sendResponse({ 
      ok: true, 
      saved: true,
      timestamp: transcript.timestamp 
    });

  } catch (err) {
    console.error('[Background] Error handling transcript:', err);
    sendResponse({ 
      ok: false, 
      error: err.message 
    });
  }
}

/**
 * Save transcript to chrome.storage.local
 */
async function saveTranscript(transcript) {
  try {
    // Get existing transcripts
    const result = await chrome.storage.local.get(['transcripts']);
    let transcripts = result.transcripts || [];

    // Add new transcript
    transcripts.push(transcript);

    // Keep only last 50
    if (transcripts.length > 50) {
      transcripts = transcripts.slice(-50);
    }

    // Save back to storage
    await chrome.storage.local.set({ transcripts });

    console.log('[Background] Transcript saved. Total:', transcripts.length);
  } catch (err) {
    console.error('[Background] Storage error:', err);
    throw err;
  }
}

/**
 * Forward transcript to popup (if open)
 */
async function forwardToPopup(transcript) {
  try {
    // Get all extension views (includes popup if open)
    const views = chrome.extension.getViews({ type: 'popup' });
    
    if (views.length > 0) {
      console.log('[Background] Forwarding to popup');
      
      // Send directly to popup window
      views.forEach(view => {
        if (view.handleTranscript) {
          view.handleTranscript(transcript);
        }
      });

      // Also try runtime message (backup method)
      try {
        await chrome.runtime.sendMessage({
          type: 'TRANSCRIPT_SAVED',
          transcript: transcript
        });
      } catch (e) {
        // Ignore if no receivers
      }
    } else {
      console.log('[Background] Popup not open, transcript only saved to storage');
    }
  } catch (err) {
    console.warn('[Background] Could not forward to popup:', err);
    // Don't throw - it's OK if popup isn't open
  }
}

/**
 * Get transcript history
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TRANSCRIPTS') {
    chrome.storage.local.get(['transcripts'], (result) => {
      sendResponse({ 
        ok: true, 
        transcripts: result.transcripts || [] 
      });
    });
    return true;
  }
});

/**
 * Clear transcript history
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CLEAR_TRANSCRIPTS') {
    chrome.storage.local.set({ transcripts: [] }, () => {
      console.log('[Background] Transcripts cleared');
      sendResponse({ ok: true });
    });
    return true;
  }
});

// Keep service worker alive (Edge specific workaround)
chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Extension startup');
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);
  
  // Initialize storage on install
  if (details.reason === 'install') {
    chrome.storage.local.set({ 
      transcripts: [],
      stats: {
        totalCommands: 0,
        recognizedCommands: 0
      },
      extensionEnabled: true // Default to enabled on install - Author: arkaan
    });
  }
  
  // Set icon based on saved state - Author: arkaan
  const state = await getToggleState();
  await updateIcon(state);
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "processText") {
    console.log("Processing text:", request.text);
    const intent = await window.getIntent(request.text);
    sendResponse({ intent });
  }
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // GET PDF ZOOM
  if (message.type === 'GET_PDF_ZOOM') {
    (async () => {
      try {
        if (!sender.tab?.id) {
          throw new Error('No tab ID available');
        }
        
        const zoom = await chrome.tabs.getZoom(sender.tab.id);
        console.log('[Background] Current PDF zoom:', zoom);  // ← Changed
        sendResponse({ success: true, zoom });
      } catch (error) {
        console.error('[Background] Failed to get PDF zoom:', error);  // ← Changed
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // SET PDF ZOOM
  if (message.type === 'SET_PDF_ZOOM') {
    (async () => {
      try {
        if (!sender.tab?.id) {
          throw new Error('No tab ID available');
        }
        
        const zoom = Math.max(0.5, Math.min(3.0, message.zoom || 1.0));
        await chrome.tabs.setZoom(sender.tab.id, zoom);
        console.log('[Background] PDF zoom set to:', zoom);  // ← Changed
        sendResponse({ success: true, zoom });
      } catch (error) {
        console.error('[Background] Failed to set PDF zoom:', error);  // ← Changed
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  // Let other handlers process their messages
  return false;
});

/**
 * Handle zoom command on restricted pages (chrome://)
 * Provides TTS feedback since content script cannot inject
 * 
 * @param {Object} msg - Message with tabId, intent, slots, and url
 * @param {Object} sender - Message sender info
 * @param {Function} sendResponse - Callback to send response
 */
async function handleRestrictedPageZoom(msg, sender, sendResponse) {
  console.log('[Background] Handling restricted page zoom:', msg.url);
  
  const message = 'Zoom not available, try another command';
  
  // Try chrome.tts API first (most reliable, system-level)
  try {
    console.log('[Background] Attempting chrome.tts.speak...');
    chrome.tts.speak(message, {
      rate: 1.0,
      pitch: 1.0,
      volume: 0.9
    });
    console.log('[Background] TTS requested via chrome.tts');
    sendResponse({ ok: true, method: 'chrome.tts' });
    return;
  } catch (ttsError) {
    console.warn('[Background] chrome.tts failed, trying script injection:', ttsError);
  }
  
  // Fallback: Try injecting minimal script into the page
  try {
    console.log('[Background] Attempting script injection...');
    await chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
        speechSynthesis.speak(utterance);
      },
      args: [message]
    });
    console.log('[Background] TTS successful via script injection');
    sendResponse({ ok: true, method: 'script_injection' });
    return;
  } catch (scriptError) {
    console.warn('[Background] Script injection failed:', scriptError);
  }
  
  // Final fallback: Visual notification only (requires "notifications" permission)
  console.log('[Background] Using notification fallback');
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Hoda',
      message: message
    });
    sendResponse({ ok: true, method: 'notification' });
  } catch (notifError) {
    console.warn('[Background] Notification failed (may need permissions):', notifError);
    // Still return success since TTS was attempted
    sendResponse({ ok: true, method: 'none', warning: 'All feedback methods failed' });
  }
}

console.log('[Background] Ready');

// ============================================================================
// EXTENSION TOGGLE - Simple on/off control
// Author: arkaan
// ============================================================================

// Get current toggle state from storage
async function getToggleState() {
  const result = await chrome.storage.local.get(['extensionEnabled']);
  return result.extensionEnabled !== false; // Default to true if not set
}

// Save toggle state to storage
async function setToggleState(enabled) {
  await chrome.storage.local.set({ extensionEnabled: enabled });
  console.log('[Background] Extension toggled:', enabled ? 'ON' : 'OFF');
}

// Update icon based on state - Author: arkaan
async function updateIcon(enabled) {
  const iconPath = 'icons/icon48.png'; // Same base icon for both states
  await chrome.action.setIcon({ path: iconPath });
  await chrome.action.setTitle({ 
    title: enabled ? 'Hoda - Active (Click to turn OFF)' : 'Hoda - Inactive (Click to turn ON)' 
  });
  
  // Set badge to show state - Author: arkaan
  if (enabled) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Green
  } else {
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red
  }
}

// Toggle extension on/off
async function toggleExtension() {
  const currentState = await getToggleState();
  const newState = !currentState;
  
  await setToggleState(newState);
  await updateIcon(newState);
  
  // Send message to popup if it's open
  try {
    chrome.runtime.sendMessage({ 
      type: 'TOGGLE_STATE_CHANGED', 
      enabled: newState 
    });
  } catch (e) {
    // Popup might not be open, that's OK
  }
  
  return newState;
}

// Handle icon click - toggle extension
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Background] Icon clicked, toggling extension');
  await toggleExtension();
});

// Handle keyboard shortcut - toggle extension
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-extension') {
    console.log('[Background] Keyboard shortcut pressed, toggling extension');
    await toggleExtension();
  } else {
    console.warn('[Background] Unknown command received:', command);
  }
});

// Load saved state on startup and set icon
chrome.runtime.onStartup.addListener(async () => {
  const state = await getToggleState();
  await updateIcon(state);
});
