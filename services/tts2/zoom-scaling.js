/**
 * Zoom and Text Scaling Module
 * Handles zoom-in, zoom-out, text scaling, and reset operations
 * 
 * Supports:
 * - Page zoom (browser-level zoom)
 * - Text scaling (CSS font-size manipulation)
 * - Persistent settings (chrome.storage)
 * - Accessibility features
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Zoom Configuration
 */
const ZOOM_CONFIG = {
  MIN_ZOOM: 0.5,           // 50%
  MAX_ZOOM: 3.0,           // 300%
  DEFAULT_ZOOM: 1.0,       // 100%
  ZOOM_STEP: 0.1,          // 10% increment
  MIN_TEXT_SCALE: 0.75,    // 75%
  MAX_TEXT_SCALE: 2.0,     // 200%
  DEFAULT_TEXT_SCALE: 1.0, // 100%
  TEXT_SCALE_STEP: 0.15,   // 15% increment
  STORAGE_KEY: 'hoda_zoom_settings'
};

/**
 * Zoom State Manager
 * Tracks current zoom and text scale levels
 */
class ZoomStateManager {
  constructor() {
    this.currentZoom = ZOOM_CONFIG.DEFAULT_ZOOM;
    this.currentTextScale = ZOOM_CONFIG.DEFAULT_TEXT_SCALE;
    this.id = uuidv4();
    console.log(`[ZoomManager] Initialized (ID: ${this.id})`);
  }

  /**
   * Get current zoom level
   * @returns {number} Current zoom (0.5 to 3.0)
   */
  getZoom() {
    return this.currentZoom;
  }

  /**
   * Set zoom level with validation
   * @param {number} zoom - Zoom level (0.5 to 3.0)
   * @returns {Object} { success, zoom, previous, change }
   */
  setZoom(zoom) {
    const zoomNum = parseFloat(zoom);
    
    if (isNaN(zoomNum)) {
      return {
        success: false,
        error: `Invalid zoom value: ${zoom}. Must be a number between ${ZOOM_CONFIG.MIN_ZOOM} and ${ZOOM_CONFIG.MAX_ZOOM}`
      };
    }

    const clampedZoom = Math.max(
      ZOOM_CONFIG.MIN_ZOOM,
      Math.min(ZOOM_CONFIG.MAX_ZOOM, zoomNum)
    );

    const previous = this.currentZoom;
    this.currentZoom = clampedZoom;
    const change = ((clampedZoom - previous) * 100).toFixed(0);

    return {
      success: true,
      zoom: clampedZoom,
      previous,
      change: parseInt(change),
      message: `Zoom set to ${(clampedZoom * 100).toFixed(0)}%`
    };
  }

  /**
   * Get current text scale
   * @returns {number} Current text scale (0.75 to 2.0)
   */
  getTextScale() {
    return this.currentTextScale;
  }

  /**
   * Set text scale with validation
   * @param {number} scale - Text scale (0.75 to 2.0)
   * @returns {Object} { success, scale, previous, change }
   */
  setTextScale(scale) {
    const scaleNum = parseFloat(scale);
    
    if (isNaN(scaleNum)) {
      return {
        success: false,
        error: `Invalid text scale value: ${scale}. Must be a number between ${ZOOM_CONFIG.MIN_TEXT_SCALE} and ${ZOOM_CONFIG.MAX_TEXT_SCALE}`
      };
    }

    const clampedScale = Math.max(
      ZOOM_CONFIG.MIN_TEXT_SCALE,
      Math.min(ZOOM_CONFIG.MAX_TEXT_SCALE, scaleNum)
    );

    const previous = this.currentTextScale;
    this.currentTextScale = clampedScale;
    const change = ((clampedScale - previous) * 100).toFixed(0);

    return {
      success: true,
      scale: clampedScale,
      previous,
      change: parseInt(change),
      message: `Text scale set to ${(clampedScale * 100).toFixed(0)}%`
    };
  }

  /**
   * Reset all zoom and text scaling
   * @returns {Object} { success, zoom, textScale, message }
   */
  reset() {
    const previousZoom = this.currentZoom;
    const previousScale = this.currentTextScale;
    
    this.currentZoom = ZOOM_CONFIG.DEFAULT_ZOOM;
    this.currentTextScale = ZOOM_CONFIG.DEFAULT_TEXT_SCALE;

    return {
      success: true,
      zoom: this.currentZoom,
      textScale: this.currentTextScale,
      previous: {
        zoom: previousZoom,
        textScale: previousScale
      },
      message: 'Zoom and text scale reset to default (100%)'
    };
  }

