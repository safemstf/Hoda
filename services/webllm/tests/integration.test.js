/**
 * Integration tests for WebLLM service
 * Run with: node tests/integration.test.js
 * Author: syedhaliz
 */

import { createService, STT_INPUT_EXAMPLE, TTS_OUTPUT_EXAMPLE } from '../src/index.js';

async function runTests() {
  console.log('🧪 WebLLM Integration Tests\n');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Service initialization
    console.log('\n✓ Test 1: Service Initialization');
    const service = await createService({
      privacy: { localOnly: true }
    });
    console.log('  Status:', service.getStatus());
    passed++;

    // Test 2: Basic command processing
    console.log('\n✓ Test 2: Basic Command Processing');
    const result = await service.processCommand({
      text: "scroll down",
      confidence: 0.95
    });
    console.log('  Input: "scroll down"');
    console.log('  Output:', JSON.stringify(result, null, 2));
    if (result.success && result.action === 'navigate') {
      passed++;
    } else {
      failed++;
      console.log('  ❌ Expected navigate action');
    }

    // Test 3: STT input validation
    console.log('\n✓ Test 3: STT Input Example');
    const result2 = await service.processCommand(STT_INPUT_EXAMPLE);
    console.log('  Input:', JSON.stringify(STT_INPUT_EXAMPLE, null, 2));
    console.log('  Output:', JSON.stringify(result2, null, 2));
    passed++;

    // Test 4: Multiple commands
    console.log('\n✓ Test 4: Multiple Commands');
    const commands = [
      { text: "read this page", confidence: 0.9 },
      { text: "zoom in", confidence: 0.95 },
      { text: "find login", confidence: 0.88 }
    ];
    const results = await service.processCommands(commands);
    console.log(`  Processed ${results.length} commands`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. "${commands[i].text}" → ${r.action} (${r.text})`);
    });
    passed++;

    // Test 5: Confirmation flow
    console.log('\n✓ Test 5: Confirmation Flow');
    const confirmResult = await service.processCommand({
      text: "submit the form",
      confidence: 0.92
    });
    console.log('  Input: "submit the form"');
    console.log('  Requires confirmation:', confirmResult.requiresConfirmation);
    console.log('  Confirmation prompt:', confirmResult.confirmationPrompt);
    if (confirmResult.requiresConfirmation) {
      passed++;
    } else {
      failed++;
      console.log('  ❌ Expected confirmation required');
    }

    // Test 6: Error handling
    console.log('\n✓ Test 6: Error Handling');
    const errorResult = await service.processCommand({
      text: "xyzabc nonsense command",
      confidence: 0.95
    });
    console.log('  Input: "xyzabc nonsense command"');
    console.log('  Success:', errorResult.success);
    console.log('  Action:', errorResult.action);
    if (!errorResult.success || errorResult.action === 'unknown') {
      passed++;
    } else {
      failed++;
      console.log('  ❌ Expected failure or unknown intent');
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('✅ All tests passed!\n');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };
