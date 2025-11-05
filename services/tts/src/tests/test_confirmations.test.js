// Test file for Confirmations class - uses ES6 modules (import/export)
// Note: Uses Node's native ESM support via --experimental-vm-modules flag
// Import Jest globals explicitly for ES modules
import { jest } from '@jest/globals';
import { Confirmations } from '../confirmations.js';
import { Speaker } from '../speaker.js';

describe('Confirmations helper', () => {
  let mockSpeaker;
  beforeEach(() => {
    mockSpeaker = new Speaker();
    // mock speak to resolve immediately
    mockSpeaker.speak = jest.fn(() => Promise.resolve());
  });

  test('speaks confirmation message for navigate intent', async () => {
    const c = new Confirmations(mockSpeaker);
    // confirm() method signature: confirm(intentResult, customMessage)
    // intentResult should be an object with { intent, slots }
    // Use 'direction' slot to match template lookup logic
    const intentResult = { intent: 'navigate', slots: { direction: 'down' } };
    await c.confirm(intentResult);

    // confirm() doesn't return a payload, it just speaks
    expect(mockSpeaker.speak).toHaveBeenCalled();
    expect(mockSpeaker.speak).toHaveBeenCalledWith('Scrolling down', { rate: 1.2 });
  });

  test('handles speak errors gracefully', async () => {
    mockSpeaker.speak = jest.fn(() => Promise.reject(new Error('synth fail')));
    const c = new Confirmations(mockSpeaker);
    const intentResult = { intent: 'open', slots: { action: 'file' } };
    
    // Should not throw - errors are caught and logged
    await expect(c.confirm(intentResult)).resolves.toBeUndefined();
    expect(mockSpeaker.speak).toHaveBeenCalled();
  });
});
