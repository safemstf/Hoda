/**
 * Wake Word Detector for Hoda Voice Extension
 * Detects "Hoda" or "Hey Hoda" to activate command mode
 * Also supports direct commands without wake word
 */

export class WakeWordDetector {
  constructor(options = {}) {
    this.options = {
      wakeWords: options.wakeWords || ['hoda', 'hey hoda'],
      commandTimeout: options.commandTimeout || 5000, // 5 seconds
      requireWakeWord: options.requireWakeWord !== undefined ? options.requireWakeWord : false,
      caseSensitive: options.caseSensitive || false
    };

    this.state = {
      isAwake: false,
      lastWakeTime: null,
      awakeTimer: null
    };

    this.callbacks = {
      onWake: [],
      onSleep: [],
      onCommand: []
    };

    console.log('[WakeWord] Initialized with options:', this.options);
  }

  /**
   * Process transcript to detect wake word and commands
   * @param {string} text - Transcript text
   * @returns {Object} Result with command or wake status
   */
  process(text) {
    const cleanText = this.options.caseSensitive ? text.trim() : text.toLowerCase().trim();

    // Check if wake word is present
    const hasWakeWord = this.detectWakeWord(cleanText);

    if (hasWakeWord) {
      // Wake word detected!
      const command = this.extractCommand(cleanText);
      
      this.wake();

      if (command) {
        // "Hoda scroll down" - immediate command
        console.log('[WakeWord] Wake + command:', command);
        this.notifyCommand(command, text);
        return {
          type: 'wake_and_command',
          isWake: true,
          command: command,
          original: text
        };
      } else {
        // Just "Hoda" or "Hey Hoda" - waiting for command
        console.log('[WakeWord] Wake word only, listening for command...');
        return {
          type: 'wake',
          isWake: true,
          command: null,
          original: text
        };
      }
    } else if (this.state.isAwake) {
      // Already awake, process as command
      console.log('[WakeWord] Processing command (already awake):', cleanText);
      this.notifyCommand(cleanText, text);
      this.sleep(); // Reset after command
      return {
        type: 'command',
        isWake: false,
        command: cleanText,
        original: text
      };
    } else if (!this.options.requireWakeWord) {
      // Wake word not required, process directly as command
      console.log('[WakeWord] Direct command (no wake word needed):', cleanText);
      this.notifyCommand(cleanText, text);
      return {
        type: 'direct_command',
        isWake: false,
        command: cleanText,
        original: text
      };
    } else {
      // Wake word required but not detected
      console.log('[WakeWord] Ignoring - wake word required but not detected');
      return {
        type: 'ignored',
        isWake: false,
        command: null,
        original: text,
        reason: 'wake_word_required'
      };
    }
  }

