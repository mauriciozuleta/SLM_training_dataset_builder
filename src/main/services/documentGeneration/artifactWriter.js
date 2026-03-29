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

  const normalizeProviders = (providers) => {
    const normalized = [];
    (Array.isArray(providers) ? providers : []).forEach((entry) => {
      const value = `${entry || ''}`.trim().toLowerCase();
      if (value && !normalized.includes(value)) {
        normalized.push(value);
      }
    });
    return normalized;
  };

  const pickProvider = (availableProviders, preferenceOrder, excludedProviders = []) => {
    const available = normalizeProviders(availableProviders);
    const excluded = new Set(normalizeProviders(excludedProviders));
    const preferred = normalizeProviders(preferenceOrder);

    const fromPreferred = preferred.find((provider) => available.includes(provider) && !excluded.has(provider));
    if (fromPreferred) {
      return fromPreferred;
    }

    return available.find((provider) => !excluded.has(provider)) || '';
  };

  const buildWorkerProviderOrder = (primaryProvider, fallbackProvider, allProviders) => {
    const ordered = [];
    const push = (provider) => {
      const value = `${provider || ''}`.trim().toLowerCase();
      if (value && !ordered.includes(value)) {
        ordered.push(value);
      }
    };

    push(primaryProvider);
    push(fallbackProvider);
    normalizeProviders(allProviders).forEach((provider) => push(provider));
    return ordered;
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
    const runAbortController = new AbortController();
    const runAbortSignal = runAbortController.signal;
    const forwardExternalAbort = () => runAbortController.abort();
    if (abortSignal) {
      if (abortSignal.aborted) {
        runAbortController.abort();
      } else {
        abortSignal.addEventListener('abort', forwardExternalAbort, { once: true });
      }
    }
    await fs.mkdir(outputDir, { recursive: true });

    const written = [];
    const needsSummary = Boolean(selectedOutputs.summary);
    const needsQuestions = Boolean(selectedOutputs.questions || selectedOutputs.deterministicPairs);
    const needsDeterministicPairs = Boolean(selectedOutputs.deterministicPairs);
    const needsConversationalPairs = Boolean(selectedOutputs.conversationalPairs);
    const configuredProviders = normalizeProviders(apiProviders);
    const isMultiProviderMode = configuredProviders.length >= 2;
    const primaryProvider = configuredProviders[0] || '';
    const assignedProviders = {};
    const reserveProvider = (key, isNeeded, preferenceOrder) => {
      if (!isNeeded) {
        return '';
      }

      const alreadyAssigned = Object.values(assignedProviders).filter(Boolean);
      const selected = pickProvider(configuredProviders, preferenceOrder, alreadyAssigned);
      assignedProviders[key] = selected;
      return selected;
    };

    const summaryProvider = reserveProvider('summary', needsSummary, ['gemini', 'openai', 'anthropic']);
    const questionProvider = reserveProvider('questions', needsQuestions, ['openai', 'anthropic', 'gemini']);
    const conversationalProvider = reserveProvider('conversational', needsConversationalPairs, ['gemini', 'anthropic', 'openai']);
    const summaryFailoverProvider = pickProvider(configuredProviders, configuredProviders, [summaryProvider]);
    const questionFailoverProvider = pickProvider(configuredProviders, configuredProviders, [questionProvider]);
    const conversationalFailoverProvider = pickProvider(configuredProviders, configuredProviders, [conversationalProvider]);
    const summaryWorkerProviders = buildWorkerProviderOrder(summaryProvider, summaryFailoverProvider, configuredProviders);
    const questionWorkerProviders = buildWorkerProviderOrder(questionProvider, questionFailoverProvider, configuredProviders);
    const conversationalWorkerProviders = buildWorkerProviderOrder(conversationalProvider, conversationalFailoverProvider, configuredProviders);
    const questionUnlockProviders = normalizeProviders(configuredProviders.filter((provider) => provider !== questionProvider));
    const conversationalUnlockProviders = normalizeProviders(configuredProviders.filter((provider) => provider !== conversationalProvider));

    let summaryResult = null;
    let questionResult = null;
    let conversationalResult = null;
    let questionBank = [];
    let writtenQuestionsPath = '';
    const artifactStatuses = {
      summary: {
        buildStatus: 'not-selected',
        buildStage: 'summary',
        incompleteSections: [],
        failureReason: '',
      },
      questions: {
        buildStatus: 'not-selected',
        buildStage: 'questions',
        incompleteSections: [],
        failureReason: '',
      },
      deterministicPairs: {
        buildStatus: 'not-selected',
        buildStage: 'deterministicPairs',
        incompleteSections: [],
        failureReason: '',
      },
      conversationalPairs: {
        buildStatus: 'not-selected',
        buildStage: 'conversationalPairs',
        incompleteSections: [],
        failureReason: '',
      },
    };

    const updateArtifactStatus = (key, metadata, defaults = {}) => {
      const buildStatus = `${metadata?.buildStatus || defaults.buildStatus || 'complete'}`.trim() || 'complete';
      const buildStage = `${metadata?.buildStage || defaults.buildStage || key}`.trim() || key;
      const incompleteSections = Array.isArray(metadata?.incompleteSections)
        ? metadata.incompleteSections
        : (Array.isArray(defaults.incompleteSections) ? defaults.incompleteSections : []);
      const failureReason = `${metadata?.failureReason || defaults.failureReason || ''}`.trim();

      artifactStatuses[key] = {
        buildStatus,
        buildStage,
        incompleteSections,
        failureReason,
      };

      return artifactStatuses[key];
    };

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
        workerProviders: summaryWorkerProviders,
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
        abortSignal: runAbortSignal,
      });
      updateArtifactStatus('summary', summaryResult?.metadata, { buildStage: 'summary' });
      await writeMarkdownArtifact('summary', typeof summaryResult?.markdown === 'string' ? summaryResult.markdown : '');
      onProgress({
        key: 'summary',
        state: artifactStatuses.summary.buildStatus === 'incomplete' ? 'incomplete' : 'completed',
        buildStatus: artifactStatuses.summary.buildStatus,
        failureReason: artifactStatuses.summary.failureReason,
      });
    };

    const buildQuestionsArtifact = async (options = {}) => {
      if (!needsQuestions) {
        return;
      }
      if (selectedOutputs.questions) {
        onProgress({ key: 'questions', state: 'running' });
      }
      questionResult = await questionBankGenerator.buildQuestionBank(documentJson, {
        preferredProvider: questionProvider,
        secondaryProvider: questionFailoverProvider,
        workerProviders: questionWorkerProviders,
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
        unlockSecondaryProviderPromise: options?.unlockSecondaryProviderPromise || null,
        unlockWorkerProvidersPromise: options?.unlockWorkerProvidersPromise || null,
        abortSignal: runAbortSignal,
      });
      questionBank = Array.isArray(questionResult?.questionBank) ? questionResult.questionBank : [];
      updateArtifactStatus('questions', questionResult?.metadata, { buildStage: 'questions' });
      if (selectedOutputs.questions) {
        writtenQuestionsPath = await writeJsonArtifact('questions', questionBank);
        onProgress({
          key: 'questions',
          state: artifactStatuses.questions.buildStatus === 'incomplete' ? 'incomplete' : 'completed',
          buildStatus: artifactStatuses.questions.buildStatus,
          failureReason: artifactStatuses.questions.failureReason,
        });
      }
    };

    const buildDeterministicArtifact = async () => {
      if (!needsDeterministicPairs) {
        return;
      }
      onProgress({ key: 'deterministicPairs', state: 'running' });
      if (artifactStatuses.questions.buildStatus === 'incomplete') {
        updateArtifactStatus('deterministicPairs', null, {
          buildStatus: 'skipped',
          buildStage: 'deterministicPairs',
          failureReason: 'Skipped because the question bank is incomplete.',
        });
        onProgress({
          key: 'deterministicPairs',
          state: 'skipped',
          buildStatus: artifactStatuses.deterministicPairs.buildStatus,
          failureReason: artifactStatuses.deterministicPairs.failureReason,
        });
        return;
      }
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
      updateArtifactStatus('deterministicPairs', null, { buildStatus: 'complete', buildStage: 'deterministicPairs' });
      onProgress({
        key: 'deterministicPairs',
        state: 'completed',
        buildStatus: artifactStatuses.deterministicPairs.buildStatus,
      });
    };

    const buildConversationalArtifact = async (options = {}) => {
      if (!needsConversationalPairs) {
        return;
      }
      onProgress({ key: 'conversationalPairs', state: 'running' });
      conversationalResult = await conversationalPairGenerator.buildConversationalPairSet(documentJson, {
        preferredProvider: conversationalProvider,
        secondaryProvider: conversationalFailoverProvider,
        workerProviders: conversationalWorkerProviders,
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
        unlockSecondaryProviderPromise: options?.unlockSecondaryProviderPromise || null,
        unlockWorkerProvidersPromise: options?.unlockWorkerProvidersPromise || null,
        abortSignal: runAbortSignal,
      });
      updateArtifactStatus('conversationalPairs', conversationalResult?.conversationalTrainingPairSet, {
        buildStage: 'conversationalPairs',
      });
      await writeJsonArtifact('conversationalPairs', conversationalResult);
      onProgress({
        key: 'conversationalPairs',
        state: artifactStatuses.conversationalPairs.buildStatus === 'incomplete' ? 'incomplete' : 'completed',
        buildStatus: artifactStatuses.conversationalPairs.buildStatus,
        failureReason: artifactStatuses.conversationalPairs.failureReason,
      });
    };

    try {
      if (isMultiProviderMode) {
        const summaryJob = buildSummaryArtifact();
        const questionUnlockPromise = needsSummary
          ? summaryJob.then(() => questionUnlockProviders).catch(() => [])
          : null;
        const questionsJob = buildQuestionsArtifact({
          unlockWorkerProvidersPromise: questionUnlockPromise,
        });
        const dependentJobs = [];

        if (needsConversationalPairs) {
          const conversationalUnlockPromise = needsQuestions
            ? questionsJob.then(() => conversationalUnlockProviders).catch(() => [])
            : (needsSummary ? summaryJob.then(() => conversationalUnlockProviders).catch(() => []) : null);
          dependentJobs.push((async () => {
            await buildConversationalArtifact({
              unlockWorkerProvidersPromise: conversationalUnlockPromise,
            });
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
    } catch (error) {
      if (!runAbortSignal.aborted) {
        runAbortController.abort();
      }
      throw error;
    } finally {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', forwardExternalAbort);
      }
    }

    return {
      written,
      summary: {
        selectedCount: written.length,
        routingMode: isMultiProviderMode ? 'multi-provider-parallel' : 'single-provider-sequential',
        providersConfigured: configuredProviders,
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
        artifactStatuses,
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
