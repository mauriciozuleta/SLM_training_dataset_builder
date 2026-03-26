# Deterministic Pair Builder

This module converts a chapter question-bank JSON file into deterministic SLM training pairs.

## Rule

Each valid question must contain:
- 3 `correct_answers`
- 8 `wrong_answers`

That produces exactly 11 deterministic `question + answer` pairs per question.

## Usage

```bash
python slm_pair_builder/build_deterministic_pairs.py test_output_files/afh_2_questions.json
```

Default output naming keeps the chapter prefix from the input file:
- `afh_2_questions.json` -> `afh_2_deterministic_training_pairs.json`

Custom output path:

```bash
python slm_pair_builder/build_deterministic_pairs.py test_output_files/afh_2_questions.json --output test_output_files/afh_2_deterministic_training_pairs.json
```

## Output Shape

The script writes a JSON object with:
- `deterministicTrainingPairSet` metadata
- `invalidQuestions` (skipped malformed questions)
- `pairs` (training records)

Each pair record includes:
- `pairId`
- `questionid`
- `answerId`
- `label` (`1` for correct, `0` for incorrect)
- `labelText`
- `question`
- `answer`
- `source`
- `subjects`
