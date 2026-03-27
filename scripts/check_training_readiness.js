#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { discoverPairFiles } = require('./audit_training_pairs');

const DEFAULT_ROOT = path.join(process.cwd(), 'test_output_files');

function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    files: [],
    blockOnUnresolved: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root') {
      args.root = argv[i + 1] ? path.resolve(argv[i + 1]) : args.root;
      i += 1;
      continue;
    }
    if (token === '--file') {
      if (argv[i + 1]) {
        args.files.push(path.resolve(argv[i + 1]));
      }
      i += 1;
      continue;
    }
    if (token === '--block-on-unresolved') {
      args.blockOnUnresolved = true;
      continue;
    }
  }

  return args;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function checkFileReadiness(filePath) {
  try {
    const payload = loadJson(filePath);
    const unresolved = Boolean(payload?.qualityFeedback?.unresolvedQualityIssues);
    const canTrain = payload?.qualityFeedback?.readiness?.canTrain;

    if (unresolved || canTrain === false) {
      const pending = Number(payload?.qualityFeedback?.deferredIssueCount || 0);
      const message = payload?.qualityFeedback?.readiness?.message || 'Unresolved deferred quality issues are present.';
      return {
        ok: false,
        filePath,
        pending,
        message,
      };
    }

    return {
      ok: true,
      filePath,
      pending: 0,
      message: 'Ready for training.',
    };
  } catch (error) {
    return {
      ok: false,
      filePath,
      pending: 0,
      message: `Readiness check failed: ${error.message}`,
    };
  }
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.files.length > 0 ? args.files : discoverPairFiles(args.root);

  if (files.length === 0) {
    console.error(`No pair files found. root=${args.root}`);
    process.exitCode = 2;
    return;
  }

  const checks = files.map((filePath) => checkFileReadiness(filePath));
  const blocked = checks.filter((item) => !item.ok);

  console.log('Training Readiness Check');
  console.log('=======================');
  console.log(`Files checked: ${checks.length}`);
  console.log(`Blocked:       ${blocked.length}`);
  console.log('');

  checks.forEach((item) => {
    const status = item.ok ? 'READY' : 'BLOCKED';
    const pendingPart = item.pending > 0 ? `, pending=${item.pending}` : '';
    console.log(`- [${status}] ${item.filePath}${pendingPart}`);
    if (!item.ok) {
      console.log(`  reason: ${item.message}`);
    }
  });

  if (blocked.length > 0) {
    if (args.blockOnUnresolved) {
      console.error('Training readiness check failed: unresolved deferred quality issues detected.');
      process.exitCode = 1;
      return;
    }

    console.warn('Training readiness warning: unresolved deferred quality issues detected.');
    process.exitCode = 0;
    return;
  }

  console.log('All datasets are ready for training.');
  process.exitCode = 0;
}

run();
