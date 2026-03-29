function createSummaryGenerator({ api }) {
  const MAX_SECTION_CONTENT_CHARS = 2400;
  const MAX_GUIDANCE_CHARS = 900;

  const cleanText = (value) => `${value || ''}`.replace(/\s+/g, ' ').trim();

  const summarizeSectionContent = (content, maxChars = 240) => {
    const normalized = cleanText(content);
    if (!normalized) {
      return 'No extractable content was available for this section.';
    }
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
  };

  const toTitleCase = (value) => cleanText(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (match, chr) => chr.toUpperCase());

  const countWords = (text) => {
    const words = cleanText(text).match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
    return Array.isArray(words) ? words.length : 0;
  };

  const normalizeProviderList = (...values) => {
    const normalized = [];
    values.flat().forEach((value) => {
      const provider = `${value || ''}`.trim().toLowerCase();
      if (provider && !normalized.includes(provider)) {
        normalized.push(provider);
      }
    });
    return normalized;
  };

  const buildMetadata = ({
    chapter,
    totalSections,
    sectionsSummarized,
    summaryWordCount,
    providers,
    models,
    usage,
    buildStatus = 'complete',
    buildStage = 'summary',
    completedSections = 0,
    incompleteSections = [],
    failureReason = '',
  }) => ({
    generatedAtUtc: new Date().toISOString(),
    chapter: Number(chapter) || 0,
    totalSections: Number(totalSections) || 0,
    sectionsSummarized: Number(sectionsSummarized) || 0,
    summaryWordCount: Number(summaryWordCount) || 0,
    providers: providers.length > 0 ? providers.join(', ') : 'fallback-only',
    models: models.length > 0 ? models.join(', ') : 'fallback-only',
    promptTokens: Number(usage?.prompt_tokens || 0),
    completionTokens: Number(usage?.completion_tokens || 0),
    totalTokens: Number((usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0)),
    buildStatus,
    buildStage,
    completedSections: Number(completedSections || 0),
    incompleteSections: Array.isArray(incompleteSections) ? incompleteSections : [],
    failureReason: `${failureReason || ''}`.trim(),
  });

  const buildFallbackSummaryModel = (documentJson) => {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const totalSections = Number(documentJson?.totalSections) > 0
      ? Number(documentJson.totalSections)
      : sections.length;
    const totalWords = Number(documentJson?.totalWords) > 0
      ? Number(documentJson.totalWords)
      : sections.reduce((sum, sec) => sum + (Number(sec?.wordCount) || 0), 0);

    const mainConcepts = sections.map((section) => ({
      title: cleanText(section?.title) || `Section ${section?.id || ''}`.trim(),
      summary: summarizeSectionContent(section?.content, 260),
    }));

    const keyLearningObjectives = sections
      .slice(0, Math.min(12, sections.length))
      .map((section) => cleanText(section?.title))
      .filter(Boolean)
      .map((title) => `Understand and apply ${title.toLowerCase()} in practical training scenarios.`);

    const keyTerms = sections
      .slice(0, Math.min(12, sections.length))
      .map((section) => cleanText(section?.title))
      .filter(Boolean)
      .map((term) => ({
        term: toTitleCase(term),
        definition: 'A primary chapter concept that supports safe execution and consistent pilot performance.',
      }));

    const importantFacts = [
      `The chapter is organized into ${totalSections} section${totalSections === 1 ? '' : 's'} that should all be represented in study review.`,
      totalWords > 0
        ? `The extracted content totals approximately ${totalWords.toLocaleString()} words of training guidance.`
        : 'The extracted content provides structured training guidance across the full chapter.',
      'Emphasis is placed on standards-based execution, pilot judgment, and risk-managed decision making.',
    ];

    return {
      chapterTitle: cleanText(documentJson?.title) || `Chapter ${documentJson?.chapter || '?'}`,
      totalSections,
      overview: `Chapter ${documentJson?.chapter || '?'} covers ${totalSections} sections and provides section-by-section guidance focused on pilot technique, control accuracy, risk awareness, and standards-based decision making.`,
      keyLearningObjectives,
      mainConcepts,
      keyTerms,
      importantFacts,
      metadata: null,
    };
  };

  const buildSummaryMarkdownBody = (summaryModel) => {
    const lines = [];

    lines.push('## Overview');
    lines.push(summaryModel.overview || 'No overview was generated.');
    lines.push('');

    lines.push('## Key Learning Objectives');
    if (Array.isArray(summaryModel.keyLearningObjectives) && summaryModel.keyLearningObjectives.length > 0) {
      summaryModel.keyLearningObjectives.forEach((item) => {
        lines.push(`- ${item}`);
      });
    } else {
      lines.push('- No learning objectives were generated.');
    }
    lines.push('');

    lines.push('## Main Concepts');
    if (Array.isArray(summaryModel.mainConcepts) && summaryModel.mainConcepts.length > 0) {
      summaryModel.mainConcepts.forEach((entry) => {
        lines.push(`- ${entry.title}: ${entry.summary}`);
      });
    } else {
      lines.push('- No concept summaries were generated.');
    }
    lines.push('');

    lines.push('## Key Terms and Definitions');
    if (Array.isArray(summaryModel.keyTerms) && summaryModel.keyTerms.length > 0) {
      summaryModel.keyTerms.forEach((entry) => {
        lines.push(`- **${entry.term}**: ${entry.definition}`);
      });
    } else {
      lines.push('- No key terms were generated.');
    }
    lines.push('');

    lines.push('## Summary of Important Facts');
    if (Array.isArray(summaryModel.importantFacts) && summaryModel.importantFacts.length > 0) {
      summaryModel.importantFacts.forEach((entry) => {
        lines.push(`- ${entry}`);
      });
    } else {
      lines.push('- No additional important facts were generated.');
    }

    return `${lines.join('\n').trim()}\n`;
  };

  const buildSummaryMarkdown = (summaryModel) => {
    const lines = [];
    const metadata = summaryModel?.metadata || {};

    lines.push(`# Chapter Summary: ${summaryModel.chapterTitle || 'Unknown Chapter'}`);
    lines.push('');
    lines.push('## Summary Metadata');
    lines.push(`- Generated At (UTC): ${metadata.generatedAtUtc || 'N/A'}`);
    lines.push(`- Source Chapter: ${metadata.chapter || 0}`);
    lines.push(`- Total Sections (from JSON): ${metadata.totalSections || 0}`);
    lines.push(`- Sections Summarized: ${metadata.sectionsSummarized || 0}`);
    lines.push(`- Summary Word Count: ${metadata.summaryWordCount || 0}`);
    lines.push(`- API Provider(s): ${metadata.providers || 'fallback-only'}`);
    lines.push(`- Model(s): ${metadata.models || 'fallback-only'}`);
    lines.push(`- Prompt Tokens: ${metadata.promptTokens || 0}`);
    lines.push(`- Completion Tokens: ${metadata.completionTokens || 0}`);
    lines.push(`- Total Tokens: ${metadata.totalTokens || 0}`);
    lines.push(`- Build Status: ${metadata.buildStatus || 'complete'}`);
    lines.push(`- Completed Sections: ${metadata.completedSections || 0}`);
    lines.push(`- Incomplete Sections: ${Array.isArray(metadata.incompleteSections) ? metadata.incompleteSections.length : 0}`);
    if (metadata.failureReason) {
      lines.push(`- Failure Reason: ${metadata.failureReason}`);
    }
    lines.push('');
    lines.push(buildSummaryMarkdownBody(summaryModel).trim());

    return `${lines.join('\n').trim()}\n`;
  };

  const buildSectionSummaryFromApi = async ({ documentJson, section, sectionIndex, totalSections, preferredProvider = null, requestOptions = {} }) => {
    const sectionTitle = cleanText(section?.title) || `Section ${sectionIndex + 1}`;
    const guidance = cleanText(requestOptions?.generationGuidance).slice(0, MAX_GUIDANCE_CHARS);
    const prompt = [
      'You are an aviation training summarizer.',
      'Create a concise summary for exactly one chapter section using only provided text.',
      'Return strict JSON only with shape:',
      '{"summary": string}',
      'Constraints:',
      '- 1-2 sentences.',
      '- Mention the section topic explicitly.',
      '- Stay factual and avoid adding outside information.',
      guidance ? `Regeneration guidance from prior audit findings: ${guidance}` : '',
    ].join(' ');

    const result = preferredProvider
      ? await api.callApiJson(preferredProvider, prompt, {
        chapter: Number(documentJson?.chapter) || 0,
        chapterTitle: cleanText(documentJson?.title),
        totalSections,
        sectionIndex: sectionIndex + 1,
        sectionId: cleanText(section?.id),
        sectionTitle,
        sectionWordCount: Number(section?.wordCount) || 0,
        sectionContent: summarizeSectionContent(section?.content, MAX_SECTION_CONTENT_CHARS),
      }, null, requestOptions)
      : await api.callPreferredApiJson(prompt, {
      chapter: Number(documentJson?.chapter) || 0,
      chapterTitle: cleanText(documentJson?.title),
      totalSections,
      sectionIndex: sectionIndex + 1,
      sectionId: cleanText(section?.id),
      sectionTitle,
      sectionWordCount: Number(section?.wordCount) || 0,
      sectionContent: summarizeSectionContent(section?.content, MAX_SECTION_CONTENT_CHARS),
    }, null, requestOptions);

    const summary = cleanText(result?.json?.summary);
    return {
      summary: summary || summarizeSectionContent(section?.content, 260),
      modelUsed: cleanText(result?.modelUsed),
      modelVersion: cleanText(result?.modelVersion),
      usage: {
        prompt_tokens: Number(result?.usage?.prompt_tokens || 0),
        completion_tokens: Number(result?.usage?.completion_tokens || 0),
      },
    };
  };

  const buildSummaryFromApi = async (documentJson, fallbackModel, options = {}) => {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const totalSections = Number(documentJson?.totalSections) > 0
      ? Number(documentJson.totalSections)
      : sections.length;
    const preferredProvider = typeof options?.preferredProvider === 'string'
      ? options.preferredProvider.trim().toLowerCase()
      : '';
    const secondaryProvider = typeof options?.secondaryProvider === 'string'
      ? options.secondaryProvider.trim().toLowerCase()
      : '';
    const workerProviders = normalizeProviderList(options?.workerProviders);
    const providerFallbackOrder = normalizeProviderList(preferredProvider, secondaryProvider, workerProviders);
    const allowLocalFallback = Boolean(options?.allowLocalFallback);
    const generationGuidance = cleanText(options?.generationGuidance).slice(0, MAX_GUIDANCE_CHARS);
    const onLog = typeof options?.onLog === 'function' ? options.onLog : () => {};
    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : () => {};
    const abortSignal = options?.abortSignal || null;
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

    const isAborted = () => Boolean(abortSignal?.aborted);
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
      onLog({ scope: 'summary', level, message });
    };

    const mainConcepts = [];
    const providers = new Set();
    const models = new Set();
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    let switchedToSecondaryUntil = 0;
    let primaryRecoveryPending = false;

    const buildSummaryModel = ({ buildStatus = 'complete', failedSection = null, failureReason = '' } = {}) => {
      const incompleteSections = sections
        .map((section, index) => {
          if (index < mainConcepts.length) {
            return null;
          }
          const isFailedSection = Number(failedSection?.sectionIndex) === index;
          return {
            sectionOrdinal: index + 1,
            sectionId: cleanText(section?.id) || `section.${index + 1}`,
            sectionTitle: cleanText(section?.title) || `Section ${index + 1}`,
            status: isFailedSection ? 'failed' : 'pending',
            attemptedProviders: isFailedSection ? (failedSection?.attemptedProviders || []) : [],
            error: isFailedSection ? `${failedSection?.error || failureReason || 'Unknown API error.'}` : '',
          };
        })
        .filter(Boolean);

      const keyLearningObjectives = sections
        .slice(0, Math.min(12, sections.length))
        .map((section) => cleanText(section?.title))
        .filter(Boolean)
        .map((title) => `Understand and apply ${title.toLowerCase()} in practical training scenarios.`);

      const keyTerms = sections
        .slice(0, Math.min(12, sections.length))
        .map((section) => cleanText(section?.title))
        .filter(Boolean)
        .map((term) => ({
          term: toTitleCase(term),
          definition: 'A primary chapter concept that supports safe execution and consistent pilot performance.',
        }));

      const totalWords = Number(documentJson?.totalWords) > 0
        ? Number(documentJson.totalWords)
        : sections.reduce((sum, sec) => sum + (Number(sec?.wordCount) || 0), 0);

      const importantFacts = [
        `The chapter is organized into ${totalSections} section${totalSections === 1 ? '' : 's'} and ${mainConcepts.length} section${mainConcepts.length === 1 ? '' : 's'} were summarized in this build.`,
        totalWords > 0
          ? `The extracted source content totals approximately ${totalWords.toLocaleString()} words.`
          : 'The extracted source content provides full chapter coverage for review.',
        buildStatus === 'incomplete'
          ? 'Some sections remain incomplete and should be repaired before treating this summary as final.'
          : 'The section summaries are intended for fast review before deeper study of each section in the source chapter.',
      ];

      const summaryModel = {
        chapterTitle: cleanText(documentJson?.title) || fallbackModel.chapterTitle,
        totalSections,
        overview: `Chapter ${documentJson?.chapter || '?'} covers ${totalSections} sections, and this summary includes section-by-section coverage built directly from the document JSON.`,
        keyLearningObjectives,
        mainConcepts,
        keyTerms,
        importantFacts,
        metadata: null,
      };

      const body = buildSummaryMarkdownBody(summaryModel);
      summaryModel.metadata = buildMetadata({
        chapter: documentJson?.chapter,
        totalSections,
        sectionsSummarized: mainConcepts.length,
        summaryWordCount: countWords(body),
        providers: Array.from(providers),
        models: Array.from(models),
        usage,
        buildStatus,
        buildStage: 'summary',
        completedSections: mainConcepts.length,
        incompleteSections,
        failureReason: buildStatus === 'incomplete' ? `${failureReason || 'One or more sections failed across all providers.'}` : '',
      });

      return summaryModel;
    };

    onProgress({
      completed: 0,
      total: totalSections,
      progressText: `0/${totalSections}`,
      provider: '',
    });

    for (let index = 0; index < sections.length; index += 1) {
      assertNotAborted();
      const section = sections[index];
      const title = cleanText(section?.title) || `Section ${index + 1}`;

      let apiSection = null;
      let lastError = null;
      const attemptedProviders = [];

      const canUseSecondary = Boolean(secondaryProvider && secondaryProvider !== preferredProvider);
      const now = Date.now();
      if (canUseSecondary && primaryRecoveryPending && now >= switchedToSecondaryUntil) {
        log('Backup window elapsed. Retrying primary API for summary generation.', 'info');
      }
      const preferSecondary = canUseSecondary && now < switchedToSecondaryUntil;
      const firstProvider = preferSecondary ? secondaryProvider : preferredProvider;
      const providerAttempts = normalizeProviderList(
        firstProvider,
        providerFallbackOrder.filter((provider) => provider && provider !== firstProvider)
      );
      const windowRemainingMs = Math.max(0, switchedToSecondaryUntil - now);
      const routingMode = preferSecondary ? 'secondary-window' : 'primary';
      let resolvedProvider = '';
      let resolvedVia = 'none';

      log(
        `Failover timeline [summary s${index + 1}]: start mode=${routingMode} first=${firstProvider || 'none'} attempts=${providerAttempts.join('>') || 'none'} windowMs=${windowRemainingMs}`,
        'info'
      );

      for (let pass = 0; pass < SECTION_REBUILD_PASSES && !apiSection; pass += 1) {
        if (pass > 0) {
          log(
            `Rebuilding summary section ${index + 1} after first-pass failures (pass ${pass + 1}/${SECTION_REBUILD_PASSES}).`,
            'warning'
          );
        }

        for (let attemptIndex = 0; attemptIndex < providerAttempts.length; attemptIndex += 1) {
          const provider = providerAttempts[attemptIndex];
          const isFirstAttempt = pass === 0 && attemptIndex === 0;
          try {
            apiSection = await buildSectionSummaryFromApi({
              documentJson,
              section,
              sectionIndex: index,
              totalSections,
              preferredProvider: provider,
              requestOptions: {
                signal: abortSignal,
                timeoutMs: isFirstAttempt ? getPrimaryTimeoutMs(provider) : SECONDARY_TIMEOUT_MS,
                generationGuidance,
              },
            });
            resolvedProvider = provider;
            resolvedVia = isFirstAttempt ? 'first' : (pass === 0 ? 'alternate' : `rebuild-${pass + 1}`);
            if (provider === preferredProvider) {
              primaryRecoveryPending = false;
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
              switchedToSecondaryUntil = Date.now() + SWITCH_WINDOW_MS;
              primaryRecoveryPending = true;
              log('Primary API was unresponsive for 30s. Switching summary generation to backup API for 1 minute.', 'warning');
            }
          }
        }
      }

      if (apiSection) {

        mainConcepts.push({
          title,
          summary: apiSection.summary,
        });

        if (apiSection.modelUsed) {
          providers.add(apiSection.modelUsed);
        }
        if (apiSection.modelVersion) {
          models.add(apiSection.modelVersion);
        }

        usage.prompt_tokens += Number(apiSection.usage?.prompt_tokens || 0);
        usage.completion_tokens += Number(apiSection.usage?.completion_tokens || 0);
        log(
          `Failover timeline [summary s${index + 1}]: outcome=success via=${resolvedVia} provider=${resolvedProvider || 'unknown'}`,
          'info'
        );
      } else if (allowLocalFallback) {
        assertNotAborted();
        mainConcepts.push({
          title,
          summary: summarizeSectionContent(section?.content, 260),
        });
        log(`Failover timeline [summary s${index + 1}]: outcome=fallback`, 'warning');
      } else {
        const sectionRef = cleanText(section?.id) || `${index + 1}`;
        const errorMsg = `${lastError?.message || lastError || 'Unknown API error.'}`;
        log(`Failover timeline [summary s${index + 1}]: outcome=failed error=${errorMsg}`, 'error');
        return buildSummaryModel({
          buildStatus: 'incomplete',
          failedSection: {
            sectionIndex: index,
            sectionOrdinal: index + 1,
            sectionId: sectionRef,
            sectionTitle: title,
            attemptedProviders,
            error: errorMsg,
          },
          failureReason: `Summary generation failed for section ${sectionRef}. ${errorMsg}`,
        });
      }

      onProgress({
        completed: index + 1,
        total: totalSections,
        progressText: `${index + 1}/${totalSections}`,
        provider: resolvedProvider || '',
      });
    }

    return buildSummaryModel({ buildStatus: 'complete' });
  };

  async function buildSummary(documentJson, options = {}) {
    const fallbackModel = buildFallbackSummaryModel(documentJson);
    const allowLocalFallback = Boolean(options?.allowLocalFallback);

    try {
      const apiModel = await buildSummaryFromApi(documentJson, fallbackModel, options);
      return {
        ...apiModel,
        markdown: buildSummaryMarkdown(apiModel),
      };
    } catch (error) {
      if (!allowLocalFallback) {
        throw error;
      }
      const fallbackBody = buildSummaryMarkdownBody(fallbackModel);
      const fallbackWithMetadata = {
        ...fallbackModel,
        metadata: buildMetadata({
          chapter: documentJson?.chapter,
          totalSections: fallbackModel.totalSections,
          sectionsSummarized: Array.isArray(fallbackModel.mainConcepts) ? fallbackModel.mainConcepts.length : 0,
          summaryWordCount: countWords(fallbackBody),
          providers: [],
          models: [],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
          },
        }),
      };
      return {
        ...fallbackWithMetadata,
        markdown: buildSummaryMarkdown(fallbackWithMetadata),
      };
    }
  }

  return {
    buildSummary,
    buildSummaryMarkdown,
  };
}

module.exports = {
  createSummaryGenerator,
};
