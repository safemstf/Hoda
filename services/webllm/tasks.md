# webLLM — Sprint Plan (Single Sprint - Local-First Intent Parsing for Accessibility)

**Owners:** @ali (primary), @arakan, @sumanth  
**Related Stories:** #8 webLLM natural intent parsing (local-first) — Natural language accessibility commands  
**Branch prefix examples:**  
- `feature/webllm/accessibility-intents`  
- `feature/webllm/local-first-parsing`  
- `feature/webllm/confirmation-flow`  

## 🎯 Sprint 1 — Local-first intent parsing for accessibility browser control
**Branch:** `feature/webllm/accessibility-intents`  
**Goal:** Local-first natural language processing for accessibility-focused browser commands with privacy protection.

### Checklist
- [ ] **T1 — Project scaffold & local-first architecture**
  - [ ] Create `services/webllm/src/` with files: `index.ts`, `parser.ts`, `intents.ts`, `privacy.ts`.
  - [ ] Install minimal local ML dependencies (no cloud APIs by default).
  - [ ] Add `services/webllm/package.json` scripts: `build`, `test`, `lint`.
  - [ ] Add README with accessibility use cases and privacy documentation.
- [ ] **T2 — Accessibility intent classification (Story #8)**
  - [ ] Implement `parseIntent(text)` returning `{ intent, slots, confidence }`.
  - [ ] Map accessibility-focused intents: `navigate`, `read`, `form_action`, `zoom`, `find_content`.
  - [ ] Handle everyday language: "find me articles about cooking" → search action.
  - [ ] Unit tests for 40+ accessibility-focused utterances from personas.
- [ ] **T3 — Context-aware slot resolution**
  - [ ] Implement page context awareness for better intent resolution.
  - [ ] Handle accessibility-specific entities: headings, landmarks, form fields.
  - [ ] Fuzzy matching for link names and page elements visually impaired users might reference.
  - [ ] Unit tests for accessibility navigation patterns.
- [ ] **T4 — Confirmation flow for high-risk actions (Story #8 criteria)**
  - [ ] Implement confirmation system: "assistant proposes plan and asks confirmation".
  - [ ] Identify high-risk actions: form submission, navigation away from page, data entry.
  - [ ] Generate clear confirmation prompts for visually impaired users.
  - [ ] Unit tests for confirmation flow with mock user responses.
- [ ] **T5 — Local-first privacy protection (Story #8 criteria)**
  - [ ] Add privacy toggle enforcing local-only processing when selected.
  - [ ] No external API calls in local-only mode (strict privacy).
  - [ ] Graceful degradation when local processing is insufficient.
  - [ ] Documentation for privacy-conscious users and AT specialists.
- [ ] **T6 — Accessibility-focused error handling**
  - [ ] Handle ambiguous commands with accessible clarifying questions.
  - [ ] Provide alternative interpretations for misunderstood accessibility commands.
  - [ ] Integration with TTS for spoken error recovery.
  - [ ] Tests for accessibility-specific edge cases.
- [ ] **T7 — Integration with STT and background services**
  - [ ] Provide main API: `analyzeAccessibilityUtterance(text, pageContext)`.
  - [ ] Integration hooks for STT → webLLM → action pipeline.
  - [ ] Background service message handling for accessibility commands.
  - [ ] Example integration demonstrating accessibility workflow.
- [ ] **T8 — Accessibility QA & persona testing**
  - [ ] Test with ~50 accessibility-focused utterances covering all personas.
  - [ ] Performance: <200ms response time for local processing.
  - [ ] Accuracy: Intent mapping for accessibility commands from user stories.
  - [ ] Generate accessibility-focused QA logs and metrics.

✅ **Acceptance (Sprint 1):**
- Open-ended utterances mapped to accessibility actions with high accuracy.  
- Assistant proposes plan and asks confirmation for high-risk actions.  
- Privacy toggle enforces local-only processing when selected.  
- Natural language works for accessibility scenarios: "find me articles about cooking".

---

## 📌 Acceptance Criteria (Story #8 Aligned)
- webLLM integrated with local-first processing and opt-in cloud fallback.  
- Intent→action mapping handles everyday language from accessibility users.  
- Confirmation flow for high-impact actions (submit, navigate, etc.).  
- Privacy toggle with strict local-only enforcement documented.  
- Tests with ~50 accessibility-focused utterances showing good accuracy.

## 📌 Definition of Done
- Local-first processing with privacy protection implemented.  
- Natural language intent parsing for accessibility commands working.  
- Confirmation flow integrated with TTS for spoken interactions.  
- Integration with STT service and background extension architecture.  
- Accessibility-focused test suite with persona-based scenarios.  
- Privacy documentation for visually impaired users and AT specialists.

## 📌 Persona Alignment
**Aisha Chen:** Natural commands like "find the login form" or "read me the main article"  
**George Martinez:** Simple everyday language: "make text bigger" or "read this to me"  
**Nora Kim:** Privacy controls and configuration options for different user comfort levels

## 📌 Privacy & Accessibility Notes
- **Local-first by default:** Respects privacy concerns of visually impaired users
- **Screen reader compatible:** Confirmation prompts work with NVDA/JAWS
- **Edge optimized:** Integration tested specifically for Microsoft Edge environment