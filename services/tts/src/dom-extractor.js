// DOM-to-sections extractor for readPageSemantic
// Accepts a Document or Element and returns an array of sections
// { role: 'headline'|'byline'|'paragraph', text }

function extractSections(root) {
  if (!root) return [];

  // If a string was passed, return single paragraph
  if (typeof root === 'string') return [{ role: 'paragraph', text: root.trim() }];

  // Query common article selectors in order
  const sections = [];

  // Headline
  const headline = root.querySelector && (root.querySelector('h1') || root.querySelector('header h1'));
  if (headline && headline.textContent) sections.push({ role: 'headline', text: headline.textContent.trim() });

  // Byline
  const byline = root.querySelector && (root.querySelector('.byline') || root.querySelector('header .byline') || root.querySelector('meta[name="author"]'));
  if (byline) {
    const txt = byline.textContent ? byline.textContent.trim() : (byline.getAttribute && byline.getAttribute('content')) || '';
    if (txt) sections.push({ role: 'byline', text: txt });
  }

  // Main article paragraphs
  const article = root.querySelector && (root.querySelector('article') || root.querySelector('main') || root.body);
  if (article && article.querySelectorAll) {
    const paras = article.querySelectorAll('p');
    paras.forEach(p => {
      const t = p.textContent && p.textContent.trim();
      if (t) sections.push({ role: 'paragraph', text: t });
    });
  }

  // Fallback: if no sections found, try to capture textContent of root
  if (sections.length === 0 && root.textContent) {
    const txt = root.textContent.trim();
    if (txt) sections.push({ role: 'paragraph', text: txt });
  }

  return sections;
}

// Export using ES6 module syntax for consistency with other source files
// This allows the test file to use ES6 import syntax
export { extractSections };
