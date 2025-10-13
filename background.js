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

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);
  
  // Initialize storage on install
  if (details.reason === 'install') {
    chrome.storage.local.set({ 
      transcripts: [],
      stats: {
        totalCommands: 0,
        recognizedCommands: 0
      }
    });
  }
});

console.log('[Background] Ready');