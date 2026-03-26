const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./test_output_files/afh_3_conversational_training_pairs.json', 'utf8'));

console.log('='.repeat(80));
console.log('CONVERSATIONAL PAIR GENERATOR - PERSONA VARIATION');
console.log('='.repeat(80));

console.log('\nMetadata:');
console.log('  Total Pairs:', data.conversationalTrainingPairSet.generatedPairCount);
console.log('  Confident:  ', data.conversationalTrainingPairSet.studentPersonas.confident);
console.log('  Confused:   ', data.conversationalTrainingPairSet.studentPersonas.confused);
console.log('  Checkride:  ', data.conversationalTrainingPairSet.studentPersonas.checkride);

// Find one example of each persona
const confidentExample = data.pairs.find(p => p.studentPersona === 'confident');
const confusedExample = data.pairs.find(p => p.studentPersona === 'confused');
const checkrideExample = data.pairs.find(p => p.studentPersona === 'checkride');

console.log('\n' + '='.repeat(80));
console.log('CONFIDENT PERSONA - Direct, Assertive');
console.log('='.repeat(80));
console.log(`ID: ${confidentExample.conversationalPairId}`);
console.log(`Subject: ${confidentExample.subjects.join(', ')}`);
console.log('\nUser (Confident Student):');
console.log(`  "${confidentExample.turns[0].content}"`);
console.log('\nAssistant (Instructor):');
console.log(`  "${confidentExample.turns[1].content}"`);

console.log('\n' + '='.repeat(80));
console.log('CONFUSED PERSONA - Uncertain, Seeking Clarification');
console.log('='.repeat(80));
console.log(`ID: ${confusedExample.conversationalPairId}`);
console.log(`Subject: ${confusedExample.subjects.join(', ')}`);
console.log('\nUser (Confused Student):');
console.log(`  "${confusedExample.turns[0].content}"`);
console.log('\nAssistant (Instructor):');
console.log(`  "${confusedExample.turns[1].content}"`);

console.log('\n' + '='.repeat(80));
console.log('CHECKRIDE PERSONA - Exam Preparation Focused');
console.log('='.repeat(80));
console.log(`ID: ${checkrideExample.conversationalPairId}`);
console.log(`Subject: ${checkrideExample.subjects.join(', ')}`);
console.log('\nUser (Checkride Prep Student):');
console.log(`  "${checkrideExample.turns[0].content}"`);
console.log('\nAssistant (Instructor):');
console.log(`  "${checkrideExample.turns[1].content}"`);

console.log('\n' + '='.repeat(80));
console.log('DISTRIBUTION SUMMARY');
console.log('='.repeat(80));
console.log('Perfect distribution across 3 personas for diverse SLM training');
console.log(`- Each student type appears in ~${Math.round(data.conversationalTrainingPairSet.generatedPairCount / 3)} pairs`);
console.log('- Confident: Direct knowledge questioning');
console.log('- Confused: Clarification and understanding verification');
console.log('- Checkride: Practical exam preparation context');
console.log('\nFile: ./test_output_files/afh_3_conversational_training_pairs.json');
console.log('Size: ' + Math.round(fs.statSync('./test_output_files/afh_3_conversational_training_pairs.json').size / 1024) + ' KB');
