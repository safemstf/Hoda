const { validateTTSInput } = require('./formats');
const reader = require('./reader');

async function speak(input) {
  validateTTSInput(input);
  return reader.readText(input);
}

module.exports = {
  speak,
};
