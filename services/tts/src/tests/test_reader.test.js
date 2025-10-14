const Reader = require('../reader');
const Speaker = require('../speaker');

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
