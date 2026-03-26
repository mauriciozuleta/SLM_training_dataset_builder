function createArtifactWriter({ fs, path, common, summaryGenerator, questionBankGenerator, deterministicPairGenerator, conversationalPairGenerator }) {
  async function writeSelectedArtifacts(payload) {
    const outputDir = payload?.outputDir;
    if (!outputDir) {
      throw new Error('Missing outputDir.');
    }

    const allowOverwrite = Boolean(payload?.allowOverwrite);
    const selectedOutputs = payload?.selectedOutputs || {};
    const fileNames = payload?.outputFileNames || {};
    const documentJson = payload?.documentJson || {};
    const documentJsonPath = typeof payload?.documentJsonPath === 'string' ? payload.documentJsonPath : '';
    const apiProviderCount = Math.max(0, Number(payload?.apiProviderCount || 0));
    const apiProviders = Array.isArray(payload?.apiProviders)
      ? payload.apiProviders.map((entry) => `${entry || ''}`.trim().toLowerCase()).filter(Boolean)
      : [];
    const onProgress = typeof payload?.onProgress === 'function' ? payload.onProgress : () => {};
    await fs.mkdir(outputDir, { recursive: true });

    const written = [];
    const needsSummary = Boolean(selectedOutputs.summary);
    const needsQuestions = Boolean(selectedOutputs.questions || selectedOutputs.deterministicPairs);
    const needsDeterministicPairs = Boolean(selectedOutputs.deterministicPairs);
    const needsConversationalPairs = Boolean(selectedOutputs.conversationalPairs);
    const primaryProvider = apiProviders.includes('openai')
      ? 'openai'
      : (apiProviders[0] || '');
    const conversationalProvider = apiProviders.includes('gemini')
      ? 'gemini'
      : (apiProviders.find((provider) => provider !== primaryProvider) || primaryProvider || '');
    const canRunConversationalInParallel = Boolean(
      needsConversationalPairs
      && primaryProvider
      && conversationalProvider
      && conversationalProvider !== primaryProvider
      && apiProviderCount >= 2
    );

    let summaryResult = null;
    let questionResult = null;
    let conversationalResult = null;
    let questionBank = [];
    let writtenQuestionsPath = '';

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
        preferredProvider: primaryProvider,
      });
      await writeMarkdownArtifact('summary', typeof summaryResult?.markdown === 'string' ? summaryResult.markdown : '');
      onProgress({ key: 'summary', state: 'completed' });
    };

    const buildQuestionsArtifact = async () => {
      if (!needsQuestions) {
        return;
      }
      if (selectedOutputs.questions) {
        onProgress({ key: 'questions', state: 'running' });
      }
      questionResult = await questionBankGenerator.buildQuestionBank(documentJson, {
        preferredProvider: primaryProvider,
      });
      questionBank = Array.isArray(questionResult?.questionBank) ? questionResult.questionBank : [];
      if (selectedOutputs.questions) {
        writtenQuestionsPath = await writeJsonArtifact('questions', questionBank);
        onProgress({ key: 'questions', state: 'completed' });
      }
    };

    const buildDeterministicArtifact = async () => {
      if (!needsDeterministicPairs) {
        return;
      }
      onProgress({ key: 'deterministicPairs', state: 'running' });
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
      await writeJsonArtifact('deterministicPairs', deterministicResult);
      onProgress({ key: 'deterministicPairs', state: 'completed' });
    };

    const buildConversationalArtifact = async () => {
      if (!needsConversationalPairs) {
        return;
      }
      onProgress({ key: 'conversationalPairs', state: 'running' });
      conversationalResult = await conversationalPairGenerator.buildConversationalPairSet(documentJson, {
        preferredProvider: conversationalProvider,
      });
      await writeJsonArtifact('conversationalPairs', conversationalResult);
      onProgress({ key: 'conversationalPairs', state: 'completed' });
    };

    if (canRunConversationalInParallel) {
      await Promise.all([
        (async () => {
          await buildSummaryArtifact();
          await buildQuestionsArtifact();
        })(),
        buildConversationalArtifact(),
      ]);
    } else {
      await buildSummaryArtifact();
      await buildQuestionsArtifact();
    }

    await buildDeterministicArtifact();

    if (!canRunConversationalInParallel) {
      await buildConversationalArtifact();
    }

    return {
      written,
      summary: {
        selectedCount: written.length,
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
