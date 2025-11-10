/**
 * Zoom Content Script
 * Runs in page context to manipulate zoom and text scaling
 * Communicates with background service worker
 * 
 * Handles:
 * - Page-level zoom (via chrome.tabs.setZoom API)
 * - DOM-level text scaling (CSS manipulation)
 * - Visual feedback overlays
 * - Persistent zoom state
 */

(function() {
  'use strict';

  console.log('[ZoomContent] Initializing zoom and text scaling service...');

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  let zoomState = {
    currentZoom: 1.0,
    currentTextScale: 1.0,
    styleInjected: false,
    feedbackElement: null
  };

  // ============================================================================
  // ZOOM LEVEL MANAGEMENT
  // ============================================================================

  /**
   * Apply page-level zoom via chrome.tabs.setZoom
   * @param {number} zoomLevel - Zoom level (0.5 to 3.0)
   */
  async function applyZoom(zoomLevel) {
    try {
      const clampedZoom = Math.max(0.5, Math.min(3.0, zoomLevel));
      
      chrome.runtime.sendMessage(
        {
          type: 'SET_PAGE_ZOOM',
          zoom: clampedZoom
        },
        (response) => {
          if (response && response.success) {
            zoomState.currentZoom = clampedZoom;
            console.log(`[ZoomContent] Page zoom set to ${(clampedZoom * 100).toFixed(0)}%`);
            showZoomFeedback('zoom', clampedZoom);
          } else {
            console.error('[ZoomContent] Failed to set zoom:', response?.error);
          }
        }
      );
    } catch (error) {
      console.error('[ZoomContent] Error applying zoom:', error);
    }
  }

  /**
   * Get current page zoom
   */
  async function getCurrentZoom() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_PAGE_ZOOM' },
        (response) => {
          if (response && response.success) {
            zoomState.currentZoom = response.zoom;
            resolve(response.zoom);
          } else {
            resolve(1.0);
          }
        }
      );
    });
  }

  // ============================================================================
  // TEXT SCALING (DOM-LEVEL)
  // ============================================================================

  /**
   * Inject text scaling styles into page
   */
  function injectTextScalingStyles() {
    if (zoomState.styleInjected) return;

    const styleId = 'hoda-text-scaling-styles';
    
    // Check if already injected
    if (document.getElementById(styleId)) {
      zoomState.styleInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Hoda Text Scaling */
      html.hoda-text-scale {
        --hoda-text-scale: 1;
        font-size: calc(16px * var(--hoda-text-scale)) !important;
      }

      html.hoda-text-scale * {
        font-size: inherit !important;
      }

      html.hoda-text-scale body {
        font-size: calc(16px * var(--hoda-text-scale)) !important;
      }

      /* Common elements */
      html.hoda-text-scale p,
      html.hoda-text-scale div,
      html.hoda-text-scale span,
      html.hoda-text-scale a,
      html.hoda-text-scale button,
      html.hoda-text-scale input,
      html.hoda-text-scale textarea,
      html.hoda-text-scale select,
      html.hoda-text-scale label {
        font-size: inherit !important;
      }

      /* Headings */
      html.hoda-text-scale h1 { font-size: calc(32px * var(--hoda-text-scale)) !important; }
      html.hoda-text-scale h2 { font-size: calc(28px * var(--hoda-text-scale)) !important; }
      html.hoda-text-scale h3 { font-size: calc(24px * var(--hoda-text-scale)) !important; }
      html.hoda-text-scale h4 { font-size: calc(20px * var(--hoda-text-scale)) !important; }
      html.hoda-text-scale h5 { font-size: calc(18px * var(--hoda-text-scale)) !important; }
      html.hoda-text-scale h6 { font-size: calc(16px * var(--hoda-text-scale)) !important; }

      /* Small text */
      html.hoda-text-scale small { font-size: calc(12px * var(--hoda-text-scale)) !important; }

      /* Line height for readability */
      html.hoda-text-scale body {
        line-height: 1.6 !important;
      }

      /* Feedback overlay */
      .hoda-zoom-feedback {
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 16px 24px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        animation: slideIn 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .hoda-zoom-feedback.error {
        background-color: #f44336;
      }

      .hoda-zoom-feedback.warning {
        background-color: #ff9800;
      }

      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      .hoda-zoom-feedback.fade-out {
        animation: slideOut 0.3s ease-out forwards;
      }
    `;

    document.head.appendChild(style);
    zoomState.styleInjected = true;
    console.log('[ZoomContent] Text scaling styles injected');
  }

  /**
   * Apply text scaling to page
   * @param {number} scale - Text scale (0.75 to 2.0)
   */
  function applyTextScale(scale) {
    const clampedScale = Math.max(0.75, Math.min(2.0, scale));
    
    // Inject styles if needed
    injectTextScalingStyles();

    // Add class to html element
    document.documentElement.classList.add('hoda-text-scale');

    // Set CSS variable
    document.documentElement.style.setProperty(
      '--hoda-text-scale',
      clampedScale.toString()
    );

    zoomState.currentTextScale = clampedScale;
    console.log(`[ZoomContent] Text scale set to ${(clampedScale * 100).toFixed(0)}%`);
    showZoomFeedback('text-scale', clampedScale);
  }

  /**
   * Reset text scaling
   */
  function resetTextScale() {
    document.documentElement.classList.remove('hoda-text-scale');
    document.documentElement.style.removeProperty('--hoda-text-scale');
    zoomState.currentTextScale = 1.0;
    console.log('[ZoomContent] Text scale reset to 100%');
    showZoomFeedback('reset', 1.0);
  }

  // ============================================================================
  // VISUAL FEEDBACK
  // ============================================================================

  /**
   * Show zoom feedback overlay
   * @param {string} type - Type: 'zoom', 'text-scale', 'reset', 'error'
   * @param {number} value - Value (zoom or scale)
   */
  function showZoomFeedback(type, value) {
    // Remove existing feedback
    if (zoomState.feedbackElement) {
      zoomState.feedbackElement.remove();
      zoomState.feedbackElement = null;
    }

    // Create new feedback element
    const feedback = document.createElement('div');
    feedback.className = 'hoda-zoom-feedback';

    let icon = '🔍';
    let message = '';

    switch (type) {
      case 'zoom':
        icon = '🔍';
        message = `Zoom: ${(value * 100).toFixed(0)}%`;
        break;
      case 'text-scale':
        icon = 'A';
        message = `Text: ${(value * 100).toFixed(0)}%`;
        break;
      case 'reset':
        icon = '↺';
        message = 'Reset to 100%';
        break;
      case 'error':
        icon = '⚠️';
        message = value;
        feedback.classList.add('error');
        break;
      default:
        message = 'Zoom Updated';
    }

    feedback.innerHTML = `<span>${icon} ${message}</span>`;
    document.body.appendChild(feedback);
    zoomState.feedbackElement = feedback;

    // Auto-remove after 2.5 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.classList.add('fade-out');
        setTimeout(() => {
          if (feedback.parentNode) {
            feedback.remove();
          }
          if (zoomState.feedbackElement === feedback) {
            zoomState.feedbackElement = null;
          }
        }, 300);
      }
    }, 2500);
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Handle messages from popup or background
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // From injected script
    if (event.data.type === 'HODA_ZOOM_COMMAND') {
      handleZoomCommand(event.data.command);
    }
  });

  /**
   * Handle zoom command
   * @param {string} command - Command: 'zoom-in', 'zoom-out', etc.
   */
  async function handleZoomCommand(command) {
    console.log('[ZoomContent] Processing zoom command:', command);

    const cmd = command.toLowerCase().trim();
    const currentZoom = await getCurrentZoom();

    switch (cmd) {
      case 'zoom-in':
      case 'zoom in':
        applyZoom(currentZoom + 0.1);
        break;

      case 'zoom-out':
      case 'zoom out':
        applyZoom(currentZoom - 0.1);
        break;

      case 'reset-zoom':
      case 'reset zoom':
        applyZoom(1.0);
        break;

      case 'text-larger':
      case 'text larger':
      case 'larger text':
        applyTextScale(zoomState.currentTextScale + 0.15);
        break;

      case 'text-smaller':
      case 'text smaller':
      case 'smaller text':
        applyTextScale(zoomState.currentTextScale - 0.15);
        break;

      case 'reset-text':
      case 'reset text':
        resetTextScale();
        break;

      case 'reset-all':
      case 'reset all':
      case 'reset':
        applyZoom(1.0);
        resetTextScale();
        showZoomFeedback('reset', 1.0);
        break;

      default:
        showZoomFeedback('error', `Unknown command: ${cmd}`);
    }
  }

  /**
   * Listen for zoom commands from content script messaging
   */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'ZOOM_COMMAND') {
      handleZoomCommand(event.data.command);
    }
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize zoom service
   */
  async function initialize() {
    try {
      console.log('[ZoomContent] Initializing...');

      // Get current zoom
      const zoom = await getCurrentZoom();
      console.log(`[ZoomContent] Current zoom: ${(zoom * 100).toFixed(0)}%`);

      // Inject styles
      injectTextScalingStyles();

      // Make handler globally available
      window.HODA_HANDLE_ZOOM_COMMAND = handleZoomCommand;

      console.log('[ZoomContent] Ready. Supported commands:');
      console.log('  - zoom-in, zoom-out, reset-zoom');
      console.log('  - text-larger, text-smaller, reset-text');
      console.log('  - reset-all');

    } catch (error) {
      console.error('[ZoomContent] Initialization error:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      applyZoom,
      applyTextScale,
      resetTextScale,
      handleZoomCommand,
      showZoomFeedback,
      getCurrentZoom
    };
  }

})();
