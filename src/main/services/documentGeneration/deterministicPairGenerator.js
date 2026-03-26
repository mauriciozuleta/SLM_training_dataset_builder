const EXPECTED_CORRECT = 3;
const EXPECTED_WRONG = 8;
const EXPECTED_PAIRS_PER_QUESTION = EXPECTED_CORRECT + EXPECTED_WRONG;

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeAnswers(rawAnswers, fallbackPrefix) {
  if (!Array.isArray(rawAnswers)) {
    return [];
  }

  const normalized = [];
  for (let index = 0; index < rawAnswers.length; index += 1) {
    const item = rawAnswers[index];
    let answerId = '';
    let answerText = '';

    if (item && typeof item === 'object') {
      answerId = normalizeText(item.id);
      answerText = normalizeText(item.text);
    } else {
      answerText = normalizeText(item);
    }

    if (!answerText) {
      continue;
    }

    if (!answerId) {
      answerId = `${fallbackPrefix}.${index + 1}`;
    }

    normalized.push({
      id: answerId,
      text: answerText,
    });
  }

  return normalized;
}

function extractChapterId(questionBank) {
  if (!Array.isArray(questionBank)) {
    return 'unknown';
  }

  const metadataEntry = questionBank.find((entry) => entry && typeof entry === 'object' && entry.questionBank);
  const chapterId = normalizeText(metadataEntry?.questionBank?.chapterId);
  if (chapterId) {
    return chapterId;
  }

  const firstQuestion = questionBank.find((entry) => entry && typeof entry === 'object' && entry.questionid);
  const questionId = normalizeText(firstQuestion?.questionid);
  const parts = questionId.split('.');
  if (parts.length >= 2) {
    return `${parts[0].toLowerCase()}.${parts[1]}`;
  }

  return 'unknown';
}

function validateQuestionEntry(entry, index) {
  const questionId = normalizeText(entry?.questionid);
  const questionText = normalizeText(entry?.question);
  const correctAnswers = normalizeAnswers(entry?.correct_answers, `${questionId}.c`);
  const wrongAnswers = normalizeAnswers(entry?.wrong_answers, `${questionId}.w`);
  const reasons = [];

  if (!questionId) {
    reasons.push('Missing questionid.');
  }
  if (!questionText) {
    reasons.push('Missing question text.');
  }
  if (correctAnswers.length !== EXPECTED_CORRECT) {
    reasons.push(`Expected ${EXPECTED_CORRECT} correct answers, got ${correctAnswers.length}.`);
  }
  if (wrongAnswers.length !== EXPECTED_WRONG) {
    reasons.push(`Expected ${EXPECTED_WRONG} wrong answers, got ${wrongAnswers.length}.`);
  }

  if (reasons.length > 0) {
    return {
      isValid: false,
      invalid: {
        index,
        questionid: questionId,
        reason: reasons.join(' '),
      },
    };
  }

  return {
    isValid: true,
    valid: {
      questionid: questionId,
      question: questionText,
      correct_answers: correctAnswers,
      wrong_answers: wrongAnswers,
      source: normalizeText(entry?.source),
      subjects: Array.isArray(entry?.subjects) ? entry.subjects : [],
    },
  };
}

function buildPairs(validQuestions) {
  const pairs = [];

  validQuestions.forEach((question) => {
    let pairIndex = 1;

    question.correct_answers.forEach((answer) => {
      pairs.push({
        pairId: `${question.questionid}.p.${pairIndex}`,
        questionid: question.questionid,
        answerId: answer.id,
        label: 1,
        labelText: 'correct',
        question: question.question,
        answer: answer.text,
        source: question.source,
        subjects: question.subjects,
      });
      pairIndex += 1;
    });

    question.wrong_answers.forEach((answer) => {
      pairs.push({
        pairId: `${question.questionid}.p.${pairIndex}`,
        questionid: question.questionid,
        answerId: answer.id,
        label: 0,
        labelText: 'incorrect',
        question: question.question,
        answer: answer.text,
        source: question.source,
        subjects: question.subjects,
      });
      pairIndex += 1;
    });
  });

  return pairs;
}

function createDeterministicPairGenerator() {
  function buildDeterministicPairSet(questionBank, sourceQuestionsFileName = '') {
    const safeQuestionBank = Array.isArray(questionBank) ? questionBank : [];
    const validQuestions = [];
    const invalidQuestions = [];

    safeQuestionBank.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || entry.questionBank) {
        return;
      }

      const validation = validateQuestionEntry(entry, index);
      if (validation.isValid) {
        validQuestions.push(validation.valid);
      } else {
        invalidQuestions.push(validation.invalid);
      }
    });

    const pairs = buildPairs(validQuestions);

    return {
      deterministicTrainingPairSet: {
        generatedAtUtc: new Date().toISOString(),
        chapterId: extractChapterId(safeQuestionBank),
        sourceQuestionsFile: sourceQuestionsFileName || 'chapter_questions.json',
        expectedPairsPerQuestion: EXPECTED_PAIRS_PER_QUESTION,
        validQuestionCount: validQuestions.length,
        invalidQuestionCount: invalidQuestions.length,
        totalPairs: pairs.length,
      },
      invalidQuestions,
      pairs,
    };
  }

  return {
    buildDeterministicPairSet,
  };
}

module.exports = {
  createDeterministicPairGenerator,
};