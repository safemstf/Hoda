/**
 * ============================================================================
 * TUTORIAL MANAGER - Spoken Onboarding Tutorial for Hoda Extension
 * Author: arkaan
 * ============================================================================
 * 
 * Features:
 * - 45-60 second interactive tutorial delivered via TTS
 * - Covers: Toggle on/off, 5 basic commands, help system
 * - Skippable by voice ("skip tutorial") or keyboard (Escape)
 * - Auto-starts for first-time users
 * - Tracks tutorial completion in storage
 */

class TutorialManager {
  constructor(options = {}) {
    this.ttsService = options.ttsService;
    this.speechService = options.speechService;
    
    // Tutorial state
    this.isRunning = false;
    this.isPaused = false;
    this.isSpeaking = false;
    this.skipRequested = false;
    
    // Skip detection
    this.skipListener = null;
    this.skipTimeout = null;
    
    // Tutorial content - 45-60 second script
    this.tutorialScript = [
      {
        duration: 3,
        text: "Welcome to Hoda voice assistant for navigating the web."
      },
      {
        duration: 4,
        text: "First, you can toggle me on and off by clicking the icon in your toolbar, or pressing Alt Shift A."
      },
      {
        duration: 5,
        text: "Let me show you five essential commands. Try saying: Scroll down."
      },
      {
        duration: 3,
        text: "You can also say: Scroll up to move back up the page."
      },
      {
        duration: 4,
        text: "To read the page out loud, say: Read page. To stop reading, say: Stop reading."
      },
      {
        duration: 4,
        text: "To see all links on the page, say: List links."
      },
      {
        duration: 3,
        text: "You can fill web forms by saying: Fill form, then answer questions with voice."
      },
      {
        duration: 4,
        text: "You can also zoom in by saying: Zoom in, and zoom out by saying: Zoom out."
      },
      {
        duration: 3,
        text: "Stuck? Just say: Help to get guidance on what you can do."
      },
      {
        duration: 2,
        text: "You can replay this tutorial anytime by saying: Tutorial."
      },
      {
        duration: 3,
        text: "That's it! I'm ready to help. Say skip tutorial to exit now, or I'll end automatically."
      }
    ];
    
    // Calculate total tutorial duration (in seconds)
    this.totalDuration = this.tutorialScript.reduce((sum, item) => sum + item.duration, 0);
    
    console.log('[TutorialManager] Initialized');
    console.log('[TutorialManager] Tutorial duration:', this.totalDuration, 'seconds');
  }

  /**
   * Start tutorial (called on first mic button click for first-time users)
   * Author: arkaan
   */
  async startTutorial(isFirstTime = false) {
    if (this.isRunning) {
      console.warn('[TutorialManager] Tutorial already running');
      return { success: false, error: 'Tutorial already running' };
    }

    console.log('[TutorialManager] Starting tutorial (isFirstTime:', isFirstTime, ')');
    
    this.isRunning = true;
    this.skipRequested = false;
    
    try {
      // Set up skip listener (listens for "skip tutorial" voice command)
      this.setupSkipListener();
      
      // Play tutorial
      const result = await this.playTutorialSequence();
      
      // Clean up skip listener
      this.cleanupSkipListener();
      
      // If tutorial completed (not skipped), mark as complete
      if (result.success && !result.skipped) {
        await this.markTutorialComplete();
      }
      
      this.isRunning = false;
      
      return result;
    } catch (error) {
      console.error('[TutorialManager] Tutorial error:', error);
      this.cleanupSkipListener();
      this.isRunning = false;
      return { success: false, error: error.message, skipped: false };
    }
  }

  /**
   * Replay tutorial (called when user says "tutorial")
   * Author: arkaan
   */
  async replayTutorial() {
    console.log('[TutorialManager] Replaying tutorial');
    return this.startTutorial(false);
  }

  /**
   * Play the full tutorial sequence
   * Author: arkaan
   */
  async playTutorialSequence() {
    console.log('[TutorialManager] Playing tutorial sequence (' + this.totalDuration + 's)');
    
    for (let i = 0; i < this.tutorialScript.length; i++) {
      const section = this.tutorialScript[i];
      
      // Check if skip was requested
      if (this.skipRequested) {
        console.log('[TutorialManager] Tutorial skipped at section', i);
        return { success: true, skipped: true };
      }
      
      try {
        // Speak the section via TTS
        console.log('[TutorialManager] Section', i + 1, '/', this.tutorialScript.length, '-', section.text);
        
        await this.speakTutorialSection(section.text);
        
        // Pause between sections for user to process
        await this.sleep(300);
        
      } catch (error) {
        console.error('[TutorialManager] Error speaking section:', error);
        // Continue with next section if one fails
      }
    }
    
    console.log('[TutorialManager] Tutorial completed successfully');
    return { success: true, skipped: false };
  }

  /**
   * Speak a tutorial section via TTS
   * Author: arkaan
   */
  async speakTutorialSection(text) {
    return new Promise((resolve, reject) => {
      if (!this.ttsService || !this.ttsService.speaker) {
        console.error('[TutorialManager] TTS service not available');
        reject(new Error('TTS service not available'));
        return;
      }
      
      try {
        // Pause speech recognition before TTS
        if (this.speechService) {
          this.speechService.pauseForTTS();
          console.log('[TutorialManager] Paused STT for TTS output');
        }
        
        this.isSpeaking = true;
        
        // Use speaker.speak() which is the main TTS interface
        this.ttsService.speaker.speak(text, {
          rate: 1.0,
          pitch: 1.0,
          volume: 0.9,
          onEnd: () => {
            this.isSpeaking = false;
            console.log('[TutorialManager] TTS section completed');
            
            // Resume speech recognition after TTS
            if (this.speechService) {
              this.speechService.resumeAfterTTS();
              console.log('[TutorialManager] Resumed STT after TTS');
            }
            
            resolve();
          },
          onError: (error) => {
            this.isSpeaking = false;
            console.error('[TutorialManager] TTS error:', error);
            
            // Resume speech recognition after TTS error
            if (this.speechService) {
              this.speechService.resumeAfterTTS();
              console.log('[TutorialManager] Resumed STT after TTS error');
            }
            
            reject(error);
          }
        });
        
      } catch (error) {
        this.isSpeaking = false;
        console.error('[TutorialManager] Failed to speak:', error);
        
        // Resume speech recognition on error
        if (this.speechService) {
          this.speechService.resumeAfterTTS();
        }
        
        reject(error);
      }
    });
  }

  /**
   * Set up listener for "skip tutorial" voice command
   * Author: arkaan
   */
  setupSkipListener() {
    if (this.skipListener) {
      console.warn('[TutorialManager] Skip listener already set up');
      return;
    }
    
    console.log('[TutorialManager] Setting up skip listener');
    
    // Listen for messages from popup containing transcript
    this.skipListener = (message, sender, sendResponse) => {
      if (message.type === 'SPEECH_RESULT' || message.type === 'TRANSCRIPT') {
        const transcript = (message.transcript || message.text || '').toLowerCase().trim();
        
        console.log('[TutorialManager] Checking transcript:', transcript);
        
        // Check for skip command variations
        const skipCommands = [
          'skip tutorial',
          'skip',
          'stop tutorial',
          'exit tutorial',
          'cancel tutorial',
          'quit tutorial'
        ];
        
        for (const cmd of skipCommands) {
          if (transcript.includes(cmd)) {
            console.log('[TutorialManager] Skip command detected:', cmd);
            this.skipRequested = true;
            break;
          }
        }
      }
    };
    
    // Add listener if we have runtime messaging
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(this.skipListener);
        console.log('[TutorialManager] Runtime message listener added');
      }
    } catch (error) {
      console.warn('[TutorialManager] Could not add runtime listener:', error);
    }
    
    // Also listen for keyboard input (Escape key)
    this.keyboardListener = (event) => {
      if (event.key === 'Escape' || event.code === 'Escape') {
        console.log('[TutorialManager] Escape key pressed, skipping tutorial');
        this.skipRequested = true;
      }
    };
    
    try {
      document.addEventListener('keydown', this.keyboardListener);
      console.log('[TutorialManager] Keyboard listener added');
    } catch (error) {
      console.warn('[TutorialManager] Could not add keyboard listener:', error);
    }
  }

  /**
   * Clean up skip listeners
   * Author: arkaan
   */
  cleanupSkipListener() {
    console.log('[TutorialManager] Cleaning up skip listeners');
    
    // Remove runtime message listener
    if (this.skipListener) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
          chrome.runtime.onMessage.removeListener(this.skipListener);
          console.log('[TutorialManager] Runtime message listener removed');
        }
      } catch (error) {
        console.warn('[TutorialManager] Could not remove runtime listener:', error);
      }
      this.skipListener = null;
    }
    
    // Remove keyboard listener
    if (this.keyboardListener) {
      try {
        document.removeEventListener('keydown', this.keyboardListener);
        console.log('[TutorialManager] Keyboard listener removed');
      } catch (error) {
        console.warn('[TutorialManager] Could not remove keyboard listener:', error);
      }
      this.keyboardListener = null;
    }
    
    // Clear any pending timeouts
    if (this.skipTimeout) {
      clearTimeout(this.skipTimeout);
      this.skipTimeout = null;
    }
  }

  /**
   * Mark tutorial as complete in storage
   * Author: arkaan
   */
  async markTutorialComplete() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ 
          tutorialCompleted: true,
          tutorialCompletedAt: Date.now(),
          tutorialPending: false
        });
        console.log('[TutorialManager] Marked tutorial as complete');
      }
    } catch (error) {
      console.error('[TutorialManager] Failed to mark tutorial complete:', error);
    }
  }

  /**
   * Check if tutorial has been completed
   * Author: arkaan
   */
  async isTutorialCompleted() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['tutorialCompleted']);
        return result.tutorialCompleted === true;
      }
    } catch (error) {
      console.error('[TutorialManager] Failed to check tutorial status:', error);
    }
    return false;
  }

  /**
   * Check if tutorial is pending for first-time user
   * Author: arkaan
   */
  async isTutorialPending() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['tutorialPending']);
        return result.tutorialPending === true;
      }
    } catch (error) {
      console.error('[TutorialManager] Failed to check tutorial pending:', error);
    }
    return false;
  }

  /**
   * Sleep utility
   * Author: arkaan
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get tutorial status
   * Author: arkaan
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isSpeaking: this.isSpeaking,
      skipRequested: this.skipRequested,
      totalDuration: this.totalDuration,
      sections: this.tutorialScript.length
    };
  }

  /**
   * Get tutorial script (for debugging/testing)
   * Author: arkaan
   */
  getScript() {
    return this.tutorialScript;
  }
}

