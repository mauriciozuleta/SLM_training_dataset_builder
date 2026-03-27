#!/usr/bin/env node

const path = require('path');
const { getQualityStabilityStatus } = require('../src/main/services/documentGeneration/qualityMemoryService');

function parseArgs(argv) {
  const args = {
    memoryPath: '',
    requireStable: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--memory') {
      args.memoryPath = argv[index + 1] ? path.resolve(argv[index + 1]) : '';
      index += 1;
      continue;
    }
    if (token === '--require-stable') {
      args.requireStable = true;
      continue;
    }
  }

  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = await getQualityStabilityStatus({
    memoryPath: args.memoryPath,
  });

  const stability = result?.stability || {};
  const latestRun = stability?.latestRun || null;

  console.log('Quality Stability Check');
  console.log('=======================');
  console.log(`Memory: ${result?.memoryPath || 'N/A'}`);
  console.log(`Stable Optimum: ${stability?.isStableOptimum ? 'YES' : 'NO'}`);
  console.log(`Consecutive Optimum Runs: ${Number(stability?.consecutiveOptimumRuns || 0)}`);
  if (latestRun) {
    console.log(`Latest Run Level: ${`${latestRun?.afterLevel || 'unknown'}`.toUpperCase()}`);
    console.log(`Latest Run Weighted Issue %: ${Number(latestRun?.afterWeightedIssuePercent || 0)}%`);
  }
  if (Array.isArray(stability?.recurringHighImpact) && stability.recurringHighImpact.length > 0) {
    console.log(`Recurring High-Impact Issues: ${stability.recurringHighImpact.map((entry) => `${entry.code} (${entry.count})`).join(', ')}`);
  }

  if (Array.isArray(stability?.reasons) && stability.reasons.length > 0) {
    console.log('Reasons:');
    stability.reasons.forEach((reason) => {
      console.log(`- ${reason}`);
    });
  }

  if (args.requireStable && !stability?.isStableOptimum) {
    console.error('Stable optimum criteria not yet met.');
    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
