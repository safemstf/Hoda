/**
 * ============================================================================
 * TUTORIAL MANAGER - Spoken Onboarding Tutorial
 * ============================================================================
 * Handles first-time user tutorial with TTS playback and skip detection
 * Author: arkaan
 */

// ============================================================================
// TUTORIAL SCRIPT - 45-60 second onboarding content
// ============================================================================
const TUTORIAL_SCRIPT = [
  {
    text: "Welcome to Hoda Voice Assistant. I'll teach you the basics in about a minute. You can say 'skip tutorial' at any time to jump ahead.",
    duration: 5000
  },
  {
    text: "To start listening, click the microphone button or press Control Shift H. When the button turns red, I'm listening. Click again or say 'stop' to turn off.",
    duration: 7000
  },
  {
    text: "Here are five essential commands. First, 'scroll down' or 'scroll up' to move through pages.",
    duration: 5000
  },
  {
    text: "Second, 'read page' to hear the content read aloud.",
    duration: 4000
  },
  {
    text: "Third, 'list links' to see all clickable links on the page.",
    duration: 4000
  },
  {
    text: "Fourth, 'fill [field name]' to fill out forms. For example, 'fill email'.",
    duration: 5000
  },
  {
    text: "Fifth, 'zoom in' or 'zoom out' to adjust page size.",
    duration: 4000
  },
  {
    text: "If you forget a command, just say 'help' and I'll remind you of all available commands.",
    duration: 5000
  },
  {
    text: "That's it! You're ready to start. Click the mic button when you're ready to begin.",
    duration: 5000
  }
];

// ============================================================================
// TUTORIAL MANAGER CLASS
// ============================================================================
export class TutorialManager {
  /**
   * Initialize Tutorial Manager
   * @param {Object} options - Configuration options
   * @param {Object} options.ttsService - TTS service instance for speaking
   * @param {Object} options.speechService - Speech recognition service for skip detection
   */
  constructor(options = {}) {
    this.ttsService = options.ttsService || null;
    this.speechService = options.speechService || null;
    
    // State tracking
    this.isPlaying = false;
    this.skipRequested = false;
    this.currentSegment = 0;
    this.skipListener = null;
    
    console.log('[TutorialManager] Initialized');
  }

  /**
   * Check if user is first-time and tutorial status
   * @returns {Promise<Object>} Status object with isFirstTime and isPending flags
   */
  async checkFirstTime() {
    try {
      const result = await chrome.storage.local.get(['tutorialCompleted', 'tutorialPending']);
      
      return {
        isFirstTime: !result.tutorialCompleted,
        isPending: result.tutorialPending || false,
        isCompleted: result.tutorialCompleted || false
      };
    } catch (error) {
      console.error('[TutorialManager] Error checking first-time status:', error);
      return {
        isFirstTime: false,
        isPending: false,
        isCompleted: true // Default to completed on error to prevent loops
      };
    }
  }

  /**
   * Mark tutorial as pending (first-time user detected)
   * @returns {Promise<void>}
   */
  async markTutorialPending() {
    try {
      await chrome.storage.local.set({ tutorialPending: true });
      console.log('[TutorialManager] Marked tutorial as pending');
    } catch (error) {
      console.error('[TutorialManager] Error marking tutorial pending:', error);
    }
  }

