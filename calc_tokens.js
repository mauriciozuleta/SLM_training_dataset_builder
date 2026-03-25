const fs = require('fs');

const data = JSON.parse(fs.readFileSync('temp_ch1/chapter_1_rag.json', 'utf8'));

const totalChars = data.sections.reduce((sum, sec) => sum + (sec.content ? sec.content.length : 0), 0);

console.log('Document Metrics:');
console.log('================');
console.log('Total sections:', data.sections.length);
console.log('Total characters:', totalChars);
console.log('Average chars per section:', Math.round(totalChars / data.sections.length));

const details = data.sections.map((s) => ({
  id: s.id,
  chars: s.content.length,
  questions: Math.ceil(s.content.length / 900)
}));

console.log('\nSection Details:');
details.forEach(d => {
  console.log(`  [${d.id}] ${d.chars.toString().padStart(5)} chars -> ${d.questions} questions`);
});

const totalQuestions = details.reduce((sum, d) => sum + d.questions, 0);
console.log(`\nTotal planned questions: ${totalQuestions}`);

// Token calculation (estimate 1 token ≈ 4 chars average)
const TEXT_TO_TOKEN_RATIO = 4;

console.log('\n\nAPI Token Cost Estimation:');
console.log('==========================');

// 1. Blueprint Analysis
const blueprintInputChars = totalChars * 0.15 + 500; // section excerpts + overhead
const blueprintOutputChars = totalChars * 0.5; // blueprint with weights/rationales
console.log('\n1. Blueprint Analysis:');
console.log(`   Input:  ~${Math.round(blueprintInputChars / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`   Output: ~${Math.round(blueprintOutputChars / TEXT_TO_TOKEN_RATIO)} tokens`);

// 2. Question Bank Generation
const questionInputChars = totalChars * 0.08 + 400; // blueprint + overhead
const avgCharsPerQuestion = 200; // stem + correct + wrong + explanation + metadata
const questionOutputChars = totalQuestions * avgCharsPerQuestion;
console.log('\n2. Question Bank Generation:');
console.log(`   Questions to generate: ${totalQuestions}`);
console.log(`   Input:  ~${Math.round(questionInputChars / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`   Output: ~${Math.round(questionOutputChars / TEXT_TO_TOKEN_RATIO)} tokens`);

// 3. Summary (optional)
const summaryInputChars = totalChars * 0.25 + 400; // sections + metadata
const summaryOutputChars = 1500; // synopsis + key sections
console.log('\n3. Document Summary (optional):');
console.log(`   Input:  ~${Math.round(summaryInputChars / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`   Output: ~${Math.round(summaryOutputChars / TEXT_TO_TOKEN_RATIO)} tokens`);

// 4. Balanced Training
const deterministic_pairs = totalQuestions * 11;
const target_balanced = Math.floor(deterministic_pairs * 0.3);
const balancedInputChars = totalChars * 0.12 + 400;
const balancedOutputChars = target_balanced * 150; // records with statement + label
console.log('\n4. Balanced Training Generation (optional):');
console.log(`   Deterministic pairs: ${deterministic_pairs}`);
console.log(`   Target API records (30%): ${target_balanced}`);
console.log(`   Input:  ~${Math.round(balancedInputChars / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`   Output: ~${Math.round(balancedOutputChars / TEXT_TO_TOKEN_RATIO)} tokens`);

// Totals
const totalInputAllOutputs = blueprintInputChars + questionInputChars + summaryInputChars + balancedInputChars;
const totalOutputAllOutputs = blueprintOutputChars + questionOutputChars + summaryOutputChars + balancedOutputChars;

console.log('\n\nTotal Token Cost Summary:');
console.log('==========================');
console.log(`All Outputs (blueprint + questions + summary + balanced):`);
console.log(`  Input:  ~${Math.round(totalInputAllOutputs / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`  Output: ~${Math.round(totalOutputAllOutputs / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`  TOTAL:  ~${Math.round((totalInputAllOutputs + totalOutputAllOutputs) / TEXT_TO_TOKEN_RATIO)} tokens`);

const mandatoryInputs = blueprintInputChars + questionInputChars;
const mandatoryOutputs = blueprintOutputChars + questionOutputChars;
console.log(`\nMandatory Outputs (blueprint + questions only):`);
console.log(`  Input:  ~${Math.round(mandatoryInputs / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`  Output: ~${Math.round(mandatoryOutputs / TEXT_TO_TOKEN_RATIO)} tokens`);
console.log(`  TOTAL:  ~${Math.round((mandatoryInputs + mandatoryOutputs) / TEXT_TO_TOKEN_RATIO)} tokens`);

console.log('\n\nCost Estimates (approximate):');
console.log('============================');
console.log('OpenAI GPT-4 Turbo:');
const gpt4_input_price = 0.01;  // $0.01 per 1K input tokens
const gpt4_output_price = 0.03; // $0.03 per 1K output tokens
const gpt4_all_cost = (totalInputAllOutputs / TEXT_TO_TOKEN_RATIO / 1000 * gpt4_input_price) + 
                      (totalOutputAllOutputs / TEXT_TO_TOKEN_RATIO / 1000 * gpt4_output_price);
const gpt4_mandatory_cost = (mandatoryInputs / TEXT_TO_TOKEN_RATIO / 1000 * gpt4_input_price) + 
                            (mandatoryOutputs / TEXT_TO_TOKEN_RATIO / 1000 * gpt4_output_price);
console.log(`  All outputs:       $${gpt4_all_cost.toFixed(3)}`);
console.log(`  Mandatory outputs: $${gpt4_mandatory_cost.toFixed(3)}`);

console.log('\nAnthropic Claude 3.5 Sonnet:');
const claude_input_price = 0.003;  // $0.003 per 1K input tokens
const claude_output_price = 0.015; // $0.015 per 1K output tokens
const claude_all_cost = (totalInputAllOutputs / TEXT_TO_TOKEN_RATIO / 1000 * claude_input_price) + 
                        (totalOutputAllOutputs / TEXT_TO_TOKEN_RATIO / 1000 * claude_output_price);
const claude_mandatory_cost = (mandatoryInputs / TEXT_TO_TOKEN_RATIO / 1000 * claude_input_price) + 
                              (mandatoryOutputs / TEXT_TO_TOKEN_RATIO / 1000 * claude_output_price);
console.log(`  All outputs:       $${claude_all_cost.toFixed(3)}`);
console.log(`  Mandatory outputs: $${claude_mandatory_cost.toFixed(3)}`);
