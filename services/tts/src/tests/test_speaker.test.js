const Speaker = require('../speaker');

jest.useRealTimers();

describe('Speaker queueing and policies', () => {
  beforeEach(() => {
    // mock chrome.tts for Node/jest environment
    global.chrome = {
      tts: {
        speak: jest.fn((text, opts, cb) => setTimeout(cb, 20))
      },
      runtime: {}
    };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('replace policy replaces current utterance', async () => {
    const s = new Speaker();
    s.policy = 'replace';

    const p1 = s.speak('first utterance long', { rate: 1 });
    const p2 = s.speak('second utterance replace', { rate: 1 });

    // p2 should resolve
    await expect(p2).resolves.toBeUndefined();
    // Wait a bit to let p1 settle if it wasn't replaced
    await new Promise(r => setTimeout(r, 50));
    await expect(p1).resolves.toBeUndefined();
  });

  test('queue policy processes in order', async () => {
    const s = new Speaker();
    s.policy = 'queue';

    const order = [];
    s.speak('one').then(() => order.push('one'));
    s.speak('two').then(() => order.push('two'));
    s.speak('three').then(() => order.push('three'));

    // allow time for queue to process
    await new Promise(r => setTimeout(r, 200));
    expect(order).toEqual(['one', 'two', 'three']);
  });

  test('reject policy rejects concurrent speaks', async () => {
    const s = new Speaker();
    s.policy = 'reject';

    const p1 = s.speak('first');
    await expect(s.speak('second')).rejects.toThrow('Already speaking');
    await expect(p1).resolves.toBeUndefined();
  });
});
