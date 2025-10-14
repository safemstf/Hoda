const path = require('path');
const fs = require('fs');

const tests = [
  './test_tts.js'
].map(p => path.join(__dirname, p));

let failed = 0;
for (const file of tests) {
  try {
    require(file);
    console.log(`OK  ${path.basename(file)}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${path.basename(file)} - ${err.message}`);
    console.error(err.stack);
  }
}

if (failed) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('All tests passed');
}
