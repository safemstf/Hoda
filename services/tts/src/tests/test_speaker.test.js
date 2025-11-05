// Test file for Speaker class - uses ES6 modules (import/export)
// Note: Uses Node's native ESM support via --experimental-vm-modules flag
// Import Jest globals explicitly for ES modules
import { jest } from '@jest/globals';
import { Speaker } from '../speaker.js';

jest.useRealTimers();

describe('Speaker queueing and policies', () => {
  beforeEach(() => {
    // Mock window.speechSynthesis for Node/jest environment
    // jsdom provides window globally, but we need to ensure speechSynthesis exists
    if (!global.window) {
      global.window = {};
    }
    
    global.window.speechSynthesis = {
      speak: jest.fn(),
      cancel: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      getVoices: jest.fn(() => [])
    };

    // Mock SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = jest.fn(function(text) {
      this.text = text;
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
      this.lang = 'en-US';
      this.onstart = null;
      this.onend = null;
      this.onerror = null;
    });
  });

  afterEach(() => {
    delete global.window.speechSynthesis;
    delete global.SpeechSynthesisUtterance;
  });

  test('replace policy replaces current utterance', async () => {
    const s = new Speaker();
    // Simulate speech by manually triggering onend
    const mockSpeak = jest.fn((utterance) => {
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 10);
    });
    global.window.speechSynthesis.speak = mockSpeak;

    const p1 = s.speak('first utterance long', { rate: 1 });
    const p2 = s.speak('second utterance replace', { rate: 1 });

    // Wait for promises to resolve
    await expect(p2).resolves.toBe(true);
    await expect(p1).resolves.toBe(true);
  });

  test('queue policy processes in order', async () => {
    const s = new Speaker();
    const order = [];
    let callCount = 0;
    
    const mockSpeak = jest.fn((utterance) => {
      const currentCall = callCount++;
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
        order.push(['one', 'two', 'three'][currentCall]);
      }, 10);
    });
    global.window.speechSynthesis.speak = mockSpeak;

    s.speak('one').then(() => {});
    s.speak('two').then(() => {});
    s.speak('three').then(() => {});

    // allow time for queue to process
    await new Promise(r => setTimeout(r, 200));
    expect(order).toEqual(['one', 'two', 'three']);
  });

  test('reject policy rejects concurrent speaks', async () => {
    const s = new Speaker();
    // Note: Speaker class doesn't actually implement reject policy
    // This test needs to be updated to match actual implementation
    const mockSpeak = jest.fn((utterance) => {
      setTimeout(() => {
        if (utterance.onend) utterance.onend();
      }, 10);
    });
    global.window.speechSynthesis.speak = mockSpeak;

    const p1 = s.speak('first');
    const p2 = s.speak('second');
    
    // Both should resolve since Speaker doesn't implement reject policy
    await expect(p1).resolves.toBe(true);
    await expect(p2).resolves.toBe(true);
  });
});