  /**
   * Detect if wake word is present in text
   * @param {string} text - Text to check
   * @returns {boolean}
   */
  detectWakeWord(text) {
    for (const wakeWord of this.options.wakeWords) {
      const searchWord = this.options.caseSensitive ? wakeWord : wakeWord.toLowerCase();
      
      // Check exact match or as first word(s)
      if (text === searchWord || text.startsWith(searchWord + ' ')) {
        return true;
      }

      // Also check if wake word appears anywhere in text (more flexible)
      const regex = new RegExp('\\b' + this.escapeRegex(searchWord) + '\\b', 'i');
      if (regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract command after wake word
   * @param {string} text - Full text with wake word
   * @returns {string|null} Command text or null
   */
  extractCommand(text) {
    for (const wakeWord of this.options.wakeWords) {
      const searchWord = this.options.caseSensitive ? wakeWord : wakeWord.toLowerCase();
      
      // Remove wake word and get remaining text
      let command = text;
      
      if (text.startsWith(searchWord + ' ')) {
        command = text.substring(searchWord.length + 1).trim();
      } else if (text === searchWord) {
        return null; // Just the wake word, no command
      } else {
        // Try removing from anywhere in text
        const regex = new RegExp('\\b' + this.escapeRegex(searchWord) + '\\b\\s*', 'i');
        command = text.replace(regex, '').trim();
      }

      if (command && command !== text) {
        return command;
      }
    }

    return null;
  }

  /**
   * Activate wake mode (listening for command)
   */
  wake() {
    if (this.state.isAwake) {
      // Already awake, just reset timer
      this.resetTimer();
      return;
    }

    console.log('[WakeWord] Waking up - listening for command...');
    this.state.isAwake = true;
    this.state.lastWakeTime = Date.now();

    // Set timeout to go back to sleep
    this.resetTimer();

    // Notify listeners
    this.notifyWake();
  }

  /**
   * Deactivate wake mode
   */
  sleep() {
    if (!this.state.isAwake) {
      return;
    }

    console.log('[WakeWord] Going to sleep...');
    this.state.isAwake = false;
    this.state.lastWakeTime = null;

    this.clearTimer();

    // Notify listeners
    this.notifySleep();
  }

  /**
   * Reset wake timer
   */
  resetTimer() {
    this.clearTimer();

    this.state.awakeTimer = setTimeout(() => {
      console.log('[WakeWord] Timeout - going to sleep');
      this.sleep();
    }, this.options.commandTimeout);
  }

  /**
   * Clear wake timer
   */
  clearTimer() {
    if (this.state.awakeTimer) {
      clearTimeout(this.state.awakeTimer);
      this.state.awakeTimer = null;
    }
  }

  /**
   * Check if currently in wake mode
   * @returns {boolean}
   */
  isAwake() {
    return this.state.isAwake;
  }

  /**
   * Get time remaining until sleep (ms)
   * @returns {number|null}
   */
  getTimeRemaining() {
    if (!this.state.isAwake || !this.state.lastWakeTime) {
      return null;
    }

    const elapsed = Date.now() - this.state.lastWakeTime;
    const remaining = this.options.commandTimeout - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Update options
   * @param {Object} newOptions
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    console.log('[WakeWord] Options updated:', this.options);
  }

  /**
   * Enable/disable wake word requirement
   * @param {boolean} required
   */
  setWakeWordRequired(required) {
    this.options.requireWakeWord = required;
    if (!required && this.state.isAwake) {
      this.sleep();
    }
    console.log('[WakeWord] Wake word required:', required);
  }

  /**
   * Register callbacks
   */
  onWake(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onWake.push(callback);
    }
  }

  onSleep(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onSleep.push(callback);
    }
  }

  onCommand(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onCommand.push(callback);
    }
  }

  /**
   * Notify listeners
   */
  notifyWake() {
    this.callbacks.onWake.forEach(cb => {
      try {
        cb({ timestamp: Date.now() });
      } catch (e) {
        console.error('[WakeWord] Error in wake callback:', e);
      }
    });
  }

  notifySleep() {
    this.callbacks.onSleep.forEach(cb => {
      try {
        cb({ timestamp: Date.now() });
      } catch (e) {
        console.error('[WakeWord] Error in sleep callback:', e);
      }
    });
  }

  notifyCommand(command, original) {
    this.callbacks.onCommand.forEach(cb => {
      try {
        cb({ command, original, timestamp: Date.now() });
      } catch (e) {
        console.error('[WakeWord] Error in command callback:', e);
      }
    });
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Test wake word detection
   */
  test() {
    console.log('[WakeWord] Testing wake word detection...');
    
    const testCases = [
      'hoda scroll down',
      'hey hoda read this page',
      'hoda',
      'scroll down',
      'can you scroll down please hoda'
    ];

    testCases.forEach(text => {
      console.log(`\nTest: "${text}"`);
      const result = this.process(text);
      console.log('Result:', result);
    });
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isAwake: this.state.isAwake,
      lastWakeTime: this.state.lastWakeTime,
      timeRemaining: this.getTimeRemaining(),
      requireWakeWord: this.options.requireWakeWord
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clearTimer();
    this.state.isAwake = false;
    this.callbacks = {
      onWake: [],
      onSleep: [],
      onCommand: []
    };
    console.log('[WakeWord] Destroyed');
  }
}

// Export convenience function
export function createWakeWordDetector(options) {
  return new WakeWordDetector(options);
}

export default WakeWordDetector;