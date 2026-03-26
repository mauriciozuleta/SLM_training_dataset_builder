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

/**
 * Request conversational pairs for a single document section.
 */
async function buildSectionPairsFromApi(api, documentJson, section, sectionOrdinal, pairCount, preferredProvider) {
  const sectionTitle = normalizeText(section?.title) || `Section ${sectionOrdinal}`;
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
    ? await api.callApiJson(preferredProvider, prompt, payload)
    : await api.callPreferredApiJson(prompt, payload);

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
    const totalWords = Number(safeDocumentJson?.totalWords) || 0;
    const targetPairCount = Math.max(1, Math.floor(totalWords / 20));
    const sections = Array.isArray(safeDocumentJson?.sections) ? safeDocumentJson.sections : [];
    const sectionTargets = distributeSectionPairTargets(sections, targetPairCount);
    const pairs = [];
    const providers = new Set();
    const models = new Set();
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
    };

    for (let index = 0; index < sectionTargets.length; index += 1) {
      const target = sectionTargets[index];
      const section = target.section;
      const pairCount = Math.max(1, Number(target?.pairCount) || 1);
      const sectionOrdinal = index + 1;
      let rawPairs = [];

      try {
        const result = await buildSectionPairsFromApi(api, safeDocumentJson, section, sectionOrdinal, pairCount, preferredProvider);
        rawPairs = Array.isArray(result?.pairs) ? result.pairs.slice(0, pairCount) : [];
        if (result.modelUsed) {
          providers.add(result.modelUsed);
        }
        if (result.modelVersion) {
          models.add(result.modelVersion);
        }
        usage.prompt_tokens += Number(result?.usage?.prompt_tokens || 0);
        usage.completion_tokens += Number(result?.usage?.completion_tokens || 0);
      } catch (_error) {
        rawPairs = [];
      }

      while (rawPairs.length < pairCount) {
        rawPairs.push(buildFallbackPair(section, safeDocumentJson, sectionOrdinal, rawPairs.length, rawPairs.length));
      }

      rawPairs.slice(0, pairCount).forEach((rawPair, pairIndex) => {
        pairs.push(toConversationPair(safeDocumentJson, section, sectionOrdinal, pairIndex + 1, rawPair));
      });
    }

    return {
      conversationalTrainingPairSet: {
        generatedAtUtc: new Date().toISOString(),
        chapterId: extractChapterId(safeDocumentJson),
        sourceDocumentTitle: normalizeText(safeDocumentJson?.title) || 'Unknown document',
        documentTotalWords: totalWords,
        pairGenerationRatio: '1 pair per 20 words',
        targetPairCount,
        generatedPairCount: pairs.length,
        totalSections: sections.length,
        pairType: 'conversational_exchange',
        providers: providers.size > 0 ? Array.from(providers) : ['fallback-only'],
        models: models.size > 0 ? Array.from(models) : ['fallback-only'],
        promptTokens: Number(usage.prompt_tokens || 0),
        completionTokens: Number(usage.completion_tokens || 0),
        totalTokens: Number((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)),
        studentPersonas: {
          confident: pairs.filter((p) => p.studentPersona === 'confident').length,
          confused: pairs.filter((p) => p.studentPersona === 'confused').length,
          checkride: pairs.filter((p) => p.studentPersona === 'checkride').length,
        },
      },
      pairs,
    };
  }

  return {
    buildConversationalPairSet,
  };
}

module.exports = {
  createConversationalPairGenerator,
};
