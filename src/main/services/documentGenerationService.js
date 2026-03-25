const { createCommonHelpers } = require('./documentGeneration/common');
const { createApiClient } = require('./documentGeneration/apiClient');
const { createArtifactWriter } = require('./documentGeneration/artifactWriter');

function createDocumentGenerationService({ fs, path, env, apiTimeoutMs, maxQuestionTarget }) {
  const common = createCommonHelpers({ path, maxQuestionTarget });
  const api = createApiClient({ env, apiTimeoutMs });
  const artifactWriter = createArtifactWriter({
    fs,
    path,
    common,
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
