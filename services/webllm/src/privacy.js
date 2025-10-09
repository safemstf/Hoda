/**
 * Privacy controls for local-first processing
 */

export class PrivacyManager {
  constructor(settings = {}) {
    this.settings = {
      localOnly: settings.localOnly ?? true, // Default to local-first
      allowCloudFallback: settings.allowCloudFallback ?? false,
      logInteractions: settings.logInteractions ?? false
    };
  }

  /**
   * Check if cloud fallback is allowed
   */
  canUseCloudFallback() {
    return !this.settings.localOnly && this.settings.allowCloudFallback;
  }

  /**
   * Check if local-only mode is enabled
   */
  isLocalOnly() {
    return this.settings.localOnly;
  }

  /**
   * Enable strict local-only mode
   */
  enableLocalOnly() {
    this.settings.localOnly = true;
    this.settings.allowCloudFallback = false;
  }

  /**
   * Update privacy settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Validate that no external calls are made in local-only mode
   */
  validateLocalMode(operation) {
    if (this.settings.localOnly && operation.includes('external')) {
      throw new Error('External API calls are not allowed in local-only mode');
    }
  }
}
