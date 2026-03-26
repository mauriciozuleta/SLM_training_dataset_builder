function createQuestionBankGenerator({ api, common }) {
  const REQUIRED_CORRECT_ANSWERS = 3;
  const REQUIRED_WRONG_ANSWERS = 8;
  const MAX_SECTION_CONTENT_CHARS = 3200;

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
  }) => {
    const sectionTitle = cleanText(section?.title) || `Section ${sectionOrdinal}`;

    const prompt = [
      'You are an aviation exam item generator.',
      'Generate questions for exactly one section.',
      'Return strict JSON only with shape:',
      '{"questions":[{"question":string,"correct_answers":[string,string,string],"wrong_answers":[string,string,string,string,string,string,string,string],"source":string,"subjects":[string]}]}',
      `Generate exactly ${questionCount} questions.`,
      `Each question MUST have exactly ${REQUIRED_CORRECT_ANSWERS} correct answers and ${REQUIRED_WRONG_ANSWERS} wrong answers.`,
      'All answers must be concise, factual, and non-duplicated.',
      'Use only the provided section content; do not invent outside facts.',
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
      ? await api.callApiJson(preferredProvider, prompt, payload)
      : await api.callPreferredApiJson(prompt, payload);

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

  async function buildQuestionBank(documentJson, options = {}) {
    const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
    const idContext = common.parseIdContextFromPrefix(documentJson?.prefix || '', documentJson);
    const sectionBlueprintInfo = common.buildSectionBlueprintsFromDocument(documentJson, idContext);
    const preferredProvider = typeof options?.preferredProvider === 'string'
      ? options.preferredProvider.trim().toLowerCase()
      : '';

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

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
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
      try {
        const apiResult = await buildSectionQuestionsFromApi({
          documentJson,
          section,
          sectionOrdinal,
          questionCount: plannedCount,
          chapterNumber,
          bookId,
          sectionWeightPercentage,
          preferredProvider,
        });

        rawQuestions = Array.isArray(apiResult.questions) ? apiResult.questions : [];
        if (apiResult.modelUsed) {
          providers.add(apiResult.modelUsed);
        }
        if (apiResult.modelVersion) {
          models.add(apiResult.modelVersion);
        }
        usage.prompt_tokens += Number(apiResult?.usage?.prompt_tokens || 0);
        usage.completion_tokens += Number(apiResult?.usage?.completion_tokens || 0);
      } catch (_error) {
        rawQuestions = [];
      }

      if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        rawQuestions = buildFallbackSectionQuestions({
          sectionTitle,
          sectionContent: section?.content,
          count: plannedCount,
        });
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

      allQuestions.push(...normalizedQuestions);
      sectionQuestionSummary.push({
        sectionId: cleanText(section?.id) || `section.${sectionOrdinal}`,
        sectionTitle,
        sectionOrdinal,
        sectionWeightPercentage: Number(sectionWeightPercentage.toFixed(2)),
        questionsGenerated: normalizedQuestions.length,
      });
    }

    const metadata = {
      generatedAtUtc: new Date().toISOString(),
      chapterId,
      chapterNumber,
      totalSections: sections.length,
      totalRequiredQuestions: allQuestions.length,
      providers: providers.size > 0 ? Array.from(providers) : ['fallback-only'],
      models: models.size > 0 ? Array.from(models) : ['fallback-only'],
      promptTokens: Number(usage.prompt_tokens || 0),
      completionTokens: Number(usage.completion_tokens || 0),
      totalTokens: Number((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)),
      sectionQuestionSummary,
    };

    const payload = [
      {
        questionBank: {
          chapterId,
          bookId,
          chapterNumber,
          chapterTitle,
          totalRequiredQuestions: allQuestions.length,
          metadata,
        },
      },
      ...allQuestions.map(({ _meta, ...question }) => question),
    ];

    return {
      questionBank: payload,
      metadata,
    };
  }

  return {
    buildQuestionBank,
  };
}

module.exports = {
  createQuestionBankGenerator,
};