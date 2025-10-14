const { v4: uuidv4 } = require('uuid');

// Simulated speaker: converts text to a fake audio URL and metadata
async function synthesize(text, opts = {}) {
  // Simulate processing time
  await new Promise((r) => setTimeout(r, 10));

  const id = uuidv4();
  const voice = opts.voice || 'default';
  const duration = Math.max(0.5, Math.min(10, text.length / 20));

  return {
    success: true,
    audioUrl: `memory://tts/${id}.wav`,
    meta: {
      id,
      voice,
      duration,
      chars: text.length,
    }
  };
}

module.exports = { synthesize };
