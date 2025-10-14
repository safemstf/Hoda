const { validateTTSInput, validateTTSResult } = require('./formats');
const speaker = require('./speaker');

async function readText(input) {
  // Input validated by caller, but validate again for safety
  validateTTSInput(input);

  try {
    const result = await speaker.synthesize(input.text, {
      voice: input.voice,
      language: input.language,
      ...(input.options || {})
    });

    const ttsResult = {
      success: !!result.success,
      audioUrl: result.audioUrl,
      meta: result.meta
    };

    validateTTSResult(ttsResult);
    return ttsResult;
  } catch (err) {
    return {
      success: false,
      error: String(err)
    };
  }
}

module.exports = { readText };
