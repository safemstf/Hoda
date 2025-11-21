# Technical Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HODA EXTENSION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────┐         ┌──────────────────────────────────┐  │
│  │  EXTENSION ICON      │         │     POPUP.HTML                   │  │
│  │  (Edge Toolbar)      │◄────►   │     ┌────────────────────────┐  │  │
│  │                      │         │     │  Toggle Button         │  │  │
│  │  • Badge: ON/OFF     │         │     │  Microphone Button     │  │  │
│  │  • Tooltip           │         │     │  Tutorial Button       │  │  │
│  │  • Click handler     │         │     │  Status Display        │  │  │
│  └──────────────────────┘         │     │  Stats Display         │  │  │
│         △                          │     └────────────────────────┘  │  │
│         │                          └──────────────────────────────────┘  │
│         │                                      △                         │
│      updateIcon()                              │                         │
│    setBadgeText()                      popup.js Event Listeners         │
│   setBadgeColor()                               │                         │
│         │                                      │                         │
│         └──────────────┬───────────────────────┘                         │
│                        │                                                  │
│                        ▼                                                  │
│         ┌──────────────────────────┐                                     │
│         │   BACKGROUND.JS          │                                     │
│         │                          │                                     │
│         │  • toggleExtension()     │                                     │
│         │  • updateIcon()          │                                     │
│         │  • Message listeners     │                                     │
│         │  • Command handler       │                                     │
│         │  • State persistence     │                                     │
│         └──────────────┬───────────┘                                     │
│                        │                                                  │
│                        ▼                                                  │
│         ┌──────────────────────────┐                                     │
│         │  CHROME STORAGE.LOCAL    │                                     │
│         │                          │                                     │
│         │  • extensionEnabled      │                                     │
│         │  • tutorialPending       │                                     │
│         │  • tutorialCompleted     │                                     │
│         │  • tutorialCompletedAt   │                                     │
│         └──────────────────────────┘                                     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              HOVER VOICE ASSISTANT (HVA)                        │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                  │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐ │    │
│  │  │  SpeechRecognition   │  │   TTS SERVICE                    │ │    │
│  │  │   Service            │  │                                  │ │    │
│  │  │                      │  │   • Speaker                      │ │    │
│  │  │  • start()           │  │   • speak()                      │ │    │
│  │  │  • stop()            │  │   • pauseForTTS()                │ │    │
│  │  │  • pauseForTTS()◄───►│──│   • resumeAfterTTS()             │ │    │
│  │  │  • resumeAfterTTS()  │  │   • setVoice()                   │ │    │
│  │  │  • isListening       │  │                                  │ │    │
│  │  └──────────────────────┘  └──────────────────────────────────┘ │    │
│  │                                                                  │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │          TUTORIAL MANAGER                                │   │    │
│  │  │                                                           │   │    │
│  │  │  • startTutorial()                                        │   │    │
│  │  │  • replayTutorial()                                       │   │    │
│  │  │  • playTutorialSequence()                                │   │    │
│  │  │  • setupSkipListener()                                   │   │    │
│  │  │  • cleanupSkipListener()                                │   │    │
│  │  │  • markTutorialComplete()                               │   │    │
│  │  │  • getStatus()                                           │   │    │
│  │  │                                                           │   │    │
│  │  │  SKIP DETECTION:                                         │   │    │
│  │  │  ├─ Voice: "skip tutorial" (via runtime.onMessage)      │   │    │
│  │  │  └─ Keyboard: Escape key (via document.keydown)         │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │                                                                  │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────┐ │    │
│  │  │ COMMAND PROCESSOR    │  │   INTENT RESOLVER                │ │    │
│  │  │                      │  │                                  │ │    │
│  │  │ • processCommand()   │  │   • resolve()                    │ │    │
│  │  │ • executeCommand()   │  │   • detect "tutorial" intent     │ │    │
│  │  │ • setTutorial...()   │  │   • detect "help" intent         │ │    │
│  │  │                      │  │                                  │ │    │
│  │  │ On "tutorial" intent:│  │                                  │ │    │
│  │  │ └─ Call tutorial     │  │                                  │ │    │
│  │  │    .replayTutorial() │  │                                  │ │    │
│  │  └──────────────────────┘  └──────────────────────────────────┘ │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              MANIFEST.JSON                                       │   │
│  │                                                                  │   │
│  │  • commands:                                                     │   │
│  │    └─ toggle-extension: Alt+Shift+A                            │   │
│  │                                                                  │   │
│  │  • background: service_worker: background.js                   │   │
│  │  • action: default_popup: popup.html                           │   │
│  │  • permissions: [storage, activeTab, scripting, tts, tabs]     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Toggle Extension

