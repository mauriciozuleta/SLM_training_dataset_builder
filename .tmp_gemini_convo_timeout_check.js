const fs=require('fs');
const path=require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env'), override: true });
const { createApiClient } = require('./src/main/services/documentGeneration/apiClient');
const { createConversationalPairGenerator } = require('./src/main/services/documentGeneration/conversationalPairGenerator');
(async () => {
  const docPath = path.join(process.cwd(), 'test_output_files', 'afh_7 output docs', 'afh_7_document.json');
  const documentJson = JSON.parse(fs.readFileSync(docPath,'utf8'));
  const api = createApiClient({ env: process.env, apiTimeoutMs: 120000 });
  const convo = createConversationalPairGenerator({ api });
  try {
    const c = await convo.buildConversationalPairSet(documentJson, { preferredProvider: 'gemini', secondaryProvider: '', allowLocalFallback: false, apiConcurrency: 1 });
    const meta = c?.conversationalTrainingPairSet || {};
    console.log('CONVO_OK providers=', JSON.stringify(meta.providers), 'models=', JSON.stringify(meta.models), 'count=', meta.generatedPairCount);
  } catch (e) {
    console.log('CONVO_ERR', String(e && e.message ? e.message : e));
  }
})();
