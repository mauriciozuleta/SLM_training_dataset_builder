const fs = require('fs/promises');
const path = require('path');
const { FATAL_ISSUE_CODES, QUALITY_LEVELS } = require('../../../../scripts/quality_rating_rules');

const DEFAULT_MEMORY_FILE = path.join(process.cwd(), 'test_output_files', 'quality_feedback_memory.json');
const DEFAULT_STABILITY_RULES = {
  consecutiveOptimumRuns: 3,
  recurringHighImpactThreshold: 2,
  highImpactWindow: 5,
};

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function defaultMemory() {
  return {
    updatedAtUtc: new Date().toISOString(),
    runs: [],
    issueStats: {},
    successfulFixes: {},
    stability: {
      isStableOptimum: false,
      checkedAtUtc: '',
      consecutiveOptimumRuns: 0,
      reasons: [],
    },
  };
}

async function readMemoryFile(memoryPath = DEFAULT_MEMORY_FILE) {
  try {
    const raw = await fs.readFile(memoryPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return defaultMemory();
    }
    return {
      ...defaultMemory(),
      ...parsed,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      issueStats: parsed.issueStats && typeof parsed.issueStats === 'object' ? parsed.issueStats : {},
      successfulFixes: parsed.successfulFixes && typeof parsed.successfulFixes === 'object' ? parsed.successfulFixes : {},
    };
  } catch {
    return defaultMemory();
  }
}

async function writeMemoryFile(memoryPayload, memoryPath = DEFAULT_MEMORY_FILE) {
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  await fs.writeFile(memoryPath, `${JSON.stringify(memoryPayload, null, 2)}\n`, 'utf8');
}

function collectIssues(auditResult = {}) {
  const results = Array.isArray(auditResult?.results) ? auditResult.results : [];
  const issues = [];

  results.forEach((result) => {
    const issueList = Array.isArray(result?.issues) ? result.issues : [];
    issueList.forEach((issue) => {
      issues.push({
        code: normalizeText(issue?.code) || 'UNKNOWN_ISSUE',
        severity: normalizeText(issue?.severity) || 'warning',
        instruction: normalizeText(issue?.repairGuidance?.instruction) || normalizeText(issue?.message),
        action: normalizeText(issue?.repairGuidance?.action) || 'review',
      });
    });
  });

  return issues;
}

function summarizeRun(auditResult = {}, decision = 'close', postAuditResult = null) {
  const issues = collectIssues(auditResult);
  const overall = auditResult?.overallRating || {};
  const finalOverall = postAuditResult?.overallRating || overall;
  const uniqueIssueCodes = Array.from(new Set(issues.map((issue) => issue.code))).sort();
  const fatalCodes = uniqueIssueCodes.filter((code) => FATAL_ISSUE_CODES.has(code));

  return {
    atUtc: new Date().toISOString(),
    decision,
    totalIssues: issues.length,
    issueCodes: uniqueIssueCodes,
    fatalIssueCodes: fatalCodes,
    fatalIssueCount: fatalCodes.length,
    beforeWeightedIssuePercent: toNumber(overall?.weightedIssuePercent, 0),
    afterWeightedIssuePercent: postAuditResult
      ? toNumber(postAuditResult?.overallRating?.weightedIssuePercent, toNumber(overall?.weightedIssuePercent, 0))
      : toNumber(overall?.weightedIssuePercent, 0),
    beforeLevel: normalizeText(overall?.level) || 'unknown',
    afterLevel: normalizeText(finalOverall?.level) || 'unknown',
    improved: Boolean(postAuditResult)
      && toNumber(postAuditResult?.overallRating?.weightedIssuePercent, 0) < toNumber(overall?.weightedIssuePercent, 0),
  };
}

function getRecentRuns(memoryPayload, count) {
  const runs = Array.isArray(memoryPayload?.runs) ? memoryPayload.runs : [];
  return runs.slice(-Math.max(1, Number(count) || 1));
}

