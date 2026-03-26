const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./test_output_files/afh_3_conversational_training_pairs.json', 'utf8'));

// Show first 5 pairs
console.log('Sample Conversational Pairs (First 5):');
for (let i = 0; i < Math.min(5, data.pairs.length); i++) {
  const pair = data.pairs[i];
  console.log(`\n--- Pair ${i + 1}: ${pair.conversationalPairId} ---`);
  console.log('User:', pair.turns[0].content.substring(0, 80) + '...');
  console.log('Assistant:', pair.turns[1].content.substring(0, 100) + '...');
  console.log('ID Format:', pair.conversationalPairId.includes('.z.') ? 'OK - Using .z. format' : 'WRONG');
}

console.log('\n--- File Info ---');
console.log('Total Pairs:', data.pairs.length);
console.log('File Size:', Math.round(fs.statSync('./test_output_files/afh_3_conversational_training_pairs.json').size / 1024) + ' KB');
console.log('\nMetadata:', JSON.stringify(data.conversationalTrainingPairSet, null, 2));
console.log('\nSource artifact: document.json');
