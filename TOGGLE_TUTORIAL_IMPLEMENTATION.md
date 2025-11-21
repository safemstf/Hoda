# Extension Toggle & Spoken Onboarding Tutorial Implementation

## Overview

This document describes the implementation of two major features:

1. **Extension Toggle Control** - Browser action icon to enable/disable Hoda
2. **Spoken Onboarding Tutorial** - Interactive 45-60 second tutorial for first-time users

Both features are implemented in `services/tts2/tutorial.js`.

---

## Part 1: Extension Toggle Control

### Features

✅ **Browser Action Icon**
- Click icon to toggle extension ON/OFF
- Different visual states (ON = green badge, OFF = red badge)
- Tooltip shows current state

✅ **Keyboard Shortcut**
- `Alt+Shift+A` to toggle extension
- Works from any page/popup

✅ **Visual State Indicators**
- **ON**: Green "ON" badge + "Hoda - Active" tooltip
- **OFF**: Red "OFF" badge + "Hoda - Inactive" tooltip

✅ **Persistent State**
- State saved to `chrome.storage.local`
- Persists across browser sessions

### How It Works

#### Toggle Flow (ON → OFF)

```
User clicks icon/presses Alt+Shift+A
         ↓
background.js: toggleExtension()
         ↓
Save state: extensionEnabled = false
         ↓
Update icon: Red "OFF" badge
         ↓
Speak: "Assistant off" (TTS)
         ↓
Stop STT listening
         ↓
Cancel all active TTS
         ↓
Show inactive UI state
```

#### Toggle Flow (OFF → ON)

```
User clicks icon/presses Alt+Shift+A
         ↓
background.js: toggleExtension()
         ↓
Save state: extensionEnabled = true
         ↓
Update icon: Green "ON" badge
         ↓
Speak: "Assistant on" (TTS)
         ↓
Start STT listening
         ↓
Show active UI state
```

### Implementation Details

**Manifest Configuration** (`manifest.json`):
```json
{
  "commands": {
    "toggle-extension": {
      "suggested_key": {
        "default": "Alt+Shift+A"
      },
      "description": "Toggle Hoda extension on/off"
    }
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon48.png"
  }
}
```

**Background Script** (`background.js`):
```javascript
// Handle icon click
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Background] Icon clicked, toggling extension');
  await toggleExtension();
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-extension') {
    console.log('[Background] Keyboard shortcut pressed, toggling extension');
    await toggleExtension();
  }
});

// Update icon based on state
async function updateIcon(enabled) {
  if (enabled) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Green
  } else {
    await chrome.action.setBadgeText({ text: 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // Red
  }
}
```

**Popup Integration** (`popup.js`):
```javascript
// Toggle button click handler
document.getElementById('toggleExtensionBtn').addEventListener('click', async () => {
  const newState = await this.toggleExtension();
  this.updateToggleButtonUI(newState);
  
  // Notify background to update icon
  chrome.runtime.sendMessage({
    type: 'UPDATE_TOGGLE_ICON',
    enabled: newState
  });
});

// Handle toggle state changes from background
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'TOGGLE_STATE_CHANGED') {
    this.extensionEnabled = msg.enabled;
    
    if (msg.enabled) {
      // Say "Assistant on" and start listening
      await this.ttsService.speaker.speak('Assistant on');
      await this.startListening();
    } else {
      // Say "Assistant off" and stop everything
      await this.ttsService.speaker.speak('Assistant off');
      this.stopListening();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
    
    this.uiManager.updateStatus(
      msg.enabled 
        ? '✅ Active - Listening enabled' 
        : '⏸️ Inactive - Extension disabled'
    );
    
    this.updateToggleButtonUI(msg.enabled);
  }
});
```

### Testing the Toggle

1. **Click icon in toolbar** - Extension toggles between ON/OFF
2. **Watch badge change** - Green ON ↔ Red OFF
3. **Press Alt+Shift+A** - Keyboard shortcut toggles state
4. **Hear TTS confirmation** - "Assistant on" or "Assistant off"
5. **Check popup** - Toggle button updates UI
6. **Refresh page** - State persists

---

## Part 2: Spoken Onboarding Tutorial

### Features

✅ **Interactive 45-60 Second Tutorial**
- Delivered entirely via TTS (Text-to-Speech)
- Covers all essential features
- Organized in digestible sections

✅ **Content Coverage**
1. Welcome introduction
2. How to toggle extension on/off
3. How to scroll down/up
4. How to read page content
5. How to list links
6. How to fill forms
7. How to zoom in/out
8. How to get help
9. How to replay tutorial

✅ **Skippable**
- Voice command: "skip tutorial"
- Keyboard shortcut: `Escape` key
- Exits gracefully any time