// ============================================================================
// EXTENSION TOGGLE CONTROL - Browser action management
// Author: arkaan
// ============================================================================

/**
 * Extension Toggle Control
 * - Shows ON/OFF state with visual badge
 * - Keyboard shortcut: Alt+Shift+A
 * - Clicking icon toggles extension state
 * - TTS confirms state change
 */
class ExtensionToggleControl {
  constructor(options = {}) {
    this.ttsService = options.ttsService;
    this.enabled = true;
    this.initialized = false;
    
    console.log('[ExtensionToggleControl] Initialized');
  }

  /**
   * Initialize toggle control from storage
   * Author: arkaan
   */
  async initialize() {
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      this.enabled = result.extensionEnabled !== false;
      console.log('[ExtensionToggleControl] Loaded state:', this.enabled ? 'ON' : 'OFF');
      this.initialized = true;
      return this.enabled;
    } catch (error) {
      console.error('[ExtensionToggleControl] Failed to initialize:', error);
      return true;
    }
  }

  /**
   * Toggle extension on/off
   * Author: arkaan
   */
  async toggle() {
    try {
      this.enabled = !this.enabled;
      
      // Save state
      await chrome.storage.local.set({ extensionEnabled: this.enabled });
      
      console.log('[ExtensionToggleControl] Toggled to:', this.enabled ? 'ON' : 'OFF');
      
      // Provide TTS feedback if available
      if (this.ttsService && this.ttsService.speaker) {
        const message = this.enabled ? 'Assistant on' : 'Assistant off';
        try {
          await this.ttsService.speaker.speak(message, {
            rate: 1.0,
            pitch: 1.0,
            volume: 0.9
          });
        } catch (error) {
          console.warn('[ExtensionToggleControl] TTS feedback failed:', error);
        }
      }
      
      // Notify background script to update icon
      try {
        chrome.runtime.sendMessage({
          type: 'UPDATE_TOGGLE_ICON',
          enabled: this.enabled
        }).catch(e => {
          console.warn('[ExtensionToggleControl] Could not notify background:', e);
        });
      } catch (error) {
        console.warn('[ExtensionToggleControl] Message error:', error);
      }
      
      return this.enabled;
    } catch (error) {
      console.error('[ExtensionToggleControl] Toggle failed:', error);
      throw error;
    }
  }

  /**
   * Get current state
   * Author: arkaan
   */
  getState() {
    return this.enabled;
  }

  /**
   * Set state directly
   * Author: arkaan
   */
  async setState(enabled) {
    try {
      this.enabled = enabled;
      await chrome.storage.local.set({ extensionEnabled: this.enabled });
      
      console.log('[ExtensionToggleControl] State set to:', this.enabled ? 'ON' : 'OFF');
      
      return this.enabled;
    } catch (error) {
      console.error('[ExtensionToggleControl] Failed to set state:', error);
      throw error;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// For Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TutorialManager,
    ExtensionToggleControl
  };
}

// For Browser / ES6
if (typeof window !== 'undefined') {
  window.TutorialManager = TutorialManager;
  window.ExtensionToggleControl = ExtensionToggleControl;
}
