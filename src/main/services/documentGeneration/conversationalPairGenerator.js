/**
 * Conversational Pair Generator
 * Generates document-grounded conversational training pairs suitable for SLM training.
 * Pairs are produced directly from document sections so conversational generation can run
 * independently from question generation in the pipeline.
 */

function normalizeText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().replace(/\s+/g, ' ');
}

function extractChapterId(documentJson) {
  const prefix = normalizeText(documentJson?.prefix);
  if (prefix) {
    return prefix.toLowerCase();
  }

  const chapterNumber = Number(documentJson?.chapter) || 0;
  if (chapterNumber > 0) {
    return `doc.${chapterNumber}`;
  }

  if (!Array.isArray(documentJson?.sections)) {
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Builds enhanced context from document sections for richer conversational content
 */
function cleanSentenceList(content, maxCount = 8) {
  const normalized = normalizeText(content);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 30)
    .slice(0, maxCount);
}

function extractContextualContent(section, maxLength = 300) {
  const fullContext = normalizeText(section?.content);
  if (!fullContext) {
    return '';
  }

  if (fullContext.length <= maxLength) {
    return fullContext;
  }

  let truncated = fullContext.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > 0) {
    truncated = fullContext.substring(0, lastPeriod + 1);
  }

  return truncated;
}

/**
 * Distribute target pair counts across sections while preserving the total target.
 */
function distributeSectionPairTargets(sections, targetPairCount) {
  const validSections = Array.isArray(sections)
    ? sections.filter((section) => normalizeText(section?.content))
    : [];
  if (validSections.length === 0) {
    return [];
  }

  const totalWords = validSections.reduce((sum, section) => sum + (Number(section?.wordCount) || 0), 0);
  const withWeights = validSections.map((section, index) => {
    const sectionWords = Math.max(1, Number(section?.wordCount) || cleanSentenceList(section?.content, 50).join(' ').split(/\s+/).filter(Boolean).length || 1);
    const exact = totalWords > 0
      ? (sectionWords / totalWords) * targetPairCount
      : (targetPairCount / validSections.length);
    const base = Math.max(1, Math.floor(exact));
    return {
      section,
      index,
      base,
      remainder: exact - Math.floor(exact),
    };
  });

  let allocated = withWeights.reduce((sum, entry) => sum + entry.base, 0);
  if (allocated > targetPairCount) {
    withWeights
      .sort((left, right) => left.base - right.base || left.remainder - right.remainder)
      .forEach((entry) => {
        if (allocated <= targetPairCount || entry.base <= 1) {
          return;
        }
        entry.base -= 1;
        allocated -= 1;
      });
  }

  if (allocated < targetPairCount) {
    withWeights
      .sort((left, right) => right.remainder - left.remainder)
      .forEach((entry) => {
        if (allocated >= targetPairCount) {
          return;
        }
        entry.base += 1;
        allocated += 1;
      });
  }

  return withWeights
    .sort((left, right) => left.index - right.index)
    .map((entry) => ({ section: entry.section, pairCount: entry.base }));
}

/**
 * Normalize persona names coming back from the API.
 */
function normalizePersona(value, fallbackIndex = 0) {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'confident') {
    return 'confident';
  }
  if (raw === 'confused') {
    return 'confused';
  }
  if (raw === 'checkride' || raw === 'checkride-prep' || raw === 'checkride prep') {
    return 'checkride';
  }

  const personas = ['confident', 'confused', 'checkride'];
  return personas[fallbackIndex % personas.length];
}

/**
 * Build stable conversational pair ids from the document section id.
 */
function buildConversationRootId(documentJson, section, sectionOrdinal) {
  const sectionId = normalizeText(section?.id).toUpperCase();
  if (sectionId) {
    return `${sectionId}.1`;
  }

  return `${extractChapterId(documentJson).toUpperCase()}.${sectionOrdinal}.1`;
}

function buildFallbackPair(section, documentJson, sectionOrdinal, pairIndex, personaIndex) {
  const persona = normalizePersona('', personaIndex);
  const sectionTitle = normalizeText(section?.title) || `Section ${sectionOrdinal}`;
  const snippets = cleanSentenceList(section?.content, 6);
  const leadingSnippet = snippets[pairIndex % Math.max(1, snippets.length)]
    || `This section explains ${sectionTitle.toLowerCase()} in practical flight training.`;

  let studentOpening = `What should I know about ${sectionTitle.toLowerCase()}?`;
  if (persona === 'confused') {
    studentOpening = `I am confused about ${sectionTitle.toLowerCase()}. Can you clarify the key idea?`;
  }
  if (persona === 'checkride') {
    studentOpening = `For checkride prep, what is the most important takeaway from ${sectionTitle.toLowerCase()}?`;
  }

  return {
    studentPersona: persona,
    student: studentOpening,
    assistant: leadingSnippet,
    subjects: [sectionTitle],
    source: normalizeText(documentJson?.title) || `Section ${sectionOrdinal}: ${sectionTitle}`,
  };
}

