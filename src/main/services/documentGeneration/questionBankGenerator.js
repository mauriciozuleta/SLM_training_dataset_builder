function createQuestionBankGenerator({ api, common }) {
  const REQUIRED_CORRECT_ANSWERS = 3;
  const REQUIRED_WRONG_ANSWERS = 8;
  const MAX_SECTION_CONTENT_CHARS = 3200;
  const MAX_GUIDANCE_CHARS = 900;

  const cleanText = (value) => `${value || ''}`.replace(/\s+/g, ' ').trim();

  const truncateForPrompt = (text, maxChars = MAX_SECTION_CONTENT_CHARS) => {
    const normalized = cleanText(text);
    if (!normalized) {
      return '';
    }
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
  };

  const sentenceSnippets = (content, maxCount = 8) => {
    const normalized = cleanText(content);
    if (!normalized) {
      return [];
    }

    return normalized
      .split(/(?<=[.!?])\s+/)
      .map((entry) => cleanText(entry))
      .filter((entry) => entry.length > 25)
      .slice(0, maxCount);
  };

  const uniqueList = (items, options = {}) => {
    const max = Number(options.max || 999);
    const result = [];
    const seen = new Set();

    for (const item of items || []) {
      const value = cleanText(item);
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(value);
      if (result.length >= max) {
        break;
      }
    }

    return result;
  };

  const toAnswerObjects = (questionId, type, answers) => {
    const marker = type === 'correct' ? 'c' : 'w';
    return answers.map((text, index) => ({
      id: `${questionId}.${marker}.${index + 1}`,
      text,
    }));
  };

  const buildFallbackCorrectAnswers = (sectionTitle, content) => {
    const snippets = sentenceSnippets(content, REQUIRED_CORRECT_ANSWERS + 2);
    const candidates = [
      ...snippets,
      `It explains key operational guidance related to ${sectionTitle.toLowerCase()}.`,
      `It supports safe decision-making and standards-based pilot performance in ${sectionTitle.toLowerCase()}.`,
      `It focuses on practical application of ${sectionTitle.toLowerCase()} during flight training.`,
    ];

    return uniqueList(candidates, { max: REQUIRED_CORRECT_ANSWERS }).slice(0, REQUIRED_CORRECT_ANSWERS);
  };

  const buildFallbackWrongAnswers = (sectionTitle, usedCorrect) => {
    const title = sectionTitle.toLowerCase();
    const candidates = [
      `It is mainly about unrelated advanced turbine transition procedures not covered in ${title}.`,
      `It focuses only on airline dispatch documentation and excludes pilot decision-making.`,
      `It is a dedicated guide to aerobatic competition routines and judging criteria.`,
      `It is exclusively about military formation tactics and combat operations.`,
      `It is solely a maintenance manual for engine teardown and overhaul steps.`,
      `It concentrates only on satellite launch planning and orbital mechanics.`,
      `It is intended only for long-range oceanic navigation in transport-category jets.`,
      `It replaces FAA regulations with optional recommendations that override legal rules.`,
      `It is strictly a weather-climatology textbook with no pilot training relevance.`,
      `It addresses only airport retail operations and passenger-service workflows.`,
    ];

    const filtered = uniqueList(candidates, { max: 30 }).filter(
      (entry) => !usedCorrect.some((correct) => correct.toLowerCase() === entry.toLowerCase())
    );

    return filtered.slice(0, REQUIRED_WRONG_ANSWERS);
  };

  const normalizeQuestionItem = ({
    raw,
    sectionTitle,
    sectionContent,
    questionId,
    sectionOrdinal,
    questionOrdinal,
  }) => {
    const safeQuestion = cleanText(raw?.question)
      || `Which statement best reflects the key guidance in ${sectionTitle}?`;

    const correctCandidates = Array.isArray(raw?.correct_answers)
      ? raw.correct_answers.map((entry) => (typeof entry === 'string' ? entry : entry?.text))
      : [];
    const wrongCandidates = Array.isArray(raw?.wrong_answers)
      ? raw.wrong_answers.map((entry) => (typeof entry === 'string' ? entry : entry?.text))
      : [];

    const fallbackCorrect = buildFallbackCorrectAnswers(sectionTitle, sectionContent);
    const correctAnswers = uniqueList([...correctCandidates, ...fallbackCorrect], { max: REQUIRED_CORRECT_ANSWERS })
      .slice(0, REQUIRED_CORRECT_ANSWERS);

    const fallbackWrong = buildFallbackWrongAnswers(sectionTitle, correctAnswers);
    const wrongAnswers = uniqueList([...wrongCandidates, ...fallbackWrong], { max: REQUIRED_WRONG_ANSWERS + 4 })
      .filter((entry) => !correctAnswers.some((correct) => correct.toLowerCase() === entry.toLowerCase()))
      .slice(0, REQUIRED_WRONG_ANSWERS);

    const sourceText = cleanText(raw?.source)
      || `Section ${sectionOrdinal}: ${sectionTitle}`;

    const subjects = uniqueList(
      Array.isArray(raw?.subjects) ? raw.subjects : [sectionTitle, `Section ${sectionOrdinal}`],
      { max: 5 }
    );

    const paddedCorrect = [...correctAnswers];
    while (paddedCorrect.length < REQUIRED_CORRECT_ANSWERS) {
      paddedCorrect.push(`Accurate guidance from section ${sectionOrdinal} (${sectionTitle})`);
    }

    const paddedWrong = [...wrongAnswers];
    while (paddedWrong.length < REQUIRED_WRONG_ANSWERS) {
      const fillerNumber = paddedWrong.length + 1;
      paddedWrong.push(`Distractor ${fillerNumber} not supported by section ${sectionOrdinal} (${sectionTitle})`);
    }

    return {
      questionid: questionId,
      question: safeQuestion,
      correct_answers: toAnswerObjects(questionId, 'correct', paddedCorrect),
      wrong_answers: toAnswerObjects(questionId, 'wrong', paddedWrong),
      source: sourceText,
      subjects,
      _meta: {
        sectionOrdinal,
        questionOrdinal,
      },
    };
  };

  const buildSectionQuestionsFromApi = async ({
    documentJson,
    section,
    sectionOrdinal,
    questionCount,
    chapterNumber,
    bookId,
    sectionWeightPercentage,
    preferredProvider = null,
    requestOptions = {},
  }) => {
    const sectionTitle = cleanText(section?.title) || `Section ${sectionOrdinal}`;
    const guidance = cleanText(requestOptions?.generationGuidance).slice(0, MAX_GUIDANCE_CHARS);

    const prompt = [
      'You are an aviation exam item generator.',
      'Generate questions for exactly one section.',
      'Return strict JSON only with shape:',
      '{"questions":[{"question":string,"correct_answers":[string,string,string],"wrong_answers":[string,string,string,string,string,string,string,string],"source":string,"subjects":[string]}]}',
      `Generate exactly ${questionCount} questions.`,
      `Each question MUST have exactly ${REQUIRED_CORRECT_ANSWERS} correct answers and ${REQUIRED_WRONG_ANSWERS} wrong answers.`,
      'All answers must be concise, factual, and non-duplicated.',
      'Use only the provided section content; do not invent outside facts.',
      guidance ? `Regeneration guidance from prior audit findings: ${guidance}` : '',
    ].join(' ');

    const payload = {
      bookId,
      chapter: chapterNumber,
      chapterTitle: cleanText(documentJson?.title),
      sectionId: cleanText(section?.id),
      sectionOrdinal,
      sectionTitle,
      sectionWeightPercentage: Number(sectionWeightPercentage || 0),
      questionCount,
      sectionWordCount: Number(section?.wordCount) || 0,
      sectionContent: truncateForPrompt(section?.content, MAX_SECTION_CONTENT_CHARS),
      requiredShape: {
        question: 'string',
        correct_answers: [REQUIRED_CORRECT_ANSWERS],
        wrong_answers: [REQUIRED_WRONG_ANSWERS],
      },
    };

    const result = preferredProvider
      ? await api.callApiJson(preferredProvider, prompt, payload, null, requestOptions)
      : await api.callPreferredApiJson(prompt, payload, null, requestOptions);

    const generated = Array.isArray(result?.json?.questions) ? result.json.questions : [];
    return {
      questions: generated,
      modelUsed: cleanText(result?.modelUsed),
      modelVersion: cleanText(result?.modelVersion),
      usage: {
        prompt_tokens: Number(result?.usage?.prompt_tokens || 0),
        completion_tokens: Number(result?.usage?.completion_tokens || 0),
      },
    };
  };

  const buildFallbackSectionQuestions = ({ sectionTitle, sectionContent, count }) => {
    const snippets = sentenceSnippets(sectionContent, Math.max(6, count + 3));
    const items = [];

    for (let idx = 0; idx < count; idx += 1) {
      const snippet = snippets[idx % (snippets.length || 1)] || `This section explains ${sectionTitle.toLowerCase()} for pilot training.`;
      items.push({
        question: `Which statement is accurate about ${sectionTitle.toLowerCase()}?`,
        correct_answers: [
          snippet,
          `It supports sound judgment and safe operating practices in ${sectionTitle.toLowerCase()}.`,
          `It contributes to standards-based pilot proficiency related to ${sectionTitle.toLowerCase()}.`,
        ],
        wrong_answers: [
          `It removes the need for pilot judgment in ${sectionTitle.toLowerCase()}.`,
          `It applies only to spaceflight operations and not airplane training.`,
          `It is unrelated to safety or regulatory compliance in flight operations.`,
          `It requires replacing all checklist procedures with improvisation.`,
          `It prohibits using established training standards and syllabi.`,
          `It addresses only unrelated cargo logistics workflows.`,
          `It is about non-aviation topics and excludes pilot performance.`,
          `It eliminates the need for structured flight instruction.`,
        ],
        source: `Section reference: ${sectionTitle}`,
        subjects: [sectionTitle],
      });
    }

    return items;
  };

  const normalizeProviderList = (...inputs) => {
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
  };

  async function buildQuestionBank(documentJson, options = {}) {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const idContext = common.parseIdContextFromPrefix(documentJson?.prefix || '', documentJson);
    let sectionBlueprintInfo = common.buildSectionBlueprintsFromDocument(documentJson, idContext);
    const repairSectionPlan = Array.isArray(options?.repairSectionPlan) ? options.repairSectionPlan : [];
    if (repairSectionPlan.length > 0 && Array.isArray(sectionBlueprintInfo?.sectionBlueprints)) {
      const requiredQuestionsBySectionId = new Map(
        repairSectionPlan
          .map((entry) => {
            const sectionId = cleanText(entry?.sectionId);
            const plannedQuestions = Math.max(1, Number(entry?.plannedQuestions || 0) || 1);
            return sectionId ? [sectionId, plannedQuestions] : null;
          })
          .filter(Boolean)
      );

      const sectionBlueprints = sectionBlueprintInfo.sectionBlueprints.map((blueprint, index) => {
        const section = sections[index] || {};
        const sectionId = cleanText(section?.id) || cleanText(blueprint?.sectionId);
        const plannedQuestions = requiredQuestionsBySectionId.get(sectionId);
        if (!plannedQuestions) {
          return blueprint;
        }

        return {
          ...blueprint,
          requiredQuestions: plannedQuestions,
        };
      });

      sectionBlueprintInfo = {
        ...sectionBlueprintInfo,
        sectionBlueprints,
        totalRequiredQuestions: sectionBlueprints.reduce((sum, entry) => {
          return sum + Math.max(1, Number(entry?.requiredQuestions || 0) || 1);
        }, 0),
      };
    }
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
    const generationGuidance = cleanText(options?.generationGuidance).slice(0, MAX_GUIDANCE_CHARS);
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
      onLog({ scope: 'questions', level, message });
    };

    const bookId = `${sectionBlueprintInfo?.bookId || idContext?.bookId || 'DOC'}`.toUpperCase();
    const chapterNumber = Number(sectionBlueprintInfo?.chapterNumber || idContext?.chapterNumber || documentJson?.chapter || 0) || 0;
    const chapterId = cleanText(documentJson?.prefix) || `${bookId.toLowerCase()}.${chapterNumber}`;
    const chapterTitle = cleanText(documentJson?.title) || `Chapter ${chapterNumber || '?'}`;

    const providers = new Set();
    const models = new Set();
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    const allQuestions = [];
    const sectionQuestionSummary = [];
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

    const buildQuestionBankPayload = ({ buildStatus = 'complete', failedSection = null, failureReason = '' } = {}) => {
      const completedResults = sectionResults.filter(Boolean);
      const completedIndexes = new Set(completedResults.map((entry) => entry.sectionIndex));
      const builtQuestions = [];
      const builtSummary = [];
      const builtProviders = new Set();
      const builtModels = new Set();
      const builtUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
      };

      completedResults.forEach((result) => {
        builtQuestions.push(...result.normalizedQuestions);
        builtSummary.push(result.summaryEntry);
        if (result.modelUsed) {
          builtProviders.add(result.modelUsed);
        }
        if (result.modelVersion) {
          builtModels.add(result.modelVersion);
        }
        builtUsage.prompt_tokens += Number(result?.usage?.prompt_tokens || 0);
        builtUsage.completion_tokens += Number(result?.usage?.completion_tokens || 0);
      });

      const incompleteSections = sections
        .map((section, sectionIndex) => {
          if (completedIndexes.has(sectionIndex)) {
            return null;
          }

          const sectionOrdinal = common.extractSectionOrdinal(section?.id, sectionIndex + 1) || (sectionIndex + 1);
          const sectionTitle = cleanText(section?.title) || `Section ${sectionOrdinal}`;
          const blueprint = Array.isArray(sectionBlueprintInfo?.sectionBlueprints)
            ? sectionBlueprintInfo.sectionBlueprints[sectionIndex]
            : null;
          const isFailedSection = Number(failedSection?.sectionIndex) === sectionIndex;

          return {
            sectionOrdinal,
            sectionId: cleanText(section?.id) || `section.${sectionOrdinal}`,
            sectionTitle,
            plannedQuestions: Math.max(1, Number(blueprint?.requiredQuestions || 1)),
            status: isFailedSection ? 'failed' : 'pending',
            attemptedProviders: isFailedSection ? (failedSection?.attemptedProviders || []) : [],
            error: isFailedSection ? `${failedSection?.error || failureReason || 'Unknown API error.'}` : '',
          };
        })
        .filter(Boolean);

      const metadata = {
        generatedAtUtc: new Date().toISOString(),
        chapterId,
        chapterNumber,
        totalSections: sections.length,
        totalRequiredQuestions: builtQuestions.length,
        providers: builtProviders.size > 0 ? Array.from(builtProviders) : ['fallback-only'],
        models: builtModels.size > 0 ? Array.from(builtModels) : ['fallback-only'],
        promptTokens: Number(builtUsage.prompt_tokens || 0),
        completionTokens: Number(builtUsage.completion_tokens || 0),
        totalTokens: Number((builtUsage.prompt_tokens || 0) + (builtUsage.completion_tokens || 0)),
        sectionQuestionSummary: builtSummary,
        buildStatus,
        buildStage: 'questions',
        completedSections: completedResults.length,
        incompleteSections,
        failureReason: buildStatus === 'incomplete' ? `${failureReason || 'One or more sections failed across all providers.'}` : '',
      };

      const payload = [
        {
          questionBank: {
            chapterId,
            bookId,
            chapterNumber,
            chapterTitle,
            totalRequiredQuestions: builtQuestions.length,
            metadata,
          },
        },
        ...builtQuestions.map(({ _meta, ...question }) => question),
      ];

      return {
        questionBank: payload,
        metadata,
      };
    };

    const totalRequiredQuestions = Math.max(1, Number(sectionBlueprintInfo?.totalRequiredQuestions || 0));
    onProgress({
      completed: 0,
      total: totalRequiredQuestions,
      progressText: `0/${totalRequiredQuestions}`,
      provider: '',
    });

    const buildSectionResult = async (sectionIndex, workerProvider = '') => {
      assertNotAborted();
      const section = sections[sectionIndex];
      const sectionOrdinal = common.extractSectionOrdinal(section?.id, sectionIndex + 1) || (sectionIndex + 1);
      const sectionTitle = cleanText(section?.title) || `Section ${sectionOrdinal}`;
      const blueprint = Array.isArray(sectionBlueprintInfo?.sectionBlueprints)
        ? sectionBlueprintInfo.sectionBlueprints[sectionIndex]
        : null;

      const plannedCount = Math.max(1, Number(blueprint?.requiredQuestions || 1));
      const sectionWeightPercentage = Number(
        blueprint?.weightPercentage ?? section?.sectionWeight ?? 0
      ) || 0;

      let rawQuestions = [];
      let apiResult = null;
      let lastError = null;
      const attemptedProviders = [];

      const now = Date.now();
      if (canUseSecondary && routingState.primaryRecoveryPending && now >= routingState.switchedToSecondaryUntil) {
        log('Backup window elapsed. Retrying primary API for question generation.', 'info');
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
        `Failover timeline [questions s${sectionOrdinal}]: start mode=${routingMode} first=${firstProvider || 'none'} attempts=${providerAttempts.join('>') || 'none'} windowMs=${windowRemainingMs}`,
        'info'
      );

      for (let pass = 0; pass < SECTION_REBUILD_PASSES && !apiResult; pass += 1) {
        if (pass > 0) {
          log(
            `Rebuilding question section ${sectionOrdinal} after first-pass failures (pass ${pass + 1}/${SECTION_REBUILD_PASSES}).`,
            'warning'
          );
        }

        for (let attemptIndex = 0; attemptIndex < providerAttempts.length; attemptIndex += 1) {
          const provider = providerAttempts[attemptIndex];
          const isFirstAttempt = pass === 0 && attemptIndex === 0;
          const timeoutMs = isFirstAttempt ? getPrimaryTimeoutMs(provider) : SECONDARY_TIMEOUT_MS;
          assertNotAborted();
          try {
            apiResult = await buildSectionQuestionsFromApi({
              documentJson,
              section,
              sectionOrdinal,
              questionCount: plannedCount,
              chapterNumber,
              bookId,
              sectionWeightPercentage,
              preferredProvider: provider,
              requestOptions: {
                signal: runAbortSignal,
                timeoutMs,
                generationGuidance,
              },
            });
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
              log('Primary API was unresponsive for 30s. Switching question generation to backup API for 1 minute.', 'warning');
            }
          }
        }
      }

      if (apiResult) {
        rawQuestions = Array.isArray(apiResult.questions) ? apiResult.questions : [];
        if (apiResult.modelUsed) {
          providers.add(apiResult.modelUsed);
        }
        if (apiResult.modelVersion) {
          models.add(apiResult.modelVersion);
        }
        usage.prompt_tokens += Number(apiResult?.usage?.prompt_tokens || 0);
        usage.completion_tokens += Number(apiResult?.usage?.completion_tokens || 0);
      }

      if ((!Array.isArray(rawQuestions) || rawQuestions.length === 0) && allowLocalFallback) {
        assertNotAborted();
        rawQuestions = buildFallbackSectionQuestions({
          sectionTitle,
          sectionContent: section?.content,
          count: plannedCount,
        });
        if (!resolvedProvider) {
          log(`Failover timeline [questions s${sectionOrdinal}]: outcome=fallback questions=${plannedCount}`, 'warning');
        }
      } else if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        const sectionRef = cleanText(section?.id) || `${sectionOrdinal}`;
        const errorMsg = `${lastError?.message || lastError || 'Unknown API error.'}`;
        log(`Failover timeline [questions s${sectionOrdinal}]: outcome=failed error=${errorMsg}`, 'error');
        const sectionFailure = new Error(`Question generation failed for section ${sectionRef}. ${errorMsg}`);
        sectionFailure.sectionFailure = {
          sectionIndex,
          sectionOrdinal,
          sectionId: sectionRef,
          sectionTitle,
          plannedQuestions: plannedCount,
          attemptedProviders,
          error: errorMsg,
        };
        throw sectionFailure;
      }

      if (resolvedProvider) {
        log(
          `Failover timeline [questions s${sectionOrdinal}]: outcome=success via=${resolvedVia} provider=${resolvedProvider} questions=${Math.min(plannedCount, rawQuestions.length)}`,
          'info'
        );
      }

      const normalizedQuestions = [];
      for (let qIndex = 0; qIndex < plannedCount; qIndex += 1) {
        const rawQuestion = rawQuestions[qIndex] || {};
        const questionOrdinal = qIndex + 1;
        const questionId = common.buildStructuredQuestionId(bookId, chapterNumber, sectionOrdinal, questionOrdinal);
        normalizedQuestions.push(
          normalizeQuestionItem({
            raw: rawQuestion,
            sectionTitle,
            sectionContent: section?.content,
            questionId,
            sectionOrdinal,
            questionOrdinal,
          })
        );
      }

      return {
        sectionIndex,
        normalizedQuestions,
        summaryEntry: {
          sectionId: cleanText(section?.id) || `section.${sectionOrdinal}`,
          sectionTitle,
          sectionOrdinal,
          sectionWeightPercentage: Number(sectionWeightPercentage.toFixed(2)),
          questionsGenerated: normalizedQuestions.length,
        },
        modelUsed: apiResult?.modelUsed || '',
        modelVersion: apiResult?.modelVersion || '',
        usage: {
          prompt_tokens: Number(apiResult?.usage?.prompt_tokens || 0),
          completion_tokens: Number(apiResult?.usage?.completion_tokens || 0),
        },
        resolvedProvider,
      };
    };

    const sectionResults = new Array(sections.length);
    let nextSectionIndex = 0;
    let generatedQuestionCount = 0;

    const claimNextSectionIndex = () => {
      if (nextSectionIndex >= sections.length) {
        return -1;
      }
      const claimedIndex = nextSectionIndex;
      nextSectionIndex += 1;
      return claimedIndex;
    };

    const runWorker = async (workerProvider, workerLabel) => {
      const safeWorkerProvider = `${workerProvider || ''}`.trim().toLowerCase();
      if (!safeWorkerProvider) {
        return;
      }

      log(`Parallel question worker active: ${workerLabel} -> ${safeWorkerProvider}.`, 'info');
      while (true) {
        assertNotAborted();
        const sectionIndex = claimNextSectionIndex();
        if (sectionIndex === -1) {
          return;
        }

        const result = await buildSectionResult(sectionIndex, safeWorkerProvider);
        sectionResults[sectionIndex] = result;
        generatedQuestionCount += result.normalizedQuestions.length;
        onProgress({
          completed: generatedQuestionCount,
          total: totalRequiredQuestions,
          progressText: `${generatedQuestionCount}/${totalRequiredQuestions}`,
          provider: result.resolvedProvider || '',
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
            if (nextSectionIndex >= sections.length) {
              return;
            }
            const provider = pendingWorkers[index];
            log(`Parallel question worker unlocked: worker-${index + 1} -> ${provider}.`, 'info');
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
      return buildQuestionBankPayload({
        buildStatus: 'incomplete',
        failedSection: error?.sectionFailure || null,
        failureReason: `${error?.message || error || 'Unknown API error.'}`,
      });
    }

    return buildQuestionBankPayload({ buildStatus: 'complete' });
  }

  return {
    buildQuestionBank,
  };
}

module.exports = {
  createQuestionBankGenerator,
};