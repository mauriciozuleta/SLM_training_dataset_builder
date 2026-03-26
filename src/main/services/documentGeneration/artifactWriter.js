function createArtifactWriter({ fs, path, common, summaryGenerator, questionBankGenerator, deterministicPairGenerator }) {
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
    await fs.mkdir(outputDir, { recursive: true });

    const written = [];
    const needsSummary = Boolean(selectedOutputs.summary);
    const needsQuestions = Boolean(selectedOutputs.questions || selectedOutputs.deterministicPairs);
    const needsDeterministicPairs = Boolean(selectedOutputs.deterministicPairs);
    const useParallelApiRequests = apiProviderCount >= 2 && needsSummary && needsQuestions;

    let summaryResult = null;
    let questionResult = null;
    if (useParallelApiRequests) {
      [summaryResult, questionResult] = await Promise.all([
        summaryGenerator.buildSummary(documentJson),
        questionBankGenerator.buildQuestionBank(documentJson),
      ]);
    } else {
      summaryResult = needsSummary ? await summaryGenerator.buildSummary(documentJson) : null;
      questionResult = needsQuestions ? await questionBankGenerator.buildQuestionBank(documentJson) : null;
    }

    const questionBank = Array.isArray(questionResult?.questionBank) ? questionResult.questionBank : [];

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

    let writtenQuestionsPath = '';
    for (const entry of selectedEntries) {
      const outPath = path.join(outputDir, entry.fileName);
      let dataToWrite = entry.data;

      if (entry.key === 'deterministicPairs') {
        let deterministicQuestionBank = questionBank;
        let sourceQuestionsFileName = fileNames.questions;

        // With a single available API provider, bind pair generation to written questions.json for deterministic sequencing.
        if (apiProviderCount <= 1 && selectedOutputs.questions && writtenQuestionsPath) {
          const rawQuestions = await fs.readFile(writtenQuestionsPath, 'utf8');
          const parsedQuestions = JSON.parse(rawQuestions);
          if (Array.isArray(parsedQuestions)) {
            deterministicQuestionBank = parsedQuestions;
          }
          sourceQuestionsFileName = path.basename(writtenQuestionsPath);
        }

        dataToWrite = needsDeterministicPairs
          ? deterministicPairGenerator.buildDeterministicPairSet(deterministicQuestionBank, sourceQuestionsFileName)
          : {};
      }

      if (entry.contentType === 'text/markdown') {
        await fs.writeFile(outPath, dataToWrite, 'utf8');
      } else {
        await fs.writeFile(outPath, `${JSON.stringify(dataToWrite, null, 2)}\n`, 'utf8');
      }
      if (entry.key === 'questions') {
        writtenQuestionsPath = outPath;
      }
      written.push({ key: entry.key, path: outPath });
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