✅ **First-Time User Auto-Start**
- Automatically triggers on first mic button click
- Marked as "pending" on first install
- Marked as "completed" after full playthrough
- Never auto-starts again unless user explicitly requests

### Tutorial Script

Duration: **~55 seconds**

```
1. "Welcome to Hoda voice assistant for navigating the web." (3s)

2. "First, you can toggle me on and off by clicking the icon in your toolbar, 
   or pressing Alt Shift A." (4s)

3. "Let me show you five essential commands. Try saying: Scroll down." (5s)

4. "You can also say: Scroll up to move back up the page." (3s)

5. "To read the page out loud, say: Read page. To stop reading, say: Stop reading." (4s)

6. "To see all links on the page, say: List links." (4s)

7. "You can fill web forms by saying: Fill form, then answer questions with voice." (3s)

8. "You can also zoom in by saying: Zoom in, and zoom out by saying: Zoom out." (4s)

9. "Stuck? Just say: Help to get guidance on what you can do." (3s)

10. "You can replay this tutorial anytime by saying: Tutorial." (2s)

11. "That's it! I'm ready to help. Say skip tutorial to exit now, or I'll end automatically." (3s)
```

### How It Works

#### First-Time User Flow

```
User clicks microphone button
         ↓
popup.js: startListening()
         ↓
Check: Is this first time? (tutorialPending = true)
         ↓
YES → Start tutorial
         ↓
TutorialManager.startTutorial(true)
         ↓
Set up skip listeners (voice, keyboard)
         ↓
Loop through tutorial sections:
  - Pause STT
  - Speak section via TTS
  - Resume STT
  - Pause between sections
         ↓
User can say "skip tutorial" or press Escape
         ↓
If completed (not skipped):
  Mark as complete: tutorialCompleted = true
  Mark pending as false: tutorialPending = false
```

#### Manual Replay Flow

```
User says: "Tutorial"
         ↓
IntentResolver resolves to intent: "tutorial"
         ↓
CommandProcessor handles "tutorial" intent
         ↓
TutorialManager.replayTutorial()
         ↓
Same as above but isFirstTime = false
         ↓
User can skip or let it complete
```

### TTS/STT Coordination

**Challenge**: TTS output interferes with STT (speech recognition)

**Solution**: Pause/Resume Pattern

```javascript
// When tutorial plays a section:
this.speechService.pauseForTTS()      // Stop listening
await this.speakTutorialSection(text) // Play TTS
this.speechService.resumeAfterTTS()   // Resume listening
```

**Implementation in SpeechRecognitionService** (popup.js):

```javascript
// Pause recognition for TTS output
pauseForTTS() {
  this.isPausedForTTS = true;
  this.wasListeningBeforeTTS = true;
  this.isListening = false;
  this.recognition.stop();
}

// Resume recognition after TTS completes
resumeAfterTTS() {
  if (this.wasListeningBeforeTTS && this.isPausedForTTS) {
    this.isPausedForTTS = false;
    this.wasListeningBeforeTTS = false;
    this.isListening = true;
    this.recognition.start();
  }
}
```

### Skip Detection

**Voice Command**: "skip tutorial"
- Monitored via `chrome.runtime.onMessage`
- Looks for transcript containing skip keywords
- Sets `skipRequested = true`
- Tutorial breaks out of main loop

**Keyboard**: `Escape` key
- Monitored via `document.keydown`
- Sets `skipRequested = true` immediately
- Tutorial breaks out of main loop

**Implementation**:

```javascript
setupSkipListener() {
  // Listen for voice transcripts
  this.skipListener = (message, sender, sendResponse) => {
    if (message.type === 'TRANSCRIPT') {
      const transcript = message.text.toLowerCase();
      const skipCommands = [
        'skip tutorial', 'skip', 'stop tutorial', 
        'exit tutorial', 'cancel tutorial'
      ];
      
      for (const cmd of skipCommands) {
        if (transcript.includes(cmd)) {
          this.skipRequested = true;
          break;
        }
      }
    }
  };
  
  chrome.runtime.onMessage.addListener(this.skipListener);
  
  // Listen for Escape key
  this.keyboardListener = (event) => {
    if (event.key === 'Escape') {
      this.skipRequested = true;
    }
  };
  
  document.addEventListener('keydown', this.keyboardListener);
}
```

### Storage Management

**Keys Used**:
- `tutorialCompleted` (boolean) - User has completed tutorial
- `tutorialPending` (boolean) - Tutorial pending for first-time user
- `tutorialCompletedAt` (timestamp) - When tutorial was completed

**First Install Flow** (background.js):

```javascript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ 
      tutorialPending: true,    // Mark as pending
      tutorialCompleted: false,
      transcripts: [],
      stats: { totalCommands: 0, recognizedCommands: 0 }
    });
  }
});
```

