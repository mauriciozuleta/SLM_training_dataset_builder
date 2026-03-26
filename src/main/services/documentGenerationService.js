const { createCommonHelpers } = require('./documentGeneration/common');
const { createApiClient } = require('./documentGeneration/apiClient');
const { createSummaryGenerator } = require('./documentGeneration/summaryGenerator');
const { createQuestionBankGenerator } = require('./documentGeneration/questionBankGenerator');
const { createDeterministicPairGenerator } = require('./documentGeneration/deterministicPairGenerator');
const { createArtifactWriter } = require('./documentGeneration/artifactWriter');

function createDocumentGenerationService({ fs, path, env, apiTimeoutMs, maxQuestionTarget }) {
  const common = createCommonHelpers({ path, maxQuestionTarget });
  const api = createApiClient({ env, apiTimeoutMs });
  const summaryGenerator = createSummaryGenerator({ api });
  const questionBankGenerator = createQuestionBankGenerator({ api, common });
  const deterministicPairGenerator = createDeterministicPairGenerator();
  const artifactWriter = createArtifactWriter({
    fs,
    path,
    common,
    summaryGenerator,
    questionBankGenerator,
    deterministicPairGenerator,
  });

  return {
    writeSelectedArtifacts: artifactWriter.writeSelectedArtifacts,
    getApiStatus: api.getApiStatus,
    buildStructuredQuestionId: common.buildStructuredQuestionId,
    extractSectionOrdinal: common.extractSectionOrdinal,
    normalizeJsonFileName: common.normalizeJsonFileName,
  };
}

module.exports = {
  createDocumentGenerationService,
};
