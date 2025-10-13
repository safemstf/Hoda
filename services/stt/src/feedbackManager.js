/**
 * Feedback Manager for Hoda Voice Extension
 * Provides audio and visual feedback for recognized commands
 * Supports both beeps and spoken confirmations
 */

export class FeedbackManager {
  constructor(options = {}) {
    this.options = {
      enableAudio: options.enableAudio !== false,
      enableVisual: options.enableVisual !== false,
      enableSpoken: options.enableSpoken || false, // Off by default
      feedbackVolume: options.feedbackVolume || 0.3,
      feedbackDuration: options.feedbackDuration || 2000
    };

    // Audio context for beeps
    this.audioContext = null;
    this.initAudioContext();

    // Speech synthesis for spoken feedback
    this.speechSynth = window.speechSynthesis;
    this.voice = null;
    this.initSpeechSynthesis();
  }

  /**
   * Initialize Web Audio API for beeps
   */
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[Feedback] Audio context initialized');
    } catch (err) {
      console.warn('[Feedback] Could not initialize audio context:', err);
    }
  }

  /**
   * Initialize Speech Synthesis
   */
  initSpeechSynthesis() {
    if (!this.speechSynth) {
      console.warn('[Feedback] Speech synthesis not available');
      return;
    }

    // Wait for voices to load
    if (this.speechSynth.getVoices().length === 0) {
      this.speechSynth.addEventListener('voiceschanged', () => {
        this.selectVoice();
      });
    } else {
      this.selectVoice();
    }
  }

  /**
   * Select a good voice for feedback (prefer natural/compact voices)
   */
  selectVoice() {
    const voices = this.speechSynth.getVoices();
    
    // Prefer these voices in order
    const preferredVoices = [
      'Google US English',
      'Microsoft David',
      'Microsoft Zira',
      'Alex',
      'Samantha'
    ];

    for (const preferred of preferredVoices) {
      const voice = voices.find(v => v.name.includes(preferred));
      if (voice) {
        this.voice = voice;
        console.log('[Feedback] Selected voice:', voice.name);
        return;
      }
    }

    // Fallback to first English voice
    this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    console.log('[Feedback] Using fallback voice:', this.voice?.name);
  }

  /**
   * Provide feedback for a recognized command
   * @param {Object} command - Normalized command object
   * @param {Object} options - Override options
   */
  confirmCommand(command, options = {}) {
    const opts = { ...this.options, ...options };

    // Visual feedback
    if (opts.enableVisual) {
      this.showVisualFeedback(command);
    }

    // Audio feedback
    if (opts.enableAudio) {
      if (opts.enableSpoken) {
        this.speakConfirmation(command);
      } else {
        this.playBeep('success');
      }
    }
  }

  /**
   * Provide error feedback
   * @param {string} message - Error message
   * @param {Object} options - Override options
   */
  showError(message, options = {}) {
    const opts = { ...this.options, ...options };

    if (opts.enableVisual) {
      this.showVisualError(message);
    }

    if (opts.enableAudio) {
      this.playBeep('error');
    }
  }

  /**
   * Play a beep sound
   * @param {string} type - 'success', 'error', or 'notification'
   */
  playBeep(type = 'success') {
    if (!this.audioContext) {
      console.warn('[Feedback] Audio context not available');
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Configure based on type
      switch (type) {
        case 'success':
          oscillator.frequency.value = 800; // High C
          gainNode.gain.value = this.options.feedbackVolume;
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + 0.1);
          break;

        case 'error':
          oscillator.frequency.value = 200; // Low note
          oscillator.type = 'sawtooth';
          gainNode.gain.value = this.options.feedbackVolume;
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + 0.15);
          break;

        case 'notification':
          oscillator.frequency.value = 600;
          gainNode.gain.value = this.options.feedbackVolume * 0.7;
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + 0.08);
          break;
      }

      console.log('[Feedback] Played beep:', type);
    } catch (err) {
      console.error('[Feedback] Error playing beep:', err);
    }
  }

  /**
   * Speak a confirmation message
   * @param {Object} command - Normalized command
   */
  speakConfirmation(command) {
    if (!this.speechSynth || this.speechSynth.speaking) {
      console.log('[Feedback] Cannot speak - already speaking or unavailable');
      return;
    }

    // Generate short confirmation (< 3 words)
    const message = this.getConfirmationMessage(command);

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.voice = this.voice;
    utterance.rate = 1.2; // Slightly faster
    utterance.volume = this.options.feedbackVolume;
    utterance.pitch = 1.0;

    console.log('[Feedback] Speaking:', message);
    this.speechSynth.speak(utterance);
  }

  /**
   * Generate a short confirmation message (< 3 words)
   * @param {Object} command - Normalized command
   * @returns {string} Confirmation message
   */
  getConfirmationMessage(command) {
    const intent = command.intent || command.normalized?.intent;
    const slots = command.slots || command.normalized?.slots || {};

    switch (intent) {
      case 'navigate':
        if (slots.direction === 'down') return 'Scrolling down';
        if (slots.direction === 'up') return 'Scrolling up';
        if (slots.target === 'top') return 'Going top';
        if (slots.target === 'bottom') return 'Going bottom';
        return 'Navigating';

      case 'read':
        if (slots.action === 'stop') return 'Stopping';
        if (slots.action === 'pause') return 'Pausing';
        if (slots.action === 'resume') return 'Resuming';
        return 'Reading';

      case 'zoom':
        if (slots.action === 'in') return 'Zooming in';
        if (slots.action === 'out') return 'Zooming out';
        if (slots.action === 'reset') return 'Resetting zoom';
        return 'Zooming';

      case 'link_action':
        if (slots.action === 'list') return 'Listing links';
        if (slots.linkNumber) return `Opening link ${slots.linkNumber}`;
        return 'Opening link';

      case 'find_content':
        return 'Searching';

      case 'help':
        return 'Showing help';

      default:
        return 'OK';
    }
  }

  /**
   * Show visual feedback overlay
   * @param {Object} command - Command object
   */
  showVisualFeedback(command) {
    const message = this.getVisualMessage(command);
    this.showOverlay(message, 'success');
  }

  /**
   * Show visual error
   * @param {string} message - Error message
   */
  showVisualError(message) {
    this.showOverlay(message, 'error');
  }

  /**
   * Get visual message for command
   * @param {Object} command - Command object
   * @returns {string}
   */
  getVisualMessage(command) {
    const original = command.original || command.raw?.text || '';
    const intent = command.intent || command.normalized?.intent || 'unknown';
    
    if (intent === 'unknown') {
      return `❓ "${original}"`;
    }

    return `✓ "${original}"`;
  }

  /**
   * Show overlay on page
   * @param {string} message - Message to show
   * @param {string} type - 'success' or 'error'
   */
  showOverlay(message, type = 'success') {
    let overlay = document.getElementById('hoda-feedback-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hoda-feedback-overlay';
      document.body.appendChild(overlay);
    }

    // Set styles
    const backgroundColor = type === 'error' 
      ? 'rgba(244, 67, 54, 0.95)' 
      : 'rgba(76, 175, 80, 0.95)';

    Object.assign(overlay.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      backgroundColor: backgroundColor,
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      opacity: '0',
      transform: 'translateY(-10px)',
      transition: 'opacity 0.3s, transform 0.3s',
      maxWidth: '400px',
      pointerEvents: 'none'
    });

    overlay.textContent = message;

    // Animate in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      overlay.style.transform = 'translateY(0)';
    });

    // Remove after duration
    clearTimeout(overlay._hideTimer);
    overlay._hideTimer = setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }, this.options.feedbackDuration);
  }

  /**
   * Play a double beep for listening start
   */
  playListeningStart() {
    this.playBeep('notification');
    setTimeout(() => {
      this.playBeep('notification');
    }, 100);
  }

  /**
   * Play a single beep for listening stop
   */
  playListeningStop() {
    this.playBeep('notification');
  }

  /**
   * Update options
   * @param {Object} newOptions
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    console.log('[Feedback] Options updated:', this.options);
  }

  /**
   * Enable/disable features
   */
  setAudioEnabled(enabled) {
    this.options.enableAudio = enabled;
  }

  setVisualEnabled(enabled) {
    this.options.enableVisual = enabled;
  }

  setSpokenEnabled(enabled) {
    this.options.enableSpoken = enabled;
  }

  /**
   * Test feedback system
   */
  test() {
    console.log('[Feedback] Testing feedback system...');
    
    // Test beeps
    console.log('[Feedback] Playing success beep...');
    this.playBeep('success');
    
    setTimeout(() => {
      console.log('[Feedback] Playing error beep...');
      this.playBeep('error');
    }, 500);

    setTimeout(() => {
      console.log('[Feedback] Testing visual feedback...');
      this.showVisualFeedback({
        original: 'scroll down',
        intent: 'navigate'
      });
    }, 1000);

    setTimeout(() => {
      if (this.options.enableSpoken) {
        console.log('[Feedback] Testing spoken confirmation...');
        this.speakConfirmation({
          intent: 'navigate',
          slots: { direction: 'down' }
        });
      }
    }, 2000);

    console.log('[Feedback] Test sequence started');
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.error('[Feedback] Error closing audio context:', e);
      }
    }

    if (this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
    }

    const overlay = document.getElementById('hoda-feedback-overlay');
    if (overlay) {
      overlay.remove();
    }

    console.log('[Feedback] Destroyed');
  }
}

// Export convenience function
export function createFeedbackManager(options) {
  return new FeedbackManager(options);
}

export default FeedbackManager;