**After Tutorial Completes** (tutorial.js):

```javascript
async markTutorialComplete() {
  await chrome.storage.local.set({ 
    tutorialCompleted: true,
    tutorialCompletedAt: Date.now(),
    tutorialPending: false
  });
}
```

### Usage in popup.js

**Import and Initialize**:

```javascript
// In HodaVoiceAssistant.loadOptionalServices()
this.tutorialManager = new TutorialManager({
  ttsService: this.ttsService,
  speechService: this.speechService
});

// Link to command processor
this.commandProcessor.setTutorialManager(this.tutorialManager);
```

**Auto-Start for First-Time Users**:

```javascript
// In HodaVoiceAssistant.startListening()
const tutorialStatus = await this.checkTutorialStatus();
if (tutorialStatus.isPending) {
  // Start speech recognition (needed for skip detection)
  this.speechService.start();
  
  // Start tutorial (will set up skip listener)
  const tutorialResult = await this.tutorialManager.startTutorial(true);
  
  if (tutorialResult.success && tutorialResult.skipped) {
    this.uiManager.showCommandResult('✓ Tutorial skipped', false);
  }
}
```

**Manual Replay via Voice Command**:

```javascript
// In CommandProcessor.processCommand()
if (intentResult.intent === 'tutorial') {
  const tutorialResult = await this.tutorialManager.replayTutorial();
  
  if (tutorialResult.success) {
    if (tutorialResult.skipped) {
      this.uiManager.showCommandResult('✓ Tutorial skipped', false);
    } else {
      this.uiManager.showCommandResult('✓ Tutorial started', false);
    }
  }
}
```

**Manual Button in UI** (popup.html):

```html
<button id="btnTutorial" title="Play onboarding tutorial">
  🎓 Tutorial
</button>
```

```javascript
// In popup.js event listeners
document.getElementById('btnTutorial').addEventListener('click', async () => {
  if (!this.tutorialManager || !this.ttsService) {
    this.uiManager.showCommandResult('Tutorial not ready yet.', true);
    return;
  }
  
  try {
    // Start speech recognition if not already running
    if (!this.speechService.isListening) {
      this.speechService.start();
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Start tutorial
    const tutorialResult = await this.tutorialManager.replayTutorial();
    
    if (tutorialResult.success) {
      if (tutorialResult.skipped) {
        this.uiManager.showCommandResult('✓ Tutorial skipped', false);
      } else {
        this.uiManager.showCommandResult('✓ Tutorial completed', false);
      }
    }
  } catch (error) {
    console.error('[Popup] Failed to replay tutorial:', error);
    this.uiManager.showCommandResult('Could not start tutorial', true);
  }
});
```

---

## Integration Checklist

### Background Script Updates (background.js)
- ✅ Toggle command listener
- ✅ Icon click handler
- ✅ Icon update on state change
- ✅ Badge visual states (ON/OFF)
- ✅ First-time install setup

### Popup Script Updates (popup.js)
- ✅ TutorialManager initialization
- ✅ TutorialManager linked to CommandProcessor
- ✅ Tutorial auto-start for first-time users
- ✅ Tutorial button event listener
- ✅ Toggle button event listener
- ✅ Toggle state UI update
- ✅ Message listener for toggle state changes

### Manifest Updates (manifest.json)
- ✅ `toggle-extension` command with Alt+Shift+A
- ✅ Command description

### Content Script Updates (content.js)
- ✅ No changes needed (works via popup messaging)

### Tutorial Script (services/tts2/tutorial.js)
- ✅ TutorialManager class
- ✅ ExtensionToggleControl class
- ✅ Skip listeners (voice + keyboard)
- ✅ TTS/STT coordination
- ✅ Storage management
- ✅ All 11 tutorial sections

---

## Testing Guide

### Test Toggle Control

1. **Icon Click Test**
   - Click extension icon in toolbar
   - Verify badge toggles: ON ↔ OFF
   - Verify tooltip changes
   - Hear "Assistant on" or "Assistant off"

2. **Keyboard Shortcut Test**
   - Press Alt+Shift+A
   - Verify state toggles
   - Repeat multiple times

3. **Persistence Test**
   - Toggle to OFF
   - Refresh page
   - Verify still OFF
   - Close and reopen popup
   - Verify still OFF

4. **Auto-Start Test (when ON)**
   - Toggle ON
   - Click microphone button
   - Should auto-start listening

5. **Auto-Stop Test (when OFF)**
   - Toggle OFF
   - Click microphone button
   - Should show "Extension is OFF" message
   - Should not start listening

### Test Spoken Tutorial

1. **First-Time User Tutorial**
   - Clear storage: `chrome.storage.local.clear()`
   - Go to popup
   - Click microphone button
   - Tutorial should auto-start
   - Hear "Welcome to Hoda..."

