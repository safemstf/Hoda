// services/tts/index.js - TTS Service Integration
/**
 * TTS Service - Main entry point for Text-to-Speech
 * Provides voice feedback for accessibility commands
 */

import { Speaker } from './speaker.js';
import { Confirmations } from './confirmations.js';
import { Reader } from './reader.js';

/**
 * Main TTS Service class
 */
export class TTSService {
  constructor(options = {}) {
    this.options = options;
    this.speaker = new Speaker(options.speaker || {});
    this.confirmations = new Confirmations(this.speaker);
    this.reader = new Reader(this.speaker);
    this.initialized = false;
    
    console.log('[TTSService] Created', options);
  }

  /**
   * Initialize TTS service
   */
  async initialize() {
    try {
      // Check browser support
      if (!Speaker.isSupported()) {
        console.warn('[TTSService] Speech synthesis not supported');
        return false;
      }

      // Load voices
      const voices = await this.speaker.getVoices();
      console.log(`[TTSService] Loaded ${voices.length} voices`);

      // Select default voice if specified
      if (this.options.preferredVoice) {
        const voice = voices.find(v => 
          v.name.toLowerCase().includes(this.options.preferredVoice.toLowerCase())
        );
        if (voice) {
          this.speaker.voice = voice;
          console.log(`[TTSService] Using voice: ${voice.name}`);
        }
      }

      this.initialized = true;
      console.log('[TTSService] ✅ Initialized successfully');
      return true;

    } catch (error) {
      console.error('[TTSService] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Speak command confirmation
   */
  async confirmCommand(intentResult, customMessage = null) {
    if (!this.initialized || !this.speaker.enabled) return false;
    
    try {
      await this.confirmations.confirm(intentResult, customMessage);
      return true;
    } catch (error) {
      console.error('[TTSService] Failed to confirm command:', error);
      return false;
    }
  }

  /**
   * Speak result message
   */
  async speakResult(message, isError = false) {
    if (!this.initialized || !this.speaker.enabled) return false;

    try {
      if (isError) {
        await this.confirmations.error(message);
      } else {
        await this.confirmations.success(message);
      }
      return true;
    } catch (error) {
      console.error('[TTSService] Failed to speak result:', error);
      return false;
    }
  }

  /**
   * Read page content
   */
  async readContent(text, options = {}) {
    if (!this.initialized || !this.speaker.enabled) return false;

    try {
      return await this.reader.read(text, options);
    } catch (error) {
      console.error('[TTSService] Failed to read content:', error);
      return false;
    }
  }

  /**
   * Enable/disable TTS
   */
  setEnabled(enabled) {
    this.speaker.setEnabled(enabled);
    console.log(`[TTSService] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Update TTS settings
   */
  updateSettings(settings) {
    this.speaker.updateSettings(settings);
    console.log('[TTSService] Settings updated:', settings);
  }

  /**
   * Stop all speech
   */
  stop() {
    this.speaker.stop();
    this.reader.stop();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      supported: Speaker.isSupported(),
      speaker: this.speaker.getStatus(),
      reader: this.reader.getStatus()
    };
  }

  /**
   * Get available voices
   */
  async getVoices() {
    return await this.speaker.getVoices();
  }
}

/**
 * Create and initialize TTS service
 */
export async function createTTSService(options = {}) {
  const service = new TTSService(options);
  await service.initialize();
  return service;
}

/**
 * Quick speak function for simple use cases
 */
export async function speak(text, options = {}) {
  if (!Speaker.isSupported()) {
    console.warn('[TTS] Speech synthesis not supported');
    return false;
  }

  const speaker = new Speaker(options);
  return await speaker.speak(text, options);
}

// Named exports for direct module access
export { Speaker, Confirmations, Reader };

// Default export
export default TTSService;