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

  const buildMetadata = ({
    chapter,
    totalSections,
    sectionsSummarized,
    summaryWordCount,
    providers,
    models,
    usage,
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
    const allowLocalFallback = Boolean(options?.allowLocalFallback);
    const generationGuidance = cleanText(options?.generationGuidance).slice(0, MAX_GUIDANCE_CHARS);
    const onLog = typeof options?.onLog === 'function' ? options.onLog : () => {};
    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : () => {};
    const abortSignal = options?.abortSignal || null;
    const PRIMARY_TIMEOUT_MS = 30000;
    const SECONDARY_TIMEOUT_MS = 60000;
    const SWITCH_WINDOW_MS = 60000;

    const isAborted = () => Boolean(abortSignal?.aborted);
    const assertNotAborted = () => {
      if (isAborted()) {
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
    let forceSecondaryForRemainder = false;

    onProgress({
      completed: 0,
      total: totalSections,
      progressText: `0/${totalSections}`,
    });

    for (let index = 0; index < sections.length; index += 1) {
      assertNotAborted();
      const section = sections[index];
      const title = cleanText(section?.title) || `Section ${index + 1}`;

      let apiSection = null;
      let lastError = null;

      const canUseSecondary = Boolean(secondaryProvider && secondaryProvider !== preferredProvider);
      const now = Date.now();
      if (canUseSecondary && primaryRecoveryPending && !forceSecondaryForRemainder && now >= switchedToSecondaryUntil) {
        log('Backup window elapsed. Retrying primary API for summary generation.', 'info');
      }
      const preferSecondary = canUseSecondary && (forceSecondaryForRemainder || now < switchedToSecondaryUntil);
      const firstProvider = preferSecondary ? secondaryProvider : preferredProvider;
      const secondProvider = canUseSecondary
        ? (firstProvider === preferredProvider ? secondaryProvider : preferredProvider)
        : '';
      const windowRemainingMs = Math.max(0, switchedToSecondaryUntil - now);
      const routingMode = forceSecondaryForRemainder
        ? 'secondary-locked'
        : (preferSecondary ? 'secondary-window' : 'primary');
      let resolvedProvider = '';
      let resolvedVia = 'none';

      log(
        `Failover timeline [summary s${index + 1}]: start mode=${routingMode} first=${firstProvider || 'none'} alt=${secondProvider || 'none'} windowMs=${windowRemainingMs}`,
        'info'
      );

      if (firstProvider) {
        try {
          apiSection = await buildSectionSummaryFromApi({
            documentJson,
            section,
            sectionIndex: index,
            totalSections,
            preferredProvider: firstProvider,
            requestOptions: {
              signal: abortSignal,
              timeoutMs: firstProvider === preferredProvider ? PRIMARY_TIMEOUT_MS : SECONDARY_TIMEOUT_MS,
              generationGuidance,
            },
          });
          resolvedProvider = firstProvider;
          resolvedVia = 'first';
          if (firstProvider === preferredProvider) {
            primaryRecoveryPending = false;
          }
        } catch (error) {
          lastError = error;
          if (firstProvider === preferredProvider && canUseSecondary) {
            if (primaryRecoveryPending) {
              forceSecondaryForRemainder = true;
              log('Primary API failed again after recovery attempt. Remaining summary sections will use backup API.', 'warning');
            } else {
              switchedToSecondaryUntil = Date.now() + SWITCH_WINDOW_MS;
              primaryRecoveryPending = true;
              log('Primary API was unresponsive for 30s. Switching summary generation to backup API for 1 minute.', 'warning');
            }
          }
        }
      }

      if (!apiSection && secondProvider) {
        try {
          log(`Retrying summary section ${index + 1} with alternate API (${secondProvider}).`, 'warning');
          apiSection = await buildSectionSummaryFromApi({
            documentJson,
            section,
            sectionIndex: index,
            totalSections,
            preferredProvider: secondProvider,
            requestOptions: {
              signal: abortSignal,
              timeoutMs: SECONDARY_TIMEOUT_MS,
              generationGuidance,
            },
          });
          resolvedProvider = secondProvider;
          resolvedVia = 'alternate';
        } catch (error) {
          lastError = error;
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
        mainConcepts.push({
          title,
          summary: summarizeSectionContent(section?.content, 260),
        });
        log(`Failover timeline [summary s${index + 1}]: outcome=fallback`, 'warning');
      } else {
        const sectionRef = cleanText(section?.id) || `${index + 1}`;
        const errorMsg = `${lastError?.message || lastError || 'Unknown API error.'}`;
        log(`Failover timeline [summary s${index + 1}]: outcome=failed error=${errorMsg}`, 'error');
        throw new Error(`Summary generation failed for section ${sectionRef}. ${errorMsg}`);
      }

      onProgress({
        completed: index + 1,
        total: totalSections,
        progressText: `${index + 1}/${totalSections}`,
      });
    }

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
      `The chapter is organized into ${totalSections} section${totalSections === 1 ? '' : 's'} and all available sections were summarized.`,
      totalWords > 0
        ? `The extracted source content totals approximately ${totalWords.toLocaleString()} words.`
        : 'The extracted source content provides full chapter coverage for review.',
      'The section summaries are intended for fast review before deeper study of each section in the source chapter.',
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
    });

    return summaryModel;
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
