#!/usr/bin/env node
/**
 * Chapter 1 Generation Test Script
 * Simulates the full workflow: extract -> blueprint -> questions -> deterministic training -> balanced training -> summary
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

// Check API keys
const status = {
  openaiAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
  anthropicAvailable: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
};

console.log('=== Pair Generator Chapter 1 Test ===\n');
console.log('API Status:');
console.log(`  OpenAI:    ${status.openaiAvailable ? '✓ Available' : '✗ Missing'}`);
console.log(`  Anthropic: ${status.anthropicAvailable ? '✓ Available' : '✗ Missing'}`);

if (!status.openaiAvailable && !status.anthropicAvailable) {
  console.error('\n❌ No API keys configured in .env');
  process.exit(1);
}

console.log('\n✓ API keys ready\n');

// Load extracted chapter JSON
async function loadChapter() {
  const chapterPath = path.join(__dirname, 'temp_ch1', 'chapter_1_rag.json');
  const content = await fs.readFile(chapterPath, 'utf8');
  return JSON.parse(content);
}

async function main() {
  try {
    const documentJson = await loadChapter();
    console.log(`Loaded Chapter: "${documentJson.title}"`);
    console.log(`Sections: ${documentJson.sections.length}`);
    console.log(`Characters: ${documentJson.sections.reduce((s, sec) => s + sec.content.length, 0)}\n`);

    // Setup output directory
    const outputDir = path.join(__dirname, 'test_output_ch1');
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Output directory: ${outputDir}\n`);

    // Test workflow
    console.log('Starting generation workflow...\n');
    console.log('Step 1: Blueprint Analysis...');
    console.log('  (This will call the API to analyze sections and determine weights)\n');

    console.log('Step 2: Question Generation...');
    console.log('  (This will call the API to generate 44 questions with 3 correct + 8 wrong answers)\n');

    console.log('Step 3: Deterministic Training Pairs...');
    console.log('  (This will generate 484 SLM training pairs locally, no API cost)\n');

    console.log('Step 4: Balanced Training Records...');
    console.log('  (This will call the API to generate ~145 classification records)\n');

    console.log('Step 5: Document Summary...');
    console.log('  (This will call the API to generate synopsis + key sections)\n');

    console.log('---\n');
    console.log('Expected Output Files:');
    console.log('  ✓ chapter_rag.json (extracted document)');
    console.log('  ✓ chapter_blueprint.json (section weights & requirements)');
    console.log('  ✓ question_bank.generated.json (44 questions)');
    console.log('  ✓ deterministic_training.json (484 training pairs)');
    console.log('  ✓ balanced_training_record.json (145 API records)');
    console.log('  ✓ chapter_summary.json (synopsis & key sections)\n');

    console.log('Expected Token Usage:');
    console.log('  • All outputs: ~17,280 tokens');
    console.log('    - OpenAI GPT-4 Turbo: ~$0.41');
    console.log('    - Anthropic Claude 3.5: ~$0.20\n');

    console.log('To run the actual generation, use the Electron app:');
    console.log('  1. npm run start');
    console.log('  2. Upload the PDF from: D:\\OneDrive\\pilot study books\\AFH\\AFH Chapter 1\\');
    console.log('  3. Select all output checkboxes');
    console.log('  4. Click "Generate Pairs"\n');

    console.log('Generation will be logged to the console and output files will be saved.\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
