const QUALITY_LEVELS = {
  OPTIMUM: 'optimum',
  ACCEPTABLE: 'acceptable',
  CRITICAL: 'critical',
  CATASTROPHIC: 'catastrophic',
};

const SEVERITY_WEIGHTS = {
  error: 1.0,
  warning: 0.25,
  info: 0.0,
};

const LEVEL_THRESHOLDS = {
  // weighted issue score <= 0.5%
  optimumMax: 0.005,
  // weighted issue score <= 2%
  acceptableMax: 0.02,
  // weighted issue score <= 7%
  criticalMax: 0.07,
};

const FATAL_ISSUE_CODES = new Set([
  'READ_FAILURE',
  'JSON_PARSE_FAILURE',
  'PAIRS_MISSING',
  'BAD_TURNS_SHAPE',
  'BAD_USER_ROLE',
  'BAD_ASSISTANT_ROLE',
  'REQUIRED_STRING',
  'REQUIRED_ARRAY',
  'DUPLICATE_PAIR_ID',
  'DUPLICATE_ANSWER_ID_PER_QUESTION',
  'LABEL_MISMATCH',
  'UNSUPPORTED_SCHEMA',
]);

function normalizeSeverity(input) {
  const value = `${input || ''}`.trim().toLowerCase();
  if (value === 'error' || value === 'warning' || value === 'info') {
    return value;
  }
  return 'warning';
}

function summarizeIssues(issues) {
  const safeIssues = Array.isArray(issues) ? issues : [];
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let fatalIssueCount = 0;

  safeIssues.forEach((issue) => {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === 'error') {
      errorCount += 1;
    } else if (severity === 'warning') {
      warningCount += 1;
    } else {
      infoCount += 1;
    }

    const issueCode = `${issue?.code || ''}`.trim().toUpperCase();
    if (FATAL_ISSUE_CODES.has(issueCode)) {
      fatalIssueCount += 1;
    }
  });

  return {
    errorCount,
    warningCount,
    infoCount,
    fatalIssueCount,
  };
}

function computeQualityRating({ pairCount, issues }) {
  const totalPairs = Math.max(1, Number(pairCount || 0));
  const summary = summarizeIssues(issues);

  const weightedIssueCount = (summary.errorCount * SEVERITY_WEIGHTS.error)
    + (summary.warningCount * SEVERITY_WEIGHTS.warning)
    + (summary.infoCount * SEVERITY_WEIGHTS.info);

  const weightedIssueRate = weightedIssueCount / totalPairs;

  let level = QUALITY_LEVELS.CATASTROPHIC;

  if (summary.fatalIssueCount > 0) {
    level = QUALITY_LEVELS.CATASTROPHIC;
  } else if (weightedIssueRate <= LEVEL_THRESHOLDS.optimumMax) {
    level = QUALITY_LEVELS.OPTIMUM;
  } else if (weightedIssueRate <= LEVEL_THRESHOLDS.acceptableMax) {
    level = QUALITY_LEVELS.ACCEPTABLE;
  } else if (weightedIssueRate <= LEVEL_THRESHOLDS.criticalMax) {
    level = QUALITY_LEVELS.CRITICAL;
  } else {
    level = QUALITY_LEVELS.CATASTROPHIC;
  }

  return {
    level,
    weightedIssueRate,
    weightedIssuePercent: Number((weightedIssueRate * 100).toFixed(3)),
    weightedIssueCount: Number(weightedIssueCount.toFixed(3)),
    thresholds: {
      optimumMaxPercent: LEVEL_THRESHOLDS.optimumMax * 100,
      acceptableMaxPercent: LEVEL_THRESHOLDS.acceptableMax * 100,
      criticalMaxPercent: LEVEL_THRESHOLDS.criticalMax * 100,
    },
    ...summary,
  };
}

module.exports = {
  QUALITY_LEVELS,
  LEVEL_THRESHOLDS,
  FATAL_ISSUE_CODES,
  SEVERITY_WEIGHTS,
  computeQualityRating,
};
