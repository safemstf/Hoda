// services/tts/speaker.js - Core TTS functionality
/**
 * Speaker - Core Text-to-Speech service
 * Wraps Web Speech API's SpeechSynthesis
 */
export class Speaker {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.volume = options.volume || 1.0;
    this.rate = options.rate || 1.0;
    this.pitch = options.pitch || 1.0;
    this.voice = options.voice || null;
    this.lang = options.lang || 'en-US';
    
    // Queue management
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    
    console.log('[Speaker] Initialized', {
      enabled: this.enabled,
      volume: this.volume,
      rate: this.rate
    });
  }

  /**
   * Check if browser supports TTS
   */
  static isSupported() {
    return 'speechSynthesis' in window;
  }

  /**
   * Get available voices
   */
  async getVoices() {
    if (!Speaker.isSupported()) return [];

    return new Promise((resolve) => {
      let voices = window.speechSynthesis.getVoices();
      
      if (voices.length > 0) {
        resolve(voices);
      } else {
        // Voices load asynchronously in some browsers
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          resolve(voices);
        };
      }
    });
  }

  /**
   * Speak text with options
   */
  async speak(text, options = {}) {
    if (!this.enabled || !Speaker.isSupported()) {
      console.log('[Speaker] TTS disabled or not supported');
      return false;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[Speaker] Empty text provided');
      return false;
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply settings
      utterance.volume = options.volume ?? this.volume;
      utterance.rate = options.rate ?? this.rate;
      utterance.pitch = options.pitch ?? this.pitch;
      utterance.lang = options.lang ?? this.lang;
      
      // Set voice if specified
      if (options.voice) {
        utterance.voice = options.voice;
      } else if (this.voice) {
        utterance.voice = this.voice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.currentUtterance = utterance;
        console.log('[Speaker] 🔊 Speaking:', text.substring(0, 50));
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('[Speaker] ✅ Finished speaking');
        resolve(true);
      };

      utterance.onerror = (event) => {
        console.error('[Speaker] ❌ Error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;
        reject(event.error);
      };

      // Speak
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop current speech
   */
  stop() {
    if (Speaker.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      console.log('[Speaker] 🛑 Stopped');
    }
  }

  /**
   * Pause speech
   */
  pause() {
    if (Speaker.isSupported() && this.isSpeaking) {
      window.speechSynthesis.pause();
      console.log('[Speaker] ⏸️ Paused');
    }
  }

  /**
   * Resume speech
   */
  resume() {
    if (Speaker.isSupported()) {
      window.speechSynthesis.resume();
      console.log('[Speaker] ▶️ Resumed');
    }
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.isSpeaking) {
      this.stop();
    }
    console.log('[Speaker] Enabled:', enabled);
  }

  /**
   * Update settings
   */
  updateSettings(settings) {
    if (settings.volume !== undefined) this.volume = settings.volume;
    if (settings.rate !== undefined) this.rate = settings.rate;
    if (settings.pitch !== undefined) this.pitch = settings.pitch;
    if (settings.voice !== undefined) this.voice = settings.voice;
    if (settings.lang !== undefined) this.lang = settings.lang;
    
    console.log('[Speaker] Settings updated:', settings);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      supported: Speaker.isSupported(),
      speaking: this.isSpeaking,
      volume: this.volume,
      rate: this.rate,
      pitch: this.pitch
    };
  }
}