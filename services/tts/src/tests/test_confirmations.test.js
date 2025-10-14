const Confirmations = require('../confirmations');
const Speaker = require('../speaker');

describe('Confirmations helper', () => {
  let mockSpeaker;
  beforeEach(() => {
    mockSpeaker = new Speaker();
    // mock speak to resolve immediately
    mockSpeaker.speak = jest.fn(() => Promise.resolve());
  });

  test('returns payload with expected fields', async () => {
    const c = new Confirmations(mockSpeaker);
    const payload = await c.confirm('navigate', 'down');

    expect(payload).toHaveProperty('text');
    expect(payload).toHaveProperty('action', 'navigate');
    expect(payload).toHaveProperty('success', true);
    expect(payload).toHaveProperty('intent');
    expect(typeof payload.confidence).toBe('number');
    expect(payload.requiresConfirmation).toBe(false);
  });

  test('handles speak errors and returns failure payload', async () => {
    mockSpeaker.speak = jest.fn(() => Promise.reject(new Error('synth fail')));
    const c = new Confirmations(mockSpeaker);
    const payload = await c.confirm('open', 'file');
    expect(payload.success).toBe(false);
    expect(payload.text).toMatch(/Error/i);
  });
});
