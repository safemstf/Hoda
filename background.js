/**
 * background.js - MV3 service worker
 * Handles messages from popup/content and triggers TTS confirmations.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("Voice Nav extension installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("BG received:", message);
  if (!message || !message.cmd) {
    sendResponse({ ok: false, err: "no-cmd" });
    return;
  }

  switch (message.cmd) {
    case "confirm":
      // speak confirmation using browser TTS
      const text = message.text || "Action completed";
      if (chrome.tts) {
        chrome.tts.speak(text, { rate: 1.0 }, () => sendResponse({ ok: true }));
        // return true to indicate async response
        return true;
      } else {
        console.log("TTS not available");
        sendResponse({ ok: true, note: "no-tts" });
      }
      break;

    case "openUrl":
      if (message.url) {
        chrome.tabs.create({ url: message.url }, (tab) => {
          sendResponse({ ok: true, tabId: tab?.id });
        });
        return true;
      }
      sendResponse({ ok: false, err: "no-url" });
      break;

    default:
      sendResponse({ ok: false, err: "unknown-cmd" });
  }
});
