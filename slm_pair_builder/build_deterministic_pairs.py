#!/usr/bin/env python3
"""
Build deterministic SLM training pairs from a generated questions JSON file.

Each valid question must contain exactly 3 correct answers and 8 wrong answers,
which yields 11 deterministic pairs per question.

Usage:
    python slm_pair_builder/build_deterministic_pairs.py \
        test_output_files/afh_2_questions.json

    python slm_pair_builder/build_deterministic_pairs.py \
        test_output_files/afh_2_questions.json \
        --output test_output_files/afh_2_deterministic_training_pairs.json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

EXPECTED_CORRECT = 3
EXPECTED_WRONG = 8
EXPECTED_PAIRS_PER_QUESTION = EXPECTED_CORRECT + EXPECTED_WRONG


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert question-bank JSON into deterministic training pairs "
            f"({EXPECTED_PAIRS_PER_QUESTION} pairs per valid question)."
        )
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Path to chapter questions JSON (for example: afh_2_questions.json).",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output path for deterministic_training_pairs.json (default: same folder).",
    )
    return parser.parse_args()


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return " ".join(text.split())


def _normalize_answers(raw_answers: Any, fallback_prefix: str) -> List[Dict[str, str]]:
    if not isinstance(raw_answers, list):
        return []

    normalized: List[Dict[str, str]] = []
    for idx, item in enumerate(raw_answers, start=1):
        answer_id = ""
        answer_text = ""

        if isinstance(item, dict):
            answer_id = _clean_text(item.get("id"))
            answer_text = _clean_text(item.get("text"))
        else:
            answer_text = _clean_text(item)

        if not answer_text:
            continue

        if not answer_id:
            answer_id = f"{fallback_prefix}.{idx}"

        normalized.append({"id": answer_id, "text": answer_text})

    return normalized


def _extract_chapter_id(payload: List[Any], valid_questions: List[Dict[str, Any]]) -> str:
    for item in payload:
        if isinstance(item, dict) and isinstance(item.get("questionBank"), dict):
            chapter_id = _clean_text(item["questionBank"].get("chapterId"))
            if chapter_id:
                return chapter_id

    if valid_questions:
        question_id = valid_questions[0]["questionid"]
        parts = question_id.split(".")
        if len(parts) >= 2:
            return f"{parts[0].lower()}.{parts[1]}"

    return "unknown"


def load_and_validate_questions(input_path: Path) -> Tuple[List[Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Input JSON root must be an array.")

    valid_questions: List[Dict[str, Any]] = []
    invalid_questions: List[Dict[str, Any]] = []

    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            invalid_questions.append(
                {
                    "index": index,
                    "questionid": "",
                    "reason": "Entry is not an object.",
                }
            )
            continue

        # Metadata envelope from question-bank output.
        if "questionBank" in item:
            continue

        question_id = _clean_text(item.get("questionid"))
        question_text = _clean_text(item.get("question"))
        correct_answers = _normalize_answers(item.get("correct_answers"), f"{question_id}.c")
        wrong_answers = _normalize_answers(item.get("wrong_answers"), f"{question_id}.w")

        reasons: List[str] = []
        if not question_id:
            reasons.append("Missing questionid.")
        if not question_text:
            reasons.append("Missing question text.")
        if len(correct_answers) != EXPECTED_CORRECT:
            reasons.append(
                f"Expected {EXPECTED_CORRECT} correct answers, got {len(correct_answers)}."
            )
        if len(wrong_answers) != EXPECTED_WRONG:
            reasons.append(f"Expected {EXPECTED_WRONG} wrong answers, got {len(wrong_answers)}.")

        if reasons:
            invalid_questions.append(
                {
                    "index": index,
                    "questionid": question_id,
                    "reason": " ".join(reasons),
                }
            )
            continue

        valid_questions.append(
            {
                "questionid": question_id,
                "question": question_text,
                "correct_answers": correct_answers,
                "wrong_answers": wrong_answers,
                "source": _clean_text(item.get("source")),
                "subjects": item.get("subjects") if isinstance(item.get("subjects"), list) else [],
            }
        )

    return payload, valid_questions, invalid_questions


def build_pairs(valid_questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    pairs: List[Dict[str, Any]] = []

    for question in valid_questions:
        pair_index = 1

        for answer in question["correct_answers"]:
            pairs.append(
                {
                    "pairId": f"{question['questionid']}.p.{pair_index}",
                    "questionid": question["questionid"],
                    "answerId": answer["id"],
                    "label": 1,
                    "labelText": "correct",
                    "question": question["question"],
                    "answer": answer["text"],
                    "source": question["source"],
                    "subjects": question["subjects"],
                }
            )
            pair_index += 1

        for answer in question["wrong_answers"]:
            pairs.append(
                {
                    "pairId": f"{question['questionid']}.p.{pair_index}",
                    "questionid": question["questionid"],
                    "answerId": answer["id"],
                    "label": 0,
                    "labelText": "incorrect",
                    "question": question["question"],
                    "answer": answer["text"],
                    "source": question["source"],
                    "subjects": question["subjects"],
                }
            )
            pair_index += 1

    return pairs


def build_output(
    input_path: Path,
    payload: List[Any],
    valid_questions: List[Dict[str, Any]],
    invalid_questions: List[Dict[str, Any]],
    pairs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    chapter_id = _extract_chapter_id(payload, valid_questions)

    return {
        "deterministicTrainingPairSet": {
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "chapterId": chapter_id,
            "sourceQuestionsFile": input_path.name,
            "expectedPairsPerQuestion": EXPECTED_PAIRS_PER_QUESTION,
            "validQuestionCount": len(valid_questions),
            "invalidQuestionCount": len(invalid_questions),
            "totalPairs": len(pairs),
        },
        "invalidQuestions": invalid_questions,
        "pairs": pairs,
    }


def main() -> int:
    args = parse_args()
    input_path: Path = args.input

    if not input_path.exists():
        print(f"Error: input file not found: {input_path}")
        return 1

    if args.output:
        output_path = args.output
    else:
        stem = input_path.stem
        if stem.endswith("_questions"):
            prefix = stem[: -len("_questions")]
        else:
            prefix = stem
        default_name = f"{prefix}_deterministic_training_pairs.json" if prefix else "deterministic_training_pairs.json"
        output_path = input_path.with_name(default_name)

    try:
        payload, valid_questions, invalid_questions = load_and_validate_questions(input_path)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {input_path}: {exc}")
        return 1
    except ValueError as exc:
        print(f"Error: {exc}")
        return 1

    pairs = build_pairs(valid_questions)
    output = build_output(input_path, payload, valid_questions, invalid_questions, pairs)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")

    expected_total = len(valid_questions) * EXPECTED_PAIRS_PER_QUESTION
    print(f"Input file: {input_path}")
    print(f"Valid questions: {len(valid_questions)}")
    print(f"Invalid questions skipped: {len(invalid_questions)}")
    print(f"Pairs generated: {len(pairs)}")
    print(f"Expected pairs from valid questions: {expected_total}")
    print(f"Output file: {output_path}")

    if len(pairs) != expected_total:
        print("Warning: generated pair count did not match expected total.")
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())