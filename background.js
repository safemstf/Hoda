/**
 * background.js - MV3 service worker
 * Handles messages from popup/content and triggers TTS confirmations.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("Voice Nav extension installed.");
});

async function injectContentToTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // small delay so the content script can register listeners
    await new Promise(r => setTimeout(r, 150));
    return { ok: true };
  } catch (err) {
    console.warn('injectContentToTab failed:', err && err.message ? err.message : err);
    return { ok: false, err: err && err.message ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("BG received:", message, 'from', sender && (sender.tab ? `tab ${sender.tab.id}` : 'extension'));

  // Support both { cmd: '...' } messages and { type: '...' } styles if you need them
  const cmd = (message && (message.cmd || message.type)) || null;

  if (!cmd) {
    sendResponse({ ok: false, err: "no-cmd" });
    return;
  }

  (async () => {
    switch (cmd) {
      case "confirm": {
        // speak confirmation using browser TTS
        const text = message.text || "Action completed";
        if (chrome.tts) {
          chrome.tts.speak(text, { rate: 1.0 }, () => {
            // check for runtime error
            if (chrome.runtime.lastError) {
              console.warn('TTS speak error:', chrome.runtime.lastError.message);
              sendResponse({ ok: false, err: chrome.runtime.lastError.message });
            } else {
              sendResponse({ ok: true });
            }
          });
          // tell runtime we will respond asynchronously
          return true;
        } else {
          console.log("TTS not available");
          sendResponse({ ok: true, note: "no-tts" });
          return;
        }
      }

      case "openUrl": {
        if (message.url) {
          chrome.tabs.create({ url: message.url }, (tab) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, err: chrome.runtime.lastError.message });
            } else {
              sendResponse({ ok: true, tabId: tab?.id });
            }
          });
          return true;
        }
        sendResponse({ ok: false, err: "no-url" });
        return;
      }

      // NEW: ensure content script exists in the specified tab (or active tab)
      case "ensureContent": {
        // allow message.tabId override, otherwise use sender.tab or active tab
        let tabId = message.tabId || (sender && sender.tab && sender.tab.id);
        if (!tabId) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tab && tab.id;
        }
        if (!tabId) {
          sendResponse({ ok: false, err: 'no-tab' });
          return;
        }

        // Only permit http(s) injection
        try {
          const tabInfo = await chrome.tabs.get(tabId);
          if (!tabInfo || !tabInfo.url || !/^https?:\/\//i.test(tabInfo.url)) {
            sendResponse({ ok: false, err: 'unsupported-url', url: tabInfo && tabInfo.url });
            return;
          }
        } catch (e) {
          sendResponse({ ok: false, err: e && e.message ? e.message : String(e) });
          return;
        }

        const injected = await injectContentToTab(tabId);
        if (!injected.ok) {
          sendResponse({ ok: false, err: injected.err });
          return;
        }

        // test PING after injection
        try {
          const resp = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
          sendResponse({ ok: true, ping: resp });
        } catch (e) {
          sendResponse({ ok: false, err: e && e.message ? e.message : String(e) });
        }
        return;
      }

      default: {
        sendResponse({ ok: false, err: "unknown-cmd" });
        return;
      }
    }
  })();

  // indicate we may call sendResponse asynchronously for cases above that return true
  return true;
});
