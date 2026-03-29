#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function normalizeText(value) {
  return `${value || ''}`.trim();
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    output: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root') {
      args.root = argv[i + 1] ? path.resolve(argv[i + 1]) : args.root;
      i += 1;
      continue;
    }
    if (token === '--out') {
      args.output = argv[i + 1] ? path.resolve(argv[i + 1]) : args.output;
      i += 1;
    }
  }

  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function walkFiles(rootFolder, currentFolder = rootFolder, files = []) {
  const entries = fs.readdirSync(currentFolder, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const absolutePath = path.join(currentFolder, entry.name);
    if (entry.isDirectory()) {
      walkFiles(rootFolder, absolutePath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function countQuestions(filePath) {
  const payload = readJson(filePath);
  if (!Array.isArray(payload)) {
    return 0;
  }
  return payload.filter((entry) => entry && typeof entry === 'object' && !entry.questionBank).length;
}

function countConversationalPairs(filePath) {
  const payload = readJson(filePath);
  const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
  return pairs.length;
}

function detectQualityReportFile(filePath) {
  const lower = path.basename(filePath).toLowerCase();
  return lower.endsWith('_quality_report.json') && !lower.includes('_quality_report_step');
}

function detectQuestionsFile(filePath) {
  return path.basename(filePath).toLowerCase().endsWith('_questions.json');
}

function detectConversationalFile(filePath) {
  return path.basename(filePath).toLowerCase().endsWith('_conversational_training_pairs.json');
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
}

function summarizeQualityReports(reportPaths) {
  const deterministicEntries = [];
  const conversationalEntries = [];

  reportPaths.forEach((reportPath) => {
    try {
      const report = readJson(reportPath);
      const results = Array.isArray(report?.results) ? report.results : [];
      results.forEach((result) => {
        const type = normalizeText(result?.type).toLowerCase();
        const pairCount = Number(result?.pairCount) || 0;
        const issues = Array.isArray(result?.issues) ? result.issues : [];
        const issueCount = issues.length;
        const warningCount = issues.filter((entry) => normalizeText(entry?.severity).toLowerCase() === 'warning').length;
        const errorCount = issues.filter((entry) => normalizeText(entry?.severity).toLowerCase() === 'error').length;
        const issueRatePercent = pairCount > 0 ? (issueCount / pairCount) * 100 : 0;

        const normalized = {
          pairCount,
          issueCount,
          warningCount,
          errorCount,
          issueRatePercent,
        };

        if (type === 'deterministic') {
          deterministicEntries.push(normalized);
        } else if (type === 'conversational') {
          conversationalEntries.push(normalized);
        }
      });
    } catch (_error) {
      // Skip malformed reports.
    }
  });

  const summarizeEntries = (entries) => ({
    reports: entries.length,
    avgIssuesPerReport: average(entries.map((entry) => entry.issueCount)),
    avgWarningsPerReport: average(entries.map((entry) => entry.warningCount)),
    avgErrorsPerReport: average(entries.map((entry) => entry.errorCount)),
    avgIssueRatePercent: average(entries.map((entry) => entry.issueRatePercent)),
  });

  return {
    deterministic: summarizeEntries(deterministicEntries),
    conversational: summarizeEntries(conversationalEntries),
  };
}

function formatFixed(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function buildMarkdownSummary({
  root,
  questionsFileCount,
  conversationalFileCount,
  totalQuestions,
  totalConversationalPairs,
  qualityReportCount,
  quality,
}) {
  const generatedAt = new Date().toISOString();
  return [
    '# Export Dataset Summary',
    '',
    `- Generated: ${generatedAt}`,
    `- Dataset root: ${root}`,
    '',
    '## Totals',
    '',
    `- Question files: ${questionsFileCount}`,
    `- Conversational files: ${conversationalFileCount}`,
    `- Total questions: ${totalQuestions}`,
    `- Total conversational pairs: ${totalConversationalPairs}`,
    '',
    '## Quality Averages',
    '',
    `- Quality reports found: ${qualityReportCount}`,
    `- Deterministic (question-pair quality): avg issue rate ${formatFixed(quality.deterministic.avgIssueRatePercent)}%, avg warnings/report ${formatFixed(quality.deterministic.avgWarningsPerReport)}, avg errors/report ${formatFixed(quality.deterministic.avgErrorsPerReport)}`,
    `- Conversational: avg issue rate ${formatFixed(quality.conversational.avgIssueRatePercent)}%, avg warnings/report ${formatFixed(quality.conversational.avgWarningsPerReport)}, avg errors/report ${formatFixed(quality.conversational.avgErrorsPerReport)}`,
    '',
  ].join('\n');
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const rootFolder = path.resolve(args.root);
  if (!fs.existsSync(rootFolder) || !fs.statSync(rootFolder).isDirectory()) {
    console.error(`Dataset root is missing or invalid: ${rootFolder}`);
    process.exitCode = 1;
    return;
  }

  const allFiles = walkFiles(rootFolder);
  const questionFiles = allFiles.filter(detectQuestionsFile);
  const conversationalFiles = allFiles.filter(detectConversationalFile);
  const qualityReportFiles = allFiles.filter(detectQualityReportFile);

  const totalQuestions = questionFiles.reduce((sum, filePath) => sum + countQuestions(filePath), 0);
  const totalConversationalPairs = conversationalFiles.reduce((sum, filePath) => sum + countConversationalPairs(filePath), 0);
  const quality = summarizeQualityReports(qualityReportFiles);

  const markdown = buildMarkdownSummary({
    root: rootFolder,
    questionsFileCount: questionFiles.length,
    conversationalFileCount: conversationalFiles.length,
    totalQuestions,
    totalConversationalPairs,
    qualityReportCount: qualityReportFiles.length,
    quality,
  });

  const outputPath = args.output || path.join(rootFolder, 'export_dataset_summary.md');
  fs.writeFileSync(outputPath, `${markdown}\n`, 'utf8');

  console.log('Dataset summary created.');
  console.log(`Output: ${outputPath}`);
  console.log(`Questions: ${totalQuestions}`);
  console.log(`Conversational pairs: ${totalConversationalPairs}`);
  console.log(`Quality reports: ${qualityReportFiles.length}`);
}

run();
