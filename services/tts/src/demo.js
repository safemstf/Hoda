const { speaker, confirmations, reader } = require('./index');

async function runDemo() {
  console.log('TTS demo starting (simulated when run in Node)');

  // Confirmation example
  console.log('\n-- Confirmation Example --');
  const c = await confirmations.confirm('navigate', 'down');
  console.log('Confirmation payload:', c);

  // Semantic reader example
  console.log('\n-- Semantic Reader Example --');
  const article = [
    { role: 'headline', text: 'Local Park Reopens After Renovation' },
    { role: 'byline', text: 'By A Reporter' },
    { role: 'paragraph', text: "The town's central park reopened today after a two-month renovation. Families were seen enjoying the new playground and walking paths." },
    { role: 'paragraph', text: 'Officials said the improvements were funded by a community grant and private donors.' }
  ];

  const r = await reader.readPageSemantic(article);
  console.log('Reader result:', r);

  // Voice and rate control
  console.log('\n-- Voice Controls --');
  speaker.setRate(0.9);
  speaker.setVoice('default');
  await speaker.speak('Voice and rate updated. Speaking at 0.9x speed.');

  console.log('TTS demo finished');
}

runDemo().catch(err => {
  console.error('Demo error:', err && err.stack || err);
  process.exit(1);
});
