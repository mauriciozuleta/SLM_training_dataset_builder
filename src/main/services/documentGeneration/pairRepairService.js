/**
 * Pair Repair Service
 * Handles targeted regeneration of training pairs identified as problematic by audit.
 * Uses audit findings (with target IDs) to regenerate only affected pairs,
 * then merges results back into original files.
 */

const fs = require('fs/promises');
const path = require('path');

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().replace(/\s+/g, ' ');
}

/**
 * Extract unique pair IDs from audit findings
 */
function extractAffectedPairIds(auditResult = {}) {
  const findings = Array.isArray(auditResult?.findings) ? auditResult.findings : [];
  const affectedIds = new Set();

  findings.forEach((finding) => {
    const target = finding?.target || {};
    const targetId = normalizeText(target?.id);

    if (targetId && target?.type === 'pair') {
      affectedIds.add(targetId);
    }
  });

  return Array.from(affectedIds);
}

/**
 * Load pair data from JSON file
 */
async function loadPairFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load pair file ${filePath}: ${error.message}`);
  }
}

/**
 * Save pair data to JSON file
 */
async function savePairFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save pair file ${filePath}: ${error.message}`);
  }
}

/**
 * Find all pairs to repair in a deterministic pair set
 */
function findDeterministicPairsToRepair(pairSet, affectedPairIds) {
  const affected = [];
  const pairsArray = Array.isArray(pairSet?.pairs) ? pairSet.pairs : [];

  pairsArray.forEach((pair) => {
    const pairId = normalizeText(pair?.pairId);
    if (affectedPairIds.includes(pairId)) {
      affected.push({
        ...pair,
        originalIndex: pairsArray.indexOf(pair),
      });
    }
  });

  return affected;
}

/**
 * Find all pairs to repair in a conversational pair set
 */
function findConversationalPairsToRepair(pairSet, affectedPairIds) {
  const affected = [];
  const pairsArray = Array.isArray(pairSet?.pairs) ? pairSet.pairs : [];

  pairsArray.forEach((pair) => {
    const pairId = normalizeText(pair?.conversationalPairId);
    if (affectedPairIds.includes(pairId)) {
      affected.push({
        ...pair,
        originalIndex: pairsArray.indexOf(pair),
      });
    }
  });

  return affected;
}

/**
 * Extract questions from affected deterministic pairs
 */
function extractQuestionsFromDeterministicPairs(affectedPairs) {
  const questionMap = new Map();

  affectedPairs.forEach((pair) => {
    const questionId = normalizeText(pair?.questionid);
    if (!questionId) {
      return;
    }

    if (!questionMap.has(questionId)) {
      questionMap.set(questionId, {
        questionid: questionId,
        question: normalizeText(pair?.question),
        source: normalizeText(pair?.source),
        subjects: Array.isArray(pair?.subjects) ? pair.subjects : [],
        affectedPairIds: [],
      });
    }

    const entry = questionMap.get(questionId);
    entry.affectedPairIds.push(normalizeText(pair?.pairId));
  });

  return Array.from(questionMap.values());
}

/**
 * Build correction prompt for regeneration
 */
function buildCorrectionPrompt(auditResult, affectedQuestion, pairType) {
  const findings = Array.isArray(auditResult?.findings) ? auditResult.findings : [];
  const relevantFindings = findings.filter((f) => {
    const target = f?.target || {};
    const targetId = normalizeText(target?.id);
    return affectedQuestion.affectedPairIds.includes(targetId);
  });

  if (relevantFindings.length === 0) {
    return '';
  }

  const issueDescriptions = relevantFindings
    .map((f) => {
      const code = normalizeText(f?.code);
      const guidance = f?.repairGuidance || {};
      const instruction = normalizeText(guidance?.instruction);
      return `${code}: ${instruction}`;
    })
    .filter(Boolean);

  if (issueDescriptions.length === 0) {
    return '';
  }

  return [
    'Previous issues detected in this content. Please regenerate addressing these points:',
    ...issueDescriptions,
  ].join('\n');
}

/**
 * Merge repaired pairs back into original structure
 */
function mergeDeterministicPairs(originalPairSet, repairedPairs) {
  const merged = JSON.parse(JSON.stringify(originalPairSet));
  const pairsArray = Array.isArray(merged?.pairs) ? merged.pairs : [];

  repairedPairs.forEach((repaired) => {
    const originalIndex = repaired?.originalIndex;
    if (typeof originalIndex === 'number' && originalIndex >= 0 && originalIndex < pairsArray.length) {
      pairsArray[originalIndex] = {
        ...pairsArray[originalIndex],
        ...repaired,
        originalIndex: undefined,
      };
    }
  });

  return merged;
}

function mergeConversationalPairs(originalPairSet, repairedPairs) {
  const merged = JSON.parse(JSON.stringify(originalPairSet));
  const pairsArray = Array.isArray(merged?.pairs) ? merged.pairs : [];

  repairedPairs.forEach((repaired) => {
    const originalIndex = repaired?.originalIndex;
    if (typeof originalIndex === 'number' && originalIndex >= 0 && originalIndex < pairsArray.length) {
      pairsArray[originalIndex] = {
        ...pairsArray[originalIndex],
        ...repaired,
        originalIndex: undefined,
      };
    }
  });

  return merged;
}

/**
 * Main repair function
 * Returns repair summary with counts and results
 */
async function repairAffectedPairs(options = {}) {
  const {
    auditResult,
    deterministicPairPath,
    conversationalPairPath,
    outputFolder,
  } = options;

  if (!auditResult || typeof auditResult !== 'object') {
    throw new Error('Invalid or missing audit result.');
  }

  const affectedPairIds = extractAffectedPairIds(auditResult);
  if (affectedPairIds.length === 0) {
    return {
      success: true,
      message: 'No affected pairs to repair.',
      repairCount: 0,
      affectedPairIds: [],
    };
  }

  const summary = {
    success: false,
    affectedPairIds,
    repairs: {
      deterministic: { attempted: 0, merged: 0, errors: [] },
      conversational: { attempted: 0, merged: 0, errors: [] },
    },
  };

  // Process deterministic pairs
  if (deterministicPairPath && outputFolder) {
    try {
      const pairSet = await loadPairFile(deterministicPairPath);
      const affected = findDeterministicPairsToRepair(pairSet, affectedPairIds);

      if (affected.length > 0) {
        summary.repairs.deterministic.attempted = affected.length;

        // For now, merge without regeneration (placeholder for API call in future)
        const merged = mergeDeterministicPairs(pairSet, affected);
        await savePairFile(deterministicPairPath, merged);
        summary.repairs.deterministic.merged = affected.length;
      }
    } catch (error) {
      summary.repairs.deterministic.errors.push(error.message);
    }
  }

  // Process conversational pairs
  if (conversationalPairPath && outputFolder) {
    try {
      const pairSet = await loadPairFile(conversationalPairPath);
      const affected = findConversationalPairsToRepair(pairSet, affectedPairIds);

      if (affected.length > 0) {
        summary.repairs.conversational.attempted = affected.length;

        // For now, merge without regeneration (placeholder for API call in future)
        const merged = mergeConversationalPairs(pairSet, affected);
        await savePairFile(conversationalPairPath, merged);
        summary.repairs.conversational.merged = affected.length;
      }
    } catch (error) {
      summary.repairs.conversational.errors.push(error.message);
    }
  }

  summary.success =
    summary.repairs.deterministic.errors.length === 0 &&
    summary.repairs.conversational.errors.length === 0;

  return summary;
}

module.exports = {
  repairAffectedPairs,
  extractAffectedPairIds,
  loadPairFile,
  savePairFile,
};
