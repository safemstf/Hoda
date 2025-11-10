/**
 * Zoom Intent Configuration
 * Add these intent definitions to services/stt/src/intents-temporary.js
 * 
 * These define how voice commands are recognized and classified as zoom commands
 */

const ZOOM_INTENTS = {
  zoom_control: {
    intent: 'zoom_control',
    priority: 25, // Lower than navigation, higher than form actions
    requiresConfirmation: false,
    slots: ['action', 'direction'],
    examples: [
      // Zoom in commands
      'zoom in',
      'zoom-in',
      'increase zoom',
      'make bigger',
      'bigger',
      'enlarge',
      'magnify',
      
      // Zoom out commands
      'zoom out',
      'zoom-out',
      'decrease zoom',
      'make smaller',
      'smaller',
      'shrink',
      'reduce size',
      
      // Reset zoom
      'reset zoom',
      'reset size',
      'normal zoom',
      'zoom normal',
      'go back to normal',
      'reset',
      'default zoom',
      
      // Text scaling
      'text larger',
      'make text bigger',
      'bigger text',
      'increase text',
      'text-larger',
      
      // Text smaller
      'text smaller',
      'make text smaller',
      'smaller text',
      'decrease text',
      'text-smaller',
      
      // Reset text
      'reset text',
      'text normal',
      'text default',
      
      // Reset all
      'reset all',
      'reset everything',
      'normal',
      'restore defaults'
    ],
    synonyms: {
      zoom: ['magnify', 'enlarge', 'scale'],
      in: ['increase', 'bigger', 'larger', 'up'],
      out: ['decrease', 'smaller', 'shrink', 'down'],
      text: ['font', 'letters', 'words'],
      reset: ['restore', 'normal', 'default', 'undo']
    }
  }
};

/**
 * Slot extraction for zoom commands
 * Add to commandNormalizer.js STEP 6 (Slot Extraction)
 */
const ZOOM_SLOT_EXTRACTION = {
  // Pattern: zoom [direction]
  zoomPatterns: [
    /^(zoom|magnify|enlarge)\s+(in|up|increase|bigger|larger)$/i,
    /^(zoom|magnify|enlarge)$/i, // defaults to in
    /^(zoom|magnify|enlarge)\s+(out|down|decrease|smaller)$/i,
  ],

  // Pattern: text [size]
  textPatterns: [
    /^(text|font)\s+(bigger|larger|more|increase|up)$/i,
    /^(text|font)\s+(smaller|less|decrease|down)$/i,
    /^(increase|enlarge)\s+(text|font)$/i,
    /^(decrease|reduce)\s+(text|font)$/i,
  ],

  // Pattern: reset
  resetPatterns: [
    /^(reset|restore|default|normal)$/i,
    /^(reset|restore)\s+(all|everything|zoom|text)$/i,
  ],

  /**
   * Extract zoom slots from normalized text
   * @param {string} normalizedText - Normalized command text
   * @returns {Object} Slots with action, direction, target
   */
  extractZoomSlots: function(normalizedText) {
    const text = normalizedText.toLowerCase().trim();

    // Check reset commands
    for (const pattern of this.resetPatterns) {
      if (pattern.test(text)) {
        return {
          action: 'reset',
          target: text.includes('text') ? 'text' : text.includes('zoom') ? 'zoom' : 'all',
          confidence: 0.95
        };
      }
    }

    // Check zoom commands
    for (const pattern of this.zoomPatterns) {
      if (pattern.test(text)) {
        return {
          action: 'zoom',
          direction: text.includes('out') || text.includes('down') || text.includes('decrease') || text.includes('smaller') ? 'out' : 'in',
          confidence: 0.95
        };
      }
    }

    // Check text commands
    for (const pattern of this.textPatterns) {
      if (pattern.test(text)) {
        return {
          action: 'text',
          direction: text.includes('bigger') || text.includes('larger') || text.includes('increase') || text.includes('up') ? 'larger' : 'smaller',
          confidence: 0.95
        };
      }
    }

    // Default: unknown
    return {
      action: 'unknown',
      confidence: 0
    };
  }
};

/**
 * Command Executor Integration
 * Add to services/stt/src/commandExecutor.js
 * 
 * Add this to the CommandExecutor class:
 */
