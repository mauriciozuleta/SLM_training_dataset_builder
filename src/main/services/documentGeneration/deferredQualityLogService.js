const fs = require('fs/promises');
const path = require('path');

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPendingRepairs(auditResult = {}) {
  const results = toArray(auditResult?.results);
  const pending = [];

  results.forEach((result) => {
    const filePath = normalizeText(result?.filePath);
    const issues = toArray(result?.issues);

    issues.forEach((issue) => {
      const guidance = issue?.repairGuidance || {};
      const action = normalizeText(guidance?.action) || 'metadata-flag';
      const target = issue?.target || {};
      pending.push({
        filePath,
        severity: normalizeText(issue?.severity) || 'warning',
        code: normalizeText(issue?.code) || 'UNKNOWN_ISSUE',
        message: normalizeText(issue?.message),
        target: {
          type: normalizeText(target?.type) || normalizeText(guidance?.scope) || 'file',
          id: normalizeText(target?.id) || filePath || 'unknown',
        },
        repairGuidance: {
          action,
          scope: normalizeText(guidance?.scope) || 'file',
          instruction: normalizeText(guidance?.instruction) || 'Review and repair in a later pass.',
        },
      });
    });
  });

  return pending;
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJsonFile(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function getFileIssueSummary(pendingRepairs, filePath) {
  const subset = pendingRepairs.filter((item) => normalizeText(item.filePath) === normalizeText(filePath));
  const uniqueCodes = Array.from(new Set(subset.map((item) => item.code))).sort();
  return {
    issueCount: subset.length,
    issueCodes: uniqueCodes,
  };
}

async function annotateDatasetFile(filePath, options = {}) {
  const payload = await readJsonFile(filePath);
  const pendingRepairs = toArray(options.pendingRepairs);
  const deferredAtUtc = normalizeText(options.deferredAtUtc) || new Date().toISOString();
  const deferredLogPath = normalizeText(options.deferredLogPath);

  const fileSummary = getFileIssueSummary(pendingRepairs, filePath);

  payload.qualityFeedback = {
    unresolvedQualityIssues: true,
    deferredForLater: true,
    deferredAtUtc,
    deferredIssueCount: fileSummary.issueCount,
    deferredIssueCodes: fileSummary.issueCodes,
    deferredLogPath,
    readiness: {
      canTrain: false,
      status: 'blocked-until-repair-or-override',
      message: 'Deferred quality issues are pending repair. Run readiness check before training.',
    },
  };

  if (payload.deterministicTrainingPairSet && typeof payload.deterministicTrainingPairSet === 'object') {
    payload.deterministicTrainingPairSet.qualityStatus = {
      unresolvedQualityIssues: true,
      deferredAtUtc,
      deferredIssueCount: fileSummary.issueCount,
    };
  }

  if (payload.conversationalTrainingPairSet && typeof payload.conversationalTrainingPairSet === 'object') {
    payload.conversationalTrainingPairSet.qualityStatus = {
      unresolvedQualityIssues: true,
      deferredAtUtc,
      deferredIssueCount: fileSummary.issueCount,
    };
  }

  await writeJsonFile(filePath, payload);

  return {
    filePath,
    deferredIssueCount: fileSummary.issueCount,
    deferredIssueCodes: fileSummary.issueCodes,
  };
}

async function persistDeferredQualityLog(options = {}) {
  const auditResult = options?.auditResult || {};
  const files = toArray(options?.files).map((entry) => path.resolve(entry));
  const deferredAtUtc = new Date().toISOString();
  const deferredLogPath = normalizeText(options?.deferredLogPath)
    ? path.resolve(options.deferredLogPath)
    : '';

  if (files.length === 0) {
    throw new Error('No dataset files provided for defer-log action.');
  }

  const pendingRepairs = buildPendingRepairs(auditResult);

  const annotations = [];
  for (const filePath of files) {
    try {
      const annotated = await annotateDatasetFile(filePath, {
        pendingRepairs,
        deferredAtUtc,
        deferredLogPath,
      });
      annotations.push({ ok: true, ...annotated });
    } catch (error) {
      annotations.push({ ok: false, filePath, error: error.message });
    }
  }

  const deferredLog = {
    generatedAtUtc: deferredAtUtc,
    decision: 'defer-log',
    overallRating: auditResult?.overallRating || {},
    totalPendingIssues: pendingRepairs.length,
    files,
    annotations,
    pendingRepairs,
  };

  if (deferredLogPath) {
    await fs.mkdir(path.dirname(deferredLogPath), { recursive: true });
    await writeJsonFile(deferredLogPath, deferredLog);
  }

  const failed = annotations.some((entry) => !entry.ok);

  return {
    ok: !failed,
    deferredAtUtc,
    deferredLogPath,
    totalPendingIssues: pendingRepairs.length,
    filesAnnotated: annotations.filter((entry) => entry.ok).length,
    annotations,
    pendingRepairs,
  };
}

module.exports = {
  persistDeferredQualityLog,
};
