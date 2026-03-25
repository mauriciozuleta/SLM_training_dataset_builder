function createSummaryGenerator({ api }) {
  const MAX_SECTIONS_FOR_PROMPT = 14;
  const MAX_SECTION_CONTENT_CHARS = 1600;

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

  const normalizeSummaryModel = (candidate, fallback, totalSections) => {
    const model = candidate && typeof candidate === 'object' ? candidate : {};
    const fallbackModel = fallback && typeof fallback === 'object' ? fallback : {};

    const overview = cleanText(model.overview) || cleanText(fallbackModel.overview);

    const keyLearningObjectives = Array.isArray(model.keyLearningObjectives)
      ? model.keyLearningObjectives.map(cleanText).filter(Boolean)
      : [];

    const mainConcepts = Array.isArray(model.mainConcepts)
      ? model.mainConcepts
        .map((entry) => ({
          title: cleanText(entry?.title),
          summary: cleanText(entry?.summary),
        }))
        .filter((entry) => entry.title && entry.summary)
      : [];

    const keyTerms = Array.isArray(model.keyTerms)
      ? model.keyTerms
        .map((entry) => ({
          term: cleanText(entry?.term),
          definition: cleanText(entry?.definition),
        }))
        .filter((entry) => entry.term && entry.definition)
      : [];

    const importantFacts = Array.isArray(model.importantFacts)
      ? model.importantFacts.map(cleanText).filter(Boolean)
      : [];

    return {
      chapterTitle: cleanText(model.chapterTitle) || cleanText(fallbackModel.chapterTitle),
      totalSections: Number.isFinite(Number(model.totalSections)) && Number(model.totalSections) > 0
        ? Number(model.totalSections)
        : totalSections,
      overview,
      keyLearningObjectives: keyLearningObjectives.length > 0
        ? keyLearningObjectives
        : (fallbackModel.keyLearningObjectives || []),
      mainConcepts: mainConcepts.length > 0
        ? mainConcepts
        : (fallbackModel.mainConcepts || []),
      keyTerms: keyTerms.length > 0
        ? keyTerms
        : (fallbackModel.keyTerms || []),
      importantFacts: importantFacts.length > 0
        ? importantFacts
        : (fallbackModel.importantFacts || []),
    };
  };

  const buildFallbackSummaryModel = (documentJson) => {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const totalSections = Number(documentJson?.totalSections) > 0
      ? Number(documentJson.totalSections)
      : sections.length;
    const totalWords = Number(documentJson?.totalWords) > 0
      ? Number(documentJson.totalWords)
      : sections.reduce((sum, sec) => sum + (Number(sec?.wordCount) || 0), 0);

    const mainConcepts = sections.slice(0, 10).map((section) => ({
      title: cleanText(section?.title) || `Section ${section?.id || ''}`.trim(),
      summary: summarizeSectionContent(section?.content, 280),
    }));

    const keyLearningObjectives = sections
      .slice(0, 8)
      .map((section) => cleanText(section?.title))
      .filter(Boolean)
      .map((title) => `Understand and apply ${title.toLowerCase()} in practical training scenarios.`);

    const keyTerms = sections
      .slice(0, 8)
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
      overview: `Chapter ${documentJson?.chapter || '?'} covers ${totalSections} sections and focuses on pilot technique, control accuracy, risk awareness, and standards-based decision making.`,
      keyLearningObjectives,
      mainConcepts,
      keyTerms,
      importantFacts,
    };
  };

  const buildSummaryMarkdown = (summaryModel) => {
    const lines = [];

    lines.push(`# Chapter Summary: ${summaryModel.chapterTitle || 'Unknown Chapter'}`);
    lines.push('');

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

  const buildSummaryFromApi = async (documentJson, fallbackModel) => {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const totalSections = Number(documentJson?.totalSections) > 0
      ? Number(documentJson.totalSections)
      : sections.length;

    const sectionPayload = sections.slice(0, MAX_SECTIONS_FOR_PROMPT).map((section, index) => ({
      index: index + 1,
      id: cleanText(section?.id),
      title: cleanText(section?.title),
      wordCount: Number(section?.wordCount) || 0,
      content: summarizeSectionContent(section?.content, MAX_SECTION_CONTENT_CHARS),
    }));

    const systemPrompt = [
      'You are an aviation curriculum summarization engine.',
      'Build a structured chapter summary from the provided document JSON sections.',
      'You must acknowledge the exact totalSections value and ensure section coverage in the output.',
      'Return strict JSON only with this shape:',
      '{',
      '  "chapterTitle": string,',
      '  "totalSections": number,',
      '  "overview": string,',
      '  "keyLearningObjectives": string[],',
      '  "mainConcepts": [{"title": string, "summary": string}],',
      '  "keyTerms": [{"term": string, "definition": string}],',
      '  "importantFacts": string[]',
      '}',
      'Constraints:',
      '- Mention the chapter and total section count in overview.',
      '- Keep each main concept summary concise (1-2 sentences).',
      '- Use clear training language and factual content from provided sections only.',
    ].join(' ');

    const result = await api.callPreferredApiJson(systemPrompt, {
      chapter: Number(documentJson?.chapter) || 0,
      chapterTitle: cleanText(documentJson?.title),
      totalSections,
      totalWords: Number(documentJson?.totalWords) || 0,
      sections: sectionPayload,
    });

    return normalizeSummaryModel(result?.json, fallbackModel, totalSections);
  };

  async function buildSummary(documentJson) {
    const fallbackModel = buildFallbackSummaryModel(documentJson);

    try {
      const apiModel = await buildSummaryFromApi(documentJson, fallbackModel);
      return {
        ...apiModel,
        markdown: buildSummaryMarkdown(apiModel),
      };
    } catch (_error) {
      return {
        ...fallbackModel,
        markdown: buildSummaryMarkdown(fallbackModel),
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
