const { createCommonHelpers } = require('./documentGeneration/common');
const { createApiClient } = require('./documentGeneration/apiClient');
const { createSummaryGenerator } = require('./documentGeneration/summaryGenerator');
const { createQuestionBankGenerator } = require('./documentGeneration/questionBankGenerator');
const { createDeterministicPairGenerator } = require('./documentGeneration/deterministicPairGenerator');
const { createConversationalPairGenerator } = require('./documentGeneration/conversationalPairGenerator');
const { createArtifactWriter } = require('./documentGeneration/artifactWriter');
const { createPartialArtifactRepairService } = require('./documentGeneration/partialArtifactRepairService');

function createDocumentGenerationService({ fs, path, env, apiTimeoutMs, maxQuestionTarget }) {
  const common = createCommonHelpers({ path, maxQuestionTarget });
  const api = createApiClient({ env, apiTimeoutMs });
  const summaryGenerator = createSummaryGenerator({ api });
  const questionBankGenerator = createQuestionBankGenerator({ api, common });
  const deterministicPairGenerator = createDeterministicPairGenerator();
  const conversationalPairGenerator = createConversationalPairGenerator({ api });
  const artifactWriter = createArtifactWriter({
    fs,
    path,
    common,
    summaryGenerator,
    questionBankGenerator,
    deterministicPairGenerator,
    conversationalPairGenerator,
  });
  const partialArtifactRepairService = createPartialArtifactRepairService({
    fs,
    path,
    common,
    questionBankGenerator,
    conversationalPairGenerator,
  });

  return {
    writeSelectedArtifacts: artifactWriter.writeSelectedArtifacts,
    inspectRepairArtifact: partialArtifactRepairService.inspectRepairArtifact,
    repairPartialArtifact: partialArtifactRepairService.repairPartialArtifact,
    getApiStatus: api.getApiStatus,
    verifyApiProviders: api.verifyApiProviders,
    buildStructuredQuestionId: common.buildStructuredQuestionId,
    extractSectionOrdinal: common.extractSectionOrdinal,
    normalizeJsonFileName: common.normalizeJsonFileName,
  };
}

module.exports = {
  createDocumentGenerationService,
};
