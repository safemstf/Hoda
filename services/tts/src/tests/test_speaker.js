const Speaker = require('../speaker');

// Mock chrome.tts in Node for testing
global.chrome = {
  tts: {
    speak(text, opts, cb) {
      // simulate async speak with small timeout
      setTimeout(() => cb && cb(), 50);
    }
  },
  runtime: {}
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testReplacePolicy() {
  const s = new Speaker();
  s.policy = 'replace';

  // Start long speak, then immediately call speak again which should replace
  const p1 = s.speak('first utterance that is long', { rate: 1 });
  const p2 = s.speak('second utterance should replace', { rate: 1 });

  // p1 should reject or will be resolved before replaced; we only assert p2 resolves
  await p2;
}

async function testQueuePolicy() {
  const s = new Speaker();
  s.policy = 'queue';

  const results = [];
  s.speak('one', {}).then(() => results.push('one'));
  s.speak('two', {}).then(() => results.push('two'));
  s.speak('three', {}).then(() => results.push('three'));

  // wait for queue to process
  await sleep(500);
  if (results.length !== 3) throw new Error('Queue did not process all items: ' + results);
}

async function testRejectPolicy() {
  const s = new Speaker();
  s.policy = 'reject';

  const p1 = s.speak('hello');
  try {
    await s.speak('will reject');
    throw new Error('Expected reject');
  } catch (err) {
    // expected
  }
  await p1;
}

(async function run() {
  await testReplacePolicy();
  await testQueuePolicy();
  await testRejectPolicy();
})();
