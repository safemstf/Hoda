const { extractSections } = require('../dom-extractor');

let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (err) {
  console.warn('jsdom not installed — skipping DOM extractor test. To run this test, install jsdom as a dev dependency.');
}

function testSimpleExtraction() {
  if (!JSDOM) return;
  const html = `
    <html><body>
      <article>
        <h1>Title Here</h1>
        <p>First paragraph.</p>
        <p>Second paragraph.</p>
      </article>
    </body></html>`;

  const dom = new JSDOM(html);
  const sections = extractSections(dom.window.document);
  if (!Array.isArray(sections)) throw new Error('Sections not array');
  if (sections.length < 3) throw new Error('Expected at least 3 sections');
}

testSimpleExtraction();
