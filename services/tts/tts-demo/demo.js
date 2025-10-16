const { speaker, confirmations, reader } = require('./index');

async function runDemo() {
  console.log('🎤 TTS Demo Starting...\n');

  // Demo 1: Basic Speech
  console.log('📢 Demo 1: Basic Speech');
  await speaker.speak('Hello! Welcome to the TTS demonstration.');
  
  // Demo 2: Speed Control
  console.log('\n📢 Demo 2: Speed Control');
  speaker.setRate(1.5);
  await speaker.speak('This is faster speech at 1.5x rate.');
  speaker.setRate(0.7);
  await speaker.speak('This is slower speech at 0.7x rate.');
  speaker.setRate(1.0); // Reset to normal
  
  // Demo 3: Confirmations
  console.log('\n📢 Demo 3: Action Confirmations');
  const navConfirm = await confirmations.confirm('navigate', 'home page');
  console.log('   Result:', navConfirm);
  
  const saveConfirm = await confirmations.confirm('save', 'document');
  console.log('   Result:', saveConfirm);
  
  // Demo 4: Semantic Reading
  console.log('\n📢 Demo 4: Article Reading');
  
  // Using structured sections
  const article = [
    { role: 'headline', text: 'Breaking: New AI Assistant Launches' },
    { role: 'byline', text: 'By Tech Reporter, Today' },
    { role: 'paragraph', text: 'A revolutionary new AI assistant was announced today, featuring advanced natural language capabilities.' },
    { role: 'paragraph', text: 'The system includes text-to-speech, semantic reading, and intelligent confirmation features.' }
  ];
  
  await reader.readPageSemantic(article);
  
  // Demo 5: Plain Text Reading
  console.log('\n📢 Demo 5: Plain Text Reading');
  const plainText = `This is a simple text document.

It has multiple paragraphs separated by blank lines.

The reader will handle each paragraph individually.`;
  
  await reader.readPageSemantic(plainText);
  
  // Demo 6: Queue Management
  console.log('\n📢 Demo 6: Speech Queue Management');
  speaker.policy = 'queue'; // Change to queue mode
  
  console.log('   Queueing multiple utterances...');
  speaker.speak('First message in queue');
  speaker.speak('Second message in queue');
  speaker.speak('Third message in queue');
  
  // Wait for all to complete
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n✅ Demo Complete!');
}

// Run with error handling
runDemo().catch(err => {
  console.error('❌ Demo Error:', err);
  process.exit(1);
});