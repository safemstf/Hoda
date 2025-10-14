const path = require('path');
const tests = [
  './test_speaker.js',
  './test_dom_extractor.js'
];

async function run() {
  console.log('Running tests...');
  let failed = 0;
  for (const t of tests) {
    try {
      console.log('\n===', t, '===');
      require(t);
      console.log(t, 'PASS');
    } catch (err) {
      failed++;
      console.error(t, 'FAIL:', err && err.stack || err);
    }
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }

  console.log('\nAll tests passed');
}

run();
