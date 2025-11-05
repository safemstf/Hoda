// Test file for Reader class - uses ES6 modules (import/export)
// Note: Uses Node's native ESM support via --experimental-vm-modules flag
// Import Jest globals explicitly for ES modules
import { jest } from '@jest/globals';
import { Reader } from '../reader.js';
import { Speaker } from '../speaker.js';

describe('Reader.readPageSemantic', () => {
  test('reads array of sections and returns success', async () => {
    const speaker = new Speaker();
    speaker.speak = jest.fn(() => Promise.resolve());
    const reader = new Reader(speaker);

    const sections = [
      { role: 'headline', text: 'My Title' },
      { role: 'byline', text: 'By Author' },
      { role: 'paragraph', text: 'First paragraph.' }
    ];

    const result = await reader.readPageSemantic(sections);
    expect(result).toEqual({ success: true });
    expect(speaker.speak).toHaveBeenCalledTimes(3);
  });

  test('handles speak error and returns failure payload', async () => {
    const speaker = new Speaker();
    speaker.speak = jest.fn(() => Promise.reject(new Error('speak error')));
    const reader = new Reader(speaker);

    const sections = [{ role: 'paragraph', text: 'Text' }];
    const result = await reader.readPageSemantic(sections);
    expect(result).toHaveProperty('success', false);
  });
});
