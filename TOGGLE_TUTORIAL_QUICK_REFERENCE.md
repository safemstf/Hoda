# Quick Reference: Toggle & Tutorial Implementation

## Files

| File | Purpose | Status |
|------|---------|--------|
| `services/tts2/tutorial.js` | TutorialManager & ExtensionToggleControl | ✅ Created |
| `manifest.json` | Alt+Shift+A command registration | ✅ Already updated |
| `background.js` | Toggle handlers & icon management | ✅ Already updated |
| `popup.js` | Tutorial initialization & integration | ✅ Already updated |

## Class Reference

### TutorialManager

```javascript
// Initialize
const tutorialManager = new TutorialManager({
  ttsService: ttsService,
  speechService: speechService
});

// Start (first-time auto)
await tutorialManager.startTutorial(true);

// Replay (voice command)
await tutorialManager.replayTutorial();

// Check status
const completed = await tutorialManager.isTutorialCompleted();
const pending = await tutorialManager.isTutorialPending();

// Get info
tutorialManager.getStatus();    // { isRunning, totalDuration, sections, etc }
tutorialManager.getScript();    // Returns 11-section script array
```

### ExtensionToggleControl

```javascript
// Initialize
const toggleControl = new ExtensionToggleControl({
  ttsService: ttsService
});

await toggleControl.initialize();

// Toggle
const newState = await toggleControl.toggle();  // Returns boolean

// Get state
const isEnabled = toggleControl.getState();

// Set state
await toggleControl.setState(true);
```

## Integration Points

### 1. Background Script (background.js)
Already implemented:
- Icon click handler → `toggleExtension()`
- Keyboard shortcut handler → `toggleExtension()`
- State persistence
- Icon badge updates

### 2. Popup Script (popup.js)

**Initialization:**
```javascript
// In loadOptionalServices() after TTS loads
this.tutorialManager = new TutorialManager({
  ttsService: this.ttsService,
  speechService: this.speechService
});

this.commandProcessor.setTutorialManager(this.tutorialManager);
```

**Auto-Start (First Time):**
```javascript
// In startListening()
const tutorialStatus = await this.checkTutorialStatus();
if (tutorialStatus.isPending) {
  this.speechService.start();
  const result = await this.tutorialManager.startTutorial(true);
  // Handle result.skipped
}
```

**Voice Command:**
```javascript
// In CommandProcessor.processCommand()
if (intentResult.intent === 'tutorial') {
  const result = await this.tutorialManager.replayTutorial();
  // Handle result.skipped
}
```

**Button Handler:**
```javascript
// In setupEventListeners()
document.getElementById('btnTutorial')?.addEventListener('click', async () => {
  if (!this.tutorialManager) return;
  const result = await this.tutorialManager.replayTutorial();
  // Handle result
});
```

### 3. Manifest (manifest.json)
Already configured:
```json
{
  "commands": {
    "toggle-extension": {
      "suggested_key": { "default": "Alt+Shift+A" },
      "description": "Toggle Hoda extension on/off"
    }
  }
}
```

## Feature Breakdown

### Toggle (Alt+Shift+A)

**ON State:**
- ✅ Green badge "ON"
- ✅ Speaks "Assistant on"
- ✅ Starts STT listening
- ✅ UI shows "Active"

**OFF State:**
- ✅ Red badge "OFF"  
- ✅ Speaks "Assistant off"
- ✅ Stops STT
- ✅ Cancels TTS
- ✅ UI shows "Inactive"

**State Persistence:**
- Saved to `chrome.storage.local.extensionEnabled`
- Loaded on browser startup
- Checked before starting listening

### Tutorial (~55 seconds)

**11 Sections:**
1. Welcome (3s)
2. Toggle on/off (4s)
3. Scroll down (5s)
4. Scroll up (3s)
5. Read page (4s)
6. List links (4s)
7. Fill forms (3s)
8. Zoom (4s)
9. Help (3s)
10. Replay tutorial (2s)
11. Closing (3s)

**Skip Methods:**
- Voice: "skip tutorial"
- Keyboard: Escape key
- Either stops tutorial immediately

**Storage Keys:**
- `tutorialCompleted` - User finished tutorial
- `tutorialPending` - First-time user pending
- `tutorialCompletedAt` - Completion timestamp

## API Reference

### TutorialManager Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `startTutorial(isFirstTime)` | Promise | Play tutorial (auto-start or manual) |
| `replayTutorial()` | Promise | Replay from voice command |
| `isTutorialCompleted()` | Promise\<boolean\> | Check if completed |
| `isTutorialPending()` | Promise\<boolean\> | Check if pending for new user |
| `getStatus()` | Object | Get current status |
| `getScript()` | Array | Get tutorial sections |

