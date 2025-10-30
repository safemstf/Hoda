/**
 * ScalingManager - Handles page zoom and text scaling with graceful error handling
 *
 * Rationale (aligned with codebase patterns):
 * - Mirrors existing "Manager" naming (e.g., microphoneManager, feedbackManager)
 * - Keeps parsing (CommandNormalizer) pure and execution (CommandExecutor) thin
 * - Centralizes bounds, restriction detection, and recovery messaging
 */

export class ScalingManager {
  constructor(options = {}) {
    this.minZoom = options.minZoom || 0.5; // 50%
    this.maxZoom = options.maxZoom || 3.0; // 300%
    this.zoomStep = options.zoomStep || 0.1; // 10%

    this.minTextScale = options.minTextScale || 0.75; // 75%
    this.maxTextScale = options.maxTextScale || 2.5;  // 250%
    this.textStep = options.textStep || 0.1;          // 10%
  }

  /**
   * Apply zoom: 'in' | 'out' | 'reset'
   * Returns structured result for TTS/feedback
   */
  async applyZoom(action) {
    try {
      const before = this.#getZoom();
      let target = before;

      if (action === 'reset' || action === 'normal') {
        target = 1.0;
      } else if (action === 'in' || action === 'bigger') {
        target = before + this.zoomStep;
      } else if (action === 'out' || action === 'smaller') {
        target = before - this.zoomStep;
      }

      // Bounds
      if (target > this.maxZoom) {
        return {
          success: false,
          code: 'MAX_REACHED',
          message: `Already at maximum zoom (${Math.round(this.maxZoom * 100)}%)`
        };
      }
      if (target < this.minZoom) {
        return {
          success: false,
          code: 'MIN_REACHED',
          message: `Already at minimum zoom (${Math.round(this.minZoom * 100)}%)`
        };
      }

      // Apply and verify
      this.#setZoom(target);
      const after = this.#getZoom();

      if (!this.#changed(before, after)) {
        return {
          success: false,
          code: 'RESTRICTED',
          message: 'This page may block zoom. Try Ctrl + (plus) or say "increase text".'
        };
      }

      return {
        success: true,
        code: 'OK',
        percent: Math.round(after * 100),
        message: `Zoomed to ${Math.round(after * 100)}%`
      };
    } catch (e) {
      return {
        success: false,
        code: 'ERROR',
        message: 'Could not change zoom. Try browser zoom: Ctrl plus or Ctrl minus.'
      };
    }
  }

  /**
   * Apply text scaling: 'in' | 'out' | 'reset'
   * Uses root font-size percentage to preserve layout as much as possible
   */
  async applyTextScale(action) {
    try {
      const before = this.#getTextScale();
      let target = before;

      if (action === 'reset' || action === 'normal') {
        target = 1.0;
      } else if (action === 'in' || action === 'bigger') {
        target = before + this.textStep;
      } else if (action === 'out' || action === 'smaller') {
        target = before - this.textStep;
      }

      // Bounds
      if (target > this.maxTextScale) {
        return {
          success: false,
          code: 'MAX_REACHED',
          message: `Already at maximum text size (${Math.round(this.maxTextScale * 100)}%)`
        };
      }
      if (target < this.minTextScale) {
        return {
          success: false,
          code: 'MIN_REACHED',
          message: `Already at minimum text size (${Math.round(this.minTextScale * 100)}%)`
        };
      }

      // Apply and verify
      this.#setTextScale(target);
      const after = this.#getTextScale();

      if (!this.#changed(before, after)) {
        return {
          success: false,
          code: 'RESTRICTED',
          message: 'Text size change may be blocked by this page.'
        };
      }

      return {
        success: true,
        code: 'OK',
        percent: Math.round(after * 100),
        message: `Text size ${Math.round(after * 100)}%`
      };
    } catch (e) {
      return {
        success: false,
        code: 'ERROR',
        message: 'Could not change text size.'
      };
    }
  }

  // --- Private helpers ---
  #getZoom() {
    const inline = parseFloat(document.body.style.zoom);
    if (!isNaN(inline) && inline > 0) return inline;
    // Fallback approximation via transform scale detection could go here; default 1
    return 1.0;
  }

  #setZoom(value) {
    document.body.style.zoom = String(value);
  }

  #getTextScale() {
    const root = document.documentElement;
    const inline = root.style.fontSize; // e.g., '110%'
    if (inline && inline.endsWith('%')) {
      const n = parseFloat(inline);
      if (!isNaN(n) && n > 0) return n / 100;
    }

    // Compute current font-size relative to default 100%
    const computed = getComputedStyle(root).fontSize;
    const px = parseFloat(computed);
    // Assume 16px baseline typical; if unknown, default 1.0
    if (!isNaN(px) && px > 0) {
      const baseline = 16;
      return Math.max(0.1, Math.min(10, px / baseline));
    }
    return 1.0;
  }

  #setTextScale(multiplier) {
    const percent = Math.round(multiplier * 100);
    document.documentElement.style.fontSize = percent + '%';
  }

  #changed(a, b) {
    return Math.abs(a - b) > 0.005; // ~0.5%
  }
}

export default ScalingManager;


