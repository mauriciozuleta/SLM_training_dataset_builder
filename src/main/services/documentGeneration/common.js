function createCommonHelpers({ path, maxQuestionTarget }) {
  const MAX_QUESTION_TARGET = Math.max(20, Number.parseInt(maxQuestionTarget || '80', 10) || 80);

  function normalizeJsonFileName(fileName, fallback) {
    const raw = typeof fileName === 'string' ? fileName.trim() : '';
    const base = raw || fallback;
    const safe = path.basename(base);
    return safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;
  }

  function normalizeMarkdownFileName(fileName, fallback) {
    const raw = typeof fileName === 'string' ? fileName.trim() : '';
    const base = raw || fallback;
    const safe = path.basename(base);
    return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
  }

  function normalizePathForCompare(inputPath) {
    if (typeof inputPath !== 'string' || inputPath.trim() === '') {
      return '';
    }
    return path.resolve(inputPath).replace(/\\/g, '/').toLowerCase();
  }

  function inferBookId(documentJson) {
    const chapterTitle = `${documentJson?.title || ''}`.toLowerCase();
    if (chapterTitle.includes('airplane flying handbook') || chapterTitle.includes('faa-h-8083-3')) {
      return 'AFH';
    }
    if (chapterTitle.includes("pilot's handbook") || chapterTitle.includes('phak')) {
      return 'PHAK';
    }
    return 'DOC';
  }

  function normalizeChapterNumber(value) {
    const numeric = Number.parseInt(value, 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  function parseIdContextFromPrefix(prefix, documentJson) {
    const raw = typeof prefix === 'string' ? prefix.trim() : '';
    const bookMatch = raw.match(/[A-Za-z]{2,}/);
    const chapterMatch = raw.match(/(\d{1,3})/);

    const inferredBook = inferBookId(documentJson);
    const inferredChapter = normalizeChapterNumber(documentJson?.chapter);

    const bookId = (bookMatch?.[0] || inferredBook || 'DOC').toUpperCase();
    const chapterNumber = chapterMatch ? normalizeChapterNumber(chapterMatch[1]) : inferredChapter;

    return {
      bookId,
      chapterNumber,
      chapterId: `${bookId.toLowerCase()}_${chapterNumber || 0}`,
      idBase: `${bookId.toLowerCase()}_${chapterNumber || 0}`,
    };
  }

  function buildStableSectionId(bookId, chapterNumber, sectionIndex) {
    return `${bookId.toLowerCase()}_${chapterNumber}_${sectionIndex}`;
  }

  function buildStructuredQuestionId(bookId, chapterNumber, sectionOrdinal, questionOrdinal) {
    const book = `${bookId || 'DOC'}`.trim().toUpperCase() || 'DOC';
    const chapter = Math.max(0, Number.parseInt(chapterNumber, 10) || 0);
    const section = Math.max(1, Number.parseInt(sectionOrdinal, 10) || 1);
    const question = Math.max(1, Number.parseInt(questionOrdinal, 10) || 1);
    return `${book}.${chapter}.${section}.${question}`;
  }

  function extractSectionOrdinal(sectionId, fallback = 0) {
    const asText = `${sectionId || ''}`.trim();
    const underscoreMatch = asText.match(/_(\d+)$/);
    if (underscoreMatch) {
      return Number.parseInt(underscoreMatch[1], 10);
    }
    const dotMatch = asText.match(/\.(\d+)$/);
    if (dotMatch) {
      return Number.parseInt(dotMatch[1], 10);
    }
    return fallback;
  }

  function normalizeWeightDistribution(blueprintSections) {
    if (!Array.isArray(blueprintSections) || blueprintSections.length === 0) {
      return blueprintSections;
    }

    const sum = blueprintSections.reduce((acc, sec) => acc + (Number(sec.weightPercentage) || 0), 0);
    if (sum <= 0) {
      const equalWeight = Number((100 / blueprintSections.length).toFixed(2));
      return blueprintSections.map((sec) => ({ ...sec, weightPercentage: equalWeight }));
    }

    const normalized = blueprintSections.map((sec) => ({
      ...sec,
      weightPercentage: Number((((Number(sec.weightPercentage) || 0) / sum) * 100).toFixed(2)),
    }));

    const normalizedSum = normalized.reduce((acc, sec) => acc + sec.weightPercentage, 0);
    const delta = Number((100 - normalizedSum).toFixed(2));
    if (Math.abs(delta) > 0 && normalized.length > 0) {
      normalized[normalized.length - 1].weightPercentage = Number(
        (normalized[normalized.length - 1].weightPercentage + delta).toFixed(2)
      );
    }

    return normalized;
  }

  function distributeQuestionsByWeight(sections, targetTotal) {
    if (!Array.isArray(sections) || sections.length === 0) {
      return [];
    }

    const safeTarget = Math.max(sections.length, Number.parseInt(targetTotal, 10) || sections.length);
    const weighted = sections.map((section) => ({
      ...section,
      requiredQuestions: Math.max(1, Number.parseInt(section?.requiredQuestions, 10) || 0),
    }));

    const hasProvided = weighted.some((section) => Number.parseInt(section?.requiredQuestions, 10) > 0);
    if (!hasProvided) {
      weighted.forEach((section) => {
        const weight = Math.max(0.01, Number(section?.weightPercentage) || 0.01);
        section.requiredQuestions = Math.max(1, Math.round((safeTarget * weight) / 100));
      });
    }

    let currentTotal = weighted.reduce((sum, section) => sum + Math.max(1, Number(section.requiredQuestions) || 1), 0);
    let guard = 0;
    while (currentTotal !== safeTarget && guard < 5000) {
      guard += 1;
      if (currentTotal < safeTarget) {
        const next = weighted
          .slice()
          .sort((a, b) => (Number(b.weightPercentage) || 0) - (Number(a.weightPercentage) || 0))[0];
        next.requiredQuestions += 1;
        currentTotal += 1;
        continue;
      }

      const next = weighted
        .slice()
        .sort((a, b) => (Number(a.weightPercentage) || 0) - (Number(b.weightPercentage) || 0))
        .find((section) => section.requiredQuestions > 1);
      if (!next) {
        break;
      }
      next.requiredQuestions -= 1;
      currentTotal -= 1;
    }

    return weighted;
  }

  function buildDeterministicBlueprintSections(documentJson, bookId, chapterNumber) {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const weights = sections.map((sec) => Math.max(1, sec?.content?.length || 0));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

    const blueprintSections = sections.map((sec, idx) => {
      const sectionIndex = idx + 1;
      const sectionId = buildStableSectionId(bookId, chapterNumber, sectionIndex);
      const weightPercentage = (weights[idx] / totalWeight) * 100;
      const charCount = sec?.content?.length || 0;
      const requiredQuestions = Math.max(1, Math.ceil(charCount / 900));

      return {
        sectionId,
        sectionTitle: sec.title || `Section ${sectionIndex}`,
        weightPercentage: Number(weightPercentage.toFixed(2)),
        requiredQuestions,
        rationale: 'Deterministic fallback based on section length and content density.',
      };
    });

    return normalizeWeightDistribution(blueprintSections);
  }

  function buildSectionBlueprintsFromDocument(documentJson, idContext) {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const bookId = `${idContext?.bookId || inferBookId(documentJson) || 'DOC'}`.toUpperCase();
    const chapterNumber = normalizeChapterNumber(idContext?.chapterNumber ?? documentJson?.chapter);
    const chapterId = idContext?.chapterId || `${bookId.toLowerCase()}_${chapterNumber || 0}`;

    const computedTotalWords = sections.reduce((sum, sec) => {
      const wc = Number(sec?.wordCount);
      if (Number.isFinite(wc) && wc > 0) {
        return sum + wc;
      }
      const fallbackWords = `${sec?.content || ''}`.trim().split(/\s+/).filter(Boolean).length;
      return sum + fallbackWords;
    }, 0);
    const totalWords = Number.isFinite(Number(documentJson?.totalWords)) && Number(documentJson?.totalWords) > 0
      ? Number(documentJson.totalWords)
      : computedTotalWords;
    const safeTotalWords = totalWords > 0 ? totalWords : 1;

    const rawBlueprintSections = sections.map((sec, idx) => {
      const sectionIndex = idx + 1;
      const sectionId = `${sec?.id || `${idContext?.idBase || `${bookId.toLowerCase()}_${chapterNumber || 0}`}.${sectionIndex}`}`;
      const sectionTitle = sec?.title || sec?.SectionTitle || `Section ${sectionIndex}`;
      const sectionWordCount = Number.isFinite(Number(sec?.wordCount)) && Number(sec?.wordCount) > 0
        ? Number(sec.wordCount)
        : `${sec?.content || ''}`.trim().split(/\s+/).filter(Boolean).length;
      const providedWeight = Number(sec?.sectionWeight ?? sec?.SectionWeight);
      const weightPercentage = Number.isFinite(providedWeight) && providedWeight > 0
        ? providedWeight
        : (sectionWordCount / safeTotalWords) * 100;

      return {
        sectionId,
        sectionIndex,
        sectionTitle,
        weightPercentage: Number(weightPercentage.toFixed(2)),
        requiredQuestions: 0,
        subjects: [sectionTitle],
        rationale: 'Derived directly from document section word distribution.',
        sourceWordCount: sectionWordCount,
      };
    });

    const weightedSections = normalizeWeightDistribution(rawBlueprintSections);
    const targetTotalQuestions = Math.min(
      MAX_QUESTION_TARGET,
      Math.max(
        weightedSections.length || 1,
        Math.ceil((totalWords || safeTotalWords) / 220)
      )
    );
    const sectionBlueprints = distributeQuestionsByWeight(weightedSections, targetTotalQuestions);
    const totalRequiredQuestions = sectionBlueprints.reduce(
      (sum, section) => sum + Math.max(1, Number(section?.requiredQuestions) || 1),
      0,
    );

    return {
      chapterId,
      bookId,
      chapterNumber,
      chapterTitle: documentJson?.title || documentJson?.DocTitle || 'Unknown',
      totalRequiredQuestions,
      sectionBlueprints,
    };
  }

  return {
    normalizeJsonFileName,
    normalizeMarkdownFileName,
    normalizePathForCompare,
    inferBookId,
    normalizeChapterNumber,
    parseIdContextFromPrefix,
    buildStableSectionId,
    buildStructuredQuestionId,
    extractSectionOrdinal,
    normalizeWeightDistribution,
    distributeQuestionsByWeight,
    buildDeterministicBlueprintSections,
    buildSectionBlueprintsFromDocument,
  };
}

module.exports = {
  createCommonHelpers,
};