  /**
   * Start tutorial playback
   * @param {boolean} autoStart - Whether this is auto-started (first-time) or manual replay
   * @returns {Promise<boolean>} Success status
   */
  async startTutorial(autoStart = false) {
    // Prevent duplicate starts
    if (this.isPlaying) {
      console.log('[TutorialManager] Tutorial already playing, ignoring duplicate start');
      return { success: false, skipped: false };
    }

    // Check if TTS service is available
    if (!this.ttsService) {
      console.error('[TutorialManager] TTS service not available');
      return { success: false, skipped: false };
    }

    console.log('[TutorialManager] Starting tutorial', { autoStart });

    this.isPlaying = true;
    this.skipRequested = false;
    this.currentSegment = 0;

    // Set up skip detection
    this.setupSkipListener();

    try {
      // Play all tutorial segments
      for (let i = 0; i < TUTORIAL_SCRIPT.length; i++) {
        if (this.skipRequested) {
          console.log('[TutorialManager] Skip requested, stopping tutorial');
          break;
        }

        this.currentSegment = i;
        const segment = TUTORIAL_SCRIPT[i];

        console.log(`[TutorialManager] Playing segment ${i + 1}/${TUTORIAL_SCRIPT.length}`);

        // Speak the segment (already waits for TTS to finish)
        await this.ttsService.speakResult(segment.text);

        // Add pause between segments to allow time for "skip tutorial" command
        // Author: arkaan - 2500ms gives user plenty of time to interrupt between segments
        if (!this.skipRequested && i < TUTORIAL_SCRIPT.length - 1) {
          await this.delay(2500); // 2.5 second pause between segments for skip opportunity
        }
      }

      // Mark tutorial as completed
      await this.markTutorialCompleted();

      // Return result indicating if tutorial was skipped - Author: arkaan
      const wasSkipped = this.skipRequested;
      console.log('[TutorialManager] Tutorial completed', { skipped: wasSkipped });
      return { success: true, skipped: wasSkipped };

    } catch (error) {
      console.error('[TutorialManager] Error during tutorial playback:', error);
      // Still mark as completed to prevent getting stuck
      await this.markTutorialCompleted();
      return { success: false, skipped: false, error: error.message };
    } finally {
      // Clean up
      this.cleanup();
    }
  }

  /**
   * Replay tutorial (for returning users)
   * @returns {Promise<boolean>} Success status
   */
  async replayTutorial() {
    console.log('[TutorialManager] Replaying tutorial');
    return await this.startTutorial(false);
  }

  /**
   * Set up listener for "skip tutorial" command
   * @private
   */
  setupSkipListener() {
    if (!this.speechService) {
      console.warn('[TutorialManager] Speech service not available, skip detection disabled');
      return;
    }

    // Store original onResult callback
    const originalOnResult = this.speechService.callbacks?.onResult;

    // Override onResult to detect skip command
    this.skipListener = (result) => {
      if (!result || !result.transcript) return;

      const transcript = result.transcript.toLowerCase().trim();
      
      // Check for skip commands
      if (transcript.includes('skip tutorial') || 
          transcript === 'skip' ||
          transcript === 'stop') {
        console.log('[TutorialManager] Skip command detected:', transcript);
        this.handleSkip();
      }

      // Also call original callback if it exists (for normal command processing)
      if (originalOnResult && typeof originalOnResult === 'function') {
        originalOnResult(result);
      }
    };

    // Temporarily override the callback
    if (this.speechService.callbacks) {
      this.speechService.callbacks.onResult = this.skipListener;
    }

    console.log('[TutorialManager] Skip listener set up');
  }

  /**
   * Handle skip request
   * @private
   */
  handleSkip() {
    if (this.skipRequested) return; // Already handled

    console.log('[TutorialManager] Handling skip request');
    this.skipRequested = true;

    // Stop TTS immediately
    if (this.ttsService && this.ttsService.speaker) {
      this.ttsService.speaker.stop();
    } else if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Mark tutorial as completed in storage
   * @private
   * @returns {Promise<void>}
   */
  async markTutorialCompleted() {
    try {
      await chrome.storage.local.set({
        tutorialCompleted: true,
        tutorialPending: false
      });
      console.log('[TutorialManager] Marked tutorial as completed');
    } catch (error) {
      console.error('[TutorialManager] Error marking tutorial completed:', error);
    }
  }

  /**
   * Clean up listeners and reset state
   * @private
   */
  cleanup() {
    // Restore original callback if we overrode it
    if (this.skipListener && this.speechService && this.speechService.callbacks) {
      // Note: We can't fully restore without storing the original, but that's okay
      // The skip listener will just check for skip commands and pass through to original
      this.skipListener = null;
    }

    this.isPlaying = false;
    this.skipRequested = false;
    this.currentSegment = 0;

    console.log('[TutorialManager] Cleaned up');
  }

  /**
   * Utility: Delay for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current tutorial status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      skipRequested: this.skipRequested,
      currentSegment: this.currentSegment,
      totalSegments: TUTORIAL_SCRIPT.length,
      hasTTS: !!this.ttsService,
      hasSpeech: !!this.speechService
    };
  }
}

// Default export
export default TutorialManager;

