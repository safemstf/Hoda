// Background script example for an Edge/Chrome extension.
// Usage: include this file (or equivalent logic) in the extension's background script.
// Manifest must include "tts" permission: { "permissions": ["tts"] }

// This is a minimal example. In a real project you should bundle speaker logic into the background
// or call chrome.tts directly while implementing the same public API (speak -> Promise).

// Message format expected:
// { type: 'tts.speak', payload: { text, rate?, voice? }, requestId? }
// completion message sent back:
// { type: 'tts.completed', requestId?, success: true }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'tts.speak') return; // ignore

  const { text, rate, voice } = message.payload || {};
  const requestId = message.requestId;

  if (!text) {
    sendResponse({ type: 'tts.completed', requestId, success: false, error: 'no text' });
    return;
  }

  const speakOpts = {};
  if (typeof rate === 'number') speakOpts.rate = rate;
  if (typeof voice === 'string') speakOpts.voiceName = voice;

  // Use chrome.tts.speak directly. It invokes the callback when done.
  try {
    chrome.tts.speak(text, speakOpts, () => {
      // If there was an error, chrome.runtime.lastError will be set
      if (chrome.runtime && chrome.runtime.lastError) {
        sendResponse({ type: 'tts.completed', requestId, success: false, error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ type: 'tts.completed', requestId, success: true });
    });
  } catch (err) {
    sendResponse({ type: 'tts.completed', requestId, success: false, error: String(err) });
  }

  // Return true to indicate sendResponse will be called asynchronously
  return true;
});
