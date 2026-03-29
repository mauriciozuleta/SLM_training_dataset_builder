function createExportDatasetService({ fs, path }) {
  const normalizeText = (value) => `${value || ''}`.trim();
  const formatFixed = (value, digits = 2) => Number(value || 0).toFixed(digits);

  const normalizePathForCompare = (value) => path.resolve(value).replace(/\\+/g, '/').replace(/\/+$/g, '').toLowerCase();

  const isSameOrNestedPath = (candidatePath, basePath) => {
    const candidate = normalizePathForCompare(candidatePath);
    const base = normalizePathForCompare(basePath);
    return candidate === base || candidate.startsWith(`${base}/`);
  };

  const isExportContainerFolder = (folderName) => /_training_files(?:_\d+)?$/i.test(normalizeText(folderName));

  const shouldSkipDirectory = (folderName) => {
    const normalized = normalizeText(folderName);
    return normalized.startsWith('.') || isExportContainerFolder(normalized);
  };

  const normalizeDatasetName = (value) => normalizeText(value)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const detectExportType = (fileName) => {
    const normalized = normalizeText(fileName).toLowerCase();
    if (!normalized.endsWith('.json')) {
      return '';
    }
    if (normalized.includes('_questions.json')) {
      return 'questions';
    }
    if (normalized.includes('_conversational_training_pairs.json')) {
      return 'conversationalPairs';
    }
    if (normalized.includes('_document.json') || normalized.endsWith('document.json')) {
      return 'document';
    }
    return '';
  };

  const isDeterministicPairFile = (fileName) => {
    const normalized = normalizeText(fileName).toLowerCase();
    return normalized.endsWith('_deterministic_training_pairs.json');
  };

  const toSafeFileName = (value) => {
    const raw = normalizeText(value);
    const safe = raw.replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '_');
    return safe || 'file';
  };

  async function allocateUniqueFilePath(bucketFolderPath, baseFileName) {
    const parsed = path.parse(baseFileName);
    const ext = parsed.ext || '.json';
    const stem = toSafeFileName(parsed.name || 'file');

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
      const fileName = `${stem}${suffix}${ext}`;
      const candidate = path.join(bucketFolderPath, fileName);
      try {
        await fs.access(candidate);
      } catch {
        return candidate;
      }
    }

    throw new Error(`Could not allocate unique file name in ${bucketFolderPath}`);
  }

  const isQualityReportFile = (fileName) => {
    const normalized = normalizeText(fileName).toLowerCase();
    return normalized.endsWith('_quality_report.json') && !normalized.includes('_quality_report_step');
  };

  const readJsonFile = async (filePath) => {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  };

  const countDeterministicPairs = async (filePath) => {
    const payload = await readJsonFile(filePath);
    const fromPairs = Array.isArray(payload?.pairs) ? payload.pairs.length : null;
    const fromMetaRaw = Number(payload?.deterministicTrainingPairSet?.totalPairs);
    const fromMeta = Number.isFinite(fromMetaRaw) ? fromMetaRaw : null;

    if (fromPairs !== null && fromMeta !== null && fromPairs !== fromMeta) {
      throw new Error(`Deterministic pair mismatch in ${filePath}: pairs.length=${fromPairs}, metadata.totalPairs=${fromMeta}`);
    }

    if (fromPairs !== null) {
      return fromPairs;
    }
    if (fromMeta !== null) {
      return fromMeta;
    }

    throw new Error(`Deterministic file does not contain pair data: ${filePath}`);
  };

  const countConversationalPairs = async (filePath) => {
    const payload = await readJsonFile(filePath);
    const fromPairs = Array.isArray(payload?.pairs) ? payload.pairs.length : null;
    const fromMetaRaw = Number(payload?.conversationalTrainingPairSet?.generatedPairCount);
    const fromMeta = Number.isFinite(fromMetaRaw) ? fromMetaRaw : null;

    if (fromPairs !== null && fromMeta !== null && fromPairs !== fromMeta) {
      throw new Error(`Conversational pair mismatch in ${filePath}: pairs.length=${fromPairs}, metadata.generatedPairCount=${fromMeta}`);
    }

    if (fromPairs !== null) {
      return fromPairs;
    }
    if (fromMeta !== null) {
      return fromMeta;
    }

    throw new Error(`Conversational file does not contain pair data: ${filePath}`);
  };

  const average = (values = []) => {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    return values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
  };

  async function collectQualityReportFiles(currentFolder, reports = []) {
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        await collectQualityReportFiles(absolutePath, reports);
        continue;
      }

      if (entry.isFile() && isQualityReportFile(entry.name)) {
        reports.push(absolutePath);
      }
    }
    return reports;
  }

  const summarizeQualityReports = async (reportPaths = []) => {
    const deterministicRates = [];
    const conversationalRates = [];
    const deterministicPairCounts = [];

    for (const reportPath of reportPaths) {
      try {
        const report = await readJsonFile(reportPath);
        const results = Array.isArray(report?.results) ? report.results : [];
        results.forEach((result) => {
          const type = normalizeText(result?.type).toLowerCase();
          const pairCount = Number(result?.pairCount) || 0;
          const issues = Array.isArray(result?.issues) ? result.issues.length : 0;
          const ratePercent = pairCount > 0 ? (issues / pairCount) * 100 : 0;
          if (type === 'deterministic') {
            deterministicRates.push(ratePercent);
            deterministicPairCounts.push(pairCount);
          }
          if (type === 'conversational') {
            conversationalRates.push(ratePercent);
          }
        });
      } catch {
        // Ignore malformed reports and continue.
      }
    }

    return {
      reportCount: reportPaths.length,
      deterministicAvgIssueRatePercent: average(deterministicRates),
      conversationalAvgIssueRatePercent: average(conversationalRates),
      deterministicTotalPairsFromReports: deterministicPairCounts.reduce((sum, value) => sum + (Number(value) || 0), 0),
    };
  };

  async function collectDeterministicPairFiles(currentFolder, matches = []) {
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        await collectDeterministicPairFiles(absolutePath, matches);
        continue;
      }

      if (entry.isFile() && isDeterministicPairFile(entry.name)) {
        matches.push(absolutePath);
      }
    }
    return matches;
  }

  const buildSummaryMarkdown = ({
    sourceRoot,
    exportFolder,
    totalQuestionPairs,
    totalConversationalPairs,
    quality,
  }) => {
    const generatedAt = new Date().toISOString();
    return [
      '# Export Dataset Summary',
      '',
      `- Generated: ${generatedAt}`,
      `- Source root: ${sourceRoot}`,
      `- Export folder: ${exportFolder}`,
      '',
      '## Totals',
      '',
      `- Total question pairs: ${totalQuestionPairs}`,
      `- Total conversational pairs: ${totalConversationalPairs}`,
      '',
      '## Quality Averages',
      '',
      `- Reports scanned: ${Number(quality?.reportCount || 0)}`,
      `- Question pair quality average issue rate: ${formatFixed(quality?.deterministicAvgIssueRatePercent, 2)}%`,
      `- Conversational quality average issue rate: ${formatFixed(quality?.conversationalAvgIssueRatePercent, 2)}%`,
      '',
    ].join('\n');
  };

  async function collectMatchingFiles(rootFolder, currentFolder = rootFolder, matches = []) {
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }
        await collectMatchingFiles(rootFolder, absolutePath, matches);
        continue;
      }

      const type = entry.isFile() ? detectExportType(entry.name) : '';
      if (entry.isFile() && type) {
        matches.push({
          sourcePath: absolutePath,
          relativePath: path.relative(rootFolder, absolutePath),
          type,
        });
      }
    }
    return matches;
  }

  async function createUniqueExportFolder(destinationFolder, datasetToken) {
    const normalizedDest = destinationFolder.replace(/[\\/]+$/g, '');
    const baseName = `${datasetToken}_training_files`;
    let attempt = 0;
    while (attempt < 50) {
      const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
      const candidate = path.join(normalizedDest, `${baseName}${suffix}`);

      try {
        await fs.mkdir(candidate, { recursive: false });
        return candidate;
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }
      }
      attempt += 1;
    }

    throw new Error('Could not allocate a unique training export folder name.');
  }

  async function exportTrainingFiles(options = {}) {
    const rootFolder = normalizeText(options?.rootFolder);
    const destinationFolder = normalizeText(options?.destinationFolder);
    const datasetToken = normalizeDatasetName(options?.datasetName);
    
    if (!rootFolder) {
      throw new Error('Missing export root folder.');
    }
    if (!destinationFolder) {
      throw new Error('Missing export destination folder.');
    }
    if (!datasetToken) {
      throw new Error('Missing dataset name.');
    }

    const rootStat = await fs.stat(rootFolder).catch(() => null);
    if (!rootStat?.isDirectory?.()) {
      throw new Error('Export root folder does not exist or is not a directory.');
    }

    const destStat = await fs.stat(destinationFolder).catch(() => null);
    if (!destStat?.isDirectory?.()) {
      throw new Error('Export destination folder does not exist or is not a directory.');
    }

    if (isSameOrNestedPath(destinationFolder, rootFolder) || isSameOrNestedPath(rootFolder, destinationFolder)) {
      throw new Error('Export blocked: destination folder must not be the same as, inside, or parent of the scan root folder.');
    }

    const files = await collectMatchingFiles(rootFolder);
    const uniqueBySourcePath = new Map();
    files.forEach((entry) => {
      const key = normalizeText(entry.sourcePath).toLowerCase();
      if (!uniqueBySourcePath.has(key)) {
        uniqueBySourcePath.set(key, entry);
      }
    });
    const uniqueFiles = Array.from(uniqueBySourcePath.values());
    if (uniqueFiles.length === 0) {
      throw new Error('No question, conversational, or document JSON files were found in the selected folder.');
    }

    const exportFolder = await createUniqueExportFolder(destinationFolder, datasetToken);
    const documentsFolder = path.join(exportFolder, `${datasetToken}_documents`);
    const questionsFolder = path.join(exportFolder, `${datasetToken}_questions_training_pairs`);
    const conversationalFolder = path.join(exportFolder, `${datasetToken}_conversational_training_pairs`);
    await fs.mkdir(documentsFolder, { recursive: true });
    await fs.mkdir(questionsFolder, { recursive: true });
    await fs.mkdir(conversationalFolder, { recursive: true });

    const copied = [];
    let totalQuestionPairs = 0;
    let totalConversationalPairs = 0;
    for (const file of uniqueFiles) {
      const sourceFolderName = path.basename(path.dirname(file.sourcePath));
      const sourceFileName = path.basename(file.sourcePath);
      const bucketFolderPath = file.type === 'document'
        ? documentsFolder
        : (file.type === 'questions' ? questionsFolder : conversationalFolder);
      const destinationPath = await allocateUniqueFilePath(
        bucketFolderPath,
        `${toSafeFileName(sourceFolderName)}__${toSafeFileName(sourceFileName)}`
      );

      await fs.copyFile(file.sourcePath, destinationPath);
      if (file.type === 'conversationalPairs') {
        totalConversationalPairs += await countConversationalPairs(file.sourcePath);
      }
      copied.push({
        ...file,
        destinationPath,
      });
    }

    const qualityReportPaths = await collectQualityReportFiles(rootFolder);
    const quality = await summarizeQualityReports(qualityReportPaths);
    const deterministicPairFiles = await collectDeterministicPairFiles(rootFolder);
    totalQuestionPairs = (
      await Promise.all(deterministicPairFiles.map((filePath) => countDeterministicPairs(filePath)))
    ).reduce((sum, value) => sum + (Number(value) || 0), 0);
    if (totalQuestionPairs <= 0 && Number(quality?.deterministicTotalPairsFromReports || 0) > 0) {
      totalQuestionPairs = Number(quality.deterministicTotalPairsFromReports);
    }

    const summaryFileName = `${datasetToken}_export_dataset_summary.md`;
    const summaryDocumentPath = path.join(exportFolder, summaryFileName);
    const summaryMarkdown = buildSummaryMarkdown({
      sourceRoot: rootFolder,
      exportFolder,
      totalQuestionPairs,
      totalConversationalPairs,
      quality,
    });
    await fs.writeFile(summaryDocumentPath, `${summaryMarkdown}\n`, 'utf8');

    return {
      success: true,
      exportFolder,
      summaryDocumentPath,
      copiedCount: copied.length,
      copied,
      summary: {
        questions: copied.filter((entry) => entry.type === 'questions').length,
        conversationalPairs: copied.filter((entry) => entry.type === 'conversationalPairs').length,
        document: copied.filter((entry) => entry.type === 'document').length,
        totalQuestionPairs,
        totalConversationalPairs,
        quality,
      },
    };
  }

  return {
    exportTrainingFiles,
  };
}

module.exports = {
  createExportDatasetService,
};