function getRecurringHighImpactCodes(memoryPayload, rules = {}) {
  const threshold = toNumber(rules.recurringHighImpactThreshold, DEFAULT_STABILITY_RULES.recurringHighImpactThreshold);
  const windowSize = toNumber(rules.highImpactWindow, DEFAULT_STABILITY_RULES.highImpactWindow);
  const recentRuns = getRecentRuns(memoryPayload, windowSize);
  const counts = new Map();

  recentRuns.forEach((run) => {
    const codes = Array.isArray(run?.fatalIssueCodes) && run.fatalIssueCodes.length > 0
      ? run.fatalIssueCodes
      : [];
    Array.from(new Set(codes)).forEach((code) => {
      counts.set(code, (counts.get(code) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count >= threshold)
    .map(([code, count]) => ({ code, count }));
}

function evaluateStability(memoryPayload, rules = {}) {
  const mergedRules = {
    ...DEFAULT_STABILITY_RULES,
    ...(rules && typeof rules === 'object' ? rules : {}),
  };

  const requiredRuns = toNumber(mergedRules.consecutiveOptimumRuns, DEFAULT_STABILITY_RULES.consecutiveOptimumRuns);
  const recentRuns = getRecentRuns(memoryPayload, requiredRuns);
  const reasons = [];

  if (recentRuns.length < requiredRuns) {
    reasons.push(`Need ${requiredRuns} consecutive runs; only ${recentRuns.length} recorded.`);
  }

  const optimumStreak = recentRuns.length > 0
    ? recentRuns.every((run) => normalizeText(run?.afterLevel) === QUALITY_LEVELS.OPTIMUM)
    : false;

  if (!optimumStreak) {
    reasons.push(`Last ${requiredRuns} runs are not all OPTIMUM.`);
  }

  const latestRun = recentRuns[recentRuns.length - 1] || null;
  if (latestRun && toNumber(latestRun?.fatalIssueCount, 0) > 0) {
    reasons.push('Latest run has severe structural issues.');
  }

  const recurringHighImpact = getRecurringHighImpactCodes(memoryPayload, mergedRules);
  if (recurringHighImpact.length > 0) {
    reasons.push(`Recurring high-impact issue(s) above threshold: ${recurringHighImpact.map((entry) => `${entry.code} (${entry.count})`).join(', ')}`);
  }

  return {
    isStableOptimum: reasons.length === 0,
    checkedAtUtc: new Date().toISOString(),
    rules: mergedRules,
    consecutiveOptimumRuns: optimumStreak ? recentRuns.length : 0,
    recurringHighImpact,
    latestRun: latestRun || null,
    reasons,
  };
}

function buildGuardrailsFromMemory(memoryPayload, maxItems = 6) {
  const issueEntries = Object.entries(memoryPayload?.issueStats || {})
    .map(([code, data]) => ({
      code,
      count: toNumber(data?.count, 0),
      instruction: normalizeText(data?.instruction),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, Number(maxItems) || 6));

  const fixEntries = Object.entries(memoryPayload?.successfulFixes || {})
    .map(([code, data]) => ({
      code,
      count: toNumber(data?.count, 0),
      instruction: normalizeText(data?.instruction),
      action: normalizeText(data?.action),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, Number(maxItems) || 6));

  const lines = [];
  if (issueEntries.length > 0) {
    lines.push('Recurring quality risks from previous runs:');
    issueEntries.forEach((entry) => {
      const instruction = entry.instruction ? ` | avoid by: ${entry.instruction}` : '';
      lines.push(`- ${entry.code} (seen ${entry.count}x)${instruction}`);
    });
  }

  if (fixEntries.length > 0) {
    lines.push('Previously successful fixes to apply as constraints:');
    fixEntries.forEach((entry) => {
      const action = entry.action ? ` via ${entry.action}` : '';
      const instruction = entry.instruction ? ` | ${entry.instruction}` : '';
      lines.push(`- ${entry.code}${action} (success ${entry.count}x)${instruction}`);
    });
  }

  return lines.join(' ');
}

function mergeIssueStats(memoryPayload, issues) {
  issues.forEach((issue) => {
    const code = issue.code;
    const current = memoryPayload.issueStats[code] || {
      count: 0,
      severity: issue.severity,
      instruction: issue.instruction,
      lastSeenUtc: '',
    };

    memoryPayload.issueStats[code] = {
      ...current,
      count: toNumber(current.count, 0) + 1,
      severity: issue.severity || current.severity,
      instruction: issue.instruction || current.instruction,
      lastSeenUtc: new Date().toISOString(),
    };
  });
}

function markSuccessfulFixes(memoryPayload, issues, decision, improved) {
  if (!improved) {
    return;
  }

  issues.forEach((issue) => {
    const code = issue.code;
    const current = memoryPayload.successfulFixes[code] || {
      count: 0,
      action: decision,
      instruction: issue.instruction,
      lastSuccessUtc: '',
    };

    memoryPayload.successfulFixes[code] = {
      ...current,
      count: toNumber(current.count, 0) + 1,
      action: decision || current.action,
      instruction: issue.instruction || current.instruction,
      lastSuccessUtc: new Date().toISOString(),
    };
  });
}

async function updateQualityMemoryFromAudit(options = {}) {
  const memoryPath = normalizeText(options?.memoryPath) ? path.resolve(options.memoryPath) : DEFAULT_MEMORY_FILE;
  const auditResult = options?.auditResult || {};
  const postAuditResult = options?.postAuditResult || null;
  const decision = normalizeText(options?.decision) || 'close';

  const memoryPayload = await readMemoryFile(memoryPath);
  const issues = collectIssues(auditResult);
  const beforePct = toNumber(auditResult?.overallRating?.weightedIssuePercent, 0);
  const afterPct = postAuditResult ? toNumber(postAuditResult?.overallRating?.weightedIssuePercent, beforePct) : beforePct;
  const improved = Boolean(postAuditResult) && afterPct < beforePct;

  mergeIssueStats(memoryPayload, issues);
  markSuccessfulFixes(memoryPayload, issues, decision, improved);

  memoryPayload.runs.push(summarizeRun(auditResult, decision, postAuditResult));

  memoryPayload.runs = memoryPayload.runs.slice(-120);
  memoryPayload.updatedAtUtc = new Date().toISOString();
  memoryPayload.stability = evaluateStability(memoryPayload, options?.stabilityRules || {});

  await writeMemoryFile(memoryPayload, memoryPath);

  return {
    ok: true,
    memoryPath,
    totalTrackedIssues: Object.keys(memoryPayload.issueStats).length,
    totalSuccessfulFixPatterns: Object.keys(memoryPayload.successfulFixes).length,
    guardrails: buildGuardrailsFromMemory(memoryPayload, toNumber(options?.maxGuardrails, 6)),
    stability: memoryPayload.stability,
  };
}

async function getQualityGuardrails(options = {}) {
  const memoryPath = normalizeText(options?.memoryPath) ? path.resolve(options.memoryPath) : DEFAULT_MEMORY_FILE;
  const maxItems = toNumber(options?.maxItems, 6);
  const memoryPayload = await readMemoryFile(memoryPath);

  return {
    ok: true,
    memoryPath,
    updatedAtUtc: memoryPayload.updatedAtUtc,
    guardrails: buildGuardrailsFromMemory(memoryPayload, maxItems),
    trackedIssueCount: Object.keys(memoryPayload.issueStats || {}).length,
    successfulFixPatternCount: Object.keys(memoryPayload.successfulFixes || {}).length,
    stability: evaluateStability(memoryPayload, options?.stabilityRules || {}),
  };
}

async function getQualityStabilityStatus(options = {}) {
  const memoryPath = normalizeText(options?.memoryPath) ? path.resolve(options.memoryPath) : DEFAULT_MEMORY_FILE;
  const memoryPayload = await readMemoryFile(memoryPath);
  const stability = evaluateStability(memoryPayload, options?.stabilityRules || {});

  return {
    ok: true,
    memoryPath,
    updatedAtUtc: memoryPayload.updatedAtUtc,
    stability,
  };
}

module.exports = {
  getQualityGuardrails,
  getQualityStabilityStatus,
  updateQualityMemoryFromAudit,
};
