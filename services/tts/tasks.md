# Issue #2: Text-to-Speech Engine

## User Story
As a visually impaired user, I want the system to speak responses back to me in a clear, natural voice so I can hear confirmations, feedback, and information without looking at the screen.

## Priority
P1 (Critical)


## Type
Substantial

---

## Tasks

### 1. Initialize TTS Engine
- [x] Set up Web Speech API `SpeechSynthesis` for Microsoft Edge
- [x] Load all available system voices (`getVoices()`)
- [x] Log available voices and their properties
- [x] Verify speech output works

### 2. Voice Selection & Quality
- [ ] Test all available English voices in Edge
- [ ] Identify highest quality voices (Enhanced, Neural, Premium)
- [ ] Select best default voice for accessibility
- [ ] Test voice naturalness and clarity
- [ ] Prioritize local voices over network voices (faster, offline)
- [ ] Document which voices work best

### 3. Core Speech Function
- [ ] Build function: `speak(text, voiceName?)` → outputs speech
- [ ] Handle different text lengths (short/long)
- [ ] Queue multiple speech requests
- [ ] Prevent overlapping speech
- [ ] Allow voice override per request

### 4. Speech Quality Tuning
- [ ] Set optimal speech rate for clarity (test 0.7x - 1.2x range)
- [ ] Set appropriate pitch (1.0 neutral, test variations)
- [ ] Set volume (0.9 for accessibility)
- [ ] Test with different voice settings:
  - [ ] Short confirmations ("Done", "Link opened")
  - [ ] Error messages ("Link not found. Say help for commands")
  - [ ] Longer responses (multiple sentences)
- [ ] Find best rate/pitch combination per voice type

### 5. Multiple Voice Support
- [ ] Support switching between voices
- [ ] Test male vs female voices
- [ ] Test different accent variations (US, UK, etc.)
- [ ] Allow user to select preferred voice
- [ ] Save voice preference
- [ ] Fallback to default if preferred unavailable

### 6. Speech Controls
- [ ] Implement stop current speech
- [ ] Implement pause speech
- [ ] Implement resume speech
- [ ] Clear speech queue when needed
- [ ] Test interruption handling

### 7. Testing Voice Quality
- [ ] Test each available voice with sample text
- [ ] Rate naturalness (1-10 scale)
- [ ] Rate clarity (1-10 scale)
- [ ] Test pronunciation of technical terms
- [ ] Test with punctuation and formatting
- [ ] Compare voices side-by-side
- [ ] Document best voices for different use cases

---

## Acceptance Criteria
- [ ] System speaks with clear, natural-sounding voice
- [ ] Best available voice is auto-selected
- [ ] User can choose from available voices
- [ ] Speech quality is optimized (rate, pitch, volume)
- [ ] Multiple voices are supported and tested
- [ ] Speech can be stopped/paused/resumed
- [ ] Preferences are saved

---

## Definition of Complete
TTS engine functional using Web Speech API; all available voices tested and documented; best voice auto-selected; `speak(text)` function works with high-quality output; rate/pitch/volume optimized for clarity; user can select preferred voice; preferences persist; queue system works; tested with various text types.

---

## User Personas Served
- **Aisha** (Blind professional) - Primary beneficiary for clear audio feedback
- **George** (Low-vision elderly) - Benefits from natural-sounding voice
- **Nora** (Caregiver/Power-user) - Can select best voice for user's preference

---

## Technical Notes
- Uses **free** Web Speech API `SpeechSynthesis` (no costs)
- Voices from user's OS (Windows 11 has premium voices)
- Edge typically includes: Microsoft Zira, David, Mark (US), Hazel (UK)
- Neural/Enhanced voices provide best quality
- Reference: `accessibleTTS.tsx` component

---

## Pipeline Position
**User Voice** → STT → WebLLM → **TTS (This Issue)** → **Spoken Response**

---

## Dependencies
- None (can start immediately)

## Used By
- All future features that need spoken responses

## Estimated Effort
2 weeks for one developer
