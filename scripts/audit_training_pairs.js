#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { computeQualityRating } = require('./quality_rating_rules');

const DEFAULT_ROOT = path.join(process.cwd(), 'test_output_files');

function normalizeText(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getRepairGuidance(code) {
  const normalized = `${code || ''}`.trim().toUpperCase();

  const map = {
    DUPLICATE_CONVERSATIONS: {
      action: 'targeted-repair',
      scope: 'pair',
      instruction: 'Regenerate only duplicated conversational pairs with variation constraints.',
    },
    REPEATED_SUBJECTS: {
      action: 'targeted-repair',
      scope: 'section',
      instruction: 'Regenerate over-concentrated sections with subject balancing constraints.',
    },
    REPEATED_USER_PROMPTS: {
      action: 'targeted-repair',
      scope: 'pair',
      instruction: 'Rewrite repeated user prompts to increase diversity while preserving topic.',
    },
    REPEATED_ASSISTANT_REPLIES: {
      action: 'targeted-repair',
      scope: 'pair',
      instruction: 'Rewrite repeated assistant replies to increase wording diversity while keeping facts.',
    },
    POTENTIAL_TRUNCATION: {
      action: 'targeted-repair',
      scope: 'pair',
      instruction: 'Regenerate affected item to ensure complete sentence boundaries.',
    },
    QUESTION_TEXT_VARIATION: {
      action: 'targeted-repair',
      scope: 'question',
      instruction: 'Normalize question wording for the same question id.',
    },
    PAIRS_PER_QUESTION_MISMATCH: {
      action: 'targeted-repair',
      scope: 'question',
      instruction: 'Regenerate missing/extra answer pairs for affected question id only.',
    },
    LABEL_BALANCE_BY_QUESTION: {
      action: 'targeted-repair',
      scope: 'question',
      instruction: 'Regenerate answer set for affected question id to restore class balance.',
    },
    PERSONA_COUNT_MISMATCH: {
      action: 'metadata-flag',
      scope: 'file',
      instruction: 'Record metadata mismatch and repair in a later pass if content is otherwise acceptable.',
    },
    DEFERRED_REPAIRS_PENDING: {
      action: 'metadata-flag',
      scope: 'file',
      instruction: 'Dataset has unresolved deferred repairs; block training in strict readiness mode until resolved.',
    },
    COUNT_MISMATCH: {
      action: 'metadata-flag',
      scope: 'file',
      instruction: 'Record mismatch in metadata and update counters during next write pass.',
    },
    REQUIRED_STRING: {
      action: 'redo',
      scope: 'file',
      instruction: 'Structural fields are missing; redo generation for affected artifact.',
    },
    REQUIRED_ARRAY: {
      action: 'redo',
      scope: 'file',
      instruction: 'Structural arrays are missing; redo generation for affected artifact.',
    },
    BAD_TURNS_SHAPE: {
      action: 'redo',
      scope: 'file',
      instruction: 'Conversation turn structure is invalid; regenerate affected artifact.',
    },
    BAD_USER_ROLE: {
      action: 'redo',
      scope: 'file',
      instruction: 'Role schema is invalid; regenerate affected artifact.',
    },
    BAD_ASSISTANT_ROLE: {
      action: 'redo',
      scope: 'file',
      instruction: 'Role schema is invalid; regenerate affected artifact.',
    },
    DUPLICATE_PAIR_ID: {
      action: 'redo',
      scope: 'file',
      instruction: 'Pair identity collisions detected; regenerate affected artifact.',
    },
    DUPLICATE_ANSWER_ID_PER_QUESTION: {
      action: 'redo',
      scope: 'question',
      instruction: 'Answer ID collisions detected; regenerate affected questions.',
    },
    LABEL_MISMATCH: {
      action: 'redo',
      scope: 'question',
      instruction: 'Label schema mismatch detected; regenerate affected questions.',
    },
    READ_FAILURE: {
      action: 'redo',
      scope: 'file',
      instruction: 'Artifact cannot be read; regenerate file.',
    },
    JSON_PARSE_FAILURE: {
      action: 'redo',
      scope: 'file',
      instruction: 'Artifact JSON is invalid; regenerate file.',
    },
    UNSUPPORTED_SCHEMA: {
      action: 'redo',
      scope: 'file',
      instruction: 'Artifact schema is unsupported; regenerate with supported schema.',
    },
  };

  return map[normalized] || {
    action: 'metadata-flag',
    scope: 'file',
    instruction: 'Record issue and review manually.',
  };
}

function addIssue(issues, severity, code, message, context = {}, target = null) {
  const guidance = getRepairGuidance(code);
  issues.push({
    severity,
    code,
    message,
    target: target || { type: guidance.scope, id: context?.where || context?.filePath || 'unknown' },
    repairGuidance: guidance,
    context,
  });
}

function countBy(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = `${item || ''}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function topNFromMap(map, n = 10) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function walkFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      return;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      out.push(fullPath);
    }
  });

  return out;
}

function discoverPairFiles(rootDir) {
  return walkFiles(rootDir).filter((filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith('_conversational_training_pairs.json') || lower.endsWith('_deterministic_training_pairs.json');
  });
}

function validateRequiredString(obj, key, issues, where) {
  if (typeof obj?.[key] !== 'string' || obj[key].trim() === '') {
    addIssue(issues, 'error', 'REQUIRED_STRING', `Missing or empty string field: ${key}`, { where });
    return false;
  }
  return true;
}

function validateRequiredArray(obj, key, issues, where) {
  if (!Array.isArray(obj?.[key]) || obj[key].length === 0) {
    addIssue(issues, 'error', 'REQUIRED_ARRAY', `Missing or empty array field: ${key}`, { where });
    return false;
  }
  return true;
}

function detectTruncatedText(text) {
  const t = `${text || ''}`.trim();
  if (!t) {
    return false;
  }

  if (t.length <= 7 && /[-.:]$/.test(t)) {
    return true;
  }

  if (/-$/.test(t)) {
    return true;
  }

  if (/\b[a-z]{2,8}-$/i.test(t)) {
    return true;
  }

  return false;
}

function detectDeferredQualityFlag(payload, issues, filePath) {
  const flag = Boolean(payload?.qualityFeedback?.unresolvedQualityIssues);
  if (!flag) {
    return;
  }

  const deferredIssueCount = Number(payload?.qualityFeedback?.deferredIssueCount || 0);
  const deferredAtUtc = `${payload?.qualityFeedback?.deferredAtUtc || ''}`.trim();
  const detail = deferredIssueCount > 0
    ? ` (${deferredIssueCount} pending issue(s))`
    : '';

  addIssue(
    issues,
    'warning',
    'DEFERRED_REPAIRS_PENDING',
    `Dataset is flagged with unresolved deferred quality issues${detail}.`,
    {
      filePath,
      deferredIssueCount,
      deferredAtUtc,
    },
    {
      type: 'file',
      id: filePath,
    }
  );
}

function analyzeConversationalPayload(payload, filePath) {
  const issues = [];
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
  const meta = payload?.conversationalTrainingPairSet || {};

  detectDeferredQualityFlag(payload, issues, filePath);

  if (!Array.isArray(payload?.pairs)) {
    addIssue(issues, 'error', 'PAIRS_MISSING', 'Missing pairs array.', { filePath });
  }

  if (typeof meta.generatedPairCount === 'number' && meta.generatedPairCount !== pairs.length) {
    addIssue(
      issues,
      'warning',
      'COUNT_MISMATCH',
      `Metadata generatedPairCount (${meta.generatedPairCount}) does not match actual pairs length (${pairs.length}).`,
      { filePath }
    );
  }

  const idSet = new Set();
  const pairFingerprintCount = new Map();
  const pairFingerprintTargets = new Map();
  const userPromptCount = new Map();
  const assistantReplyCount = new Map();
  const subjectCount = new Map();
  const subjectTargets = new Map();
  const personaCountObserved = { confident: 0, confused: 0, checkride: 0 };

  pairs.forEach((pair, index) => {
    const where = `pairs[${index}]`;

    validateRequiredString(pair, 'conversationalPairId', issues, where);
    validateRequiredString(pair, 'pairType', issues, where);
    validateRequiredString(pair, 'studentPersona', issues, where);
    validateRequiredString(pair, 'context', issues, where);
    validateRequiredString(pair, 'source', issues, where);
    validateRequiredArray(pair, 'subjects', issues, where);

    const pairId = `${pair?.conversationalPairId || ''}`.trim();
    if (pairId) {
      if (idSet.has(pairId)) {
        addIssue(issues, 'error', 'DUPLICATE_PAIR_ID', `Duplicate conversationalPairId: ${pairId}`, { where }, { type: 'pair', id: pairId });
      }
      idSet.add(pairId);
    }

    if (!Array.isArray(pair?.turns) || pair.turns.length !== 2) {
      addIssue(issues, 'error', 'BAD_TURNS_SHAPE', 'Turns must be an array with exactly 2 elements.', { where }, { type: 'pair', id: pairId || where });
      return;
    }

    const userTurn = pair.turns[0] || {};
    const assistantTurn = pair.turns[1] || {};

    if (userTurn.role !== 'user') {
      addIssue(issues, 'error', 'BAD_USER_ROLE', 'First turn role must be user.', { where }, { type: 'pair', id: pairId || where });
    }
    if (assistantTurn.role !== 'assistant') {
      addIssue(issues, 'error', 'BAD_ASSISTANT_ROLE', 'Second turn role must be assistant.', { where }, { type: 'pair', id: pairId || where });
    }

    validateRequiredString(userTurn, 'content', issues, `${where}.turns[0]`);
    validateRequiredString(assistantTurn, 'content', issues, `${where}.turns[1]`);

    const userText = normalizeText(userTurn.content);
    const assistantText = normalizeText(assistantTurn.content);
    const fingerprint = `${userText} ||| ${assistantText}`;

    pairFingerprintCount.set(fingerprint, (pairFingerprintCount.get(fingerprint) || 0) + 1);
    if (!pairFingerprintTargets.has(fingerprint)) {
      pairFingerprintTargets.set(fingerprint, []);
    }
    pairFingerprintTargets.get(fingerprint).push(pairId || where);
    userPromptCount.set(userText, (userPromptCount.get(userText) || 0) + 1);
    assistantReplyCount.set(assistantText, (assistantReplyCount.get(assistantText) || 0) + 1);

    if (detectTruncatedText(userTurn.content)) {
      addIssue(issues, 'warning', 'POTENTIAL_TRUNCATION', 'User turn appears truncated.', { where: `${where}.turns[0]` }, { type: 'pair', id: pairId || where });
    }
    if (detectTruncatedText(assistantTurn.content)) {
      addIssue(issues, 'warning', 'POTENTIAL_TRUNCATION', 'Assistant turn appears truncated.', { where: `${where}.turns[1]` }, { type: 'pair', id: pairId || where });
    }

    const persona = `${pair?.studentPersona || ''}`.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(personaCountObserved, persona)) {
      personaCountObserved[persona] += 1;
    } else {
      addIssue(issues, 'warning', 'UNKNOWN_PERSONA', `Unknown studentPersona: ${pair?.studentPersona || ''}`, { where }, { type: 'pair', id: pairId || where });
    }

    const subjects = Array.isArray(pair?.subjects) ? pair.subjects : [];
    subjects.forEach((subject) => {
      const normalized = `${subject || ''}`.trim();
      if (!normalized) {
        addIssue(issues, 'warning', 'EMPTY_SUBJECT', 'Subject entry is empty.', { where }, { type: 'pair', id: pairId || where });
        return;
      }
      subjectCount.set(normalized, (subjectCount.get(normalized) || 0) + 1);
      if (!subjectTargets.has(normalized)) {
        subjectTargets.set(normalized, []);
      }
      subjectTargets.get(normalized).push(pairId || where);
    });
  });

  const duplicatePairText = topNFromMap(pairFingerprintCount, 20)
    .filter((item) => item.count > 1)
    .map((item) => ({
      ...item,
      targets: (pairFingerprintTargets.get(item.key) || []).slice(0, 6),
    }));
  if (duplicatePairText.length > 0) {
    addIssue(
      issues,
      'warning',
      'DUPLICATE_CONVERSATIONS',
      `Found ${duplicatePairText.length} duplicated user+assistant exchanges.`,
      { topDuplicates: duplicatePairText.slice(0, 5) },
      { type: 'pair-group', id: 'duplicate-conversations' }
    );
  }

  const dominantUserPrompts = topNFromMap(userPromptCount, 10).filter((item) => item.count > Math.max(20, Math.floor(pairs.length * 0.1)));
  if (dominantUserPrompts.length > 0) {
    addIssue(
      issues,
      'warning',
      'REPEATED_USER_PROMPTS',
      'Some user prompts repeat heavily and may reduce dataset diversity.',
      { topPrompts: dominantUserPrompts },
      { type: 'pair-group', id: 'repeated-user-prompts' }
    );
  }

  const dominantAssistantReplies = topNFromMap(assistantReplyCount, 10).filter((item) => item.count > Math.max(20, Math.floor(pairs.length * 0.08)));
  if (dominantAssistantReplies.length > 0) {
    addIssue(
      issues,
      'warning',
      'REPEATED_ASSISTANT_REPLIES',
      'Some assistant replies repeat heavily and may reduce dataset diversity.',
      { topReplies: dominantAssistantReplies },
      { type: 'pair-group', id: 'repeated-assistant-replies' }
    );
  }

  const repeatedSubjects = topNFromMap(subjectCount, 20)
    .filter((item) => item.count > Math.max(30, Math.floor(pairs.length * 0.15)))
    .map((item) => ({
      ...item,
      targets: (subjectTargets.get(item.key) || []).slice(0, 8),
    }));
  if (repeatedSubjects.length > 0) {
    addIssue(
      issues,
      'warning',
      'REPEATED_SUBJECTS',
      'Subject distribution is highly concentrated; consider balancing sections/topics.',
      { repeatedSubjects: repeatedSubjects.slice(0, 10) },
      { type: 'subject-group', id: 'repeated-subjects' }
    );
  }

  if (meta?.studentPersonas && typeof meta.studentPersonas === 'object') {
    ['confident', 'confused', 'checkride'].forEach((persona) => {
      const expected = Number(meta.studentPersonas[persona] || 0);
      const observed = Number(personaCountObserved[persona] || 0);
      if (expected !== observed) {
        addIssue(
          issues,
          'warning',
          'PERSONA_COUNT_MISMATCH',
          `Metadata persona count mismatch for ${persona}: expected ${expected}, observed ${observed}.`,
          { persona },
          { type: 'metadata', id: `persona:${persona}` }
        );
      }
    });
  }

  return {
    type: 'conversational',
    filePath,
    pairCount: pairs.length,
    subjectDistributionTop: topNFromMap(subjectCount, 15),
    issues,
  };
}

function analyzeDeterministicPayload(payload, filePath) {
  const issues = [];
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
  const meta = payload?.deterministicTrainingPairSet || {};

  detectDeferredQualityFlag(payload, issues, filePath);

  if (!Array.isArray(payload?.pairs)) {
    addIssue(issues, 'error', 'PAIRS_MISSING', 'Missing pairs array.', { filePath });
  }

  if (typeof meta.totalPairs === 'number' && meta.totalPairs !== pairs.length) {
    addIssue(
      issues,
      'warning',
      'COUNT_MISMATCH',
      `Metadata totalPairs (${meta.totalPairs}) does not match actual pairs length (${pairs.length}).`,
      { filePath }
    );
  }

  const pairIdSet = new Set();
  const byQuestion = new Map();
  const subjectCount = new Map();
  const subjectTargets = new Map();

  pairs.forEach((pair, index) => {
    const where = `pairs[${index}]`;

    validateRequiredString(pair, 'pairId', issues, where);
    validateRequiredString(pair, 'questionid', issues, where);
    validateRequiredString(pair, 'answerId', issues, where);
    validateRequiredString(pair, 'question', issues, where);
    validateRequiredString(pair, 'answer', issues, where);
    validateRequiredString(pair, 'labelText', issues, where);
    validateRequiredArray(pair, 'subjects', issues, where);

    const pairId = `${pair?.pairId || ''}`.trim();
    if (pairId) {
      if (pairIdSet.has(pairId)) {
        addIssue(issues, 'error', 'DUPLICATE_PAIR_ID', `Duplicate pairId: ${pairId}`, { where }, { type: 'pair', id: pairId });
      }
      pairIdSet.add(pairId);
    }

    const numericLabel = Number(pair?.label);
    const labelText = normalizeText(pair?.labelText);
    if (!((numericLabel === 0 && labelText === 'incorrect') || (numericLabel === 1 && labelText === 'correct'))) {
      addIssue(issues, 'error', 'LABEL_MISMATCH', `label (${pair?.label}) does not match labelText (${pair?.labelText}).`, { where }, { type: 'pair', id: pairId || where });
    }

    const questionId = `${pair?.questionid || ''}`.trim();
    if (!byQuestion.has(questionId)) {
      byQuestion.set(questionId, {
        pairCount: 0,
        questionTexts: new Set(),
        answerIds: new Set(),
        correct: 0,
        incorrect: 0,
      });
    }

    const bucket = byQuestion.get(questionId);
    bucket.pairCount += 1;
    bucket.questionTexts.add(normalizeText(pair?.question));

    const answerId = `${pair?.answerId || ''}`.trim();
    if (bucket.answerIds.has(answerId)) {
      addIssue(issues, 'error', 'DUPLICATE_ANSWER_ID_PER_QUESTION', `Duplicate answerId in question ${questionId}: ${answerId}`, { where }, { type: 'question', id: questionId || where });
    }
    bucket.answerIds.add(answerId);

    if (numericLabel === 1) {
      bucket.correct += 1;
    }
    if (numericLabel === 0) {
      bucket.incorrect += 1;
    }

    if (detectTruncatedText(pair?.question)) {
      addIssue(issues, 'warning', 'POTENTIAL_TRUNCATION', 'Question appears truncated.', { where }, { type: 'question', id: questionId || where });
    }
    if (detectTruncatedText(pair?.answer)) {
      addIssue(issues, 'warning', 'POTENTIAL_TRUNCATION', 'Answer appears truncated.', { where }, { type: 'pair', id: pairId || where });
    }

    const subjects = Array.isArray(pair?.subjects) ? pair.subjects : [];
    subjects.forEach((subject) => {
      const normalized = `${subject || ''}`.trim();
      if (!normalized) {
        addIssue(issues, 'warning', 'EMPTY_SUBJECT', 'Subject entry is empty.', { where }, { type: 'pair', id: pairId || where });
        return;
      }
      subjectCount.set(normalized, (subjectCount.get(normalized) || 0) + 1);
      if (!subjectTargets.has(normalized)) {
        subjectTargets.set(normalized, []);
      }
      subjectTargets.get(normalized).push(questionId || pairId || where);
    });
  });

  const expectedPairsPerQuestion = Number(meta.expectedPairsPerQuestion || 0);
  byQuestion.forEach((bucket, questionId) => {
    if (bucket.questionTexts.size > 1) {
      addIssue(
        issues,
        'warning',
        'QUESTION_TEXT_VARIATION',
        `Question text varies within questionid ${questionId}.`,
        { questionId },
        { type: 'question', id: questionId }
      );
    }

    if (expectedPairsPerQuestion > 0 && bucket.pairCount !== expectedPairsPerQuestion) {
      addIssue(
        issues,
        'warning',
        'PAIRS_PER_QUESTION_MISMATCH',
        `questionid ${questionId} has ${bucket.pairCount} pairs, expected ${expectedPairsPerQuestion}.`,
        { questionId },
        { type: 'question', id: questionId }
      );
    }

    if (bucket.correct === 0 || bucket.incorrect === 0) {
      addIssue(
        issues,
        'warning',
        'LABEL_BALANCE_BY_QUESTION',
        `questionid ${questionId} appears one-sided (correct=${bucket.correct}, incorrect=${bucket.incorrect}).`,
        { questionId },
        { type: 'question', id: questionId }
      );
    }
  });

  const repeatedSubjects = topNFromMap(subjectCount, 20)
    .filter((item) => item.count > Math.max(30, Math.floor(pairs.length * 0.2)))
    .map((item) => ({
      ...item,
      targets: (subjectTargets.get(item.key) || []).slice(0, 8),
    }));
  if (repeatedSubjects.length > 0) {
    addIssue(
      issues,
      'warning',
      'REPEATED_SUBJECTS',
      'Subject distribution is highly concentrated; consider balancing section/topic coverage.',
      { repeatedSubjects: repeatedSubjects.slice(0, 10) },
      { type: 'subject-group', id: 'repeated-subjects' }
    );
  }

  return {
    type: 'deterministic',
    filePath,
    pairCount: pairs.length,
    questionCount: byQuestion.size,
    subjectDistributionTop: topNFromMap(subjectCount, 15),
    issues,
  };
}

function analyzeFile(filePath) {
  let raw = '';
  let parsed;

  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return {
      filePath,
      type: 'unknown',
      pairCount: 0,
      issues: [
        {
          severity: 'error',
          code: 'READ_FAILURE',
          message: `Unable to read file: ${error.message}`,
          context: { filePath },
        },
      ],
    };
  }

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      filePath,
      type: 'unknown',
      pairCount: 0,
      issues: [
        {
          severity: 'error',
          code: 'JSON_PARSE_FAILURE',
          message: `Invalid JSON: ${error.message}`,
          context: { filePath },
        },
      ],
    };
  }

  if (parsed && parsed.conversationalTrainingPairSet) {
    return analyzeConversationalPayload(parsed, filePath);
  }

  if (parsed && parsed.deterministicTrainingPairSet) {
    return analyzeDeterministicPayload(parsed, filePath);
  }

  return {
    filePath,
    type: 'unknown',
    pairCount: 0,
    issues: [
      {
        severity: 'warning',
        code: 'UNSUPPORTED_SCHEMA',
        message: 'JSON schema is not recognized as conversational or deterministic pair set.',
        context: { filePath },
      },
    ],
  };
}

function printSummary(results) {
  const totalFiles = results.length;
  const totalPairs = results.reduce((sum, item) => sum + Number(item.pairCount || 0), 0);

  const allIssues = results.flatMap((item) => item.issues || []);
  const bySeverity = countBy(allIssues.map((issue) => issue.severity));

  console.log('Training Pair Quality Audit');
  console.log('==========================');
  console.log(`Files scanned: ${totalFiles}`);
  console.log(`Total pairs:   ${totalPairs}`);
  console.log(`Errors:        ${bySeverity.get('error') || 0}`);
  console.log(`Warnings:      ${bySeverity.get('warning') || 0}`);
  console.log(`Info:          ${bySeverity.get('info') || 0}`);

  const overallRating = computeQualityRating({
    pairCount: totalPairs,
    issues: allIssues,
  });
  console.log(`Quality level: ${overallRating.level.toUpperCase()} (${overallRating.weightedIssuePercent}%)`);
  console.log('');

  results.forEach((result) => {
    const errors = (result.issues || []).filter((issue) => issue.severity === 'error').length;
    const warnings = (result.issues || []).filter((issue) => issue.severity === 'warning').length;
    const rating = computeQualityRating({
      pairCount: result.pairCount || 0,
      issues: result.issues || [],
    });
    console.log(`- ${result.filePath}`);
    console.log(`  type=${result.type}, pairs=${result.pairCount || 0}, errors=${errors}, warnings=${warnings}, rating=${rating.level} (${rating.weightedIssuePercent}%)`);

    const topIssues = (result.issues || []).slice(0, 8);
    topIssues.forEach((issue) => {
      console.log(`    [${issue.severity}] ${issue.code}: ${issue.message}`);
    });

    if ((result.issues || []).length > topIssues.length) {
      console.log(`    ... and ${(result.issues || []).length - topIssues.length} more issue(s)`);
    }

    if (Array.isArray(result.subjectDistributionTop) && result.subjectDistributionTop.length > 0) {
      const topSubjects = result.subjectDistributionTop.slice(0, 5).map((entry) => `${entry.key} (${entry.count})`).join(', ');
      console.log(`    top subjects: ${topSubjects}`);
    }

    console.log('');
  });
}

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    file: '',
    reportPath: '',
    failOnWarning: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root') {
      args.root = argv[i + 1] ? path.resolve(argv[i + 1]) : args.root;
      i += 1;
      continue;
    }
    if (token === '--file') {
      args.file = argv[i + 1] ? path.resolve(argv[i + 1]) : '';
      i += 1;
      continue;
    }
    if (token === '--report') {
      args.reportPath = argv[i + 1] ? path.resolve(argv[i + 1]) : '';
      i += 1;
      continue;
    }
    if (token === '--fail-on-warning') {
      args.failOnWarning = true;
      continue;
    }
  }

  return args;
}

function resolveAuditTargets(options = {}) {
  const root = options.root ? path.resolve(options.root) : DEFAULT_ROOT;
  const files = Array.isArray(options.files) && options.files.length > 0
    ? options.files.map((entry) => path.resolve(entry))
    : (options.file ? [path.resolve(options.file)] : discoverPairFiles(root));

  return {
    root,
    files,
    reportPath: options.reportPath ? path.resolve(options.reportPath) : '',
    failOnWarning: Boolean(options.failOnWarning),
  };
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function aggregateIssueStats(results = []) {
  const issueBuckets = new Map();
  const actionBuckets = new Map();
  const targetBuckets = new Map();

  results.forEach((result) => {
    const issues = Array.isArray(result?.issues) ? result.issues : [];
    issues.forEach((issue) => {
      const code = `${issue?.code || 'UNKNOWN_ISSUE'}`;
      issueBuckets.set(code, (issueBuckets.get(code) || 0) + 1);

      const action = `${issue?.repairGuidance?.action || 'review'}`;
      actionBuckets.set(action, (actionBuckets.get(action) || 0) + 1);

      const targetType = `${issue?.target?.type || ''}`.trim();
      const targetId = `${issue?.target?.id || ''}`.trim();
      if (targetId) {
        const key = targetType ? `${targetType}:${targetId}` : targetId;
        targetBuckets.set(key, (targetBuckets.get(key) || 0) + 1);
      }
    });
  });

  const toTopList = (bucket, limit = 8) => Array.from(bucket.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

  return {
    topIssues: toTopList(issueBuckets, 10),
    recommendedActions: toTopList(actionBuckets, 6),
    affectedTargets: toTopList(targetBuckets, 10),
  };
}

function getTrendLabel(previousPayload, currentPayload) {
  if (!previousPayload || typeof previousPayload !== 'object') {
    return 'N/A (no previous run)';
  }

  const previousPct = toNumber(previousPayload?.overallRating?.weightedIssuePercent, 0);
  const currentPct = toNumber(currentPayload?.overallRating?.weightedIssuePercent, 0);

  if (currentPct < previousPct) {
    return `improved (${previousPct}% -> ${currentPct}%)`;
  }
  if (currentPct > previousPct) {
    return `worse (${previousPct}% -> ${currentPct}%)`;
  }
  return `stable (${currentPct}%)`;
}

function buildMarkdownReport(payload, previousPayload = null) {
  const stats = aggregateIssueStats(payload?.results || []);
  const overall = payload?.overallRating || {};
  const trend = getTrendLabel(previousPayload, payload);

  const lines = [];
  lines.push('# Training Pair Quality Report');
  lines.push('');
  lines.push('## Run Metadata');
  lines.push(`- Generated At (UTC): ${payload?.generatedAtUtc || 'N/A'}`);
  lines.push(`- Root: ${payload?.root || 'N/A'}`);
  lines.push(`- File Count: ${toNumber(payload?.fileCount, 0)}`);
  lines.push(`- Total Pairs: ${toNumber(payload?.totalPairs, 0)}`);
  lines.push('');

  lines.push('## Quality Rating');
  lines.push(`- Level: ${`${overall?.level || 'unknown'}`.toUpperCase()}`);
  lines.push(`- Weighted Issue Percent: ${toNumber(overall?.weightedIssuePercent, 0)}%`);
  lines.push(`- Errors: ${toNumber(overall?.errorCount, 0)}`);
  lines.push(`- Warnings: ${toNumber(overall?.warningCount, 0)}`);
  lines.push('');

  lines.push('## Top Issues');
  if (stats.topIssues.length === 0) {
    lines.push('- None');
  } else {
    stats.topIssues.forEach((entry) => {
      lines.push(`- ${entry.key}: ${entry.count}`);
    });
  }
  lines.push('');

  lines.push('## Affected Sections/Targets');
  if (stats.affectedTargets.length === 0) {
    lines.push('- None');
  } else {
    stats.affectedTargets.forEach((entry) => {
      lines.push(`- ${entry.key}: ${entry.count}`);
    });
  }
  lines.push('');

  lines.push('## Recommended Actions');
  if (stats.recommendedActions.length === 0) {
    lines.push('- None');
  } else {
    stats.recommendedActions.forEach((entry) => {
      lines.push(`- ${entry.key}: ${entry.count}`);
    });
  }
  lines.push('');

  lines.push('## Change vs Previous Run');
  lines.push(`- Trend: ${trend}`);
  lines.push('');

  lines.push('## Per-File Summary');
  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (results.length === 0) {
    lines.push('- No files analyzed.');
  } else {
    results.forEach((result) => {
      const issues = Array.isArray(result?.issues) ? result.issues : [];
      const errors = issues.filter((issue) => issue?.severity === 'error').length;
      const warnings = issues.filter((issue) => issue?.severity === 'warning').length;
      const rating = computeQualityRating({
        pairCount: Number(result?.pairCount || 0),
        issues,
      });
      lines.push(`- ${result?.filePath || 'unknown file'}`);
      lines.push(`  - Type: ${result?.type || 'unknown'}`);
      lines.push(`  - Pairs: ${toNumber(result?.pairCount, 0)}`);
      lines.push(`  - Errors: ${errors}`);
      lines.push(`  - Warnings: ${warnings}`);
      lines.push(`  - Rating: ${`${rating?.level || 'unknown'}`.toUpperCase()} (${toNumber(rating?.weightedIssuePercent, 0)}%)`);
    });
  }

  return `${lines.join('\n').trim()}\n`;
}

function performAudit(options = {}) {
  const resolved = resolveAuditTargets(options);
  const files = resolved.files;

  let previousPayload = null;
  if (resolved.reportPath && fs.existsSync(resolved.reportPath)) {
    try {
      previousPayload = JSON.parse(fs.readFileSync(resolved.reportPath, 'utf8'));
    } catch {
      previousPayload = null;
    }
  }

  if (files.length === 0) {
    return {
      ok: false,
      exitCode: 2,
      root: resolved.root,
      files,
      results: [],
      message: `No pair files found. root=${resolved.root}`,
    };
  }

  const results = files.map((filePath) => analyzeFile(filePath));

  const allIssues = results.flatMap((item) => item.issues || []);
  const totalPairs = results.reduce((sum, item) => sum + Number(item.pairCount || 0), 0);
  const overallRating = computeQualityRating({
    pairCount: totalPairs,
    issues: allIssues,
  });

  const hasErrors = allIssues.some((issue) => issue.severity === 'error');
  const hasWarnings = allIssues.some((issue) => issue.severity === 'warning');
  const failed = hasErrors || (resolved.failOnWarning && hasWarnings);

  const payload = {
    generatedAtUtc: new Date().toISOString(),
    root: resolved.root,
    fileCount: files.length,
    totalPairs,
    overallRating,
    results,
  };

  if (resolved.reportPath) {
    fs.writeFileSync(resolved.reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const markdownPath = resolved.reportPath.toLowerCase().endsWith('.json')
      ? resolved.reportPath.replace(/\.json$/i, '.md')
      : `${resolved.reportPath}.md`;
    const markdownReport = buildMarkdownReport(payload, previousPayload);
    fs.writeFileSync(markdownPath, markdownReport, 'utf8');
  }

  return {
    ok: !failed,
    exitCode: failed ? 1 : 0,
    root: resolved.root,
    files,
    totalPairs,
    overallRating,
    results,
    reportPath: resolved.reportPath || '',
    markdownReportPath: resolved.reportPath
      ? (resolved.reportPath.toLowerCase().endsWith('.json')
        ? resolved.reportPath.replace(/\.json$/i, '.md')
        : `${resolved.reportPath}.md`)
      : '',
    payload,
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const auditResult = performAudit(args);

  if (!auditResult.ok && auditResult.exitCode === 2) {
    console.error(auditResult.message || `No pair files found. root=${auditResult.root}`);
    process.exitCode = 2;
    return;
  }

  printSummary(auditResult.results || []);

  if (auditResult.reportPath) {
    console.log(`Report saved to: ${auditResult.reportPath}`);
  }
  if (auditResult.markdownReportPath) {
    console.log(`Markdown report saved to: ${auditResult.markdownReportPath}`);
  }

  process.exitCode = auditResult.exitCode;
}

if (require.main === module) {
  run();
}

module.exports = {
  discoverPairFiles,
  analyzeFile,
  performAudit,
  resolveAuditTargets,
};
