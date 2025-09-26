# STT — Sprint Plan (3 linear sprints — updated)

**Owner:** @safemstf (Safe)  
**Branch prefix examples:**  
- `feature/stt/core-capture-l10n`  
- `feature/stt/confidence-l10n-profiles`  
- `feature/stt/hotkey-multiqa-webllm-ready`  

## 🎯 Sprint 1 — Core capture, locale selection, normalization
**Branch:** `feature/stt/core-capture-l10n`  
**Goal:** Basic capture + normalization + explicit language selection (user choice or config).

### Checklist
- [ ] **T1.1 — Scaffold + config**
  - [ ] Create files: `index.ts`, `recognizer.ts`, `normalize.ts`, `i18n.ts`.
  - [ ] Add config keys: `DEFAULT_LANG`, `SUPPORTED_LANGS`, `SPEAKER_PROFILE_ENABLED`.
  - [ ] Add `package.json` scripts: `build`, `test`.
- [ ] **T1.2 — Language selection**
  - [ ] Implement `startListening({ lang })` that sets locale (`recognition.lang`).
  - [ ] Add fallback if unsupported locale → best match + warning.
  - [ ] Unit tests: `en-US`, `es-ES`, `fr-FR`.
- [ ] **T1.3 — Normalize transcript**
  - [ ] Implement `normalizeTranscript(text, lang)`.
  - [ ] Add number parsing + common synonym maps in `i18n.ts`.
  - [ ] Unit tests for at least English + 1 other locale.
- [ ] **T1.4 — Background demo + webLLM stub**
  - [ ] Demo flow: STT → background → JSON log.
  - [ ] Stub `webllm.analyzeUtterance` to confirm payload shape.

✅ **Acceptance (Sprint 1):**
- `startListening({ lang: 'en-US' })` uses correct locale.  
- Normalization handles locale-specific rules.  
- README documents `DEFAULT_LANG` & `SUPPORTED_LANGS`.

---

## 🎯 Sprint 2 — Partials, confidence, speaker profiles, clarifying flow
**Branch:** `feature/stt/confidence-l10n-profiles`  
**Goal:** UX improvements (partials, profiles, clarifying flow with webLLM).

### Checklist
- [ ] **T2.1 — Partial results & latency**
  - [ ] Implement `onPartial()` callback.
  - [ ] Deliver JSON <300ms after speech end.
- [ ] **T2.2 — Confidence thresholds per-locale**
  - [ ] Configurable `CONF_HIGH[lang]`, `CONF_LOW[lang]`.
  - [ ] Tests for multiple locales.
- [ ] **T2.3 — Speaker profile (opt-in)**
  - [ ] Implement `registerSpeaker(profile)` + `setSpeakerId(id)`.
  - [ ] Store in `chrome.storage` with opt-in only.
- [ ] **T2.4 — webLLM-aware clarifying flow**
  - [ ] Low confidence → send JSON to `webllm.analyzeUtterance`.
  - [ ] Receive `candidates` + `speakPrompt` localized.
  - [ ] Tests for ambiguous phrases in multiple langs.
- [ ] **T2.5 — Language detection fallback**
  - [ ] Detect language heuristically if not provided.
  - [ ] Tests for ambiguous short phrases.

✅ **Acceptance (Sprint 2):**
- Partials surfaced quickly.  
- Profiles improve recognition (≥30% for test cases).  
- Clarifying flow localized & waits for confirmation.  
- Opt-in storage only, documented in README.

---

## 🎯 Sprint 3 — Hotkey + robustness, multilingual QA, webLLM finalization
**Branch:** `feature/stt/hotkey-multiqa-webllm-ready`  
**Goal:** Final polish: hotkeys, multilingual QA, contract with webLLM.

### Checklist
- [ ] **T3.1 — Hotkey/toggle**
  - [ ] Add `manifest.commands` hotkey to start/stop STT.
  - [ ] Confirm start/stop with localized TTS message.
- [ ] **T3.2 — Multilingual QA**
  - [ ] Test across ≥5 locales: `en-US`, `es-ES`, `fr-FR`, `ar-SA`, `hi-IN`.
  - [ ] Build corpus: 50 utterances/locale.
- [ ] **T3.3 — webLLM payload & contract**
  - [ ] Finalize schema: `{ raw, partial_history, lang, speakerId, confidence, timestamps, page_context? }`.
  - [ ] Document response contract: `{ action, candidates, speakPrompt, requiresConfirmation }`.
  - [ ] Integration test with mock webLLM.
- [ ] **T3.4 — Docs & privacy**
  - [ ] Finalize README: enabling languages, profiles, cloud fallback privacy.
  - [ ] Add short end-user guide.
- [ ] **T3.5 — Edge packaging checks**
  - [ ] Verify bundle size stays small.
  - [ ] Document extra permissions if cloud fallback used.

✅ **Acceptance (Sprint 3):**
- Hotkey works & localized announcements play.  
- Multilingual tests show ≥85% accuracy for core commands.  
- WebLLM contract locked down & tested.  

---

## 📌 Updated Acceptance Criteria
- ≥85% accuracy for canonical commands across supported locales.  
- JSON output always includes `lang` + `speakerId`.  
- Profiles measurably improve recognition (documented).  
- Clarifying flow localized.  
- Opt-in only for storage; privacy documented.

## 📌 Definition of Done
- `services/stt` delivers standardized JSON with partials, multi-lang normalization, opt-in profiles, and integrated clarifying flow.  
- Passes unit + integration tests.  
- README documents config, privacy, and webLLM schema.  