function normalizeProviderList(...inputs) {
  const providers = [];
  inputs.forEach((input) => {
    if (Array.isArray(input)) {
      input.forEach((entry) => {
        const normalized = `${entry || ''}`.trim().toLowerCase();
        if (normalized && !providers.includes(normalized)) {
          providers.push(normalized);
        }
      });
      return;
    }
    const normalized = `${input || ''}`.trim().toLowerCase();
    if (normalized && !providers.includes(normalized)) {
      providers.push(normalized);
    }
  });
  return providers;
}

function extractSectionOrdinal(section, fallback = 0) {
  const sectionId = normalizeText(section?.id);
  const dotMatch = sectionId.match(/\.(\d+)$/);
  if (dotMatch) {
    return Number.parseInt(dotMatch[1], 10);
  }
  const underscoreMatch = sectionId.match(/_(\d+)$/);
  if (underscoreMatch) {
    return Number.parseInt(underscoreMatch[1], 10);
  }
  return fallback;
}

/**
 * Request conversational pairs for a single document section.
 */
async function buildSectionPairsFromApi(api, documentJson, section, sectionOrdinal, pairCount, preferredProvider, requestOptions = {}) {
  const sectionTitle = normalizeText(section?.title) || `Section ${sectionOrdinal}`;
  const guidance = normalizeText(requestOptions?.generationGuidance).slice(0, 900);
  const prompt = [
    'You are generating aviation tutoring conversations for small language model training.',
    'Return strict JSON only with shape:',
    '{"pairs":[{"studentPersona":"confident|confused|checkride","student":string,"assistant":string,"subjects":[string],"source":string}]}',
    `Generate exactly ${pairCount} high-quality pairs for one section.`,
    'Requirements:',
    '- Ground every answer only in the provided section content.',
    '- Vary the student opening across confident, confused, and checkride-prep styles.',
    '- Keep the assistant answer concise, instructional, and useful for training.',
    '- Do not use markdown or code fences.',
    guidance ? `Regeneration guidance from prior audit findings: ${guidance}` : '',
  ].join(' ');

  const payload = {
    chapter: Number(documentJson?.chapter) || 0,
    chapterTitle: normalizeText(documentJson?.title),
    documentPrefix: normalizeText(documentJson?.prefix),
    sectionId: normalizeText(section?.id),
    sectionOrdinal,
    sectionTitle,
    sectionWordCount: Number(section?.wordCount) || 0,
    pairCount,
    sectionContent: normalizeText(section?.content),
  };

  const result = preferredProvider
    ? await api.callApiJson(preferredProvider, prompt, payload, null, requestOptions)
    : await api.callPreferredApiJson(prompt, payload, null, requestOptions);

  return {
    modelUsed: normalizeText(result?.modelUsed),
    modelVersion: normalizeText(result?.modelVersion),
    usage: {
      prompt_tokens: Number(result?.usage?.prompt_tokens || 0),
      completion_tokens: Number(result?.usage?.completion_tokens || 0),
    },
    pairs: Array.isArray(result?.json?.pairs) ? result.json.pairs : [],
  };
}

/**
 * Build the final conversational pair object.
 */
function toConversationPair(documentJson, section, sectionOrdinal, pairOrdinal, rawPair) {
  const persona = normalizePersona(rawPair?.studentPersona, pairOrdinal - 1);
  const context = extractContextualContent(section);
  const source = normalizeText(rawPair?.source)
    || normalizeText(documentJson?.title)
    || `Section ${sectionOrdinal}: ${normalizeText(section?.title)}`;
  const subjects = Array.isArray(rawPair?.subjects) && rawPair.subjects.length > 0
    ? rawPair.subjects.map((entry) => normalizeText(entry)).filter(Boolean)
    : [normalizeText(section?.title) || `Section ${sectionOrdinal}`];

  return {
    conversationalPairId: `${buildConversationRootId(documentJson, section, sectionOrdinal)}.z.${pairOrdinal}`,
    pairType: 'conversational_exchange',
    studentPersona: persona,
    turns: [
      {
        role: 'user',
        content: normalizeText(rawPair?.student),
        studentPersona: persona,
      },
      {
        role: 'assistant',
        content: normalizeText(rawPair?.assistant),
      },
    ],
    context,
    source,
    subjects,
  };
}