const COMMAND_EXECUTOR_ZOOM_METHODS = `
  /**
   * Handle zoom commands
   * @param {Object} intent - Intent object with slots
   * @param {string} utterance - Original utterance
   */
  async handleZoomCommand(intent, utterance) {
    const action = intent.slots?.action?.toLowerCase();
    const direction = intent.slots?.direction?.toLowerCase();
    const target = intent.slots?.target?.toLowerCase() || 'all';

    console.log('[CommandExecutor] Zoom command:', { action, direction, target });

    let command = '';

    if (action === 'reset') {
      command = target === 'text' ? 'reset-text' : 
                target === 'zoom' ? 'reset-zoom' : 
                'reset-all';
    } else if (action === 'zoom') {
      command = direction === 'out' ? 'zoom-out' : 'zoom-in';
    } else if (action === 'text') {
      command = direction === 'larger' ? 'text-larger' : 'text-smaller';
    }

    if (!command) {
      return this.handleError(\`Unknown zoom action: \${action}\`);
    }

    // Send to content script
    const result = await this.executeInPage({
      action: 'handleZoomCommand',
      command: command
    });

    // Generate feedback
    this.feedbackManager.provide({
      type: 'success',
      action: 'zoom',
      message: \`Zoom \${command}: \${utterance}\`
    });

    return {
      success: true,
      action: 'zoom',
      command: command,
      result: result
    };
  }

  /**
   * Zoom in
   */
  async zoomIn() {
    return this.handleZoomCommand({
      slots: { action: 'zoom', direction: 'in' }
    }, 'zoom in');
  }

  /**
   * Zoom out
   */
  async zoomOut() {
    return this.handleZoomCommand({
      slots: { action: 'zoom', direction: 'out' }
    }, 'zoom out');
  }

  /**
   * Reset zoom
   */
  async resetZoom() {
    return this.handleZoomCommand({
      slots: { action: 'reset', target: 'zoom' }
    }, 'reset zoom');
  }

  /**
   * Increase text size
   */
  async textLarger() {
    return this.handleZoomCommand({
      slots: { action: 'text', direction: 'larger' }
    }, 'text larger');
  }

  /**
   * Decrease text size
   */
  async textSmaller() {
    return this.handleZoomCommand({
      slots: { action: 'text', direction: 'smaller' }
    }, 'text smaller');
  }

  /**
   * Reset all
   */
  async resetAll() {
    return this.handleZoomCommand({
      slots: { action: 'reset', target: 'all' }
    }, 'reset all');
  }
`;

/**
 * Intent Resolver Integration
 * Add to services/stt/src/intentResolver.js
 * 
 * Add this to recognize zoom commands:
 */
const INTENT_RESOLVER_ZOOM = `
  resolveZoomIntent(normalizedText) {
    const slots = ZOOM_SLOT_EXTRACTION.extractZoomSlots(normalizedText);
    
    if (slots.confidence < 0.8) {
      return null; // Not a zoom command
    }

    return {
      intent: 'zoom_control',
      slots: slots,
      confidence: slots.confidence,
      requiresConfirmation: false,
      description: \`Zoom \${slots.action}: \${slots.direction || slots.target}\`
    };
  }
`;

/**
 * Popup Integration
 * Add to popup.js to handle zoom commands
 */
const POPUP_ZOOM_INTEGRATION = `
  // In PopupUI class or appropriate handler:
  
  /**
   * Handle zoom voice command
   * @param {Object} intent - Intent from resolver
   */
  async handleZoomVoiceCommand(intent) {
    console.log('[Popup] Handling zoom command:', intent);

    try {
      // Send to active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        type: 'ZOOM_COMMAND',
        command: this.generateZoomCommand(intent)
      });

      // Update UI
      this.updateZoomDisplay();

      // Provide feedback
      this.speak(\`Zoom \${intent.slots?.direction || intent.slots?.target}\`);

    } catch (error) {
      console.error('[Popup] Error handling zoom command:', error);
      this.speak('Error: could not apply zoom');
    }
  }

  /**
   * Generate zoom command from intent
   */
  generateZoomCommand(intent) {
    const action = intent.slots?.action;
    const direction = intent.slots?.direction;
    const target = intent.slots?.target;

    if (action === 'zoom') {
      return direction === 'out' ? 'zoom-out' : 'zoom-in';
    } else if (action === 'text') {
      return direction === 'larger' ? 'text-larger' : 'text-smaller';
    } else if (action === 'reset') {
      return target === 'text' ? 'reset-text' : target === 'zoom' ? 'reset-zoom' : 'reset-all';
    }
    return null;
  }

  /**
   * Update zoom display in popup
   */
  async updateZoomDisplay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const zoom = await chrome.tabs.getZoom(tab.id);
      
      const zoomPercent = (zoom * 100).toFixed(0);
      const zoomElement = document.getElementById('zoom-display');
      
      if (zoomElement) {
        zoomElement.textContent = \`Zoom: \${zoomPercent}%\`;
      }
    } catch (error) {
      console.error('[Popup] Error updating zoom display:', error);
    }
  }
`;

module.exports = {
  ZOOM_INTENTS,
  ZOOM_SLOT_EXTRACTION,
  COMMAND_EXECUTOR_ZOOM_METHODS,
  INTENT_RESOLVER_ZOOM,
  POPUP_ZOOM_INTEGRATION
};
