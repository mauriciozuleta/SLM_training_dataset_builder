const { createConversationalPairGenerator } = require('./src/main/services/documentGeneration/conversationalPairGenerator');
const fs = require('fs');

const fallbackApi = {
  callApiJson: async () => {
    throw new Error('No API configured for local persona test.');
  },
  callPreferredApiJson: async () => {
    throw new Error('No API configured for local persona test.');
  },
};

// Read test data
const documentJson = JSON.parse(fs.readFileSync('./test_output_files/afh_3_document.json', 'utf8'));

(async () => {
  // Generate with personas directly from document.json
  const generator = createConversationalPairGenerator({ api: fallbackApi });
  const result = await generator.buildConversationalPairSet(documentJson);

  console.log('Generated Pairs:', result.pairs.length);
  console.log('Persona Distribution:', result.conversationalTrainingPairSet.studentPersonas);
  console.log('');

  // Show examples for each persona
  console.log('=== CONFIDENT Examples ===');
  result.pairs.filter((p) => p.studentPersona === 'confident').slice(0, 3).forEach((pair, i) => {
    console.log(`[${i + 1}] ${pair.conversationalPairId}`);
    console.log(`    User: ${pair.turns[0].content.substring(0, 90)}...`);
    console.log('');
  });

  console.log('=== CONFUSED Examples ===');
  result.pairs.filter((p) => p.studentPersona === 'confused').slice(0, 3).forEach((pair, i) => {
    console.log(`[${i + 1}] ${pair.conversationalPairId}`);
    console.log(`    User: ${pair.turns[0].content.substring(0, 90)}...`);
    console.log('');
  });

  console.log('=== CHECKRIDE Examples ===');
  result.pairs.filter((p) => p.studentPersona === 'checkride').slice(0, 3).forEach((pair, i) => {
    console.log(`[${i + 1}] ${pair.conversationalPairId}`);
    console.log(`    User: ${pair.turns[0].content.substring(0, 90)}...`);
    console.log('');
  });

  // Save updated test file
  const outputPath = './test_output_files/afh_3_conversational_training_pairs.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log('Saved to:', outputPath);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