function createConversationalPairGenerator({ api }) {
  async function buildConversationalPairSet(documentJson, options = {}) {
    const safeDocumentJson = documentJson && typeof documentJson === 'object' ? documentJson : {};
    const preferredProvider = typeof options?.preferredProvider === 'string'
      ? options.preferredProvider.trim().toLowerCase()
      : '';
    const secondaryProvider = typeof options?.secondaryProvider === 'string'
      ? options.secondaryProvider.trim().toLowerCase()
      : '';
    const unlockSecondaryProviderPromise = options?.unlockSecondaryProviderPromise
      && typeof options.unlockSecondaryProviderPromise.then === 'function'
      ? options.unlockSecondaryProviderPromise
      : null;
    const workerProviders = normalizeProviderList(options?.workerProviders);
    const unlockWorkerProvidersPromise = options?.unlockWorkerProvidersPromise
      && typeof options.unlockWorkerProvidersPromise.then === 'function'
      ? options.unlockWorkerProvidersPromise
      : null;
    const allowLocalFallback = Boolean(options?.allowLocalFallback);
    const generationGuidance = normalizeText(options?.generationGuidance).slice(0, 900);
    const onLog = typeof options?.onLog === 'function' ? options.onLog : () => {};
    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : () => {};
    const externalAbortSignal = options?.abortSignal || null;
    const runAbortController = new AbortController();
    const runAbortSignal = runAbortController.signal;
    if (externalAbortSignal?.aborted) {
      runAbortController.abort();
    } else if (externalAbortSignal) {
      externalAbortSignal.addEventListener('abort', () => runAbortController.abort(), { once: true });
    }
    const PRIMARY_TIMEOUT_MS = 30000;
    const SECONDARY_TIMEOUT_MS = 60000;
    const SWITCH_WINDOW_MS = 60000;
    const SECTION_REBUILD_PASSES = 2;
    const getPrimaryTimeoutMs = (provider) => {
      const normalized = `${provider || ''}`.trim().toLowerCase();
      if (normalized === 'anthropic') {
        return 60000;
      }
      if (normalized === 'gemini') {
        return 45000;
      }
      return PRIMARY_TIMEOUT_MS;
    };
    const isAborted = () => Boolean(runAbortSignal?.aborted || externalAbortSignal?.aborted);
    const assertNotAborted = () => {
      if (isAborted()) {
        throw new Error('Generation cancelled by user.');
      }
    };
    const rethrowIfCancelled = (error) => {
      if (isAborted() || /generation cancelled by user/i.test(`${error?.message || error || ''}`)) {
        throw new Error('Generation cancelled by user.');
      }
    };
    const log = (message, level = 'info') => {
      onLog({ scope: 'conversational', level, message });
    };
    const totalWords = Number(safeDocumentJson?.totalWords) || 0;
    const sections = Array.isArray(safeDocumentJson?.sections) ? safeDocumentJson.sections : [];
    const repairSectionPlan = Array.isArray(options?.repairSectionPlan) ? options.repairSectionPlan : [];
    const repairPairCountBySectionId = new Map(
      repairSectionPlan
        .map((entry) => {
          const sectionId = normalizeText(entry?.sectionId);
          const plannedPairs = Math.max(1, Number(entry?.plannedPairs || 0) || 1);
          return sectionId ? [sectionId, plannedPairs] : null;
        })
        .filter(Boolean)
    );
    const targetPairCount = repairPairCountBySectionId.size > 0
      ? Array.from(repairPairCountBySectionId.values()).reduce((sum, count) => sum + count, 0)
      : Math.max(1, Math.floor(totalWords / 20));
    const sectionTargets = repairPairCountBySectionId.size > 0
      ? sections.map((section) => ({
        section,
        pairCount: repairPairCountBySectionId.get(normalizeText(section?.id)) || 1,
      }))
      : distributeSectionPairTargets(sections, targetPairCount);
    const pairs = [];
    const providers = new Set();
    const models = new Set();
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };
    const routingState = {
      switchedToSecondaryUntil: 0,
      primaryRecoveryPending: false,
    };
    const canUseSecondary = Boolean(secondaryProvider && secondaryProvider !== preferredProvider);
    const providerFallbackOrder = normalizeProviderList(
      preferredProvider,
      secondaryProvider,
      workerProviders,
    );

    const buildResultPayload = ({ buildStatus = 'complete', failedSection = null, failureReason = '' } = {}) => {
      const completedEntries = sectionResults
        .filter(Boolean)
        .sort((left, right) => left.index - right.index);
      const completedIndexes = new Set(completedEntries.map((entry) => entry.index));
      const builtPairs = [];
      const builtProviders = new Set();
      const builtModels = new Set();
      const builtUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
      };

      completedEntries.forEach((entry) => {
        if (entry.modelUsed) {
          builtProviders.add(entry.modelUsed);
        }
        if (entry.modelVersion) {
          builtModels.add(entry.modelVersion);
        }
        builtUsage.prompt_tokens += Number(entry?.sectionUsage?.prompt_tokens || 0);
        builtUsage.completion_tokens += Number(entry?.sectionUsage?.completion_tokens || 0);

        entry.rawPairs.forEach((rawPair, pairIndex) => {
          builtPairs.push(toConversationPair(safeDocumentJson, entry.section, entry.sectionOrdinal, pairIndex + 1, rawPair));
        });
      });

      const incompleteSections = sectionTargets
        .map((target, index) => {
          if (completedIndexes.has(index)) {
            return null;
          }

          const section = target?.section || {};
          const sectionOrdinal = extractSectionOrdinal(section, index + 1) || (index + 1);
          const isFailedSection = Number(failedSection?.index) === index;
          return {
            sectionOrdinal,
            sectionId: normalizeText(section?.id) || `section.${sectionOrdinal}`,
            sectionTitle: normalizeText(section?.title) || `Section ${sectionOrdinal}`,
            plannedPairs: Math.max(1, Number(target?.pairCount) || 1),
            status: isFailedSection ? 'failed' : 'pending',
            attemptedProviders: isFailedSection ? (failedSection?.attemptedProviders || []) : [],
            error: isFailedSection ? `${failedSection?.error || failureReason || 'Unknown API error.'}` : '',
          };
        })
        .filter(Boolean);

      return {
        conversationalTrainingPairSet: {
          generatedAtUtc: new Date().toISOString(),
          chapterId: extractChapterId(safeDocumentJson),
          sourceDocumentTitle: normalizeText(safeDocumentJson?.title) || 'Unknown document',
          documentTotalWords: totalWords,
          pairGenerationRatio: '1 pair per 20 words',
          targetPairCount,
          generatedPairCount: builtPairs.length,
          totalSections: sections.length,
          completedSections: completedEntries.length,
          incompleteSections,
          buildStatus,
          buildStage: 'conversationalPairs',
          failureReason: buildStatus === 'incomplete' ? `${failureReason || 'One or more sections failed across all providers.'}` : '',
          pairType: 'conversational_exchange',
          providers: builtProviders.size > 0 ? Array.from(builtProviders) : ['fallback-only'],
          models: builtModels.size > 0 ? Array.from(builtModels) : ['fallback-only'],
          promptTokens: Number(builtUsage.prompt_tokens || 0),
          completionTokens: Number(builtUsage.completion_tokens || 0),
          totalTokens: Number((builtUsage.prompt_tokens || 0) + (builtUsage.completion_tokens || 0)),
          studentPersonas: {
            confident: builtPairs.filter((p) => p.studentPersona === 'confident').length,
            confused: builtPairs.filter((p) => p.studentPersona === 'confused').length,
            checkride: builtPairs.filter((p) => p.studentPersona === 'checkride').length,
          },
        },
        pairs: builtPairs,
      };
    };

    onProgress({
      completed: 0,
      total: targetPairCount,
      progressText: `0/${targetPairCount}`,
      provider: '',
    });

    const buildSectionResult = async (target, index, workerProvider = '') => {
      assertNotAborted();
      const section = target.section;
      const pairCount = Math.max(1, Number(target?.pairCount) || 1);
      const sectionOrdinal = extractSectionOrdinal(section, index + 1) || (index + 1);
      const sectionTitle = normalizeText(section?.title) || `Section ${sectionOrdinal}`;
      let rawPairs = [];
      let modelUsed = '';
      let modelVersion = '';
      let sectionUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
      };
      let lastError = null;
      const attemptedProviders = [];

      const now = Date.now();
      if (canUseSecondary && routingState.primaryRecoveryPending && now >= routingState.switchedToSecondaryUntil) {
        log('Backup window elapsed. Retrying primary API for conversational generation.', 'info');
      }
      const preferSecondary = canUseSecondary && now < routingState.switchedToSecondaryUntil;
      let firstProvider = workerProvider || preferredProvider || secondaryProvider;
      if (canUseSecondary && preferSecondary && firstProvider === preferredProvider) {
        firstProvider = secondaryProvider;
      }
      const providerAttempts = normalizeProviderList(
        firstProvider,
        providerFallbackOrder.filter((provider) => provider && provider !== firstProvider)
      );
      const windowRemainingMs = Math.max(0, routingState.switchedToSecondaryUntil - now);
      const routingMode = preferSecondary ? 'secondary-window' : 'primary';
      let resolvedProvider = '';
      let resolvedVia = 'none';

      log(
        `Failover timeline [conversational s${sectionOrdinal}]: start mode=${routingMode} first=${firstProvider || 'none'} attempts=${providerAttempts.join('>') || 'none'} windowMs=${windowRemainingMs}`,
        'info'
      );

      for (let pass = 0; pass < SECTION_REBUILD_PASSES && rawPairs.length === 0; pass += 1) {
        if (pass > 0) {
          log(
            `Rebuilding conversational section ${sectionOrdinal} after first-pass failures (pass ${pass + 1}/${SECTION_REBUILD_PASSES}).`,
            'warning'
          );
        }

        for (let attemptIndex = 0; attemptIndex < providerAttempts.length; attemptIndex += 1) {
          const provider = providerAttempts[attemptIndex];
          const isFirstAttempt = pass === 0 && attemptIndex === 0;
          const timeoutMs = isFirstAttempt ? getPrimaryTimeoutMs(provider) : SECONDARY_TIMEOUT_MS;
          assertNotAborted();
          try {
            if (!isFirstAttempt) {
              log(`Retrying conversational section ${sectionOrdinal} with alternate API (${provider}).`, 'warning');
            }
            const result = await buildSectionPairsFromApi(
              api,
              safeDocumentJson,
              section,
              sectionOrdinal,
              pairCount,
              provider,
              {
                signal: runAbortSignal,
                timeoutMs,
                generationGuidance,
              }
            );
            rawPairs = Array.isArray(result?.pairs) ? result.pairs.slice(0, pairCount) : [];
            modelUsed = normalizeText(result?.modelUsed);
            modelVersion = normalizeText(result?.modelVersion);
            sectionUsage = {
              prompt_tokens: Number(result?.usage?.prompt_tokens || 0),
              completion_tokens: Number(result?.usage?.completion_tokens || 0),
            };
            resolvedProvider = provider;
            resolvedVia = isFirstAttempt ? 'first' : (pass === 0 ? 'alternate' : `rebuild-${pass + 1}`);

            if (provider === preferredProvider) {
              routingState.primaryRecoveryPending = false;
            }
            break;
          } catch (error) {
            rethrowIfCancelled(error);
            lastError = error;
            attemptedProviders.push({
              provider,
              error: `${error?.message || error || 'Unknown API error.'}`,
            });
            if (provider === preferredProvider && canUseSecondary) {
              routingState.switchedToSecondaryUntil = Date.now() + SWITCH_WINDOW_MS;
              routingState.primaryRecoveryPending = true;
              log('Primary API was unresponsive for 30s. Switching conversational generation to backup API for 1 minute.', 'warning');
            }
          }
        }
      }

      if (!Array.isArray(rawPairs) || rawPairs.length === 0) {
        assertNotAborted();
        if (!allowLocalFallback) {
          const sectionRef = normalizeText(section?.id) || `${sectionOrdinal}`;
          const errorMsg = `${lastError?.message || lastError || 'Unknown API error.'}`;
          log(`Failover timeline [conversational s${sectionOrdinal}]: outcome=failed error=${errorMsg}`, 'error');
          const sectionFailure = new Error(`Conversational generation failed for section ${sectionRef}. ${errorMsg}`);
          sectionFailure.sectionFailure = {
            index,
            sectionOrdinal,
            sectionId: sectionRef,
            sectionTitle,
            plannedPairs: pairCount,
            attemptedProviders,
            error: errorMsg,
          };
          throw sectionFailure;
        }
        rawPairs = [];
      }

      while (allowLocalFallback && rawPairs.length < pairCount) {
        assertNotAborted();
        rawPairs.push(buildFallbackPair(section, safeDocumentJson, sectionOrdinal, rawPairs.length, rawPairs.length));
      }

      if (resolvedProvider) {
        log(
          `Failover timeline [conversational s${sectionOrdinal}]: outcome=success via=${resolvedVia} provider=${resolvedProvider} pairs=${Math.min(pairCount, rawPairs.length)}`,
          'info'
        );
      } else if (allowLocalFallback) {
        log(
          `Failover timeline [conversational s${sectionOrdinal}]: outcome=fallback pairs=${Math.min(pairCount, rawPairs.length)}`,
          'warning'
        );
      }

      return {
        index,
        section,
        sectionOrdinal,
        pairCount,
        rawPairs: rawPairs.slice(0, pairCount),
        modelUsed,
        modelVersion,
        sectionUsage,
        resolvedProvider,
      };
    };

    const sectionResults = new Array(sectionTargets.length);
    let nextTargetIndex = 0;
    let generatedPairCount = 0;

    const claimNextTargetIndex = () => {
      if (nextTargetIndex >= sectionTargets.length) {
        return -1;
      }
      const claimedIndex = nextTargetIndex;
      nextTargetIndex += 1;
      return claimedIndex;
    };

    const runWorker = async (workerProvider, workerLabel) => {
      const safeWorkerProvider = `${workerProvider || ''}`.trim().toLowerCase();
      if (!safeWorkerProvider) {
        return;
      }

      log(`Parallel conversational worker active: ${workerLabel} -> ${safeWorkerProvider}.`, 'info');
      while (true) {
        assertNotAborted();
        const targetIndex = claimNextTargetIndex();
        if (targetIndex === -1) {
          return;
        }

        const sectionResult = await buildSectionResult(sectionTargets[targetIndex], targetIndex, safeWorkerProvider);
        sectionResults[targetIndex] = sectionResult;
        generatedPairCount += Array.isArray(sectionResult?.rawPairs) ? sectionResult.rawPairs.length : 0;
        onProgress({
          completed: generatedPairCount,
          total: targetPairCount,
          progressText: `${generatedPairCount}/${targetPairCount}`,
          provider: sectionResult.resolvedProvider || '',
        });
      }
    };

    const workerJobs = [];
    const initialWorkerProviders = normalizeProviderList(
      workerProviders.length > 0 ? workerProviders : [preferredProvider || secondaryProvider]
    );
    initialWorkerProviders.forEach((provider, index) => {
      workerJobs.push(runWorker(provider, index === 0 ? 'primary' : `worker-${index + 1}`));
    });

    const legacyUnlockPromise = unlockSecondaryProviderPromise && !unlockWorkerProvidersPromise
      ? unlockSecondaryProviderPromise.then((provider) => [provider || secondaryProvider])
      : null;
    const providerUnlockPromise = unlockWorkerProvidersPromise || legacyUnlockPromise;
    if (providerUnlockPromise) {
      workerJobs.push((async () => {
        try {
          const unlocked = await providerUnlockPromise;
          const unlockedProviders = normalizeProviderList(unlocked);
          const pendingWorkers = unlockedProviders
            .filter((provider) => provider)
            .filter((provider) => !initialWorkerProviders.includes(provider));
          const unlockedJobs = [];

          for (let index = 0; index < pendingWorkers.length; index += 1) {
            if (nextTargetIndex >= sectionTargets.length) {
              return;
            }
            const provider = pendingWorkers[index];
            log(`Parallel conversational worker unlocked: worker-${index + 1} -> ${provider}.`, 'info');
            unlockedJobs.push(runWorker(provider, `unlocked-${index + 1}`));
          }
          if (unlockedJobs.length > 0) {
            await Promise.all(unlockedJobs);
          }
        } catch {
          // Ignore unlock failures and continue with initial workers only.
        }
      })());
    }

    try {
      await Promise.all(workerJobs);
    } catch (error) {
      rethrowIfCancelled(error);
      if (!runAbortSignal.aborted) {
        runAbortController.abort();
      }
      return buildResultPayload({
        buildStatus: 'incomplete',
        failedSection: error?.sectionFailure || null,
        failureReason: `${error?.message || error || 'Unknown API error.'}`,
      });
    }

    return buildResultPayload({ buildStatus: 'complete' });
  }

  return {
    buildConversationalPairSet,
  };
}

module.exports = {
  createConversationalPairGenerator,
};
