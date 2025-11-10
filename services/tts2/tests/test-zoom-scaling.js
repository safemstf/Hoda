/**
 * Zoom and Text Scaling Unit Tests
 * Tests the zoom-scaling.js module
 */

const assert = require('assert');
const {
  ZOOM_CONFIG,
  ZoomStateManager,
  ZoomCommandHandler,
  ZoomFeedback,
  validateZoomInput,
  validateZoomResult
} = require('../zoom-scaling');

console.log('Running zoom-scaling tests...\n');

// ============================================================================
// TEST 1: ZOOM_CONFIG Constants
// ============================================================================
console.log('TEST 1: ZOOM_CONFIG Constants');
try {
  assert.strictEqual(ZOOM_CONFIG.MIN_ZOOM, 0.5);
  assert.strictEqual(ZOOM_CONFIG.MAX_ZOOM, 3.0);
  assert.strictEqual(ZOOM_CONFIG.DEFAULT_ZOOM, 1.0);
  assert.strictEqual(ZOOM_CONFIG.ZOOM_STEP, 0.1);
  assert.strictEqual(ZOOM_CONFIG.MIN_TEXT_SCALE, 0.75);
  assert.strictEqual(ZOOM_CONFIG.MAX_TEXT_SCALE, 2.0);
  console.log('✓ All constants valid\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 2: ZoomStateManager Initialization
// ============================================================================
console.log('TEST 2: ZoomStateManager Initialization');
try {
  const manager = new ZoomStateManager();
  assert.strictEqual(manager.getZoom(), 1.0);
  assert.strictEqual(manager.getTextScale(), 1.0);
  assert.ok(manager.id);
  console.log('✓ Manager initialized with default values\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 3: Set Zoom with Validation
// ============================================================================
console.log('TEST 3: Set Zoom with Validation');
try {
  const manager = new ZoomStateManager();

  // Valid zoom
  const result1 = manager.setZoom(1.5);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.zoom, 1.5);
  assert.strictEqual(manager.getZoom(), 1.5);

  // Clamping: too high
  const result2 = manager.setZoom(5.0);
  assert.strictEqual(result2.zoom, 3.0);
  assert.strictEqual(manager.getZoom(), 3.0);

  // Clamping: too low
  const result3 = manager.setZoom(0.1);
  assert.strictEqual(result3.zoom, 0.5);
  assert.strictEqual(manager.getZoom(), 0.5);

  // Invalid input
  const result4 = manager.setZoom('invalid');
  assert.strictEqual(result4.success, false);
  assert.ok(result4.error.includes('Invalid'));

  console.log('✓ Zoom validation and clamping works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 4: Increment/Decrement Zoom
// ============================================================================
console.log('TEST 4: Increment/Decrement Zoom');
try {
  const manager = new ZoomStateManager();

  // Increment
  manager.incrementZoom();
  assert.strictEqual(manager.getZoom(), 1.1);

  // Increment again
  manager.incrementZoom();
  assert.strictEqual(manager.getZoom(), 1.2);

  // Decrement
  manager.decrementZoom();
  assert.strictEqual(manager.getZoom(), 1.1);

  // Decrement to min
  manager.setZoom(0.5);
  manager.decrementZoom();
  assert.strictEqual(manager.getZoom(), 0.5); // Should clamp to min

  console.log('✓ Zoom increment/decrement works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 5: Set Text Scale
// ============================================================================
console.log('TEST 5: Set Text Scale');
try {
  const manager = new ZoomStateManager();

  // Valid scale
  const result1 = manager.setTextScale(1.25);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.scale, 1.25);
  assert.strictEqual(manager.getTextScale(), 1.25);

  // Clamping: too high
  const result2 = manager.setTextScale(3.0);
  assert.strictEqual(result2.scale, 2.0);

  // Clamping: too low
  const result3 = manager.setTextScale(0.5);
  assert.strictEqual(result3.scale, 0.75);

  console.log('✓ Text scale validation and clamping works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 6: Increment/Decrement Text Scale
// ============================================================================
console.log('TEST 6: Increment/Decrement Text Scale');
try {
  const manager = new ZoomStateManager();

  manager.incrementTextScale();
  const afterIncrement = manager.getTextScale();
  assert.ok(afterIncrement > 1.0);

  manager.decrementTextScale();
  const afterDecrement = manager.getTextScale();
  assert.strictEqual(afterDecrement, 1.0);

  console.log('✓ Text scale increment/decrement works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 7: Reset All
// ============================================================================
console.log('TEST 7: Reset All');
try {
  const manager = new ZoomStateManager();

  manager.setZoom(2.0);
  manager.setTextScale(1.5);

  const result = manager.reset();
  assert.strictEqual(result.success, true);
  assert.strictEqual(manager.getZoom(), 1.0);
  assert.strictEqual(manager.getTextScale(), 1.0);
  assert.ok(result.message.includes('reset'));

  console.log('✓ Reset works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 8: Get State
// ============================================================================
console.log('TEST 8: Get State');
try {
  const manager = new ZoomStateManager();
  manager.setZoom(1.5);
  manager.setTextScale(1.25);

  const state = manager.getState();
  assert.strictEqual(state.zoom, 1.5);
  assert.strictEqual(state.textScale, 1.25);
  assert.strictEqual(state.zoomPercent, '150%');
  assert.strictEqual(state.textScalePercent, '125%');
  assert.ok(state.id);

  console.log('✓ Get state works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 9: Load State
// ============================================================================
console.log('TEST 9: Load State');
try {
  const manager = new ZoomStateManager();

  manager.loadState({
    zoom: 1.8,
    textScale: 1.4
  });

  assert.strictEqual(manager.getZoom(), 1.8);
  assert.strictEqual(manager.getTextScale(), 1.4);

  // Test clamping during load
  manager.loadState({
    zoom: 5.0,
    textScale: 0.5
  });

  assert.strictEqual(manager.getZoom(), 3.0); // Clamped to max
  assert.strictEqual(manager.getTextScale(), 0.75); // Clamped to min

  console.log('✓ Load state works with clamping\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 10: ZoomCommandHandler - Zoom Commands
// ============================================================================
console.log('TEST 10: ZoomCommandHandler - Zoom Commands');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);

  // Zoom in
  const result1 = handler.handleCommand('zoom-in');
  assert.strictEqual(result1.success, true);
  assert.ok(result1.message.includes('110'));

  // Zoom out
  const result2 = handler.handleCommand('zoom out');
  assert.strictEqual(result2.success, true);
  assert.ok(result2.message.includes('100'));

  // Reset zoom
  handler.handleCommand('zoom-in');
  const result3 = handler.handleCommand('reset-zoom');
  assert.strictEqual(result3.success, true);
  assert.strictEqual(manager.getZoom(), 1.0);

  console.log('✓ Zoom commands work\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 11: ZoomCommandHandler - Text Commands
// ============================================================================
console.log('TEST 11: ZoomCommandHandler - Text Commands');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);

  // Text larger
  const result1 = handler.handleCommand('text-larger');
  assert.strictEqual(result1.success, true);

  // Text smaller
  const result2 = handler.handleCommand('text-smaller');
  assert.strictEqual(result2.success, true);

  // Reset all
  const result3 = handler.handleCommand('reset-all');
  assert.strictEqual(result3.success, true);
  assert.strictEqual(manager.getZoom(), 1.0);
  assert.strictEqual(manager.getTextScale(), 1.0);

  console.log('✓ Text commands work\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 12: ZoomCommandHandler - Command Aliases
// ============================================================================
console.log('TEST 12: ZoomCommandHandler - Command Aliases');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);

  // Different ways to say "zoom in"
  ['zoom-in', 'zoom in', 'increase zoom'].forEach(cmd => {
    manager.setZoom(1.0);
    const result = handler.handleCommand(cmd);
    assert.strictEqual(result.success, true);
    assert.ok(result.zoom >= 1.1);
  });

  // Different ways to say "text larger"
  ['text-larger', 'text larger', 'increase text', 'bigger text'].forEach(cmd => {
    manager.setTextScale(1.0);
    const result = handler.handleCommand(cmd);
    assert.strictEqual(result.success, true);
    assert.ok(result.scale > 1.0);
  });

  console.log('✓ Command aliases work\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 13: ZoomCommandHandler - History
// ============================================================================
console.log('TEST 13: ZoomCommandHandler - History');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);

  handler.handleCommand('zoom-in');
  handler.handleCommand('zoom-out');
  handler.handleCommand('text-larger');

  const history = handler.getHistory();
  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0].command, 'zoom-in');
  assert.strictEqual(history[1].command, 'zoom-out');
  assert.strictEqual(history[2].command, 'text-larger');

  console.log('✓ Command history works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 14: ZoomFeedback - TTS Message Generation
// ============================================================================
console.log('TEST 14: ZoomFeedback - TTS Message Generation');
try {
  const result1 = { success: true, zoom: 1.5, message: 'Zoom set to 150 percent' };
  const msg1 = ZoomFeedback.generateTTSMessage(result1);
  assert.ok(msg1.includes('150'));

  const result2 = { success: false, error: 'Invalid zoom' };
  const msg2 = ZoomFeedback.generateTTSMessage(result2);
  assert.ok(msg2.includes('Invalid'));

  console.log('✓ TTS message generation works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 15: ZoomFeedback - Visual Feedback Generation
// ============================================================================
console.log('TEST 15: ZoomFeedback - Visual Feedback Generation');
try {
  const result = { success: true, zoom: 1.5, message: 'Zoom set to 150 percent', state: {} };
  const feedback = ZoomFeedback.generateVisualFeedback(result);

  assert.strictEqual(feedback.type, 'zoom-feedback');
  assert.strictEqual(feedback.show, true);
  assert.ok(feedback.duration > 0);
  assert.strictEqual(feedback.styling.backgroundColor, '#4CAF50'); // Success = green

  const errorResult = { success: false, error: 'Error', message: 'Error' };
  const errorFeedback = ZoomFeedback.generateVisualFeedback(errorResult);
  assert.strictEqual(errorFeedback.styling.backgroundColor, '#f44336'); // Error = red

  console.log('✓ Visual feedback generation works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 16: Validation Functions
// ============================================================================
console.log('TEST 16: Validation Functions');
try {
  // Valid input
  validateZoomInput({ command: 'zoom-in' });

  // Invalid input - not an object
  let threw = false;
  try {
    validateZoomInput('invalid');
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('must be an object'));
  }
  assert.strictEqual(threw, true);

  // Valid result
  validateZoomResult({ success: true, zoom: 1.5 });

  // Invalid result - success not boolean
  threw = false;
  try {
    validateZoomResult({ success: 'true' });
  } catch (e) {
    threw = true;
    assert.ok(e.message.includes('boolean'));
  }
  assert.strictEqual(threw, true);

  console.log('✓ Validation functions work\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 17: Supported Commands List
// ============================================================================
console.log('TEST 17: Supported Commands List');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);
  const commands = handler.getSupportedCommands();

  assert.ok(Array.isArray(commands));
  assert.ok(commands.length >= 6); // At least 6 command types

  const zoomInCmd = commands.find(c => c.command === 'zoom-in');
  assert.ok(zoomInCmd);
  assert.ok(Array.isArray(zoomInCmd.aliases));
  assert.ok(zoomInCmd.effect);

  console.log('✓ Supported commands list works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// TEST 18: Error Handling - Unknown Command
// ============================================================================
console.log('TEST 18: Error Handling - Unknown Command');
try {
  const manager = new ZoomStateManager();
  const handler = new ZoomCommandHandler(manager);

  const result = handler.handleCommand('unknown-command');
  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('Unknown'));
  assert.ok(Array.isArray(result.supportedCommands));

  console.log('✓ Error handling for unknown commands works\n');
} catch (err) {
  console.error('✗ Failed:', err.message, '\n');
  process.exit(1);
}

// ============================================================================
// SUMMARY
// ============================================================================
console.log('═'.repeat(50));
console.log('✓ All 18 tests passed!');
console.log('═'.repeat(50));