```
USER INPUT
    │
    ├─ Click Extension Icon
    │       │
    │       ▼
    │   background.js:
    │   chrome.action.onClicked.addListener
    │   └─► toggleExtension()
    │
    ├─ Press Alt+Shift+A
    │       │
    │       ▼
    │   background.js:
    │   chrome.commands.onCommand.addListener
    │   └─► toggleExtension()
    │
    └─ Click Toggle Button in Popup
            │
            ▼
        popup.js:
        toggleExtensionBtn.addEventListener('click')
        └─► HodaVoiceAssistant.toggleExtension()


    ▼▼▼ PROCESSING ▼▼▼

toggleExtension()
    │
    ├─ this.extensionEnabled = !this.extensionEnabled
    │
    ├─ chrome.storage.local.set({ extensionEnabled: ... })
    │
    ├─ updateIcon(this.extensionEnabled)
    │   ├─ IF enabled:
    │   │  ├─ setBadgeText('ON')
    │   │  └─ setBadgeBackgroundColor('#10b981') [Green]
    │   └─ IF disabled:
    │      ├─ setBadgeText('OFF')
    │      └─ setBadgeBackgroundColor('#ef4444') [Red]
    │
    └─ broadcast TOGGLE_STATE_CHANGED message


    ▼▼▼ RESPONSE ▼▼▼

popup.js: TOGGLE_STATE_CHANGED listener
    │
    ├─ IF enabled:
    │  ├─ await this.ttsService.speaker.speak('Assistant on')
    │  ├─ await this.startListening()
    │  │   └─► SpeechRecognitionService.start()
    │  └─ updateStatus('✅ Active - Listening enabled')
    │
    └─ IF disabled:
       ├─ await this.ttsService.speaker.speak('Assistant off')
       ├─ this.stopListening()
       │   └─► SpeechRecognitionService.stop()
       ├─ window.speechSynthesis.cancel()
       └─ updateStatus('⏸️ Inactive - Extension disabled')


VISUAL FEEDBACK
    │
    ├─ Badge changes color (green/red)
    ├─ Tooltip updates
    ├─ Toggle button UI updates
    ├─ Popup status text updates
    └─ TTS speaks confirmation


USER PERCEIVES
    │
    ├─ Green ON badge in toolbar
    ├─ Red OFF badge in toolbar
    ├─ "Assistant on" / "Assistant off" spoken
    ├─ STT listening / not listening
    └─ Status message in popup
```

## Data Flow: Tutorial

```
TRIGGER

Path 1: First-Time User (Auto-Start)
    │
    └─► popup.js: startListening()
        └─► checkTutorialStatus()
            └─ IF tutorialPending == true
               └─► BEGIN TUTORIAL


Path 2: Voice Command
    │
    └─► User says: "Tutorial"
        └─► IntentResolver.resolve()
            └─ detect intent: "tutorial"
               └─► CommandProcessor.processCommand()
                   └─► TutorialManager.replayTutorial()


Path 3: Manual Button Click
    │
    └─► User clicks Tutorial Button in popup
        └─► btnTutorial.addEventListener('click')
            └─► TutorialManager.replayTutorial()


    ▼▼▼ EXECUTION ▼▼▼

TutorialManager.startTutorial(isFirstTime)
    │
    ├─ this.isRunning = true
    │
    ├─ setupSkipListener()
    │  ├─ chrome.runtime.onMessage listener
    │  │  └─ detect "skip tutorial" in transcripts
    │  └─ document.addEventListener('keydown')
    │     └─ detect Escape key
    │
    └─ playTutorialSequence()
       │
       └─ FOR each of 11 tutorial sections:
          │
          ├─ speakTutorialSection(text)
          │  │
          │  ├─ speechService.pauseForTTS()
          │  │  └─ stop recognition during TTS
          │  │
          │  ├─ ttsService.speaker.speak(text)
          │  │  └─ wait for TTS to complete
          │  │
          │  └─ speechService.resumeAfterTTS()
          │     └─ restart recognition after TTS
          │
          └─ CHECK: if skipRequested?
             ├─ YES ──► Break loop
             └─ NO  ──► Continue to next section


SKIP DETECTION

Voice Path:
    │
    └─► User says: "skip tutorial"
        └─► Speech Recognition processes
            └─► popup.js broadcasts transcript
                └─► TutorialManager.skipListener
                    └─► Compare with ["skip tutorial", "skip", "stop tutorial", etc]
                        └─► IF match: skipRequested = true


Keyboard Path:
    │
    └─► User presses: Escape
        └─► document.keydown event
            └─► TutorialManager.keyboardListener
                └─► IF key === 'Escape': skipRequested = true


Both paths break the tutorial loop immediately


COMPLETION

IF tutorial completed (not skipped):
    │
    ├─ cleanupSkipListener()
    │  ├─ Remove runtime message listener
    │  └─ Remove keyboard listener
    │
    ├─ markTutorialComplete()
    │  └─ chrome.storage.local.set({
    │       tutorialCompleted: true,
    │       tutorialPending: false,
    │       tutorialCompletedAt: Date.now()
    │     })
    │
    └─ RETURN { success: true, skipped: false }


IF tutorial skipped:
    │
    ├─ cleanupSkipListener()
    │
    ├─ DON'T mark as complete (storage unchanged)
    │
    └─ RETURN { success: true, skipped: true }


RESULT HANDLING

In popup.js:
    │
    ├─ IF result.success && result.skipped:
    │  └─ uiManager.showCommandResult('✓ Tutorial skipped', false)
    │
    └─ IF result.success && !result.skipped:
       └─ uiManager.showCommandResult('✓ Tutorial completed', false)
```

## State Machine: Tutorial

```
                    ┌──────────────┐
                    │    IDLE      │
                    └───────┬──────┘
                            │
                (User action or stored state)
                            │
                    ┌───────▼──────┐
                    │  SET PENDING │ (On first install)
                    └───────┬──────┘
                            │
                 (First-time user starts STT)
                            │
                    ┌───────▼──────────┐
                    │ SETUP LISTENERS  │
                    │ (voice + keyboard)
                    └───────┬──────────┘
                            │
                    ┌───────▼──────┐
                    │  PLAYING     │
                    │   (Loop)     │
                    └───────┬──────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
      ┌─────────┐     ┌─────────┐     ┌──────────┐
      │NEXT     │     │SKIP     │     │COMPLETE  │
      │SECTION  │     │DETECTED │     │LOOP      │
      └────┬────┘     └────┬────┘     └────┬─────┘
           │               │              │
        (Loop)        (Break)      (All sections done)
           │               │              │
           └───────┬───────┴──────┬───────┘
                   │              │
           ┌───────▼──────┐   ┌───▼───────┐
           │ CLEANUP      │   │ CLEANUP   │
           │ (Keep state) │   │ (Completed)
           └───────┬──────┘   └───┬───────┘
                   │              │
                   └──────┬───────┘
                          │
                   ┌──────▼──────┐
                   │   RETURN    │
                   │  RESULT     │
                   └─────────────┘
```

## State Machine: Extension Toggle

```
                ┌──────────────┐
                │   DEFAULT    │
                │  (ON/Enabled)│
                └───────┬──────┘
                        │
            (Persistent state on load)
                        │
         ┌──────────────┴──────────────┐
         │                             │
    ┌────▼─────┐                 ┌────▼─────┐
    │   ON      │                 │   OFF     │
    │(Enabled)  │                 │(Disabled) │
    └────┬─────┘                 └────┬─────┘
         │                            │
  (Click / Alt+Shift+A)       (Click / Alt+Shift+A)
         │                            │
    ┌────▼────────┐            ┌─────▼────────┐
    │ TOGGLING... │            │ TOGGLING...  │
    │ • Speak ON  │            │ • Speak OFF  │
    │ • Icon ►    │            │ • Icon ►     │
    │ • Start STT │            │ • Stop STT   │
    │ • Update UI │            │ • Cancel TTS │
    └────┬────────┘            └─────┬────────┘
         │                           │
    ┌────▼─────┐                ┌────▼─────┐
    │   ON      │◄─────────────►│   OFF     │
    │(Enabled)  │                │(Disabled) │
    └──────────┘                └──────────┘
         ▲                           ▲
         │                           │
     (persisted)                 (persisted)
```

## Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│          CHROME EXTENSION MESSAGE SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  popup.js                background.js                      │
│      │                        │                             │
│      │  ┌──────────────────┐  │                             │
│      │──│ TOGGLE_STATE_    │──│   ┌─────────────────────┐  │
│      │  │ CHANGED          │  │───│ Handle state change │  │
│      │  └──────────────────┘  │   │ Update storage      │  │
│      │                        │   │ Update icon         │  │
│      │                        │   └─────────────────────┘  │
│      │                        │                             │
│      │  ┌──────────────────┐  │                             │
│      │──│ UPDATE_TOGGLE_   │──│   ┌─────────────────────┐  │
│      │  │ ICON             │  │───│ Update badge        │  │
│      │  └──────────────────┘  │   │ Update tooltip      │  │
│      │                        │   │ Update color        │  │
│      │                        │   └─────────────────────┘  │
│      │                        │                             │
│      │  ┌──────────────────┐  │                             │
│      │──│ SPEECH_RESULT    │──│   ┌─────────────────────┐  │
│      │  │ (transcript)     │  │───│ Check for           │  │
│      │  └──────────────────┘  │   │ "skip tutorial"     │  │
│      │                        │   │ Process intent      │  │
│      │                        │   └─────────────────────┘  │
│      │                        │                             │
│  (content.js, STT running)    │                             │
│      │                        │                             │
│      └────────────────────────┘                             │
│                                                              │
│  Local Storage Sync:                                        │
│      │                                                      │
│      ├─ extensionEnabled (toggle state)                    │
│      ├─ tutorialPending (first-time flag)                 │
│      ├─ tutorialCompleted (completion flag)               │
│      └─ tutorialCompletedAt (timestamp)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Tutorial Sequence Diagram

```
Timeline: ~55 seconds

User ──[Click Mic]────► popup.js ──[STT Start]──────► content.js
                           │
                      Check tutorialPending
                           │
                      IF pending:
                           │
                    ┌─[Auto-Start]─────────────────────┐
                    │                                   │
                    ▼                                   │
            TutorialManager                             │
                    │                                   │
            ┌─Setup Skip Listeners                   │
            │  ├─ voice.onMessage                     │
            │  └─ keyboard.onKeydown                  │
            │                                          │
            ▼                                          │
       SECTION 1: Welcome (3s)                         │
            │                                          │
        ┌──► Pause STT                                 │
        │    ▼                                         │
        │  speaker.speak("Welcome...")                │
        │    ▼                                         │
        │  Resume STT                                 │
        │    ├─ Listening for "skip"                  │
        │    │                                         │
        │    └─ No skip?                              │
        │                                             │
        ▼                                             │
   SECTION 2-11                                       │
   [Repeat pattern for each section]                 │
        │                                             │
        ├─ [User says "skip tutorial"]               │
        │  ▼                                          │
        │  skipRequested = true                      │
        │  │                                          │
        │  └─► Break loop                            │
        │      Return { skipped: true }              │
        │                                             │
        └─ [All sections complete]                    │
           ▼                                          │
           Cleanup listeners                          │
           Mark complete                              │
           Return { skipped: false }                  │
                    ▼                                 │
                popup.js                              │
                    │                                 │
                ┌───┴────────────┬──────────────┐     │
                │                │              │     │
           Skipped?          Tutorial?        Complete│
           Show result       Show result      Show    │
                             Update UI       result  │
```

## File Dependency Graph

```
┌──────────────────────────────────────────────────┐
│           manifest.json                          │
│  • Registers toggle-extension command            │
│  • Defines background service worker             │
│  • Defines popup                                 │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌─────────┐ ┌──────────┐ ┌──────────┐
│background│ │popup.html│ │popup.js  │
│ .js      │ └──────────┘ └────┬─────┘
└────┬─────┘                    │
     │                      Imports:
     │                      ├─ services/stt/src/
     │                      │  └─ intentResolver.js
     │                      │
     │                      ├─ services/tts/src/
     │                      │  └─ index.js (TTS service)
     │                      │
     │                      ├─ services/tts2/
     │                      │  ├─ speaker.js
     │                      │  ├─ index.js
     │                      │  └─ tutorial.js ◄──── NEW
     │                      │
     │                      ├─ services/webllm/src/
     │                      │  └─ index.js
     │                      │
     │                      └─ content.js (indirect)
     │
     └─ Uses:
        ├─ chrome.storage.local
        ├─ chrome.action
        ├─ chrome.commands
        ├─ chrome.runtime
        └─ chrome.tabs

services/tts2/tutorial.js
├─ TutorialManager
│  └─ Uses: ttsService, speechService
│     ├─ speaker.speak()
│     ├─ speechService.pauseForTTS()
│     └─ speechService.resumeAfterTTS()
│
├─ ExtensionToggleControl
│  └─ Uses: ttsService
│     └─ speaker.speak()
│
└─ Module exports (for Node.js testing)
```

---

This technical architecture document provides a complete visual understanding of how the toggle control and tutorial system integrate with the Hoda extension.
