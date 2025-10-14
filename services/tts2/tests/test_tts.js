const assert = require('assert');
const tts = require('..');

(async function test() {
  // Happy path
  const res = await tts.speak({ text: 'Hello world', voice: 'test-voice' });
  assert.equal(typeof res.success, 'boolean');
  assert.equal(res.success, true);
  assert.equal(typeof res.audioUrl, 'string');
  assert.ok(res.meta && typeof res.meta.duration === 'number');

  // Edge: empty text should throw validation error
  let threw = false;
  try {
    await tts.speak({ text: '   ' });
  } catch (err) {
    threw = true;
    assert.ok(/Invalid TTS input/.test(err.message));
  }
  assert.equal(threw, true);
})();
