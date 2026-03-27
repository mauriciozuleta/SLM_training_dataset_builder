function createArtifactWriter({ fs, path, common, summaryGenerator, questionBankGenerator, deterministicPairGenerator, conversationalPairGenerator }) {
  const normalizeList = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  async function writeSelectedArtifacts(payload) {
    const outputDir = payload?.outputDir;
    if (!outputDir) {
      throw new Error('Missing outputDir.');
    }

    const allowOverwrite = Boolean(payload?.allowOverwrite);
    const allowLocalFallback = Boolean(payload?.allowLocalFallback);
    const selectedOutputs = payload?.selectedOutputs || {};
    const fileNames = payload?.outputFileNames || {};
    const documentJson = payload?.documentJson || {};
    const documentJsonPath = typeof payload?.documentJsonPath === 'string' ? payload.documentJsonPath : '';
    const apiProviders = Array.isArray(payload?.apiProviders)
      ? payload.apiProviders.map((entry) => `${entry || ''}`.trim().toLowerCase()).filter(Boolean)
      : [];
    const onProgress = typeof payload?.onProgress === 'function' ? payload.onProgress : () => {};
    const onLog = typeof payload?.onLog === 'function' ? payload.onLog : () => {};
    const abortSignal = payload?.abortSignal || null;
    const generationGuidance = typeof payload?.generationGuidance === 'string'
      ? payload.generationGuidance.trim()
      : '';
    await fs.mkdir(outputDir, { recursive: true });

    const written = [];
    const needsSummary = Boolean(selectedOutputs.summary);
    const needsQuestions = Boolean(selectedOutputs.questions || selectedOutputs.deterministicPairs);
    const needsDeterministicPairs = Boolean(selectedOutputs.deterministicPairs);
    const needsConversationalPairs = Boolean(selectedOutputs.conversationalPairs);
    const hasGemini = apiProviders.includes('gemini');
    const hasOpenAi = apiProviders.includes('openai');
    const primaryProvider = apiProviders[0] || '';
    const isDualProviderMode = hasGemini && hasOpenAi;
    const summaryProvider = isDualProviderMode ? 'gemini' : primaryProvider;
    const questionProvider = isDualProviderMode ? 'openai' : primaryProvider;
    const conversationalProvider = isDualProviderMode ? 'gemini' : primaryProvider;
    const summaryFailoverProvider = isDualProviderMode ? 'openai' : '';
    const questionFailoverProvider = isDualProviderMode ? 'gemini' : '';
    const conversationalFailoverProvider = isDualProviderMode ? 'openai' : '';

    let summaryResult = null;
    let questionResult = null;
    let conversationalResult = null;
    let questionBank = [];
    let writtenQuestionsPath = '';

    const outputMap = [
      {
        key: 'docJson',
        fileName: common.normalizeJsonFileName(fileNames.docJson, 'chapter_rag.json'),
        data: documentJson,
      },
      {
        key: 'summary',
        fileName: common.normalizeMarkdownFileName(fileNames.summary, 'chapter_summary.md'),
        data: typeof summaryResult?.markdown === 'string'
          ? summaryResult.markdown
          : '',
        contentType: 'text/markdown',
      },
      {
        key: 'questions',
        fileName: common.normalizeJsonFileName(fileNames.questions, 'chapter_questions.json'),
        data: questionBank,
      },
      {
        key: 'deterministicPairs',
        fileName: common.normalizeJsonFileName(fileNames.deterministicPairs, 'deterministic_training_pairs.json'),
        data: {},
      },
      {
        key: 'conversationalPairs',
        fileName: common.normalizeJsonFileName(fileNames.conversationalPairs, 'conversational_training_pairs.json'),
        data: {},
      },
    ];

    const docJsonTarget = outputMap.find((entry) => entry.key === 'docJson');
    const extractedDocMatchesTarget = Boolean(docJsonTarget)
      && common.normalizePathForCompare(documentJsonPath) !== ''
      && common.normalizePathForCompare(path.join(outputDir, docJsonTarget.fileName)) === common.normalizePathForCompare(documentJsonPath);

    const selectedEntries = outputMap.filter((entry) => {
      if (!selectedOutputs[entry.key]) {
        return false;
      }
      if (entry.key === 'docJson' && extractedDocMatchesTarget) {
        return false;
      }
      return true;
    });

    const seenFileNames = new Set();
    for (const entry of selectedEntries) {
      const lowered = entry.fileName.toLowerCase();
      if (seenFileNames.has(lowered)) {
        throw new Error(`Duplicate output file name detected (case-insensitive): ${entry.fileName}`);
      }
      seenFileNames.add(lowered);
    }

    const existingPaths = [];
    const existingEntries = await fs.readdir(outputDir);
    const existingNames = new Set(existingEntries.map((entry) => entry.toLowerCase()));
    for (const entry of selectedEntries) {
      const outPath = path.join(outputDir, entry.fileName);
      if (existingNames.has(entry.fileName.toLowerCase())) {
        existingPaths.push(outPath);
      }
    }

    if (!allowOverwrite && existingPaths.length > 0) {
      throw new Error(`Output file(s) already exist:\n${existingPaths.join('\n')}`);
    }

    if (selectedOutputs.docJson && extractedDocMatchesTarget) {
      written.push({ key: 'docJson', path: path.join(outputDir, docJsonTarget.fileName), reused: true });
    }

    const getOutputPath = (key) => {
      const entry = outputMap.find((item) => item.key === key);
      return entry ? path.join(outputDir, entry.fileName) : '';
    };

    const writeJsonArtifact = async (key, data) => {
      const outPath = getOutputPath(key);
      await fs.writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
      written.push({ key, path: outPath });
      return outPath;
    };

    const writeMarkdownArtifact = async (key, content) => {
      const outPath = getOutputPath(key);
      await fs.writeFile(outPath, content, 'utf8');
      written.push({ key, path: outPath });
      return outPath;
    };

    const buildSummaryArtifact = async () => {
      if (!needsSummary) {
        return;
      }
      onProgress({ key: 'summary', state: 'running' });
      summaryResult = await summaryGenerator.buildSummary(documentJson, {
        preferredProvider: summaryProvider,
        secondaryProvider: summaryFailoverProvider,
        allowLocalFallback,
        generationGuidance,
        onLog,
        onProgress: (progress) => {
          onProgress({
            key: 'summary',
            state: 'running',
            ...progress,
          });
        },
        abortSignal,
      });
      await writeMarkdownArtifact('summary', typeof summaryResult?.markdown === 'string' ? summaryResult.markdown : '');
      onProgress({ key: 'summary', state: 'completed' });
    };

    const buildQuestionsArtifact = async () => {
      if (!needsQuestions) {
        return;
      }
      if (selectedOutputs.questions) {
        onProgress({ key: 'questions', state: 'running' });
      }
      questionResult = await questionBankGenerator.buildQuestionBank(documentJson, {
        preferredProvider: questionProvider,
        secondaryProvider: questionFailoverProvider,
        allowLocalFallback,
        generationGuidance,
        onLog,
        onProgress: (progress) => {
          if (!selectedOutputs.questions) {
            return;
          }
          onProgress({
            key: 'questions',
            state: 'running',
            ...progress,
          });
        },
        abortSignal,
      });
      questionBank = Array.isArray(questionResult?.questionBank) ? questionResult.questionBank : [];
      if (selectedOutputs.questions) {
        writtenQuestionsPath = await writeJsonArtifact('questions', questionBank);
        onProgress({ key: 'questions', state: 'completed' });
      }
    };

    const buildDeterministicArtifact = async () => {
      if (!needsDeterministicPairs) {
        return;
      }
      onProgress({ key: 'deterministicPairs', state: 'running' });
      let pairQuestionBank = questionBank;
      let sourceQuestionsFileName = fileNames.questions;
      if (selectedOutputs.questions && writtenQuestionsPath) {
        const rawQuestions = await fs.readFile(writtenQuestionsPath, 'utf8');
        const parsedQuestions = JSON.parse(rawQuestions);
        if (Array.isArray(parsedQuestions)) {
          pairQuestionBank = parsedQuestions;
        }
        sourceQuestionsFileName = path.basename(writtenQuestionsPath);
      }
      const deterministicResult = deterministicPairGenerator.buildDeterministicPairSet(pairQuestionBank, sourceQuestionsFileName);
      const totalPairs = Number(deterministicResult?.deterministicTrainingPairSet?.totalPairs || 0);
      if (totalPairs > 0) {
        onProgress({
          key: 'deterministicPairs',
          state: 'running',
          completed: totalPairs,
          total: totalPairs,
          progressText: `${totalPairs}/${totalPairs}`,
        });
      }
      await writeJsonArtifact('deterministicPairs', deterministicResult);
      onProgress({ key: 'deterministicPairs', state: 'completed' });
    };

    const buildConversationalArtifact = async () => {
      if (!needsConversationalPairs) {
        return;
      }
      onProgress({ key: 'conversationalPairs', state: 'running' });
      conversationalResult = await conversationalPairGenerator.buildConversationalPairSet(documentJson, {
        preferredProvider: conversationalProvider,
        secondaryProvider: conversationalFailoverProvider,
        allowLocalFallback,
        generationGuidance,
        onLog,
        onProgress: (progress) => {
          onProgress({
            key: 'conversationalPairs',
            state: 'running',
            ...progress,
          });
        },
        abortSignal,
      });
      await writeJsonArtifact('conversationalPairs', conversationalResult);
      onProgress({ key: 'conversationalPairs', state: 'completed' });
    };

    if (isDualProviderMode) {
      const summaryJob = buildSummaryArtifact();
      const questionsJob = buildQuestionsArtifact();
      const dependentJobs = [];

      if (needsConversationalPairs) {
        dependentJobs.push((async () => {
          if (needsSummary) {
            await summaryJob;
          }
          await buildConversationalArtifact();
        })());
      }

      if (needsDeterministicPairs) {
        dependentJobs.push((async () => {
          await questionsJob;
          await buildDeterministicArtifact();
        })());
      }

      await Promise.all([
        summaryJob,
        questionsJob,
        ...dependentJobs,
      ]);
    } else {
      await buildSummaryArtifact();
      await buildQuestionsArtifact();
      await buildConversationalArtifact();
      await buildDeterministicArtifact();
    }

    return {
      written,
      summary: {
        selectedCount: written.length,
        routingMode: isDualProviderMode ? 'dual-provider-parallel' : 'single-provider-sequential',
        providersConfigured: apiProviders,
        providersAssigned: {
          summary: summaryProvider || 'auto',
          questions: questionProvider || 'auto',
          conversational: conversationalProvider || 'auto',
        },
        providersObserved: {
          summary: normalizeList(summaryResult?.metadata?.providers),
          questions: normalizeList(questionResult?.metadata?.providers),
          conversational: normalizeList(conversationalResult?.conversationalTrainingPairSet?.providers),
        },
        modelsObserved: {
          summary: normalizeList(summaryResult?.metadata?.models),
          questions: normalizeList(questionResult?.metadata?.models),
          conversational: normalizeList(conversationalResult?.conversationalTrainingPairSet?.models),
        },
      },
    };
  }

  return {
    writeSelectedArtifacts,
  };
}

module.exports = {
  createArtifactWriter,
};
