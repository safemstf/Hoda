// services/tts/confirmations.js - Command confirmations
/**
 * Confirmations - Speaks command confirmations and feedback
 */
export class Confirmations {
  constructor(speaker) {
    this.speaker = speaker;
    
    // Confirmation templates
    this.templates = {
      // Navigation
      navigate: {
        up: 'Scrolling up',
        down: 'Scrolling down',
        top: 'Going to top',
        bottom: 'Going to bottom',
        back: 'Going back',
        forward: 'Going forward',
        reload: 'Reloading page'
      },
      
      // Click actions
      click: {
        default: 'Clicking',
        link: 'Opening link',
        button: 'Clicking button'
      },
      
      // Form actions
      form: {
        fill: 'Filling form field',
        submit: 'Submitting form',
        clear: 'Clearing field'
      },
      
      // Link actions
      link_action: {
        list: 'Listing links',
        open: 'Opening link',
        count: 'Found {count} links'
      },
      
      // Search
      search: {
        default: 'Searching for {query}',
        found: 'Found results',
        notfound: 'No results found'
      },
      
      // Text actions
      text: {
        read: 'Reading',
        select: 'Selecting text',
        copy: 'Copied to clipboard'
      },
      
      // Tab actions
      tab: {
        new: 'Opening new tab',
        close: 'Closing tab',
        switch: 'Switching tab'
      },

      // Errors
      error: {
        not_found: 'Element not found',
        failed: 'Command failed',
        unsupported: 'Command not supported',
        unknown: 'Command not recognized'
      },

      // General
      general: {
        success: 'Done',
        help: 'Help available',
        cancel: 'Cancelled',
        wait: 'Please wait'
      }
    };

    console.log('[Confirmations] Initialized');
  }

  /**
   * Speak confirmation for an intent result
   */
  async confirm(intentResult, customMessage = null) {
    if (!this.speaker.enabled) return;

    let message = customMessage;
    
    if (!message) {
      message = this.getConfirmationMessage(intentResult);
    }

    if (message) {
      try {
        await this.speaker.speak(message, { rate: 1.2 }); // Slightly faster for confirmations
      } catch (error) {
        console.error('[Confirmations] Failed to speak:', error);
      }
    }
  }

  /**
   * Get appropriate confirmation message for intent
   */
  getConfirmationMessage(intentResult) {
    const { intent, slots = {} } = intentResult;

    // Handle specific intents
    if (this.templates[intent]) {
      const intentTemplates = this.templates[intent];
      
      // Check for specific slot values
      if (slots.direction && intentTemplates[slots.direction]) {
        return intentTemplates[slots.direction];
      }
      
      if (slots.action && intentTemplates[slots.action]) {
        return this.fillTemplate(intentTemplates[slots.action], slots);
      }
      
      // Default for this intent
      if (intentTemplates.default) {
        return this.fillTemplate(intentTemplates.default, slots);
      }
    }

    // Generic confirmation
    return 'Command executed';
  }

  /**
   * Fill template with slot values
   */
  fillTemplate(template, slots) {
    let message = template;
    
    for (const [key, value] of Object.entries(slots)) {
      message = message.replace(`{${key}}`, value);
    }
    
    return message;
  }

  /**
   * Speak success message
   */
  async success(message = 'Done') {
    await this.speaker.speak(message, { rate: 1.2 });
  }

  /**
   * Speak error message
   */
  async error(message = 'Command failed') {
    await this.speaker.speak(message, { 
      rate: 1.0,
      pitch: 0.9 // Slightly lower pitch for errors
    });
  }

  /**
   * Speak custom message
   */
  async speak(message, options = {}) {
    await this.speaker.speak(message, { rate: 1.2, ...options });
  }

  /**
   * Add custom confirmation template
   */
  addTemplate(intent, templates) {
    this.templates[intent] = {
      ...(this.templates[intent] || {}),
      ...templates
    };
    console.log(`[Confirmations] Added template for: ${intent}`);
  }
}