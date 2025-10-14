/**
 * Natural language variation tests
 * Tests >85% accuracy target with multiple phrasings
 * Run with: node tests/variations.test.js
 * Author: syedhaliz
 */

import { createService } from '../src/index.js';

// Test variations - 10+ per category
const testVariations = [
  // Navigate - 12 variations
  { category: 'navigate', text: 'scroll down', expected: 'navigate' },
  { category: 'navigate', text: 'go down', expected: 'navigate' },
  { category: 'navigate', text: 'move page down', expected: 'navigate' },
  { category: 'navigate', text: 'page down', expected: 'navigate' },
  { category: 'navigate', text: 'scroll up', expected: 'navigate' },
  { category: 'navigate', text: 'go up', expected: 'navigate' },
  { category: 'navigate', text: 'move up', expected: 'navigate' },
  { category: 'navigate', text: 'go back', expected: 'navigate' },
  { category: 'navigate', text: 'go backwards', expected: 'navigate' },
  { category: 'navigate', text: 'previous page', expected: 'navigate' },
  { category: 'navigate', text: 'scroll to top', expected: 'navigate' },
  { category: 'navigate', text: 'go to bottom', expected: 'navigate' },

  // Read - 10 variations
  { category: 'read', text: 'read this page', expected: 'read' },
  { category: 'read', text: 'read to me', expected: 'read' },
  { category: 'read', text: 'what does this say', expected: 'read' },
  { category: 'read', text: 'read it', expected: 'read' },
  { category: 'read', text: 'start reading', expected: 'read' },
  { category: 'read', text: 'stop reading', expected: 'read' },
  { category: 'read', text: 'pause', expected: 'read' },
  { category: 'read', text: 'pause reading', expected: 'read' },
  { category: 'read', text: 'resume', expected: 'read' },
  { category: 'read', text: 'continue reading', expected: 'read' },

  // Find content - 12 variations
  { category: 'find_content', text: 'find login button', expected: 'find_content' },
  { category: 'find_content', text: 'where is sign in', expected: 'find_content' },
  { category: 'find_content', text: 'locate login', expected: 'find_content' },
  { category: 'find_content', text: 'find me articles about cooking', expected: 'find_content' },
  { category: 'find_content', text: 'search for contact', expected: 'find_content' },
  { category: 'find_content', text: 'look for the menu', expected: 'find_content' },
  { category: 'find_content', text: 'where\'s the search box', expected: 'find_content' },
  { category: 'find_content', text: 'find submit button', expected: 'find_content' },
  { category: 'find_content', text: 'locate the navigation', expected: 'find_content' },
  { category: 'find_content', text: 'where is home link', expected: 'find_content' },
  { category: 'find_content', text: 'search for news', expected: 'find_content' },
  { category: 'find_content', text: 'find products', expected: 'find_content' },

  // Zoom - 10 variations
  { category: 'zoom', text: 'zoom in', expected: 'zoom' },
  { category: 'zoom', text: 'zoom out', expected: 'zoom' },
  { category: 'zoom', text: 'make text bigger', expected: 'zoom' },
  { category: 'zoom', text: 'increase size', expected: 'zoom' },
  { category: 'zoom', text: 'make it larger', expected: 'zoom' },
  { category: 'zoom', text: 'decrease size', expected: 'zoom' },
  { category: 'zoom', text: 'make smaller', expected: 'zoom' },
  { category: 'zoom', text: 'reset zoom', expected: 'zoom' },
  { category: 'zoom', text: 'normal size', expected: 'zoom' },
  { category: 'zoom', text: 'enlarge text', expected: 'zoom' },

  // Form action - 10 variations
  { category: 'form_action', text: 'submit form', expected: 'form_action' },
  { category: 'form_action', text: 'submit the form', expected: 'form_action' },
  { category: 'form_action', text: 'send form', expected: 'form_action' },
  { category: 'form_action', text: 'fill in username', expected: 'form_action' },
  { category: 'form_action', text: 'enter my email', expected: 'form_action' },
  { category: 'form_action', text: 'fill email field', expected: 'form_action' },
  { category: 'form_action', text: 'type in password', expected: 'form_action' },
  { category: 'form_action', text: 'select option', expected: 'form_action' },
  { category: 'form_action', text: 'choose from dropdown', expected: 'form_action' },
  { category: 'form_action', text: 'check the box', expected: 'form_action' },

  // Link action - 10 variations
  { category: 'link_action', text: 'list all links', expected: 'link_action' },
  { category: 'link_action', text: 'show me links', expected: 'link_action' },
  { category: 'link_action', text: 'what links are here', expected: 'link_action' },
  { category: 'link_action', text: 'open first link', expected: 'link_action' },
  { category: 'link_action', text: 'click on about', expected: 'link_action' },
  { category: 'link_action', text: 'go to home page', expected: 'link_action' },
  { category: 'link_action', text: 'open contact link', expected: 'link_action' },
  { category: 'link_action', text: 'follow the link', expected: 'link_action' },
  { category: 'link_action', text: 'click next', expected: 'link_action' },
  { category: 'link_action', text: 'navigate to home', expected: 'link_action' },

  // Help - 10 variations
  { category: 'help', text: 'help', expected: 'help' },
  { category: 'help', text: 'help me', expected: 'help' },
  { category: 'help', text: 'what can you do', expected: 'help' },
  { category: 'help', text: 'list commands', expected: 'help' },
  { category: 'help', text: 'show me commands', expected: 'help' },
  { category: 'help', text: 'what are my options', expected: 'help' },
  { category: 'help', text: 'how do I use this', expected: 'help' },
  { category: 'help', text: 'what can I say', expected: 'help' },
  { category: 'help', text: 'show help', expected: 'help' },
  { category: 'help', text: 'instructions', expected: 'help' }
];

