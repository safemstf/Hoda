# TTS — Sprint Plan (Single Sprint - Accessibility Confirmations & Article Reading)

**Owners:** Michael, Fatema, @saishishir (primary)  
**Related Stories:** #2 Baseline TTS (article reading) & #6 Clear audio confirmations & error recovery  
**Branch prefix examples:**  
- `feature/tts/semantic-reader`  
- `feature/tts/accessibility-confirmations`  
- `feature/tts/edge-integration`  

## 🎯 Sprint 1 — Accessible TTS for confirmations and semantic article reading
**Branch:** `feature/tts/semantic-reader`  
**Goal:** Robust TTS for accessibility confirmations and semantic article reading optimized for visually impaired users.

### Checklist
- [ ] **T1 — Service scaffold & Edge-compatible API**
  - [ ] Create `services/tts/src/` with core files: `index.ts`, `speaker.ts`, `reader.ts`, `confirmations.ts`.
  - [ ] Implement main API: `speak(text, opts)`, `pause()`, `resume()`, `stop()`, `setRate()`, `setVoice()`.
  - [ ] Ensure Edge browser compatibility and `chrome.tts` integration.
  - [ ] Add `services/tts/package.json` scripts: `build`, `test`, `lint`.
- [ ] **T2 — Edge TTS integration**
  - [ ] Implement Edge-optimized TTS using `chrome.tts.speak` API.
  - [ ] Fallback to Web Speech API for development/testing.
  - [ ] Promise-based API resolving when utterance finished or on error.
  - [ ] Unit tests for Edge TTS integration and error handling.
- [ ] **T3 — Accessibility confirmation system**
  - [ ] Implement standardized confirmation phrases (≤3 words + optional detail).
  - [ ] API: `confirm(action, detail?)` for navigation, forms, and page actions.
  - [ ] Templates aligned with user stories: "Scrolled down", "Link opened", "Form submitted".
  - [ ] Unit tests for confirmation phrase generation and accessibility compliance.
- [ ] **T4 — Semantic article reading (Story #2)**
  - [ ] Implement `readPageSemantic()` for visually impaired users.
  - [ ] Extract article content in semantic order: headlines, bylines, paragraphs.
  - [ ] Handle news sites, blogs, documentation with proper reading flow.
  - [ ] Tests on accessibility-focused page layouts (news, articles).
- [ ] **T5 — Voice control integration (Story #2 criteria)**
  - [ ] Implement "slower/faster/voice X" commands with immediate effect.
  - [ ] "Stop/pause" functionality that halts speech instantly.
  - [ ] Rate and voice persistence during browser session.
  - [ ] Unit tests with accessibility-focused voice control scenarios.
- [ ] **T6 — Error handling & recovery (Story #6)**
  - [ ] Implement actionable error messages with 2 suggested next steps.
  - [ ] Handle speech synthesis failures gracefully.
  - [ ] Provide specific recovery prompts: "I didn't catch that — say 'help'".
  - [ ] QA logging for misrecognition and error scenarios.
- [ ] **T7 — Extension integration**
  - [ ] Expose TTS in background service for content script communication.
  - [ ] Message handlers for accessibility actions (scroll confirmations, link opening).
  - [ ] Integration with onboarding tour (Story #3).
- [ ] **T8 — Edge packaging & accessibility testing**
  - [ ] Ensure TTS works in Edge extension environment.
  - [ ] Test with screen readers (NVDA/JAWS compatibility).
  - [ ] Verify accessibility compliance and smooth voice interactions.

✅ **Acceptance (Sprint 1):**
- "Read page" reads content in semantic order on news/article pages.  
- "Slower/faster/voice X" commands update speech immediately.  
- "Stop/pause" halts speech as expected by visually impaired users.  
- Confirmation phrases are ≤3 words and contextually appropriate for accessibility.

---

## 📌 Acceptance Criteria (Aligned with Stories #2 & #6)
- Semantic reading handles news articles and blog posts in proper order.  
- Voice controls (rate, voice, pause) work immediately for accessibility needs.  
- Success confirmations are ≤3 words with optional detail.  
- Error messages provide specific recovery prompts with 2 suggested actions.  
- Edge browser compatibility verified with screen reader testing.

## 📌 Definition of Done
- TTS integrated with play/pause/stop functionality.  
- Rate/voice controls working with immediate effect.  
- Semantic reading order tested on news/article pages.  
- Standardized confirmation/error phrases implemented.  
- QA logs for misrecognition scenarios documented.  
- Edge extension compatibility verified.

## 📌 Persona Alignment
**Aisha Chen (Blind user):** Semantic reading with quick voice controls  
**George Martinez (Low vision):** Clear confirmations and readable article consumption  
**Nora Kim (AT Specialist):** Configurable voice settings and reliable error handling