  /**
   * Increment zoom by step
   * @returns {Object} { success, zoom, previous, message }
   */
  incrementZoom() {
    const newZoom = this.currentZoom + ZOOM_CONFIG.ZOOM_STEP;
    return this.setZoom(newZoom);
  }

  /**
   * Decrement zoom by step
   * @returns {Object} { success, zoom, previous, message }
   */
  decrementZoom() {
    const newZoom = this.currentZoom - ZOOM_CONFIG.ZOOM_STEP;
    return this.setZoom(newZoom);
  }

  /**
   * Increment text scale by step
   * @returns {Object} { success, scale, previous, message }
   */
  incrementTextScale() {
    const newScale = this.currentTextScale + ZOOM_CONFIG.TEXT_SCALE_STEP;
    return this.setTextScale(newScale);
  }

  /**
   * Decrement text scale by step
   * @returns {Object} { success, scale, previous, message }
   */
  decrementTextScale() {
    const newScale = this.currentTextScale - ZOOM_CONFIG.TEXT_SCALE_STEP;
    return this.setTextScale(newScale);
  }

  /**
   * Get current state
   * @returns {Object} { zoom, textScale, zoomPercent, textScalePercent }
   */
  getState() {
    return {
      zoom: this.currentZoom,
      textScale: this.currentTextScale,
      zoomPercent: `${(this.currentZoom * 100).toFixed(0)}%`,
      textScalePercent: `${(this.currentTextScale * 100).toFixed(0)}%`,
      id: this.id
    };
  }

  /**
   * Load state from object
   * @param {Object} state - State object with zoom and textScale
   */
  loadState(state) {
    if (state.zoom !== undefined) {
      this.currentZoom = Math.max(
        ZOOM_CONFIG.MIN_ZOOM,
        Math.min(ZOOM_CONFIG.MAX_ZOOM, state.zoom)
      );
    }
    if (state.textScale !== undefined) {
      this.currentTextScale = Math.max(
        ZOOM_CONFIG.MIN_TEXT_SCALE,
        Math.min(ZOOM_CONFIG.MAX_TEXT_SCALE, state.textScale)
      );
    }
  }
}

/**
 * Zoom Command Handler
 * Processes zoom-related voice commands
 */
class ZoomCommandHandler {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.commandHistory = [];
  }

  /**
   * Handle zoom command
   * @param {string} command - Command: 'zoom-in', 'zoom-out', 'reset-zoom', 'text-larger', 'text-smaller', 'reset-all'
   * @returns {Object} Result with success, message, and new values
   */
  handleCommand(command) {
    const cmd = command.toLowerCase().trim();
    const timestamp = Date.now();

    let result = {};

    switch (cmd) {
      case 'zoom-in':
      case 'zoom in':
      case 'increase zoom':
        result = this.stateManager.incrementZoom();
        break;

      case 'zoom-out':
      case 'zoom out':
      case 'decrease zoom':
        result = this.stateManager.decrementZoom();
        break;

      case 'reset-zoom':
      case 'reset zoom':
        result = this.stateManager.setZoom(ZOOM_CONFIG.DEFAULT_ZOOM);
        break;

      case 'text-larger':
      case 'text larger':
      case 'increase text':
      case 'bigger text':
        result = this.stateManager.incrementTextScale();
        break;

      case 'text-smaller':
      case 'text smaller':
      case 'decrease text':
      case 'smaller text':
        result = this.stateManager.decrementTextScale();
        break;

      case 'reset-all':
      case 'reset all':
      case 'reset':
        result = this.stateManager.reset();
        break;

      default:
        result = {
          success: false,
          error: `Unknown zoom command: ${cmd}`,
          supportedCommands: [
            'zoom-in', 'zoom-out', 'reset-zoom',
            'text-larger', 'text-smaller', 'reset-all'
          ]
        };
    }

    // Add metadata
    result.command = cmd;
    result.timestamp = timestamp;
    result.state = this.stateManager.getState();

    // Track history
    this.commandHistory.push({
      command: cmd,
      result: result.success,
      timestamp,
      zoom: this.stateManager.getZoom(),
      textScale: this.stateManager.getTextScale()
    });

    return result;
  }

  /**
   * Get command history
   * @param {number} limit - Number of recent commands to return
   * @returns {Array} Recent commands
   */
  getHistory(limit = 10) {
    return this.commandHistory.slice(-limit);
  }

  /**
   * Clear command history
   */
  clearHistory() {
    this.commandHistory = [];
  }

  /**
   * Get supported commands
   * @returns {Array} List of supported commands
   */
  getSupportedCommands() {
    return [
      {
        command: 'zoom-in',
        aliases: ['zoom in', 'increase zoom'],
        effect: `Increase zoom by ${(ZOOM_CONFIG.ZOOM_STEP * 100).toFixed(0)}%`
      },
      {
        command: 'zoom-out',
        aliases: ['zoom out', 'decrease zoom'],
        effect: `Decrease zoom by ${(ZOOM_CONFIG.ZOOM_STEP * 100).toFixed(0)}%`
      },
      {
        command: 'reset-zoom',
        aliases: ['reset zoom'],
        effect: 'Reset zoom to 100%'
      },
      {
        command: 'text-larger',
        aliases: ['text larger', 'increase text', 'bigger text'],
        effect: `Increase text by ${(ZOOM_CONFIG.TEXT_SCALE_STEP * 100).toFixed(0)}%`
      },
      {
        command: 'text-smaller',
        aliases: ['text smaller', 'decrease text', 'smaller text'],
        effect: `Decrease text by ${(ZOOM_CONFIG.TEXT_SCALE_STEP * 100).toFixed(0)}%`
      },
      {
        command: 'reset-all',
        aliases: ['reset all', 'reset'],
        effect: 'Reset zoom and text scaling to 100%'
      }
    ];
  }
}

