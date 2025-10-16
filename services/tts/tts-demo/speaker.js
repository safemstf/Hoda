// Minimal Speaker abstraction
// In browser: uses window.speechSynthesis or chrome.tts where available.
// In Node: falls back to a simulated implementation that logs utterances and resolves.

class Speaker {
  constructor() {
    this.rate = 1.0;
    this.voice = null;
    this._isSpeaking = false;
    this._currentPromise = null;
    // queue holds pending {text, opts, resolve, reject}
    this._queue = [];
    // policy: 'replace' (default) | 'queue' | 'reject'
    this.policy = 'replace';
  }

  // speak enqueues or handles interruption based on the current policy.
  // opts may include: { rate, voice, policy } where policy overrides speaker.policy for this call.
  speak(text, opts = {}) {
    const rate = opts.rate || this.rate;
    const voice = opts.voice || this.voice;
    const callPolicy = opts.policy || this.policy;

    return new Promise((resolve, reject) => {
      const item = { text, opts: { rate, voice }, resolve, reject };

      if (!this._isSpeaking) {
        // No active speech — start immediately
        this._startItem(item);
        return;
      }

      // There is an active speech
      if (callPolicy === 'reject') {
        return reject(new Error('Already speaking'));
      }

      if (callPolicy === 'replace') {
        // Stop current and replace with new
        this.stop();
        // clear queue and start the new item
        this._queue = [];
        this._startItem(item);
        return;
      }

      // Default: queue
      this._queue.push(item);
    });
  }

  _speakSimulated(text, opts) {
    this._isSpeaking = true;
    const durationMs = Math.max(300, Math.min(8000, text.length * 50 / opts.rate));

    this._currentPromise = new Promise((resolve) => {
      console.log(`[TTS] (simulated) speaking: "${text}" rate=${opts.rate} voice=${opts.voice || 'default'}`);
      this._simTimeout = setTimeout(() => {
        this._isSpeaking = false;
        this._currentPromise = null;
        resolve();
        // After a simulated utterance completes, process next item from queue
        this._dequeueNext();
      }, durationMs);
    });

    return this._currentPromise;
  }

  _speakBrowser(text, opts) {
    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = opts.rate;
        if (opts.voice) utterance.voice = opts.voice;

        utterance.onend = () => {
          this._isSpeaking = false;
          resolve();
        };

        utterance.onerror = (e) => {
          this._isSpeaking = false;
          reject(e || new Error('speechSynthesis error'));
        };

        this._isSpeaking = true;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this._isSpeaking = false;
        reject(err);
      }
    });
  }

  _speakChromeTts(text, opts) {
    // chrome.tts.speak is only available in extension context (background/page with proper manifest permissions)
    return new Promise((resolve, reject) => {
      try {
        const speakOpts = { rate: opts.rate };
        if (opts.voice) speakOpts.voiceName = opts.voice;

        // chrome.tts.speak may accept a callback in some versions
        chrome.tts.speak(text, speakOpts, () => {
          // There's no error parameter; we treat callback as completion.
          // Some implementations provide runtime.lastError on failure.
          if (chrome.runtime && chrome.runtime.lastError) {
            this._isSpeaking = false;
            reject(new Error(chrome.runtime.lastError.message));
            // process next queued item even if there was an error
            this._dequeueNext();
            return;
          }

          this._isSpeaking = false;
          resolve();
          // After completion, start the next queued item
          this._dequeueNext();
        });

        this._isSpeaking = true;
      } catch (err) {
        this._isSpeaking = false;
        reject(err);
      }
    });
  }

  pause() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.pause();
      return;
    }

    if (this._isSpeaking && this._simTimeout) {
      clearTimeout(this._simTimeout);
      this._isSpeaking = false;
      console.log('[TTS] paused (simulated)');
    }
  }

  resume() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.resume();
      return;
    }

    console.log('[TTS] resume called (simulated) — no-op');
  }

  stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      return;
    }

    if (this._isSpeaking && this._simTimeout) {
      clearTimeout(this._simTimeout);
      this._isSpeaking = false;
      console.log('[TTS] stopped (simulated)');
      // After stopping, start next queued item if any
      this._dequeueNext();
    }
  }

  setRate(rate) {
    this.rate = Number(rate) || 1.0;
  }

  setVoice(voice) {
    this.voice = voice;
  }

  isSpeaking() {
    return !!this._isSpeaking;
  }

  _startItem(item) {
    // item: { text, opts, resolve, reject }
    const { text, opts, resolve, reject } = item;
    // Choose runtime method
    const call = (typeof chrome !== 'undefined' && chrome && chrome.tts && typeof chrome.tts.speak === 'function')
      ? this._speakChromeTts.bind(this)
      : (typeof window !== 'undefined' && window.speechSynthesis)
        ? this._speakBrowser.bind(this)
        : this._speakSimulated.bind(this);

    call(text, opts).then(() => resolve()).catch((err) => reject(err));
  }

  _dequeueNext() {
    if (this._isSpeaking) return; // still speaking
    const next = this._queue.shift();
    if (next) {
      this._startItem(next);
    }
  }
}

module.exports = Speaker;
