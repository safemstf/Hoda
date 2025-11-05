// Test file for DOM extractor - uses ES6 modules (import/export)
// Note: Uses Node's native ESM support via --experimental-vm-modules flag
import { extractSections } from '../dom-extractor.js';

describe('DOM extractor', () => {
  test('extracts headline and paragraphs from article', () => {
    document.body.innerHTML = `
      <article>
        <h1>Title Here</h1>
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
      </article>`;

    const sections = extractSections(document);
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections[0].role).toBe('headline');
  });
});
