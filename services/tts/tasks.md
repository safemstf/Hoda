# TTS — Developer Tasks and Integration Guide

This document turns the product sprint plan into concrete developer tasks, mapping implementation to the format contract in `services/webllm/src/formats.js` so the rest of the system can safely consume TTS outputs.

Goals covered here:
- Implement a small, maintainable TTS service API that works in browser extension environments (Edge/chrome) and has a Node-friendly demo fallback.
- Provide confirmation phrases and a semantic reader compatible with the TTS output format used by `webllm`.

Files added with a minimal implementation (see `src/`):
- `src/index.js` — exports a simple API: { speaker, confirmations, reader }
- `src/speaker.js` — speaker abstraction: speak(), pause(), resume(), stop(), setRate(), setVoice()
- `src/confirmations.js` — short confirmation phrases and speak wrapper
- `src/reader.js` — semantic page reader: readPageSemantic()
- `src/demo.js` — Node demo that runs the simulated speaker

Contract & shapes
- The webllm TTS contract is documented in `services/webllm/src/formats.js` (TTS_OUTPUT_SCHEMA). Key fields your implementation must produce when speaking: `text`, `action`, `success`, `intent`, `confidence`, `requiresConfirmation`.
- The helper methods in `confirmations` and `reader` return payloads compatible with that schema. The `speaker.speak()` method itself only speaks text and resolves when done; higher-level helpers build payloads.

Developer tasks (actionable)
1) Wire the speaker to the extension environment
   - In the extension background script, use `chrome.tts.speak(text, options, callback)` when `chrome && chrome.tts` exists.
   - Fallback to `window.speechSynthesis` in content or UI contexts.
   - In our minimal `Speaker` class, add the `chrome.tts` code path where available. Keep the public methods stable: speak(text, opts) -> Promise.

2) Confirmations API
   - Implement `confirm(action, detail?)` to return a TTS payload (see `confirmations.js`). Keep phrases short (≤3 words + optional short detail).
   - Use a small template map for common actions. Keep templates human-readable and testable.

3) Semantic reader
   - Provide `readPageSemantic(domOrText)` which accepts either a string (plain text) or an array of sections ({role, text}).
   - For browser use, implement an extractor that maps DOM nodes to the sections array: headline, byline, paragraphs in content order.
   - Speak each section synchronously to preserve reading order and return a summary payload when done.

4) Voice control and immediate updates
   - Implement `setRate(n)` and `setVoice(id)` on the speaker. When called, subsequent utterances should use these settings.
   - For immediate effect while speaking, call `stop()` and issue a new `speak()` with the remaining text (optional improvement). Keep initial implementation simple: new settings apply to next speak.

5) Error handling
   - If `speak()` fails, higher-level helpers must return a payload with `success: false` and a short `text` explaining the failure.
   - Emit QA logs with structured messages for later aggregation (extension message to background or console for local testing).

How to run the demo (Node)
- From `services/tts` run:

  ```
  cd services/tts
  npm run demo
  ```

Notes about browser integration
- The demo uses a simulated speaker in Node. In the browser environment, prefer `chrome.tts` for Edge/Chrome extension background scripts. Example outline for background script:

  - When receiving a message { type: 'tts.speak', payload: { text } } call:
    - If `chrome && chrome.tts`: call `chrome.tts.speak(text, {rate, voiceName}, callback)` and send a completion message when done.
    - Else if `window.speechSynthesis` is available, create a SpeechSynthesisUtterance, set `rate` and `voice` as needed, and register `onend` and `onerror` handlers.

Testing and acceptance
- Unit tests should validate template generation and that payloads follow the TTS_OUTPUT_SCHEMA shape. The repository already contains formats; use those validators during tests.
- Minimal integration test: call `confirm('navigate','down')` and assert returned payload has `text: 'Scrolled down'`-like result and `success: true`.

Follow-ups and improvements
- Add queuing (for multiple speak calls) and interruption semantics (stop/replace current utterance).
- Add persisted user settings for rate and voice (chrome.storage sync/local).
- Implement DOM article extractor which returns the sections array for `readPageSemantic`.

Implementation notes
- Keep the speaker implementation small and well-documented. The provided `src/` files are intentionally simple and clear so extension authors can port the logic into background scripts or UI code.
- Avoid introducing heavy dependencies; browser APIs suffice for runtime.

If you'd like, I can:
- Add `chrome.tts` usage in `speaker.js` behind a feature-detect branch and a small integration example for background scripts.
- Add unit tests for confirmation templates and reader normalization.