/**
 * Zoom Feedback Generator
 * Creates user feedback messages
 */
class ZoomFeedback {
  /**
   * Generate TTS feedback for zoom action
   * @param {Object} result - Result from zoom command
   * @returns {string} TTS message
   */
  static generateTTSMessage(result) {
    if (!result.success) {
      return `Error: ${result.error}`;
    }

    if (result.zoom !== undefined) {
      const percent = (result.zoom * 100).toFixed(0);
      return `Zoom set to ${percent} percent`;
    }

    if (result.scale !== undefined) {
      const percent = (result.scale * 100).toFixed(0);
      return `Text scale set to ${percent} percent`;
    }

    if (result.zoom !== undefined && result.textScale !== undefined) {
      const zoomPct = (result.zoom * 100).toFixed(0);
      const textPct = (result.textScale * 100).toFixed(0);
      return `Reset: zoom to ${zoomPct} percent, text to ${textPct} percent`;
    }

    return result.message || 'Zoom command executed';
  }

  /**
   * Generate visual feedback overlay
   * @param {Object} result - Result from zoom command
   * @returns {Object} Visual feedback configuration
   */
  static generateVisualFeedback(result) {
    return {
      type: 'zoom-feedback',
      show: true,
      duration: 3000, // 3 seconds
      position: 'top-right',
      content: {
        title: result.success ? '🔍 Zoom Updated' : '❌ Zoom Error',
        message: result.message || result.error,
        state: result.state
      },
      styling: {
        backgroundColor: result.success ? '#4CAF50' : '#f44336',
        textColor: '#ffffff',
        padding: '12px 16px',
        borderRadius: '4px',
        fontSize: '14px'
      }
    };
  }

  /**
   * Generate accessibility announcement
   * @param {Object} result - Result from zoom command
   * @returns {Object} Accessibility announcement
   */
  static generateAccessibilityAnnouncement(result) {
    return {
      role: 'status',
      ariaLive: 'assertive',
      ariaLabel: this.generateTTSMessage(result),
      message: result.message || result.error,
      timestamp: Date.now()
    };
  }
}

/**
 * Zoom Validator
 * Validates zoom operations
 */
function validateZoomInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid zoom input: must be an object');
  }

  if (input.command && typeof input.command !== 'string') {
    throw new Error('Invalid zoom input: command must be a string');
  }

  return true;
}

function validateZoomResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid zoom result: must be an object');
  }

  if (typeof result.success !== 'boolean') {
    throw new Error('Invalid zoom result: success must be a boolean');
  }

  if (result.zoom !== undefined && typeof result.zoom !== 'number') {
    throw new Error('Invalid zoom result: zoom must be a number');
  }

  if (result.scale !== undefined && typeof result.scale !== 'number') {
    throw new Error('Invalid zoom result: scale must be a number');
  }

  return true;
}

module.exports = {
  ZOOM_CONFIG,
  ZoomStateManager,
  ZoomCommandHandler,
  ZoomFeedback,
  validateZoomInput,
  validateZoomResult
};