2. **Skip via Voice**
   - During tutorial, say "skip tutorial"
   - Tutorial should stop immediately
   - Show "Tutorial skipped"

3. **Skip via Keyboard**
   - During tutorial, press Escape
   - Tutorial should stop immediately
   - Show "Tutorial skipped"

4. **Full Completion**
   - Let tutorial run fully (~55 seconds)
   - All 11 sections should play
   - Storage should be marked complete

5. **Manual Replay**
   - Say "Tutorial"
   - Tutorial should replay
   - Can skip at any time

6. **Tutorial Button**
   - Click 🎓 Tutorial button
   - Tutorial should replay
   - All skip methods should work

7. **STT/TTS Coordination**
   - During tutorial, speech recognition pauses
   - TTS plays without interference
   - STT resumes after each section

---

## Files Modified

1. **manifest.json**
   - Added `toggle-extension` command with Alt+Shift+A

2. **background.js**
   - Added toggle functions
   - Added command listener
   - Added action listener
   - Added icon update logic
   - Added first-time install setup

3. **popup.js**
   - Imported TutorialManager
   - Initialized tutorial manager
   - Added tutorial auto-start logic
   - Added toggle button handler
   - Added message listener for toggle state

4. **services/tts2/tutorial.js** ← **NEW FILE**
   - TutorialManager class
   - ExtensionToggleControl class
   - Complete 45-60 second tutorial script
   - Skip detection (voice + keyboard)
   - TTS/STT coordination

---

## Code Examples

### Play Tutorial Programmatically

```javascript
// From anywhere with access to tutorialManager and ttsService
if (tutorialManager && ttsService) {
  const result = await tutorialManager.replayTutorial();
  
  if (result.success) {
    console.log('Tutorial', result.skipped ? 'skipped' : 'completed');
  } else {
    console.error('Tutorial failed:', result.error);
  }
}
```

### Check Tutorial Status

```javascript
const completed = await tutorialManager.isTutorialCompleted();
const pending = await tutorialManager.isTutorialPending();

console.log('Completed:', completed);
console.log('Pending:', pending);
```

### Get Tutorial Info

```javascript
const status = tutorialManager.getStatus();
console.log('Duration:', status.totalDuration, 'seconds');
console.log('Sections:', status.sections);
console.log('Running:', status.isRunning);

const script = tutorialManager.getScript();
console.log('Script sections:', script.length);
```

---

## Browser Support

✅ **Tested on**:
- Microsoft Edge 120+
- Chrome 120+
- Chromium-based browsers

**Requirements**:
- Web Speech API (for speech recognition)
- Speech Synthesis API (for TTS)
- Chrome Storage API

---

## Future Enhancements

1. **Multiple Language Support**
   - Tutorial in Spanish, French, etc.
   - Language selection in options

2. **Advanced Tutorial**
   - Optional 2-3 minute advanced tutorial
   - Covers: custom intents, advanced commands, tips

3. **Tutorial Analytics**
   - Track: completion rate, skip points, replay frequency
   - Help identify confusing sections

4. **Interactive Tutorial**
   - Ask user to repeat commands
   - Provide immediate feedback
   - Branching paths based on user actions

5. **Tutorial Persistence**
   - Option to replay tutorial weekly/monthly
   - "Refresher course" for dormant users

---

## Troubleshooting

### Tutorial Doesn't Auto-Start

**Cause**: `tutorialPending` not set
**Solution**: 
```javascript
chrome.storage.local.set({ tutorialPending: true });
```

### Tutorial Won't Stop When Skipped

**Cause**: Skip listeners not properly removed
**Solution**: Clear listeners manually
```javascript
tutorialManager.cleanupSkipListener();
```

### TTS Overlaps with STT

**Cause**: pauseForTTS/resumeAfterTTS not called
**Solution**: Verify in speakTutorialSection()
```javascript
this.speechService.pauseForTTS();
await this.speakTutorialSection(text);
this.speechService.resumeAfterTTS();
```

### Toggle Icon Not Updating

**Cause**: Background script not responding
**Solution**: Check popup.js sends UPDATE_TOGGLE_ICON message
```javascript
chrome.runtime.sendMessage({
  type: 'UPDATE_TOGGLE_ICON',
  enabled: newState
});
```

---

## Author Notes

- **Implementation Date**: November 2025
- **Total Duration**: ~55 seconds for full tutorial
- **Skip Detection**: Voice + Keyboard (Escape)
- **First-Time Auto-Start**: Yes, on first mic click
- **Persistence**: Marks complete to prevent re-triggering
- **TTS/STT Coordination**: Pause/Resume pattern prevents conflicts

---

## License

This implementation follows the same license as the Hoda extension.
