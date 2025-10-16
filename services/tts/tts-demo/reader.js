// Simple semantic reader
// Accepts either a DOM-like structure (array of sections) or plain string.
// For Node demo, plain strings will be used. In browser, pass DOM-extracted sections.

class Reader {
  constructor(speaker) {
    this.speaker = speaker;
  }

  // readPageSemantic accepts either a string or an array of sections
  // sections: [{ role: 'headline'|'byline'|'paragraph', text: '...' }, ...]
  async readPageSemantic(input) {
    const sections = this._normalize(input);

    for (const sec of sections) {
      const text = this._formatSection(sec);
      // Prepare payload following webllm TTS_OUTPUT_SCHEMA
      const payload = {
        text,
        action: 'read',
        success: true,
        intent: { intent: 'read', slots: { role: sec.role }, confidence: 0.95 },
        confidence: 0.95,
        requiresConfirmation: false
      };

      // Speak each section synchronously to preserve order
      try {
        await this.speaker.speak(text);
      } catch (err) {
        // On error, return failure payload for the section
        return Object.assign({}, payload, { success: false, text: 'Error during read' });
      }
    }

    return { success: true };
  }

  _normalize(input) {
    if (typeof input === 'string') {
      // Split into paragraphs by double newlines
      const paras = input.split(/\n\n+/).map(p => ({ role: 'paragraph', text: p.trim() }));
      return paras.filter(p => p.text);
    }

    if (Array.isArray(input)) {
      return input.map(s => ({ role: s.role || 'paragraph', text: String(s.text || '').trim() })).filter(s => s.text);
    }

    return [];
  }

  _formatSection(sec) {
    if (sec.role === 'headline') return `Headline. ${sec.text}`;
    if (sec.role === 'byline') return `Byline. ${sec.text}`;
    return sec.text;
  }
}

module.exports = Reader;