### Result Objects

**Start/Replay Result:**
```javascript
{
  success: true,        // Did it run?
  skipped: false,       // Was it skipped?
  error: null,          // Error message if failed
}
```

**Status Object:**
```javascript
{
  isRunning: false,
  isPaused: false,
  isSpeaking: false,
  skipRequested: false,
  totalDuration: 55,    // seconds
  sections: 11,
}
```

## Testing Checklist

### Toggle
- [ ] Click icon → toggles
- [ ] Alt+Shift+A → toggles
- [ ] Badge changes color
- [ ] Hear "Assistant on/off"
- [ ] State persists after refresh
- [ ] Affects STT/TTS behavior

### Tutorial
- [ ] Auto-starts on first mic click
- [ ] 11 sections play in order
- [ ] Say "skip tutorial" → stops
- [ ] Press Escape → stops
- [ ] Full run takes ~55 seconds
- [ ] Mark complete after finish
- [ ] Won't auto-start again
- [ ] Say "tutorial" replays it
- [ ] Button also replays it

### Integration
- [ ] TTS plays without STT interference
- [ ] STT resumes after each section
- [ ] No console errors
- [ ] Works on all pages
- [ ] Works when OFF (shows message)

## Debugging

### Check Tutorial Status
```javascript
// In browser console (popup)
__hoda.app.tutorialManager.getStatus()
__hoda.app.tutorialManager.getScript()
```

### Check Toggle State
```javascript
// In browser console
chrome.storage.local.get(['extensionEnabled'], console.log)
```

### Check If First Time
```javascript
// In browser console
chrome.storage.local.get(['tutorialPending', 'tutorialCompleted'], console.log)
```

### Manual Trigger Tutorial
```javascript
// In popup console
await __hoda.app.tutorialManager.replayTutorial()
```

### Manual Reset Storage
```javascript
// Reset for re-testing first-time flow
chrome.storage.local.set({
  tutorialPending: true,
  tutorialCompleted: false,
  tutorialCompletedAt: null
})
```

## Common Issues

### Q: Tutorial doesn't auto-start on first click
**A:** Check `tutorialPending` is true. Reset with:
```javascript
chrome.storage.local.set({ tutorialPending: true })
```

### Q: Skip doesn't work
**A:** Ensure speech recognition is running:
```javascript
if (!this.speechService.isListening) {
  this.speechService.start();
}
```

### Q: TTS overlaps with STT
**A:** Verify pauseForTTS/resumeAfterTTS are called in `speakTutorialSection()`

### Q: Icon badge doesn't update
**A:** Check background.js `updateIcon()` function is being called

### Q: "Assistant on/off" not spoken
**A:** Verify TTS service is loaded before toggle:
```javascript
if (this.ttsService && this.ttsService.speaker) {
  await this.ttsService.speaker.speak('Assistant on');
}
```

## Console Logs

Look for these in DevTools Console to verify operation:

**Tutorial Starting:**
```
[TutorialManager] Starting tutorial (isFirstTime: true)
[TutorialManager] Setting up skip listeners
[TutorialManager] Tutorial duration: 55 seconds
```

**Tutorial Playing:**
```
[TutorialManager] Playing tutorial sequence (55s)
[TutorialManager] Section 1 / 11 - Welcome to Hoda...
[TutorialManager] Paused STT for TTS output
[TutorialManager] Resumed STT after TTS
```

**Skip Detected:**
```
[TutorialManager] Skip command detected: skip tutorial
[TutorialManager] Tutorial skipped at section 3
```

**Toggle Action:**
```
[Background] Icon clicked, toggling extension
[Background] Extension toggled: ON
[Background] Icon updated to: ON state
```

## Next Steps

1. **Test thoroughly** - Use testing checklist
2. **Verify storage** - Check keys in DevTools
3. **Monitor console** - Look for errors
4. **Get user feedback** - Is tutorial helpful?
5. **Iterate** - Refine based on usage

## Version Info

- **Created**: November 2025
- **Tutorial Duration**: 55 seconds
- **Skip Methods**: 2 (voice + keyboard)
- **Storage Keys**: 3
- **Commands**: 1 (Alt+Shift+A)

## Support

For issues or questions:
1. Check console logs
2. Verify storage state
3. Reset and retry
4. Check event listeners
5. Review implementation doc
