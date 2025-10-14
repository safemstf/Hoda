// Confirmation phrase generator and TTS helper
// Note: formats.js is an ES module; this helper keeps payloads compatible
// with the schema described in services/webllm/src/formats.js without importing it.
class Confirmations {
  constructor(speaker) {
    this.speaker = speaker;
  }

  // Generate a short confirmation phrase and speak it.
  // action: string, detail: optional string
  async confirm(action, detail) {
    const short = this._template(action, detail);

    const payload = {
      text: short,
      action,
      success: true,
      intent: { intent: action, slots: detail ? { detail } : {}, confidence: 0.9 },
      confidence: 0.9,
      requiresConfirmation: false
    };

    // Validate shape roughly (imported schema is descriptive only)
    // Speak and return payload after speaking completes (or simulated complete)
    try {
      await this.speaker.speak(short);
    } catch (err) {
      // On speak error, return failure payload
      return Object.assign({}, payload, { success: false, text: 'Error speaking' });
    }

    return payload;
  }

  _template(action, detail) {
    // Keep confirmations short: map common actions to ≤3 words.
    const map = {
      navigate: 'Navigated',
      scroll: 'Scrolled',
      open: 'Opened',
      submit: 'Submitted',
      save: 'Saved',
      error: 'Error'
    };

    const base = map[action] || action;
    if (!detail) return base;

    // If detail is short, append a single short word
    const shortDetail = String(detail).split(/[\s,]+/).slice(0,3).join(' ');
    return `${base} ${shortDetail}`;
  }
}

module.exports = Confirmations;
