function createPartialArtifactRepairService({ fs, path, common, questionBankGenerator, conversationalPairGenerator }) {
  const normalizeText = (value) => `${value || ''}`.trim();

  const normalizeSectionId = (value) => normalizeText(value).toLowerCase();

  const normalizeProviderList = (providers) => {
    const normalized = [];
    (Array.isArray(providers) ? providers : []).forEach((entry) => {
      const value = normalizeText(entry).toLowerCase();
      if (value && !normalized.includes(value)) {
        normalized.push(value);
      }
    });
    return normalized;
  };

  const pickProvider = (availableProviders, preferenceOrder, excludedProviders = []) => {
    const available = normalizeProviderList(availableProviders);
    const excluded = new Set(normalizeProviderList(excludedProviders));
    const preferred = normalizeProviderList(preferenceOrder);
    const fromPreferred = preferred.find((provider) => available.includes(provider) && !excluded.has(provider));
    if (fromPreferred) {
      return fromPreferred;
    }
    return available.find((provider) => !excluded.has(provider)) || '';
  };

  const buildWorkerProviderOrder = (primaryProvider, fallbackProvider, allProviders) => {
    const ordered = [];
    const push = (provider) => {
      const value = normalizeText(provider).toLowerCase();
      if (value && !ordered.includes(value)) {
        ordered.push(value);
      }
    };

    push(primaryProvider);
    push(fallbackProvider);
    normalizeProviderList(allProviders).forEach((provider) => push(provider));
    return ordered;
  };

  const mergeUniqueList = (...lists) => {
    const merged = [];
    lists.flat().forEach((entry) => {
      const value = normalizeText(entry);
      if (value && !merged.includes(value)) {
        merged.push(value);
      }
    });
    return merged;
  };

  const sumNumeric = (...values) => values.reduce((sum, value) => sum + (Number(value) || 0), 0);

  const readJsonFile = async (filePath) => {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  };

  const writeJsonFile = async (filePath, payload) => {
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  };

  const detectArtifactType = (artifactJson) => {
    if (Array.isArray(artifactJson) && artifactJson[0]?.questionBank) {
      return 'questions';
    }
    if (artifactJson && typeof artifactJson === 'object' && artifactJson.conversationalTrainingPairSet && Array.isArray(artifactJson.pairs)) {
      return 'conversationalPairs';
    }
    return '';
  };

  const extractQuestionMetadata = (artifactJson) => artifactJson?.[0]?.questionBank?.metadata || {};

  const extractConversationalMetadata = (artifactJson) => artifactJson?.conversationalTrainingPairSet || {};

  const extractQuestionSectionOrdinal = (questionId) => {
    const match = normalizeText(questionId).match(/^[A-Z]+\.(\d+)\.(\d+)\.(\d+)$/i);
    return match ? Number.parseInt(match[2], 10) : 0;
  };

  const extractSectionOrdinalFromId = (sectionId) => {
    const match = normalizeText(sectionId).match(/(?:\.|_)(\d+)$/);
    return match ? Number.parseInt(match[1], 10) : 0;
  };

  const extractConversationSectionId = (pair) => {
    const conversationId = normalizeText(pair?.conversationalPairId);
    const match = conversationId.match(/^([A-Z]+\.\d+\.\d+)\./i);
    if (match) {
      return match[1].toLowerCase();
    }
    return normalizeSectionId(pair?.source);
  };

  const sortQuestionEntries = (entries) => {
    return entries.slice().sort((left, right) => {
      const leftId = normalizeText(left?.questionid);
      const rightId = normalizeText(right?.questionid);
      return leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const sortSectionSummary = (entries) => {
    return entries.slice().sort((left, right) => {
      const leftOrdinal = Number(left?.sectionOrdinal || 0);
      const rightOrdinal = Number(right?.sectionOrdinal || 0);
      if (leftOrdinal !== rightOrdinal) {
        return leftOrdinal - rightOrdinal;
      }
      return normalizeText(left?.sectionId).localeCompare(normalizeText(right?.sectionId), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  };

  const getIncompleteSections = (metadata) => {
    return Array.isArray(metadata?.incompleteSections) ? metadata.incompleteSections : [];
  };

  const toPositiveInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return fallback;
  };

  const buildBaseInspection = ({ artifactType, repairArtifactPath, metadata, sourceDocument }) => {
    const incompleteSections = getIncompleteSections(metadata);
    const totalSections = toPositiveInt(
      metadata?.totalSections,
      toPositiveInt(sourceDocument?.totalSections, Array.isArray(sourceDocument?.sections) ? sourceDocument.sections.length : 0)
    );
    const completedSections = toPositiveInt(
      metadata?.completedSections,
      Math.max(0, totalSections - incompleteSections.length)
    );
    const buildStatus = normalizeText(metadata?.buildStatus).toLowerCase()
      || (incompleteSections.length > 0 ? 'incomplete' : 'complete');
    const buildStage = normalizeText(metadata?.buildStage)
      || (artifactType === 'questions' ? 'questions' : 'conversationalPairs');
    const failureReason = normalizeText(metadata?.failureReason);
    const sourceSectionIds = new Set(
      (Array.isArray(sourceDocument?.sections) ? sourceDocument.sections : [])
        .map((section) => normalizeSectionId(section?.id))
        .filter(Boolean)
    );

    const normalizedIncompleteSections = incompleteSections
      .map((entry) => {
        const sectionId = normalizeText(entry?.sectionId);
        const sectionOrdinal = toPositiveInt(entry?.sectionOrdinal, extractSectionOrdinalFromId(sectionId));
        const reason = normalizeText(entry?.reason || entry?.failureReason);
        const plannedQuestions = toPositiveInt(entry?.plannedQuestions, 0);
        const plannedPairs = toPositiveInt(entry?.plannedPairs, 0);
        const passCap = toPositiveInt(entry?.passCap, 0);
        const plannedPasses = toPositiveInt(entry?.plannedPasses, 0);
        return {
          sectionId,
          sectionOrdinal,
          reason,
          plannedQuestions,
          plannedPairs,
          passCap,
          plannedPasses,
        };
      })
      .filter((entry) => entry.sectionId);

    const missingFromSource = sourceSectionIds.size > 0
      ? normalizedIncompleteSections
        .filter((entry) => !sourceSectionIds.has(normalizeSectionId(entry.sectionId)))
        .map((entry) => entry.sectionId)
      : [];

    return {
      success: true,
      artifactType,
      repairArtifactPath,
      buildStatus,
      buildStage,
      totalSections,
      completedSections,
      incompleteSectionCount: normalizedIncompleteSections.length,
      incompleteSections: normalizedIncompleteSections,
      missingFromSource,
      failureReason,
      canRepair: normalizedIncompleteSections.length > 0 && missingFromSource.length === 0,
    };
  };

  const inspectQuestionArtifact = ({ repairArtifactPath, artifactJson, sourceDocument }) => {
    const metadata = extractQuestionMetadata(artifactJson);
    const base = buildBaseInspection({
      artifactType: 'questions',
      repairArtifactPath,
      metadata,
      sourceDocument,
    });

    const totalRequiredQuestions = toPositiveInt(
      metadata?.totalRequiredQuestions,
      toPositiveInt(artifactJson?.[0]?.questionBank?.totalRequiredQuestions, 0)
    );

    return {
      ...base,
      totalRequiredQuestions,
    };
  };

  const inspectConversationalArtifact = ({ repairArtifactPath, artifactJson, sourceDocument }) => {
    const metadata = extractConversationalMetadata(artifactJson);
    const base = buildBaseInspection({
      artifactType: 'conversationalPairs',
      repairArtifactPath,
      metadata,
      sourceDocument,
    });

    return {
      ...base,
      targetPairCount: toPositiveInt(metadata?.targetPairCount, 0),
      generatedPairCount: toPositiveInt(metadata?.generatedPairCount, Array.isArray(artifactJson?.pairs) ? artifactJson.pairs.length : 0),
    };
  };

  const buildSubsetDocument = (sourceDocument, targetSections) => {
    const sourceSections = Array.isArray(sourceDocument?.sections) ? sourceDocument.sections : [];
    const sectionIds = new Set(targetSections.map((entry) => normalizeSectionId(entry?.sectionId)).filter(Boolean));
    const sections = sourceSections.filter((section) => sectionIds.has(normalizeSectionId(section?.id)));
    const totalWords = sections.reduce((sum, section) => {
      const wordCount = Number(section?.wordCount);
      if (Number.isFinite(wordCount) && wordCount > 0) {
        return sum + wordCount;
      }
      return sum + normalizeText(section?.content).split(/\s+/).filter(Boolean).length;
    }, 0);

    return {
      ...sourceDocument,
      totalSections: sections.length,
      totalWords,
      sections,
    };
  };

  const validateSourceDocument = (sourceDocument) => {
    const sections = Array.isArray(sourceDocument?.sections) ? sourceDocument.sections : [];
    if (!sections.length) {
      throw new Error('Source document must be a structured document JSON with a non-empty sections array.');
    }
  };

  const buildQuestionRepairResult = async ({ sourceDocument, artifactJson, repairArtifactPath, configuredProviders, generationGuidance, repairMode, onLog, onProgress, abortSignal }) => {
    const metadata = extractQuestionMetadata(artifactJson);
    const incompleteSections = getIncompleteSections(metadata);
    if (!incompleteSections.length) {
      throw new Error('Question bank has no incomplete sections to repair.');
    }

    const subsetDocument = buildSubsetDocument(sourceDocument, incompleteSections);
    if (!subsetDocument.sections.length) {
      throw new Error('None of the incomplete question sections could be matched in the selected source document.');
    }

    const preferredProvider = pickProvider(configuredProviders, ['openai', 'anthropic', 'gemini']);
    const secondaryProvider = pickProvider(configuredProviders, configuredProviders, [preferredProvider]);
    onProgress({ key: 'questions', state: 'running', completed: 0, total: subsetDocument.sections.length, progressText: `0/${subsetDocument.sections.length}` });
    let repairResult = await questionBankGenerator.buildQuestionBank(subsetDocument, {
      preferredProvider,
      secondaryProvider,
      workerProviders: buildWorkerProviderOrder(preferredProvider, secondaryProvider, configuredProviders),
      generationGuidance,
      repairRetryMode: repairMode,
      repairSectionPlan: incompleteSections,
      onLog,
      onProgress: (progress) => {
        onProgress({ key: 'questions', state: 'running', ...progress });
      },
      abortSignal,
    });

    let repairedMetadata = repairResult?.metadata || {};
    if (repairMode === 'fast' && getIncompleteSections(repairedMetadata).length > 0) {
      onLog({
        scope: 'questions',
        level: 'warning',
        message: 'Fast repair mode ended incomplete. Escalating to deep retry profile for remaining sections.',
      });
      onProgress({ key: 'questions', state: 'running', completed: 0, total: subsetDocument.sections.length, progressText: `0/${subsetDocument.sections.length}` });
      repairResult = await questionBankGenerator.buildQuestionBank(subsetDocument, {
        preferredProvider,
        secondaryProvider,
        workerProviders: buildWorkerProviderOrder(preferredProvider, secondaryProvider, configuredProviders),
        generationGuidance,
        repairRetryMode: 'deep',
        repairSectionPlan: incompleteSections,
        onLog,
        onProgress: (progress) => {
          onProgress({ key: 'questions', state: 'running', ...progress });
        },
        abortSignal,
      });
      repairedMetadata = repairResult?.metadata || {};
    }

    const repairedEntries = Array.isArray(repairResult?.questionBank)
      ? repairResult.questionBank.filter((entry) => entry && typeof entry === 'object' && !entry.questionBank)
      : [];
    const repairedSectionIds = new Set(incompleteSections.map((entry) => normalizeSectionId(entry?.sectionId)).filter(Boolean));
    const repairedSectionOrdinals = new Set(
      incompleteSections
        .map((entry) => extractSectionOrdinalFromId(entry?.sectionId))
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    const existingEntries = Array.isArray(artifactJson)
      ? artifactJson.filter((entry) => entry && typeof entry === 'object' && !entry.questionBank)
      : [];
    const keptEntries = existingEntries.filter((entry) => !repairedSectionOrdinals.has(extractQuestionSectionOrdinal(entry?.questionid)));
    const mergedEntries = sortQuestionEntries([...keptEntries, ...repairedEntries]);

    const existingSummary = Array.isArray(metadata?.sectionQuestionSummary) ? metadata.sectionQuestionSummary : [];
    const repairedSummary = Array.isArray(repairedMetadata?.sectionQuestionSummary) ? repairedMetadata.sectionQuestionSummary : [];
    const mergedSectionSummary = sortSectionSummary([
      ...existingSummary.filter((entry) => !repairedSectionIds.has(normalizeSectionId(entry?.sectionId))),
      ...repairedSummary,
    ]);
    const remainingIncompleteSections = getIncompleteSections(repairedMetadata);
    const totalSections = Number(sourceDocument?.totalSections || sourceDocument?.sections?.length || mergedSectionSummary.length);
    const nextMetadata = {
      ...metadata,
      generatedAtUtc: new Date().toISOString(),
      totalSections,
      totalRequiredQuestions: mergedEntries.length,
      providers: mergeUniqueList(metadata?.providers, repairedMetadata?.providers),
      models: mergeUniqueList(metadata?.models, repairedMetadata?.models),
      promptTokens: sumNumeric(metadata?.promptTokens, repairedMetadata?.promptTokens),
      completionTokens: sumNumeric(metadata?.completionTokens, repairedMetadata?.completionTokens),
      totalTokens: sumNumeric(metadata?.totalTokens, repairedMetadata?.totalTokens),
      sectionQuestionSummary: mergedSectionSummary,
      buildStatus: remainingIncompleteSections.length > 0 ? 'incomplete' : 'complete',
      buildStage: 'questions',
      completedSections: Math.max(0, totalSections - remainingIncompleteSections.length),
      incompleteSections: remainingIncompleteSections,
      failureReason: remainingIncompleteSections.length > 0 ? normalizeText(repairedMetadata?.failureReason) : '',
    };
    const chapterMeta = artifactJson?.[0]?.questionBank || {};
    const mergedArtifact = [
      {
        questionBank: {
          ...chapterMeta,
          totalRequiredQuestions: mergedEntries.length,
          metadata: nextMetadata,
        },
      },
      ...mergedEntries,
    ];

    await writeJsonFile(repairArtifactPath, mergedArtifact);
    onProgress({
      key: 'questions',
      state: nextMetadata.buildStatus === 'incomplete' ? 'incomplete' : 'completed',
      buildStatus: nextMetadata.buildStatus,
      failureReason: nextMetadata.failureReason,
    });
    return {
      success: true,
      artifactType: 'questions',
      buildStatus: nextMetadata.buildStatus,
      repairedPath: repairArtifactPath,
      targetedSections: subsetDocument.sections.length,
      remainingIncompleteSections: nextMetadata.incompleteSections.length,
    };
  };

  const buildConversationalRepairResult = async ({ sourceDocument, artifactJson, repairArtifactPath, configuredProviders, generationGuidance, repairMode, onLog, onProgress, abortSignal }) => {
    const metadata = extractConversationalMetadata(artifactJson);
    const incompleteSections = getIncompleteSections(metadata);
    if (!incompleteSections.length) {
      throw new Error('Conversational pair file has no incomplete sections to repair.');
    }

    const subsetDocument = buildSubsetDocument(sourceDocument, incompleteSections);
    if (!subsetDocument.sections.length) {
      throw new Error('None of the incomplete conversational sections could be matched in the selected source document.');
    }

    const preferredProvider = pickProvider(configuredProviders, ['gemini', 'anthropic', 'openai']);
    const secondaryProvider = pickProvider(configuredProviders, configuredProviders, [preferredProvider]);
    onProgress({ key: 'conversationalPairs', state: 'running', completed: 0, total: subsetDocument.sections.length, progressText: `0/${subsetDocument.sections.length}` });
    let repairResult = await conversationalPairGenerator.buildConversationalPairSet(subsetDocument, {
      preferredProvider,
      secondaryProvider,
      workerProviders: buildWorkerProviderOrder(preferredProvider, secondaryProvider, configuredProviders),
      generationGuidance,
      repairRetryMode: repairMode,
      repairSectionPlan: incompleteSections,
      onLog,
      onProgress: (progress) => {
        onProgress({ key: 'conversationalPairs', state: 'running', ...progress });
      },
      abortSignal,
    });

    let repairedMeta = repairResult?.conversationalTrainingPairSet || {};
    if (repairMode === 'fast' && getIncompleteSections(repairedMeta).length > 0) {
      onLog({
        scope: 'conversational',
        level: 'warning',
        message: 'Fast repair mode ended incomplete. Escalating to deep retry profile for remaining sections.',
      });
      onProgress({ key: 'conversationalPairs', state: 'running', completed: 0, total: subsetDocument.sections.length, progressText: `0/${subsetDocument.sections.length}` });
      repairResult = await conversationalPairGenerator.buildConversationalPairSet(subsetDocument, {
        preferredProvider,
        secondaryProvider,
        workerProviders: buildWorkerProviderOrder(preferredProvider, secondaryProvider, configuredProviders),
        generationGuidance,
        repairRetryMode: 'deep',
        repairSectionPlan: incompleteSections,
        onLog,
        onProgress: (progress) => {
          onProgress({ key: 'conversationalPairs', state: 'running', ...progress });
        },
        abortSignal,
      });
      repairedMeta = repairResult?.conversationalTrainingPairSet || {};
    }

    const repairedPairs = Array.isArray(repairResult?.pairs) ? repairResult.pairs : [];
    const repairedSectionIds = new Set(incompleteSections.map((entry) => normalizeSectionId(entry?.sectionId)).filter(Boolean));
    const existingPairs = Array.isArray(artifactJson?.pairs) ? artifactJson.pairs : [];
    const keptPairs = existingPairs.filter((entry) => !repairedSectionIds.has(extractConversationSectionId(entry)));
    const mergedPairs = [...keptPairs, ...repairedPairs].sort((left, right) => {
      const leftId = normalizeText(left?.conversationalPairId);
      const rightId = normalizeText(right?.conversationalPairId);
      return leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });
    });

    const remainingIncompleteSections = getIncompleteSections(repairedMeta);
    const totalSections = Number(sourceDocument?.totalSections || sourceDocument?.sections?.length || 0);
    const nextMetadata = {
      ...metadata,
      generatedAtUtc: new Date().toISOString(),
      targetPairCount: mergedPairs.length + remainingIncompleteSections.reduce((sum, entry) => sum + Math.max(1, Number(entry?.plannedPairs || 0) || 1), 0),
      generatedPairCount: mergedPairs.length,
      totalSections,
      completedSections: Math.max(0, totalSections - remainingIncompleteSections.length),
      incompleteSections: remainingIncompleteSections,
      buildStatus: remainingIncompleteSections.length > 0 ? 'incomplete' : 'complete',
      buildStage: 'conversationalPairs',
      failureReason: remainingIncompleteSections.length > 0 ? normalizeText(repairedMeta?.failureReason) : '',
      providers: mergeUniqueList(metadata?.providers, repairedMeta?.providers),
      models: mergeUniqueList(metadata?.models, repairedMeta?.models),
      promptTokens: sumNumeric(metadata?.promptTokens, repairedMeta?.promptTokens),
      completionTokens: sumNumeric(metadata?.completionTokens, repairedMeta?.completionTokens),
      totalTokens: sumNumeric(metadata?.totalTokens, repairedMeta?.totalTokens),
      studentPersonas: {
        confident: mergedPairs.filter((entry) => normalizeText(entry?.studentPersona).toLowerCase() === 'confident').length,
        confused: mergedPairs.filter((entry) => normalizeText(entry?.studentPersona).toLowerCase() === 'confused').length,
        checkride: mergedPairs.filter((entry) => normalizeText(entry?.studentPersona).toLowerCase() === 'checkride').length,
      },
    };

    const mergedArtifact = {
      ...artifactJson,
      conversationalTrainingPairSet: nextMetadata,
      pairs: mergedPairs,
    };
    await writeJsonFile(repairArtifactPath, mergedArtifact);
    onProgress({
      key: 'conversationalPairs',
      state: nextMetadata.buildStatus === 'incomplete' ? 'incomplete' : 'completed',
      buildStatus: nextMetadata.buildStatus,
      failureReason: nextMetadata.failureReason,
    });
    return {
      success: true,
      artifactType: 'conversationalPairs',
      buildStatus: nextMetadata.buildStatus,
      repairedPath: repairArtifactPath,
      targetedSections: subsetDocument.sections.length,
      remainingIncompleteSections: nextMetadata.incompleteSections.length,
    };
  };

  async function repairPartialArtifact(options = {}) {
    const sourceDocumentPath = normalizeText(options?.sourceDocumentPath);
    const repairArtifactPath = normalizeText(options?.repairArtifactPath);
    const generationGuidance = normalizeText(options?.generationGuidance);
    const repairMode = normalizeText(options?.repairMode).toLowerCase() === 'deep' ? 'deep' : 'fast';
    const configuredProviders = normalizeProviderList(options?.apiProviders);
    const onLog = typeof options?.onLog === 'function' ? options.onLog : () => {};
    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : () => {};
    const abortSignal = options?.abortSignal || null;

    if (!sourceDocumentPath) {
      throw new Error('Missing source document path.');
    }
    if (!repairArtifactPath) {
      throw new Error('Missing repair artifact path.');
    }
    if (!configuredProviders.length) {
      throw new Error('At least one configured API provider is required for repair.');
    }

    const sourceDocument = await readJsonFile(sourceDocumentPath);
    validateSourceDocument(sourceDocument);
    const artifactJson = await readJsonFile(repairArtifactPath);
    const artifactType = detectArtifactType(artifactJson);

    const inspection = artifactType === 'questions'
      ? inspectQuestionArtifact({ repairArtifactPath, artifactJson, sourceDocument })
      : (artifactType === 'conversationalPairs'
        ? inspectConversationalArtifact({ repairArtifactPath, artifactJson, sourceDocument })
        : null);

    if (!inspection) {
      throw new Error('Unsupported repair target. Load a partial question bank JSON or partial conversational pair JSON.');
    }

    onLog({
      level: 'info',
      message: `Repair metadata preflight: ${inspection.artifactType} with ${inspection.incompleteSectionCount} incomplete section(s).`,
    });

    if (!inspection.canRepair) {
      if (inspection.missingFromSource.length > 0) {
        throw new Error(
          `Repair blocked. ${inspection.missingFromSource.length} section(s) from incomplete metadata are missing in source document: ${inspection.missingFromSource.join(', ')}`
        );
      }
      throw new Error('Repair target metadata has no incomplete sections to repair.');
    }

    if (artifactType === 'questions') {
      return buildQuestionRepairResult({
        sourceDocument,
        artifactJson,
        repairArtifactPath,
        configuredProviders,
        generationGuidance,
        repairMode,
        onLog,
        onProgress,
        abortSignal,
      });
    }

    if (artifactType === 'conversationalPairs') {
      return buildConversationalRepairResult({
        sourceDocument,
        artifactJson,
        repairArtifactPath,
        configuredProviders,
        generationGuidance,
        repairMode,
        onLog,
        onProgress,
        abortSignal,
      });
    }

    throw new Error('Unsupported repair target. Load a partial question bank JSON or partial conversational pair JSON.');
  }

  async function inspectRepairArtifact(options = {}) {
    const sourceDocumentPath = normalizeText(options?.sourceDocumentPath);
    const repairArtifactPath = normalizeText(options?.repairArtifactPath);

    if (!repairArtifactPath) {
      throw new Error('Missing repair artifact path.');
    }

    const artifactJson = await readJsonFile(repairArtifactPath);
    const artifactType = detectArtifactType(artifactJson);
    if (!artifactType) {
      throw new Error('Unsupported repair target. Load a partial question bank JSON or partial conversational pair JSON.');
    }

    let sourceDocument = null;
    if (sourceDocumentPath) {
      sourceDocument = await readJsonFile(sourceDocumentPath);
      validateSourceDocument(sourceDocument);
    }

    if (artifactType === 'questions') {
      return inspectQuestionArtifact({
        repairArtifactPath,
        artifactJson,
        sourceDocument,
      });
    }

    return inspectConversationalArtifact({
      repairArtifactPath,
      artifactJson,
      sourceDocument,
    });
  }

  return {
    inspectRepairArtifact,
    repairPartialArtifact,
  };
}

module.exports = {
  createPartialArtifactRepairService,
};