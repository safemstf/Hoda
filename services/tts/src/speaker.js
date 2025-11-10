// services/tts/speaker.js - Core TTS functionality
/**
 * Speaker - Core Text-to-Speech service
 * Wraps Web Speech API's SpeechSynthesis with speech recognition coordination
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

    // Speech recognition integration
    this.speechRecognitionService = null;
    this.postSpeechDelay = options.postSpeechDelay || 500; // ms to wait after speaking

    console.log('[Speaker] Initialized', {
      enabled: this.enabled,
      volume: this.volume,
      rate: this.rate,
      postSpeechDelay: this.postSpeechDelay
    });
  }

  /**
   * Link to speech recognition service for coordination
   * Call this from your main app after both services are initialized
   */
  setSpeechRecognitionService(service) {
    this.speechRecognitionService = service;
    console.log('[Speaker] Linked to speech recognition service');
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
 * Get voices organized by category (male, female, accent)
 */
  async getVoicesByCategory() {
    const voices = await this.getVoices();

    return {
      female: voices.filter(v =>
        v.lang.startsWith('en-') &&
        (v.name.includes('Female') ||
          v.name.includes('Zira') ||
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Moira') ||
          v.name.includes('Tessa') ||
          v.name.includes('Victoria'))
      ),
      male: voices.filter(v =>
        v.lang.startsWith('en-') &&
        (v.name.includes('Male') ||
          v.name.includes('David') ||
          v.name.includes('Alex') ||
          v.name.includes('Mark') ||
          v.name.includes('Daniel'))
      ),
      all: voices.filter(v => v.lang.startsWith('en-'))
    };
  }

  /**
   * Find voice by name or partial match
   */
  findVoiceByName(voiceName) {
    const voices = window.speechSynthesis.getVoices();

    // Exact match first
    let voice = voices.find(v => v.name === voiceName);
    if (voice) return voice;

    // Partial match
    voice = voices.find(v => v.name.includes(voiceName));
    return voice || null;
  }

  /**
   * Select the best available voice for English
   * Prioritizes high-quality voices
   */
  async selectBestVoice() {
    const voices = await this.getVoices();

    // Priority list of high-quality voices
    const preferredVoices = [
      'Google US English',           // Google Chrome (high quality)
      'Google UK English Female',    // Google Chrome
      'Microsoft Zira Desktop',      // Windows (natural)
      'Microsoft David Desktop',     // Windows
      'Samantha',                    // macOS (very natural)
      'Alex',                        // macOS (natural)
      'Google UK English Male',
      'Microsoft Mark',
      'Karen',                       // macOS
      'Moira',                       // macOS
      'Tessa'                        // macOS
    ];

    // Try to find preferred voice
    for (const preferred of preferredVoices) {
      const voice = voices.find(v => v.name.includes(preferred));
      if (voice) {
        console.log('[Speaker] Selected voice:', voice.name);
        return voice;
      }
    }

    // Fallback: Find any high-quality English voice
    const englishVoices = voices.filter(v => v.lang.startsWith('en-'));

    // Prefer non-default voices (usually better quality)
    const nonDefaultEnglish = englishVoices.find(v => !v.default && !v.localService);
    if (nonDefaultEnglish) {
      console.log('[Speaker] Using fallback voice:', nonDefaultEnglish.name);
      return nonDefaultEnglish;
    }

    // Last resort: any English voice
    if (englishVoices.length > 0) {
      console.log('[Speaker] Using default English voice:', englishVoices[0].name);
      return englishVoices[0];
    }

    console.log('[Speaker] No English voice found, using system default');
    return null;
  }

  /**
   * Speak text with options
   * Automatically pauses speech recognition to prevent echo
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

    // ✅ NEW: If already speaking, stop current speech first
    if (this.isSpeaking) {
      console.log('[Speaker] ⚠️ Already speaking, stopping current speech');
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }

    // ✅ STEP 1: Pause speech recognition before speaking
    this.pauseSpeechRecognition();

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
        console.log('[Speaker] 🔊 Speaking:', text.substring(0, 50) + '...');
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        console.log('[Speaker] ✅ Finished speaking');

        // ✅ STEP 2: Wait a moment, then resume speech recognition
        setTimeout(() => {
          this.resumeSpeechRecognition();
          resolve(true);
        }, this.postSpeechDelay);
      };

      utterance.onerror = (event) => {
        console.error('[Speaker] ❌ Error:', event.error);
        this.isSpeaking = false;
        this.currentUtterance = null;

        // ✅ STEP 3: Resume even on error
        this.resumeSpeechRecognition();
        reject(event.error);
      };

      // Speak
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Pause speech recognition service
   * Called automatically before speaking
   */
  pauseSpeechRecognition() {
    if (this.speechRecognitionService) {
      console.log('[Speaker] ⏸️ Pausing speech recognition');
      this.speechRecognitionService.pauseForTTS();
    }
  }

  /**
   * Resume speech recognition service
   * Called automatically after speaking (with delay)
   */
  resumeSpeechRecognition() {
    if (this.speechRecognitionService) {
      console.log('[Speaker] ▶️ Resuming speech recognition');
      this.speechRecognitionService.resumeAfterTTS();
    }
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

      // Resume speech recognition if stopped manually
      this.resumeSpeechRecognition();
    }
  }

  /**
   * Pause speech (NOT speech recognition)
   */
  pause() {
    if (Speaker.isSupported() && this.isSpeaking) {
      window.speechSynthesis.pause();
      console.log('[Speaker] ⏸️ Paused TTS');
    }
  }

  /**
   * Resume speech (NOT speech recognition)
   */
  resume() {
    if (Speaker.isSupported()) {
      window.speechSynthesis.resume();
      console.log('[Speaker] ▶️ Resumed TTS');
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
    if (settings.postSpeechDelay !== undefined) this.postSpeechDelay = settings.postSpeechDelay;

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
      pitch: this.pitch,
      hasRecognitionService: !!this.speechRecognitionService
    };
  }
}