async function runVariationTests() {
  console.log('🧪 Natural Language Variation Tests\n');
  console.log('Target: >85% accuracy');
  console.log('Total tests:', testVariations.length);
  console.log('='.repeat(60));

  try {
    // Initialize service
    console.log('\nInitializing WebLLM service...');
    const service = await createService({
      privacy: { localOnly: true }
    });
    console.log('✓ Service ready\n');

    let passed = 0;
    let failed = 0;
    const failures = [];

    // Run tests
    for (let i = 0; i < testVariations.length; i++) {
      const test = testVariations[i];

      try {
        const result = await service.processCommand({
          text: test.text,
          confidence: 0.95
        });

        const gotIntent = result.intent.intent;
        const isPass = gotIntent === test.expected;

        if (isPass) {
          passed++;
          process.stdout.write('.');
        } else {
          failed++;
          process.stdout.write('✗');
          failures.push({
            text: test.text,
            expected: test.expected,
            got: gotIntent,
            confidence: result.confidence
          });
        }

        // Newline every 10 tests
        if ((i + 1) % 10 === 0) {
          process.stdout.write(` ${i + 1}/${testVariations.length}\n`);
        }

      } catch (error) {
        failed++;
        process.stdout.write('E');
        failures.push({
          text: test.text,
          expected: test.expected,
          error: error.message
        });
      }
    }

    // Calculate stats
    console.log('\n\n' + '='.repeat(60));
    const total = testVariations.length;
    const accuracy = ((passed / total) * 100).toFixed(1);
    const targetMet = accuracy >= 85;

    console.log(`\n📊 Results:`);
    console.log(`  Total:    ${total}`);
    console.log(`  Passed:   ${passed}`);
    console.log(`  Failed:   ${failed}`);
    console.log(`  Accuracy: ${accuracy}%`);
    console.log(`  Target:   85%`);
    console.log(`  Status:   ${targetMet ? '✅ PASS' : '❌ FAIL'}`);

    // Show failures
    if (failures.length > 0) {
      console.log(`\n❌ Failed Tests (${failures.length}):`);
      failures.forEach((f, i) => {
        console.log(`\n  ${i + 1}. "${f.text}"`);
        console.log(`     Expected: ${f.expected}`);
        if (f.error) {
          console.log(`     Error: ${f.error}`);
        } else {
          console.log(`     Got: ${f.got} (confidence: ${f.confidence.toFixed(2)})`);
        }
      });
    }

    console.log('');
    process.exit(targetMet ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runVariationTests().catch(console.error);
}

export { runVariationTests, testVariations };
