const Speaker = require('./speaker');
const Confirmations = require('./confirmations');
const Reader = require('./reader');

const speaker = new Speaker();
const confirmations = new Confirmations(speaker);
const reader = new Reader(speaker);

module.exports = {
  speaker,
  confirmations,
  reader
};
