/**
 * Microphone Manager for Hoda Voice Extension
 * Handles microphone access, permissions, and status management
 * Compatible with Microsoft Edge and Chrome
 */

/**
 * MicrophoneManager class
 */
export class MicrophoneManager {
  constructor() {
    this.stream = null;
    this.isActive = false;
    this.hasPermission = false;
    this.audioContext = null;
    this.analyser = null;
    this.statusCallbacks = [];
    this.errorCallbacks = [];
  }

  /**
   * Initialize and request microphone access
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser does not support microphone access');
      }

      // Request microphone permission with clear explanation
      console.log('Requesting microphone access for voice commands...');
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      this.hasPermission = true;
      this.isActive = true;

      // Set up audio context for visualization
      this.setupAudioContext();

      // Notify status change
      this.notifyStatus('initialized', {
        message: 'Microphone access granted',
        timestamp: Date.now()
      });

      console.log('Microphone initialized successfully');
      return true;

    } catch (error) {
      this.hasPermission = false;
      this.isActive = false;
      
      this.handlePermissionError(error);
      return false;
    }
  }

  /**
   * Set up audio context for volume monitoring
   */
  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

    } catch (error) {
      console.warn('Could not set up audio visualization:', error);
    }
  }

  /**
   * Get current microphone volume level (0-100)
   * Useful for visual indicators
   */
  getVolumeLevel() {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    return Math.min(100, Math.round((average / 255) * 100));
  }

  /**
   * Check if microphone is currently active
   */
  isRecording() {
    return this.isActive && this.stream && this.stream.active;
  }

  /**
   * Stop microphone capture
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isActive = false;
    this.notifyStatus('stopped', {
      message: 'Microphone stopped',
      timestamp: Date.now()
    });
  }

  /**
   * Pause microphone (mute without closing)
   */
  pause() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.enabled = false;
      });
      this.isActive = false;
      this.notifyStatus('paused', {
        message: 'Microphone paused',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Resume microphone
   */
  resume() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.enabled = true;
      });
      this.isActive = true;
      this.notifyStatus('resumed', {
        message: 'Microphone resumed',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle permission errors with helpful messages
   */
  handlePermissionError(error) {
    let userMessage = '';
    let recoverySteps = [];

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      userMessage = 'Microphone access was denied. Voice commands require microphone permission.';
      recoverySteps = [
        'Click the microphone icon in your browser address bar',
        'Select "Allow" for microphone access',
        'Refresh the page and try again',
        'On Edge: Settings → Privacy → Microphone → Allow this site'
      ];
    } else if (error.name === 'NotFoundError') {
      userMessage = 'No microphone detected. Please connect a microphone.';
      recoverySteps = [
        'Check if a microphone is connected to your device',
        'Check system sound settings to ensure microphone is enabled',
        'Try a different microphone if available',
        'Restart your browser'
      ];
    } else if (error.name === 'NotReadableError') {
      userMessage = 'Microphone is being used by another application.';
      recoverySteps = [
        'Close other applications that might be using the microphone',
        'Restart your browser',
        'Check Windows privacy settings (Settings → Privacy → Microphone)'
      ];
    } else {
      userMessage = `Microphone error: ${error.message}`;
      recoverySteps = [
        'Check browser permissions',
        'Restart your browser',
        'Update Microsoft Edge to the latest version'
      ];
    }

    this.notifyError({
      error: error.name,
      message: userMessage,
      recoverySteps: recoverySteps,
      timestamp: Date.now()
    });

    console.error('Microphone error:', error);
  }

  /**
   * Get microphone permission status
   */
  async getPermissionStatus() {
    try {
      if (!navigator.permissions) {
        return 'unavailable';
      }

      const result = await navigator.permissions.query({ name: 'microphone' });
      return result.state; // 'granted', 'denied', or 'prompt'
    } catch (error) {
      console.warn('Could not check permission status:', error);
      return 'unavailable';
    }
  }

  /**
   * Test microphone functionality
   */
  async testMicrophone() {
    const results = {
      supported: false,
      permission: false,
      active: false,
      volumeDetected: false,
      errors: []
    };

    try {
      // Check browser support
      results.supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      if (!results.supported) {
        results.errors.push('Browser does not support microphone access');
        return results;
      }

      // Try to initialize
      results.permission = await this.initialize();
      if (!results.permission) {
        results.errors.push('Could not obtain microphone permission');
        return results;
      }

      results.active = this.isRecording();

      // Test volume detection
      await new Promise(resolve => setTimeout(resolve, 500));
      const volume = this.getVolumeLevel();
      results.volumeDetected = volume > 0;

      if (!results.volumeDetected) {
        results.errors.push('Microphone is connected but no audio detected. Try speaking.');
      }

    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  /**
   * Register status change callback
   */
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify all status listeners
   */
  notifyStatus(status, data) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status, data);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  /**
   * Notify all error listeners
   */
  notifyError(errorData) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorData);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Get microphone info for debugging
   */
  getInfo() {
    return {
      isActive: this.isActive,
      hasPermission: this.hasPermission,
      isRecording: this.isRecording(),
      volumeLevel: this.getVolumeLevel(),
      streamActive: this.stream ? this.stream.active : false,
      audioContextState: this.audioContext ? this.audioContext.state : 'none'
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    this.statusCallbacks = [];
    this.errorCallbacks = [];
  }
}

/**
 * Visual Indicator Component
 * Shows microphone status in the UI
 */
export class MicrophoneIndicator {
  constructor(containerId, micManager) {
    this.container = document.getElementById(containerId);
    this.micManager = micManager;
    this.indicator = null;
    this.volumeBar = null;
    this.statusText = null;
    this.animationFrame = null;

    this.createIndicator();
    this.setupListeners();
  }

  createIndicator() {
    this.indicator = document.createElement('div');
    this.indicator.id = 'hoda-mic-indicator';
    this.indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s;
    `;

    // Microphone icon
    const icon = document.createElement('div');
    icon.innerHTML = '🎤';
    icon.style.fontSize = '20px';
    
    // Status text
    this.statusText = document.createElement('div');
    this.statusText.textContent = 'Initializing...';
    
    // Volume bar
    this.volumeBar = document.createElement('div');
    this.volumeBar.style.cssText = `
      width: 60px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
    `;
    
    const volumeFill = document.createElement('div');
    volumeFill.id = 'volume-fill';
    volumeFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #4CAF50, #8BC34A);
      transition: width 0.1s;
      border-radius: 2px;
    `;
    this.volumeBar.appendChild(volumeFill);

    this.indicator.appendChild(icon);
    this.indicator.appendChild(this.statusText);
    this.indicator.appendChild(this.volumeBar);
    
    if (this.container) {
      this.container.appendChild(this.indicator);
    } else {
      document.body.appendChild(this.indicator);
    }
  }

  setupListeners() {
    this.micManager.onStatusChange((status, data) => {
      this.updateStatus(status, data);
    });

    this.micManager.onError((errorData) => {
      this.showError(errorData);
    });

    // Start volume animation
    this.updateVolume();
  }

  updateStatus(status, data) {
    const statusMessages = {
      initialized: 'Listening',
      stopped: 'Stopped',
      paused: 'Paused',
      resumed: 'Listening'
    };

    this.statusText.textContent = statusMessages[status] || status;

    // Update indicator color
    const colors = {
      initialized: 'rgba(76, 175, 80, 0.9)',
      stopped: 'rgba(158, 158, 158, 0.9)',
      paused: 'rgba(255, 152, 0, 0.9)',
      resumed: 'rgba(76, 175, 80, 0.9)'
    };

    this.indicator.style.background = colors[status] || 'rgba(0, 0, 0, 0.8)';
  }

  updateVolume() {
    if (this.micManager.isRecording()) {
      const volume = this.micManager.getVolumeLevel();
      const volumeFill = this.volumeBar.querySelector('#volume-fill');
      if (volumeFill) {
        volumeFill.style.width = `${volume}%`;
      }
    }

    this.animationFrame = requestAnimationFrame(() => this.updateVolume());
  }

  showError(errorData) {
    this.statusText.textContent = 'Error';
    this.indicator.style.background = 'rgba(244, 67, 54, 0.9)';

    // Show detailed error in console
    console.error('Microphone error:', errorData);
    
    // Could add a tooltip or modal here to show recovery steps
  }

  hide() {
    this.indicator.style.opacity = '0';
    setTimeout(() => {
      this.indicator.style.display = 'none';
    }, 300);
  }

  show() {
    this.indicator.style.display = 'flex';
    setTimeout(() => {
      this.indicator.style.opacity = '1';
    }, 10);
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.indicator) {
      this.indicator.remove();
    }
  }
}

// Export convenience function for quick setup
export async function initializeMicrophone(showIndicator = true) {
  const micManager = new MicrophoneManager();
  
  const success = await micManager.initialize();
  
  if (success && showIndicator) {
    const indicator = new MicrophoneIndicator(null, micManager);
    return { micManager, indicator };
  }
  
  return { micManager, indicator: null };
}

// Default export for easier importing
export default MicrophoneManager;