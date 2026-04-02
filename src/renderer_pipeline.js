const {
  card,
  requiredCards = [],
  generateButton,
  cancelButton,
  repairButton,
  exportButton,
  generateHint,
  repairHint,
  repairFastModeInput,
  exportHint,
  sharedOutputSubtitle,
  logWindow,
  clearLogButton,
  modeButtons = [],
  modePanels = [],
  projectCurriculumPanel,
  projectCurriculumTitle,
  projectCurriculumSubtitle,
  curriculumFoldersList,
  curriculumDocumentsList,
  outputFolderInput,
  outputFolderButton,
  datasetNameInput,
  outputPrefixInput,
  projectSelect,
  projectNameInput,
  projectStatus,
  newProjectButton,
  saveProjectButton,
  deleteProjectButton,
  topCreateProjectButton,
  topOpenProjectButton,
  projectCreationPanel,
  newProjectName,
  generateNewDatasetButton,
  projectCreationHint,
  projectCreationFields,
  projectCreationActionRow,
  projectFolderCardsSlot,
  cardFoundational,
  cardAdapters,
  cardExport,
  dropFoundational,
  dropAdapters,
  dropExport,
  foundationalSubfolderList,
  adaptersSubfolderList,
  exportSubfolderList,
  projectFolderUploadRow,
  projectUploadFilesButton,
  folderNamePromptModal,
  folderNamePromptTitle,
  folderNamePromptInput,
  folderNamePromptContinueButton,
  folderNamePromptCancelButton,
  projectBusyOverlay,
  projectBusyMessage,
  projectLoaderPanel,
  closeProjectLoaderButton,
  cachedProjectsList,
  projectDetailsPanel,
  backToCachedListButton,
  closeProjectDetailsButton,
  projectDetailsTitle,
  projectDetailsType,
  projectDetailsPath,
  projectDetailsCreated,
  projectDocumentsList,
  openProjectFolderButton,
  removeProjectCacheButton,
  datasetNameCell,
  commonPrefixCell,
  exportSourceFolderInput,
  exportSourceFolderButton,
  pdfDropTextEl,
  legacyCard,
  repairCards = [],
  qualityResultsModal,
  qualityRatingDisplay,
  qualityExplanation,
  errorCountEl,
  warningCountEl,
  weightedPercentEl,
  issuesSummary,
  qualityActionsContainer,
  conversionStatusEl,
  documentReadyBadge,
  summaryReadyBadge,
  questionReadyBadge,
  deterministicPairsReadyBadge,
  conversationalPairsReadyBadge,
  documentOutputCard,
  repairStatusCard,
  openAiStatusButton,
  anthropicStatusButton,
  geminiStatusButton,
  summaryProviderIndicators,
  questionsProviderIndicators,
  conversationalProviderIndicators,
  repairQuestionsBadge,
  repairConversationalBadge,
  repairQuestionsProviderIndicators,
  repairConversationalProviderIndicators,
  repairSourceFileName,
  repairTargetFileName,
  repairAnalysis,
  repairAnalysisSummary,
  repairAnalysisDetails,
} = window.rendererDomRefs || {};
const defaultPdfDropText = 'Drop the source PDF document to extract the structured chapter JSON.';

const checkboxIds = {
  docJson: 'optDocJson',
  summary: 'optSummaryMd',
  questions: 'optQuestionsJson',
  deterministicPairs: 'optDeterministicPairsJson',
  conversationalPairs: 'optConversationalPairsJson',
};

const apiDependentOutputs = ['docJson', 'summary', 'questions', 'deterministicPairs', 'conversationalPairs'];
const {
  NO_FOLDER_SELECTED_LABEL,
  ensureJsonExtension,
  ensureMarkdownExtension,
  normalizeDatasetName,
  normalizePathForCompare,
  readFolderInputValue,
  writeFolderInputValue,
  normalizeProjectName,
  makeProjectId,
  isSameOrNestedPath,
  joinPath,
  getBaseName,
  isJsonFileName,
  parseDroppedPath,
  inferRepairArtifactTypeFromName,
  formatRepairSectionList,
} = window.rendererUtils || {};

const {
  renderProjectWorkspaceView,
  renderCurriculumDocumentsView,
  renderCurriculumFoldersView,
  renderTaskModeView,
} = window.rendererRenderers || {};

const { createPipelineViewController } = window.rendererPipelineView || {};
const { createProjectEnvironmentController } = window.rendererProjectEnvironment || {};
const { createWorkflowActionsController } = window.rendererWorkflowActions || {};

const outputBadgesByKey = {
  docJson: documentReadyBadge,
  summary: summaryReadyBadge,
  questions: questionReadyBadge,
  deterministicPairs: deterministicPairsReadyBadge,
  conversationalPairs: conversationalPairsReadyBadge,
};

const outputProviderIndicatorsByKey = {
  summary: summaryProviderIndicators,
  questions: questionsProviderIndicators,
  conversationalPairs: conversationalProviderIndicators,
};

const repairBadgesByKey = {
  questions: repairQuestionsBadge,
  conversationalPairs: repairConversationalBadge,
};

const repairProviderIndicatorsByKey = {
  questions: repairQuestionsProviderIndicators,
  conversationalPairs: repairConversationalProviderIndicators,
};

const outputProviderState = {
  summary: { seen: new Set(), active: '' },
  questions: { seen: new Set(), active: '' },
  conversationalPairs: { seen: new Set(), active: '' },
};

const repairProviderState = {
  questions: { seen: new Set(), active: '' },
  conversationalPairs: { seen: new Set(), active: '' },
};

const cardRegistry = new Map();
const selectedFiles = { originalPdf: null, legacyFile: null, sourceDocumentJson: null, repairArtifactJson: null };
let lastLoadedPdfName = '';
let lastUsedOutputFolder = '';
let lastUsedOutputPrefix = '';
let lastUsedDatasetName = '';
let apiAvailable = false;
let apiProviderCount = 0;
let apiProviders = [];
let generationInProgress = false;
let generationCancelRequested = false;
let repairInProgress = false;
let exportInProgress = false;
let currentTaskMode = '';
let savedProjects = [];
let activeProjectId = '';
let repairInspection = null;
let repairInspectionLoading = false;
let repairInspectionRequestId = 0;
let lastUsedRepairFastMode = true;
let clearPrimaryPdf = async () => {};

// Project creation workflow state
let projectCreationInProgress = false;
let pendingFolderPromptRequest = null;
const folderCardSubfolders = { foundational: [], adapters: [], export: [] };
let currentCreatedProject = null;
let projectWriteInProgress = false;
let currentLoadedProject = null;
let cachedProjectData = null;
let currentProjectEnvironment = null;
let projectCurriculumEntries = [];
let selectedCurriculumFolderPath = '';
let lastCurriculumProjectRoot = '';
let selectedCurriculumDocumentPaths = new Set();
let collapsedCurriculumGroups = new Set();
let generationQueue = [];
const acceptedDocumentTypes = ['.pdf', '.json', '.md', '.txt', '.doc', '.docx'];
const topCreateProjectDefaultLabel = topCreateProjectButton?.querySelector('.nav-button-label')?.textContent || 'Create New Project';
const projectCreationTitleEl = document.querySelector('#projectCreationPanel .project-creation-header h2');
const defaultProjectCreationTitle = projectCreationTitleEl?.textContent || 'Create New Project';
let projectEnvironmentController = null;

const getTimeStamp = () => new Date().toLocaleTimeString([], { hour12: false });

const addLog = (message, level = 'info') => {
  if (!logWindow) {
    return;
  }

  const line = document.createElement('div');
  line.className = `log-line log-line--${level}`;
  line.textContent = `[${getTimeStamp()}] ${message}`;
  logWindow.appendChild(line);
  logWindow.scrollTop = logWindow.scrollHeight;
};

const showWarningPopup = async (message, detail = '') => {
  if (window.desktopApp?.showAlert) {
    await window.desktopApp.showAlert({
      type: 'warning',
      title: 'Warning',
      message,
      detail,
    });
    return;
  }

  addLog(detail ? `${message} ${detail}` : message, 'warning');
};

const addBootstrapLog = (message) => {
  if (!logWindow) {
    return;
  }
  const line = document.createElement('div');
  line.className = 'log-line log-line--warning';
  line.textContent = `[${getTimeStamp()}] ${message}`;
  logWindow.appendChild(line);
  logWindow.scrollTop = logWindow.scrollHeight;
};

const getQualityExplanation = (level) => {
  const levelLower = `${level || ''}`.toLowerCase();
  const explanations = {
    optimum: 'Excellent quality. Safe for production use. Minimal issues detected.',
    acceptable: 'Good quality. Usable with minor review. Some non-critical issues present.',
    critical: 'Moderate quality concerns. Recommended to review and address issues before use.',
    catastrophic: 'Severe quality issues. Regeneration is strongly recommended.',
  };
  return explanations[levelLower] || 'Quality audit completed.';
};

const getAuditIssues = (auditResult) => {
  const issues = [];
  const results = Array.isArray(auditResult?.results) ? auditResult.results : [];
  results.forEach((result) => {
    const bucket = Array.isArray(result?.issues) ? result.issues : [];
    bucket.forEach((entry) => issues.push(entry));
  });
  return issues;
};

const getIssuesSummaryText = (auditResult) => {
  const issues = getAuditIssues(auditResult);
  if (issues.length === 0) {
    return '';
  }

  const issueCounts = {};
  issues.forEach((issue) => {
    const code = `${issue?.code || 'unknown'}`;
    issueCounts[code] = (issueCounts[code] || 0) + 1;
  });

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => `${count}× ${code}`)
    .join(', ');

  return topIssues ? `Top issues: ${topIssues}` : '';
};

const buildRedoGuidanceFromAudit = (auditResult) => {
  const issues = getAuditIssues(auditResult);
  if (issues.length === 0) {
    return '';
  }

  const prioritized = issues
    .slice(0, 8)
    .map((issue) => {
      const code = `${issue?.code || 'UNKNOWN_ISSUE'}`.trim();
      const instruction = `${issue?.repairGuidance?.instruction || issue?.message || ''}`.trim();
      return instruction ? `${code}: ${instruction}` : code;
    })
    .filter(Boolean);

  if (prioritized.length === 0) {
    return '';
  }

  return [
    'Previous audit findings to avoid in this redo run:',
    ...prioritized,
    'Ensure outputs remain structurally valid and increase diversity where repetition was flagged.',
  ].join(' ');
};

const buildCombinedGuidance = (...parts) => parts
  .map((entry) => `${entry || ''}`.trim())
  .filter(Boolean)
  .join(' ');

let qualityDecision = null;

const showQualityResultsModal = async (auditResult) => {
  if (!qualityResultsModal) {
    return;
  }

  qualityDecision = null;
  const rating = auditResult?.overallRating || {};
  const level = `${rating.level || 'unknown'}`.toLowerCase();
  const errors = Number(rating?.errorCount || 0);
  const warnings = Number(rating?.warningCount || 0);
  const weightedPct = Number(rating?.weightedIssuePercent || 0);

  // Update modal header
  if (qualityRatingDisplay) {
    qualityRatingDisplay.textContent = `${level.charAt(0).toUpperCase() + level.slice(1)} (${weightedPct}%)`;
    qualityRatingDisplay.className = `quality-rating ${level}`;
  }

  // Update explanation
  if (qualityExplanation) {
    qualityExplanation.textContent = getQualityExplanation(level);
  }

  // Update stats
  if (errorCountEl) errorCountEl.textContent = String(errors);
  if (warningCountEl) warningCountEl.textContent = String(warnings);
  if (weightedPercentEl) weightedPercentEl.textContent = `${weightedPct}%`;

  // Update issues summary
  if (issuesSummary) {
    const summary = getIssuesSummaryText(auditResult);
    issuesSummary.textContent = summary;
  }

  // Create action buttons based on quality level
  if (qualityActionsContainer) {
    qualityActionsContainer.innerHTML = '';

    const buttons = [];
    if (level === 'optimum') {
      buttons.push({ label: 'Close', action: 'close', style: 'neutral' });
    } else if (level === 'catastrophic') {
      buttons.push({ label: 'Regenerate', action: 'redo', style: 'danger' });
    } else {
      // Acceptable or Critical
      buttons.push({ label: 'Repair Selected Issues', action: 'repair', style: 'primary' });
      buttons.push({ label: 'Generate Log for Later', action: 'defer-log', style: 'secondary' });
      buttons.push({ label: 'Regenerate', action: 'redo', style: 'danger' });
    }

    buttons.forEach(({ label, action, style }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.className = `quality-action-${style}`;
      btn.addEventListener('click', () => {
        qualityDecision = action;
        hideQualityResultsModal();
      });
      qualityActionsContainer.appendChild(btn);
    });
  }

  // Show modal
  qualityResultsModal.hidden = false;
  addLog(`Quality results: ${level.toUpperCase()} - waiting for user action...`, 'info');
};

const hideQualityResultsModal = () => {
  if (qualityResultsModal) {
    qualityResultsModal.hidden = true;
  }
};

const getQualityDecision = async (auditResult) => {
  return new Promise((resolve) => {
    showQualityResultsModal(auditResult);

    // Poll for decision
    const checkDecision = () => {
      if (qualityDecision !== null) {
        const decision = qualityDecision;
        qualityDecision = null;
        resolve(decision);
        return;
      }
      setTimeout(checkDecision, 100);
    };

    checkDecision();
  });
};

const setConversionStatus = (message, percent = 0, state = 'idle') => {
  if (documentOutputCard) {
    documentOutputCard.dataset.state = state;
  }

  // Keep message/percent parameters for compatibility with existing call sites.
  void message;
  void percent;
};

const getProviderShortName = (provider) => {
  const normalized = `${provider || ''}`.trim().toLowerCase();
  if (normalized === 'openai') {
    return 'O';
  }
  if (normalized === 'gemini') {
    return 'G';
  }
  if (normalized === 'anthropic') {
    return 'C';
  }
  return normalized.slice(0, 1).toUpperCase() || '?';
};

const renderOutputProviderIndicators = (key) => {
  const container = outputProviderIndicatorsByKey[key];
  const state = outputProviderState[key];
  if (!container || !state) {
    return;
  }

  const providers = Array.from(state.seen);
  if (providers.length === 0) {
    container.hidden = true;
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.setAttribute('aria-hidden', 'false');
  container.innerHTML = '';

  providers.forEach((provider) => {
    const icon = document.createElement('span');
    icon.className = 'provider-mini-icon';
    icon.dataset.provider = provider;
    icon.dataset.active = provider === state.active ? 'true' : 'false';
    icon.textContent = getProviderShortName(provider);
    icon.title = provider;
    container.appendChild(icon);
  });
};

const renderRepairProviderIndicators = (key) => {
  const container = repairProviderIndicatorsByKey[key];
  const state = repairProviderState[key];
  if (!container || !state) {
    return;
  }

  const providers = Array.from(state.seen);
  if (providers.length === 0) {
    container.hidden = true;
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = '';
    return;
  }

  container.hidden = false;
  container.setAttribute('aria-hidden', 'false');
  container.innerHTML = '';

  providers.forEach((provider) => {
    const icon = document.createElement('span');
    icon.className = 'provider-mini-icon';
    icon.dataset.provider = provider;
    icon.dataset.active = provider === state.active ? 'true' : 'false';
    icon.textContent = getProviderShortName(provider);
    icon.title = provider;
    container.appendChild(icon);
  });
};

const updateOutputProviderIndicators = (key, progressUpdate = {}) => {
  const state = outputProviderState[key];
  if (!state) {
    return;
  }

  const singleProvider = `${progressUpdate?.provider || ''}`.trim().toLowerCase();
  if (singleProvider) {
    state.seen.add(singleProvider);
    state.active = singleProvider;
  }

  if (Array.isArray(progressUpdate?.providers)) {
    progressUpdate.providers
      .map((entry) => `${entry || ''}`.trim().toLowerCase())
      .filter(Boolean)
      .forEach((provider) => state.seen.add(provider));
  }

  renderOutputProviderIndicators(key);
};

const updateRepairProviderIndicators = (key, progressUpdate = {}) => {
  const state = repairProviderState[key];
  if (!state) {
    return;
  }

  const singleProvider = `${progressUpdate?.provider || ''}`.trim().toLowerCase();
  if (singleProvider) {
    state.seen.add(singleProvider);
    state.active = singleProvider;
  }

  if (Array.isArray(progressUpdate?.providers)) {
    progressUpdate.providers
      .map((entry) => `${entry || ''}`.trim().toLowerCase())
      .filter(Boolean)
      .forEach((provider) => state.seen.add(provider));
  }

  renderRepairProviderIndicators(key);
};

const clearOutputProviderIndicators = (key) => {
  const state = outputProviderState[key];
  if (!state) {
    return;
  }
  state.seen.clear();
  state.active = '';
  renderOutputProviderIndicators(key);
};

const clearRepairProviderIndicators = (key) => {
  const state = repairProviderState[key];
  if (!state) {
    return;
  }
  state.seen.clear();
  state.active = '';
  renderRepairProviderIndicators(key);
};

const setOutputBuildState = (key, state = 'idle', progressText = '') => {
  const badge = outputBadgesByKey[key];
  if (!badge) {
    return;
  }

  if (state === 'idle') {
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    delete badge.dataset.state;
    delete badge.dataset.hasText;
    badge.title = '';
    badge.textContent = '';
    clearOutputProviderIndicators(key);
    return;
  }

  badge.hidden = false;
  badge.setAttribute('aria-hidden', 'false');
  badge.dataset.state = state;

  if (state === 'success') {
    badge.dataset.hasText = 'false';
    badge.title = '';
    badge.textContent = '✓';
    clearOutputProviderIndicators(key);
    return;
  }
  if (state === 'error') {
    badge.dataset.hasText = 'false';
    badge.title = '';
    badge.textContent = '!';
    clearOutputProviderIndicators(key);
    return;
  }

  if (state === 'incomplete') {
    const label = `${progressText || 'PARTIAL'}`.trim() || 'PARTIAL';
    badge.dataset.hasText = 'true';
    badge.title = label;
    badge.textContent = label;
    return;
  }

  if (state === 'skipped') {
    const label = `${progressText || 'SKIP'}`.trim() || 'SKIP';
    badge.dataset.hasText = 'true';
    badge.title = label;
    badge.textContent = label;
    clearOutputProviderIndicators(key);
    return;
  }

  const safeProgressText = `${progressText || ''}`.trim();
  badge.dataset.hasText = safeProgressText ? 'true' : 'false';
  badge.title = safeProgressText;
  badge.textContent = safeProgressText;
};

const setRepairBuildState = (key, state = 'idle', progressText = '') => {
  const badge = repairBadgesByKey[key];
  if (!badge) {
    return;
  }

  if (repairStatusCard) {
    repairStatusCard.dataset.state = state === 'idle'
      ? 'idle'
      : (state === 'error' || state === 'incomplete' ? 'error' : (state === 'success' ? 'success' : 'running'));
  }

  if (state === 'idle') {
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    delete badge.dataset.state;
    delete badge.dataset.hasText;
    badge.title = '';
    badge.textContent = '';
    clearRepairProviderIndicators(key);
    return;
  }

  badge.hidden = false;
  badge.setAttribute('aria-hidden', 'false');
  badge.dataset.state = state;

  if (state === 'success') {
    badge.dataset.hasText = 'false';
    badge.title = '';
    badge.textContent = '✓';
    clearRepairProviderIndicators(key);
    return;
  }
  if (state === 'error') {
    badge.dataset.hasText = 'false';
    badge.title = '';
    badge.textContent = '!';
    clearRepairProviderIndicators(key);
    return;
  }
  if (state === 'incomplete') {
    const label = `${progressText || 'PARTIAL'}`.trim() || 'PARTIAL';
    badge.dataset.hasText = 'true';
    badge.title = label;
    badge.textContent = label;
    return;
  }
  if (state === 'skipped') {
    const label = `${progressText || 'SKIP'}`.trim() || 'SKIP';
    badge.dataset.hasText = 'true';
    badge.title = label;
    badge.textContent = label;
    clearRepairProviderIndicators(key);
    return;
  }

  const safeProgressText = `${progressText || ''}`.trim();
  badge.dataset.hasText = safeProgressText ? 'true' : 'false';
  badge.title = safeProgressText;
  badge.textContent = safeProgressText;
};

const applyRepairProgressUpdate = (update = {}) => {
  const key = `${update?.key || ''}`.trim();
  const state = `${update?.state || ''}`.trim().toLowerCase();
  if (!key || !repairBadgesByKey[key]) {
    return;
  }

  if (state === 'running') {
    const progressText = `${update?.progressText || ''}`.trim();
    setRepairBuildState(key, 'running', progressText);
    updateRepairProviderIndicators(key, update);
    return;
  }
  if (state === 'completed') {
    setRepairBuildState(key, 'success');
    return;
  }
  if (state === 'incomplete') {
    setRepairBuildState(key, 'incomplete', 'PARTIAL');
    return;
  }
  if (state === 'skipped') {
    setRepairBuildState(key, 'skipped', 'SKIP');
    return;
  }
  if (state === 'error') {
    setRepairBuildState(key, 'error');
  }
};

const resetRepairOutputState = () => {
  setRepairBuildState('questions', 'idle');
  setRepairBuildState('conversationalPairs', 'idle');
  if (repairStatusCard) {
    repairStatusCard.dataset.state = 'idle';
  }
  refreshRepairFileSummary();
};

const setOutputReadyState = (key, isReady) => {
  setOutputBuildState(key, isReady ? 'success' : 'idle');
};

const resetDocumentOutputState = () => {
  setOutputBuildState('docJson', 'idle');
  setOutputBuildState('summary', 'idle');
  setOutputBuildState('questions', 'idle');
  setOutputBuildState('deterministicPairs', 'idle');
  setOutputBuildState('conversationalPairs', 'idle');
  setConversionStatus('', 0, 'idle');
};

const setSelectedOutputsRunning = (selectedOutputs, keys) => {
  keys.forEach((key) => {
    if (selectedOutputs[key]) {
      setOutputBuildState(key, 'running');
    }
  });
};

const markRunningOutputsAsError = () => {
  Object.entries(outputBadgesByKey).forEach(([key, badge]) => {
    if (!badge || badge.hidden) {
      return;
    }
    if (badge.dataset.state === 'running') {
      setOutputBuildState(key, 'error');
    }
  });
};

const applyApiOutputAvailability = async (status = {}) => {
  const configuredProviders = Array.isArray(status?.providers) ? status.providers : [];
  const verifiedProviders = Array.isArray(status?.verifiedProviders)
    ? status.verifiedProviders
    : configuredProviders;

  apiAvailable = Boolean(status?.verifiedAvailable ?? status?.available);
  apiProviderCount = configuredProviders.length;
  apiProviders = configuredProviders.slice();

  const setProviderState = (button, providerName, check) => {
    if (!button) {
      return;
    }
    button.classList.remove('provider-status--connecting', 'provider-status--connected', 'provider-status--failed');
    if (!check?.configured) {
      button.classList.add('provider-status--failed');
      button.title = `${providerName}: not configured`;
      return;
    }
    if (check?.verified) {
      button.classList.add('provider-status--connected');
      button.title = `${providerName}: connected${check?.model ? ` (${check.model})` : ''}`;
      return;
    }
    button.classList.add('provider-status--failed');
    button.title = `${providerName}: failed (${check?.error || 'unreachable'})`;
  };

  const checks = status?.checks && typeof status.checks === 'object' ? status.checks : {};
  setProviderState(openAiStatusButton, 'OpenAI', checks.openai || { configured: configuredProviders.includes('openai'), verified: false, error: 'unreachable' });
  setProviderState(anthropicStatusButton, 'Claude', checks.anthropic || { configured: configuredProviders.includes('anthropic'), verified: false, error: 'unreachable' });
  setProviderState(geminiStatusButton, 'Gemini', checks.gemini || { configured: configuredProviders.includes('gemini'), verified: false, error: 'unreachable' });

  if (!configuredProviders.length) {
    addLog('API unavailable. Configure OpenAI and/or Gemini keys in .env, then restart the app.', 'error');
  } else {
    const details = ['openai', 'anthropic', 'gemini']
      .filter((provider) => checks[provider]?.configured)
      .map((provider) => {
        const check = checks[provider];
        if (check?.verified) {
          return `${provider}: OK${check.model ? ` (${check.model})` : ''}`;
        }
        const reason = `${check?.error || 'unreachable'}`.trim();
        return `${provider}: FAIL (${reason})`;
      });

    if (details.length > 0) {
      if (apiAvailable) {
        addLog(`Connected — ${details.join(' | ')}`, 'info');
      } else {
        addLog(`Connection failed — ${details.join(' | ')}`, 'error');
      }
    } else if (apiAvailable) {
      addLog(`Connected (${verifiedProviders.join(', ') || 'configured'}).`, 'info');
    } else {
      addLog('API unavailable.', 'error');
    }
  }

  for (const outputKey of apiDependentOutputs) {
    const checkboxId = checkboxIds[outputKey];
    const input = document.getElementById(checkboxId);
    if (!input) {
      continue;
    }

    input.disabled = !apiAvailable;
    const wrapper = input.closest('.output-option');
    if (wrapper) {
      wrapper.classList.toggle('api-disabled', !apiAvailable);
    }

    if (!apiAvailable) {
      input.checked = false;
    }
  }

  if (apiAvailable && !Object.values(getSelectedOutputs()).some(Boolean)) {
    const docJsonInput = document.getElementById(checkboxIds.docJson);
    if (docJsonInput) {
      docJsonInput.checked = true;
    }
  }

  enforceOutputDependencies();

  await persistSettings();
  refreshGenerateState();
};

const refreshApiAvailability = async () => {
  [openAiStatusButton, anthropicStatusButton, geminiStatusButton].forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.remove('provider-status--connected', 'provider-status--failed');
    button.classList.add('provider-status--connecting');
    button.title = `${button.textContent}: connecting...`;
  });
  addLog('Connecting to API providers...', 'info');
  if (!window.desktopApp?.getApiStatus) {
    await applyApiOutputAvailability({ available: false, providers: [] });
    return;
  }

  try {
    const status = window.desktopApp?.verifyApiProviders
      ? await window.desktopApp.verifyApiProviders()
      : await window.desktopApp.getApiStatus();
    await applyApiOutputAvailability(status || { available: false, providers: [] });
  } catch (error) {
    addLog(`Could not verify API availability: ${error.message}`, 'error');
    try {
      const fallbackStatus = await window.desktopApp.getApiStatus();
      await applyApiOutputAvailability(fallbackStatus || { available: false, providers: [] });
      addLog('Fell back to configured API key status. Provider health checks may be stale.', 'warning');
    } catch {
      await applyApiOutputAvailability({ available: false, providers: [] });
    }
  }
};

const buildProjectSnapshotFromInputs = () => ({
  outputFolder: readFolderInputValue(outputFolderInput),
  exportSourceFolder: readFolderInputValue(exportSourceFolderInput),
  datasetName: `${datasetNameInput?.value || ''}`.trim(),
  outputPrefix: `${outputPrefixInput?.value || ''}`.trim(),
});

const normalizeProjectRecord = (project, index = 0) => {
  const safe = project && typeof project === 'object' ? project : {};
  const id = `${safe.id || ''}`.trim() || `project_legacy_${index}`;
  const name = normalizeProjectName(safe.name);
  if (!name) {
    return null;
  }

  return {
    id,
    name,
    outputFolder: `${safe.outputFolder || ''}`.trim(),
    exportSourceFolder: `${safe.exportSourceFolder || ''}`.trim(),
    datasetName: `${safe.datasetName || ''}`.trim(),
    outputPrefix: `${safe.outputPrefix || ''}`.trim(),
    updatedAt: `${safe.updatedAt || ''}`.trim() || new Date().toISOString(),
  };
};

const getActiveProject = () => {
  if (!activeProjectId) {
    return null;
  }
  return savedProjects.find((project) => project.id === activeProjectId) || null;
};

const renderProjectWorkspace = () => {
  const previousValue = `${projectSelect?.value || ''}`;
  const active = getActiveProject();
  if (typeof renderProjectWorkspaceView === 'function') {
    renderProjectWorkspaceView({
      projectSelect,
      projectNameInput,
      projectStatus,
      deleteProjectButton,
      savedProjects,
      activeProject: active,
      previousValue,
      getBaseName,
    });
  }
};

const applyProjectToInputs = (project) => {
  if (!project) {
    return;
  }

  writeFolderInputValue(outputFolderInput, project.outputFolder);
  writeFolderInputValue(exportSourceFolderInput, project.exportSourceFolder);
  if (datasetNameInput) {
    datasetNameInput.value = project.datasetName || '';
  }
  if (outputPrefixInput) {
    outputPrefixInput.value = project.outputPrefix || '';
  }

  if (project.outputFolder) {
    lastUsedOutputFolder = project.outputFolder;
  }
  if (project.outputPrefix) {
    lastUsedOutputPrefix = project.outputPrefix;
  }
  if (project.datasetName) {
    lastUsedDatasetName = project.datasetName;
  }
};

const syncActiveProjectFromInputs = () => {
  const active = getActiveProject();
  if (!active) {
    return;
  }

  const snapshot = buildProjectSnapshotFromInputs();
  const nextName = normalizeProjectName(projectNameInput?.value || active.name) || active.name;
  savedProjects = savedProjects.map((project) => {
    if (project.id !== active.id) {
      return project;
    }
    return {
      ...project,
      ...snapshot,
      name: nextName,
      updatedAt: new Date().toISOString(),
    };
  });
};

const buildPrefix = () => {
  const raw = (outputPrefixInput?.value || '').trim();
  if (!raw) {
    return '';
  }

  const noChapter = raw.replace(/\bchapter\b/gi, ' ');
  const safe = noChapter
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return safe;
};

const buildDocumentIdPrefix = () => {
  const raw = (outputPrefixInput?.value || '').trim();
  if (!raw) {
    return '';
  }

  return raw
    .replace(/\s+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
};

const getInitialDocumentFileName = () => {
  const prefix = buildPrefix();
  const head = prefix ? `${prefix}_` : '';
  return ensureJsonExtension(`${head}document`, 'document.json');
};

const buildRunOutputFolderName = () => {
  const prefix = buildPrefix();
  return prefix ? `${prefix} output docs` : 'output docs';
};

const renderRepairAnalysis = () => {
  if (!repairAnalysis || !repairAnalysisSummary || !repairAnalysisDetails) {
    return;
  }

  if (repairInspectionLoading) {
    repairAnalysis.hidden = false;
    repairAnalysisSummary.textContent = 'Reading incomplete metadata from selected repair artifact...';
    repairAnalysisDetails.textContent = '';
    return;
  }

  const hasSource = Boolean(selectedFiles.sourceDocumentJson?.path);
  const hasTarget = Boolean(selectedFiles.repairArtifactJson?.path);
  if (!hasSource || !hasTarget || !repairInspection) {
    repairAnalysis.hidden = true;
    repairAnalysisSummary.textContent = '';
    repairAnalysisDetails.textContent = '';
    return;
  }

  repairAnalysis.hidden = false;

  if (!repairInspection.success) {
    repairAnalysisSummary.textContent = 'Metadata check failed for selected repair artifact.';
    repairAnalysisDetails.textContent = `${repairInspection.message || 'Unable to determine required fixes.'}`.trim();
    return;
  }

  const artifactLabel = repairInspection.artifactType === 'conversationalPairs'
    ? 'conversational pairs'
    : 'question bank';
  const incompleteCount = Number(repairInspection.incompleteSectionCount || 0);
  const sectionSummary = formatRepairSectionList(repairInspection.incompleteSections);
  const failureReason = `${repairInspection.failureReason || ''}`.trim();
  const missingFromSource = Array.isArray(repairInspection.missingFromSource)
    ? repairInspection.missingFromSource
    : [];

  if (incompleteCount <= 0) {
    repairAnalysisSummary.textContent = `Selected ${artifactLabel} artifact does not report incomplete sections.`;
    repairAnalysisDetails.textContent = 'No repair is required according to metadata.';
    return;
  }

  repairAnalysisSummary.textContent = `Required fixes detected: ${incompleteCount} incomplete section(s) in ${artifactLabel} metadata.`;

  const detailParts = [];
  if (sectionSummary) {
    detailParts.push(`Sections: ${sectionSummary}`);
  }
  if (failureReason) {
    detailParts.push(`Reason: ${failureReason}`);
  }
  if (missingFromSource.length > 0) {
    detailParts.push(`Missing in source JSON: ${missingFromSource.join(', ')}`);
  }

  repairAnalysisDetails.textContent = detailParts.join(' | ');
};

const refreshRepairFileSummary = () => {
  const sourceName = selectedFiles.sourceDocumentJson?.name || 'No source document selected';
  const targetName = selectedFiles.repairArtifactJson?.name || 'No partial artifact selected';

  if (repairSourceFileName) {
    repairSourceFileName.textContent = sourceName;
    repairSourceFileName.title = sourceName;
  }

  if (repairTargetFileName) {
    repairTargetFileName.textContent = targetName;
    repairTargetFileName.title = targetName;
  }

  renderRepairAnalysis();
};

const inspectSelectedRepairArtifact = async () => {
  const sourceDocumentPath = selectedFiles.sourceDocumentJson?.path;
  const repairArtifactPath = selectedFiles.repairArtifactJson?.path;
  const hasBothFiles = Boolean(sourceDocumentPath && repairArtifactPath);

  if (!hasBothFiles) {
    repairInspection = null;
    repairInspectionLoading = false;
    refreshRepairFileSummary();
    refreshRepairState();
    return;
  }

  if (!window.desktopApp?.inspectRepairArtifact) {
    repairInspection = {
      success: false,
      message: 'Repair metadata preflight is unavailable in this app build.',
    };
    repairInspectionLoading = false;
    refreshRepairFileSummary();
    refreshRepairState();
    return;
  }

  repairInspectionRequestId += 1;
  const requestId = repairInspectionRequestId;
  repairInspectionLoading = true;
  repairInspection = null;
  refreshRepairFileSummary();
  refreshRepairState();

  try {
    const inspection = await window.desktopApp.inspectRepairArtifact({
      sourceDocumentPath,
      repairArtifactPath,
    });
    if (requestId !== repairInspectionRequestId) {
      return;
    }
    repairInspection = {
      success: true,
      ...inspection,
    };
    const artifactLabel = inspection?.artifactType === 'conversationalPairs' ? 'conversational pairs' : 'question bank';
    addLog(
      `Repair metadata loaded: ${artifactLabel}, incomplete sections ${Number(inspection?.incompleteSectionCount || 0)}.`,
      'info'
    );
  } catch (error) {
    if (requestId !== repairInspectionRequestId) {
      return;
    }
    repairInspection = {
      success: false,
      message: `${error?.message || 'Unable to inspect repair metadata.'}`.trim(),
    };
    addLog(`Repair metadata check failed: ${repairInspection.message}`, 'error');
  } finally {
    if (requestId !== repairInspectionRequestId) {
      return;
    }
    repairInspectionLoading = false;
    refreshRepairFileSummary();
    refreshRepairState();
  }
};

const getDroppedFileFromEvent = (event) => {
  const transfer = event?.dataTransfer;
  if (!transfer) {
    return null;
  }

  if (transfer.files && transfer.files.length > 0) {
    return transfer.files[0];
  }

  if (transfer.items && transfer.items.length > 0) {
    for (const item of transfer.items) {
      if (item?.kind === 'file') {
        const candidate = item.getAsFile?.();
        if (candidate) {
          return candidate;
        }
      }
    }
  }

  const droppedPath = parseDroppedPath(
    transfer.getData?.('text/uri-list')
      || transfer.getData?.('text/plain')
      || transfer.getData?.('DownloadURL')
  );

  if (droppedPath) {
    return {
      name: getBaseName(droppedPath),
      path: droppedPath,
      size: 0,
      type: 'application/json',
    };
  }

  return null;
};

const getDroppedPathsFromEvent = (event) => {
  const transfer = event?.dataTransfer;
  if (!transfer) {
    return [];
  }

  const resolvedPaths = [];
  const pushResolvedPath = (candidate) => {
    if (!candidate) {
      return;
    }

    let resolvedPath = candidate.path || null;
    if (!resolvedPath) {
      try {
        resolvedPath = window.desktopApp?.getPathForFile?.(candidate) || null;
      } catch (_) {
        resolvedPath = null;
      }
    }

    if (resolvedPath) {
      resolvedPaths.push(resolvedPath);
    }
  };

  if (transfer.files && transfer.files.length > 0) {
    Array.from(transfer.files).forEach(pushResolvedPath);
  }

  if (resolvedPaths.length === 0 && transfer.items && transfer.items.length > 0) {
    Array.from(transfer.items).forEach((item) => {
      if (item?.kind !== 'file') {
        return;
      }
      const candidate = item.getAsFile?.();
      if (candidate) {
        pushResolvedPath(candidate);
      }
    });
  }

  if (resolvedPaths.length === 0) {
    const droppedPath = parseDroppedPath(
      transfer.getData?.('text/uri-list')
        || transfer.getData?.('text/plain')
        || transfer.getData?.('DownloadURL')
    );
    if (droppedPath) {
      resolvedPaths.push(droppedPath);
    }
  }

  return [...new Set(resolvedPaths.filter(Boolean))];
};

const setPdfDropText = (text, isLoaded = false) => {
  if (!pdfDropTextEl) {
    return;
  }
  pdfDropTextEl.textContent = text || defaultPdfDropText;
  pdfDropTextEl.classList.toggle('loaded-doc', Boolean(isLoaded));
};

const getActiveProjectEnvironment = () => {
  if (currentProjectEnvironment?.rootPath) {
    return currentProjectEnvironment;
  }
  if (currentCreatedProject?.rootPath) {
    return currentCreatedProject;
  }
  if (currentLoadedProject?.rootPath) {
    return currentLoadedProject;
  }
  return null;
};

const rebuildGenerationQueue = () => {
  const queueItems = [];
  projectCurriculumEntries.forEach((entry) => {
    const documents = Array.isArray(entry?.documents) ? entry.documents : [];
    documents.forEach((documentEntry) => {
      const pathKey = `${documentEntry?.path || ''}`.trim();
      if (!pathKey || !selectedCurriculumDocumentPaths.has(pathKey)) {
        return;
      }
      queueItems.push({
        folderName: `${entry?.name || ''}`.trim() || 'folder',
        name: documentEntry?.name || '',
        relativePath: documentEntry?.relativePath || documentEntry?.name || '',
        path: pathKey,
      });
    });
  });

  generationQueue = queueItems;
  if (projectCurriculumSubtitle) {
    const queueLabel = generationQueue.length > 0
      ? `Generation queue ready: ${generationQueue.length} document${generationQueue.length === 1 ? '' : 's'} selected.`
      : 'Select source documents with checkboxes to build a generation queue.';
    projectCurriculumSubtitle.textContent = queueLabel;
  }
};

const toggleCurriculumDocumentQueue = (documentEntry, checked) => {
  const pathKey = `${documentEntry?.path || ''}`.trim();
  if (!pathKey) {
    return;
  }

  if (checked) {
    selectedCurriculumDocumentPaths.add(pathKey);
  } else {
    selectedCurriculumDocumentPaths.delete(pathKey);
  }

  rebuildGenerationQueue();
  renderCurriculumDocuments(selectedCurriculumFolderPath);
  addLog(
    `Generation queue updated: ${generationQueue.length} document${generationQueue.length === 1 ? '' : 's'} selected.`,
    'info'
  );
};

const toggleCurriculumGroup = (groupKey) => {
  if (!groupKey) {
    return;
  }

  if (collapsedCurriculumGroups.has(groupKey)) {
    collapsedCurriculumGroups.delete(groupKey);
  } else {
    collapsedCurriculumGroups.add(groupKey);
  }

  renderCurriculumDocuments(selectedCurriculumFolderPath);
};

const buildProjectEnvironmentEntries = () => {
  const activeProjectEnvironment = getActiveProjectEnvironment();
  const projectRoot = `${activeProjectEnvironment?.rootPath || ''}`.trim();
  const mapByName = new Map();

  projectCurriculumEntries.forEach((entry) => {
    const nameKey = `${entry?.name || ''}`.trim().toLowerCase();
    if (nameKey) {
      mapByName.set(nameKey, entry);
    }
  });

  const getFallbackPath = (folderName) => {
    if (!projectRoot) {
      return folderName;
    }
    return typeof joinPath === 'function' ? joinPath(projectRoot, folderName) : `${projectRoot}/${folderName}`;
  };

  const resolveEntry = (name, fallbackFolder) => {
    const existing = mapByName.get(name.toLowerCase());
    if (existing) {
      return {
        ...existing,
        name,
      };
    }
    return {
      name,
      path: getFallbackPath(fallbackFolder),
      sourceDocumentsPath: getFallbackPath(fallbackFolder),
      documentCount: 0,
      documents: [],
    };
  };

  return [
    resolveEntry('Foundational data', 'Foundational data'),
    resolveEntry('adapter data', 'adapter data'),
    resolveEntry('export files', 'export files'),
  ];
};

const renderCurriculumDocuments = (folderPath = '') => {
  const environmentEntries = buildProjectEnvironmentEntries();
  const selectedEntry = environmentEntries.find((entry) => entry.path === folderPath) || null;
  if (typeof renderCurriculumDocumentsView === 'function') {
    renderCurriculumDocumentsView({
      curriculumDocumentsList,
      selectedEntry,
      selectedDocumentPaths: selectedCurriculumDocumentPaths,
      generationQueue,
      onToggleDocument: toggleCurriculumDocumentQueue,
      collapsedGroupKeys: collapsedCurriculumGroups,
      onToggleGroup: toggleCurriculumGroup,
    });
  }
};

const renderCurriculumFolders = () => {
  const environmentEntries = buildProjectEnvironmentEntries();

  if (environmentEntries.length === 0) {
    renderCurriculumDocuments('');
  }

  const hasSelectedPath = environmentEntries.some((entry) => entry.path === selectedCurriculumFolderPath);
  if (!hasSelectedPath) {
    selectedCurriculumFolderPath = environmentEntries[0]?.path || '';
  }

  if (typeof renderCurriculumFoldersView === 'function') {
    renderCurriculumFoldersView({
      curriculumFoldersList,
      entries: environmentEntries,
      selectedPath: selectedCurriculumFolderPath,
      isDropEnabled: Boolean(currentProjectEnvironment?.rootPath || currentCreatedProject?.rootPath),
      onSelect: (entry) => {
        selectedCurriculumFolderPath = entry.path;
        renderCurriculumFolders();
        renderCurriculumDocuments(selectedCurriculumFolderPath);
      },
      onDropFiles: async (entry, event) => {
        await handleCurriculumFolderDrop(entry, event);
      },
    });
  }

  renderCurriculumDocuments(selectedCurriculumFolderPath);
};

const loadProjectCurriculumOverview = async (forceRefresh = false) => {
  const activeProjectEnvironment = getActiveProjectEnvironment();
  const projectRoot = `${activeProjectEnvironment?.rootPath || ''}`.trim();
  if (!projectRoot || !window.desktopApp?.getProjectCurriculumOverview) {
    projectCurriculumEntries = [];
    selectedCurriculumFolderPath = '';
    selectedCurriculumDocumentPaths = new Set();
    collapsedCurriculumGroups = new Set();
    generationQueue = [];
    renderCurriculumFolders();
    return;
  }

  if (!forceRefresh && projectRoot === lastCurriculumProjectRoot && projectCurriculumEntries.length > 0) {
    renderCurriculumFolders();
    return;
  }

  if (curriculumFoldersList) {
    curriculumFoldersList.innerHTML = '<p class="curriculum-empty">Loading project folders...</p>';
  }
  if (curriculumDocumentsList) {
    curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">Select a project folder to view source documents.</p>';
  }

  try {
    const result = await window.desktopApp.getProjectCurriculumOverview(projectRoot);
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to load curriculum folders');
    }
    projectCurriculumEntries = Array.isArray(result.entries) ? result.entries : [];
    const environmentEntries = buildProjectEnvironmentEntries();
    selectedCurriculumFolderPath = environmentEntries[0]?.path || '';
    lastCurriculumProjectRoot = projectRoot;

    const availablePaths = new Set();
    projectCurriculumEntries.forEach((entry) => {
      const docs = Array.isArray(entry?.documents) ? entry.documents : [];
      docs.forEach((doc) => {
        const pathKey = `${doc?.path || ''}`.trim();
        if (pathKey) {
          availablePaths.add(pathKey);
        }
      });
    });
    selectedCurriculumDocumentPaths = new Set(
      Array.from(selectedCurriculumDocumentPaths).filter((pathKey) => availablePaths.has(pathKey))
    );
    const availableGroupKeys = new Set();
    projectCurriculumEntries.forEach((entry) => {
      const docs = Array.isArray(entry?.documents) ? entry.documents : [];
      docs.forEach((doc) => {
        const relativePath = `${doc?.relativePath || doc?.name || ''}`.trim().replace(/\\/g, '/');
        const pathParts = relativePath.split('/').filter(Boolean);
        const groupKey = pathParts.length > 1 ? pathParts[0] : '__root__';
        availableGroupKeys.add(groupKey);
      });
    });
    collapsedCurriculumGroups = new Set(
      Array.from(collapsedCurriculumGroups).filter((groupKey) => availableGroupKeys.has(groupKey))
    );
    rebuildGenerationQueue();

    const projectName = activeProjectEnvironment?.projectName || 'Project';
    if (projectCurriculumTitle) {
      projectCurriculumTitle.textContent = projectName;
    }

    renderCurriculumFolders();
  } catch (error) {
    projectCurriculumEntries = [];
    selectedCurriculumFolderPath = '';
    selectedCurriculumDocumentPaths = new Set();
    collapsedCurriculumGroups = new Set();
    generationQueue = [];
    lastCurriculumProjectRoot = projectRoot;
    if (curriculumFoldersList) {
      curriculumFoldersList.innerHTML = '<p class="curriculum-empty">Could not load project folders for this project.</p>';
    }
    if (curriculumDocumentsList) {
      curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">No source documents available.</p>';
    }
    addLog(`Curriculum browser error: ${error.message}`, 'warning');
  }
};

const refreshProjectCurriculumBrowser = () => {
  const activeProjectEnvironment = getActiveProjectEnvironment();
  const shouldShow = currentTaskMode === 'generate' && Boolean(activeProjectEnvironment?.rootPath);
  if (projectCurriculumPanel) {
    if (shouldShow) {
      projectCurriculumPanel.removeAttribute('hidden');
    } else {
      projectCurriculumPanel.setAttribute('hidden', '');
    }
  }

  if (!shouldShow) {
    return;
  }

  void loadProjectCurriculumOverview(false);
};

const getSelectedOutputs = () => {
  const result = {};
  Object.entries(checkboxIds).forEach(([key, id]) => {
    const input = document.getElementById(id);
    result[key] = Boolean(input?.checked);
  });
  return result;
};

const enforceOutputDependencies = () => {
  const questionsInput = document.getElementById(checkboxIds.questions);
  const deterministicInput = document.getElementById(checkboxIds.deterministicPairs);
  const conversationalInput = document.getElementById(checkboxIds.conversationalPairs);
  if (!questionsInput || !deterministicInput || !conversationalInput) {
    return;
  }

  const canUseDeterministicPairs = apiAvailable && questionsInput.checked;
  if (!canUseDeterministicPairs && deterministicInput.checked) {
    deterministicInput.checked = false;
    setOutputReadyState('deterministicPairs', false);
  }

  deterministicInput.disabled = !canUseDeterministicPairs;
  conversationalInput.disabled = !apiAvailable;
};

const getOutputFileNames = () => {
  const prefix = buildPrefix();
  const head = prefix ? `${prefix}_` : '';

  return {
    docJson: getInitialDocumentFileName(),
    summary: ensureMarkdownExtension(`${head}chapter_summary`, 'chapter_summary.md'),
    questions: ensureJsonExtension(`${head}questions`, 'chapter_questions.json'),
    deterministicPairs: ensureJsonExtension(`${head}deterministic_training_pairs`, 'deterministic_training_pairs.json'),
    conversationalPairs: ensureJsonExtension(`${head}conversational_training_pairs`, 'conversational_training_pairs.json'),
  };
};

const updateCardDisplay = (key, fileLabel, options = {}) => {
  const cardInfo = cardRegistry.get(key);
  if (!cardInfo) {
    return;
  }

  if (cardInfo.fileName) {
    cardInfo.fileName.textContent = fileLabel;
  }
  if (options.selected === false) {
    cardInfo.card.dataset.selected = 'false';
  } else {
    cardInfo.card.dataset.selected = 'true';
  }

  if (options.invalid) {
    cardInfo.card.dataset.invalid = 'true';
  } else {
    delete cardInfo.card.dataset.invalid;
  }
};

const getRequiredUploadsReady = () =>
  Array.from(requiredCards).every((entry) => entry.dataset.selected === 'true');

const getDestinationsReady = () =>
  Boolean(outputFolderInput?.value && outputFolderInput.value !== 'No folder selected');

const hasSelectedOutput = () => Object.values(getSelectedOutputs()).some(Boolean);

const pipelineViewController = typeof createPipelineViewController === 'function'
  ? createPipelineViewController({
      dom: {
        modeButtons,
        modePanels,
        sharedOutputSubtitle,
        commonPrefixCell,
        outputPrefixInput,
        datasetNameCell,
        datasetNameInput,
        exportButton,
        exportHint,
        exportSourceFolderInput,
        outputFolderInput,
        repairButton,
        repairHint,
        generateButton,
        generateHint,
        cancelButton,
      },
      state: {
        get currentTaskMode() { return currentTaskMode; },
        get generationInProgress() { return generationInProgress; },
        get generationCancelRequested() { return generationCancelRequested; },
        get repairInProgress() { return repairInProgress; },
        get exportInProgress() { return exportInProgress; },
        get apiAvailable() { return apiAvailable; },
        get selectedFiles() { return selectedFiles; },
        get repairInspection() { return repairInspection; },
        get repairInspectionLoading() { return repairInspectionLoading; },
        get lastUsedDatasetName() { return lastUsedDatasetName; },
        get requiredUploadsReady() { return getRequiredUploadsReady(); },
        get destinationsReady() { return getDestinationsReady(); },
        get hasSelectedOutput() { return hasSelectedOutput(); },
      },
      helpers: {
        normalizeDatasetName,
        getBaseName,
        inferRepairArtifactTypeFromName,
        refreshProjectCurriculumBrowser,
      },
      renderTaskModeView,
    })
  : null;

const refreshTaskModeState = () => {
  pipelineViewController?.renderTaskModeSection?.();
};

const setTaskMode = (mode) => {
  const normalized = `${mode || ''}`.trim().toLowerCase();
  if (!['generate', 'repair', 'export'].includes(normalized)) {
    currentTaskMode = '';
  } else {
    currentTaskMode = normalized;
  }
  refreshTaskModeState();
};

const refreshExportState = () => {
  pipelineViewController?.renderExportSection?.();
};

const refreshRepairState = () => {
  pipelineViewController?.renderRepairSection?.();
};

const refreshGenerateState = () => {
  pipelineViewController?.renderGenerateSection?.();
  pipelineViewController?.renderRepairSection?.();
  pipelineViewController?.renderExportSection?.();
  pipelineViewController?.renderTaskModeSection?.();
};

const collectSettings = () => ({
  outputFolder: readFolderInputValue(outputFolderInput),
  datasetName: datasetNameInput?.value || '',
  outputPrefix: outputPrefixInput?.value || '',
  repairFastMode: Boolean(repairFastModeInput?.checked ?? lastUsedRepairFastMode),
  exportSourceFolder: readFolderInputValue(exportSourceFolderInput),
  savedProjects,
  activeProjectId,
  currentTaskMode,
  selectedOutputs: getSelectedOutputs(),
  lastLoadedPdfName,
  lastUsed: {
    outputFolder: lastUsedOutputFolder,
    outputPrefix: lastUsedOutputPrefix,
    datasetName: lastUsedDatasetName,
    repairFastMode: lastUsedRepairFastMode,
  },
});

const persistSettings = async () => {
  if (!window.desktopApp?.saveSettings) {
    return;
  }
  try {
    syncActiveProjectFromInputs();
    renderProjectWorkspace();
    await window.desktopApp.saveSettings(collectSettings());
  } catch (error) {
    addLog(`Could not save app settings: ${error.message}`, 'error');
  }
};

const applySettings = (settings) => {
  if (!settings || typeof settings !== 'object') {
    return;
  }

  const incomingProjects = Array.isArray(settings.savedProjects)
    ? settings.savedProjects
    : (Array.isArray(settings.projects) ? settings.projects : []);
  const normalizedProjects = incomingProjects
    .map((project, index) => normalizeProjectRecord(project, index))
    .filter(Boolean);
  const dedupedById = new Map();
  normalizedProjects.forEach((project) => {
    if (!dedupedById.has(project.id)) {
      dedupedById.set(project.id, project);
    }
  });
  savedProjects = Array.from(dedupedById.values());

  const incomingActiveProjectId = `${settings.activeProjectId || ''}`.trim();
  activeProjectId = savedProjects.some((project) => project.id === incomingActiveProjectId)
    ? incomingActiveProjectId
    : '';

  if (outputFolderInput && typeof settings.outputFolder === 'string') {
    writeFolderInputValue(outputFolderInput, settings.outputFolder);
  }

  if (outputPrefixInput && typeof settings.outputPrefix === 'string') {
    outputPrefixInput.value = settings.outputPrefix;
  }

  if (datasetNameInput && typeof settings.datasetName === 'string') {
    datasetNameInput.value = settings.datasetName;
  }

  if (exportSourceFolderInput && typeof settings.exportSourceFolder === 'string') {
    writeFolderInputValue(exportSourceFolderInput, settings.exportSourceFolder);
  }

  if (repairFastModeInput && typeof settings.repairFastMode === 'boolean') {
    repairFastModeInput.checked = settings.repairFastMode;
  }

  if (typeof settings.lastLoadedPdfName === 'string') {
    lastLoadedPdfName = settings.lastLoadedPdfName;
  }

  if (settings.lastUsed && typeof settings.lastUsed === 'object') {
    if (typeof settings.lastUsed.outputFolder === 'string') {
      lastUsedOutputFolder = settings.lastUsed.outputFolder;
    }
    if (typeof settings.lastUsed.outputPrefix === 'string') {
      lastUsedOutputPrefix = settings.lastUsed.outputPrefix;
    }
    if (typeof settings.lastUsed.datasetName === 'string') {
      lastUsedDatasetName = settings.lastUsed.datasetName;
    }
    if (typeof settings.lastUsed.repairFastMode === 'boolean') {
      lastUsedRepairFastMode = settings.lastUsed.repairFastMode;
    }
  }

  if (outputFolderInput && (outputFolderInput.value === '' || outputFolderInput.value === NO_FOLDER_SELECTED_LABEL) && lastUsedOutputFolder) {
    writeFolderInputValue(outputFolderInput, lastUsedOutputFolder);
  }

  if (outputPrefixInput && outputPrefixInput.value.trim() === '' && lastUsedOutputPrefix) {
    outputPrefixInput.value = lastUsedOutputPrefix;
  }

  if (datasetNameInput && datasetNameInput.value.trim() === '' && lastUsedDatasetName) {
    datasetNameInput.value = lastUsedDatasetName;
  }

  if (repairFastModeInput && typeof settings.repairFastMode !== 'boolean') {
    repairFastModeInput.checked = lastUsedRepairFastMode;
  }

  if (settings.selectedOutputs && typeof settings.selectedOutputs === 'object') {
    Object.entries(checkboxIds).forEach(([key, id]) => {
      const input = document.getElementById(id);
      if (input && typeof settings.selectedOutputs[key] === 'boolean') {
        input.checked = settings.selectedOutputs[key];
      }
    });
  }

  if (typeof settings.currentTaskMode === 'string') {
    currentTaskMode = settings.currentTaskMode.trim().toLowerCase();
  }

  enforceOutputDependencies();

  if (!['generate', 'repair', 'export'].includes(currentTaskMode)) {
    currentTaskMode = '';
  }

  refreshTaskModeState();

  if (activeProjectId) {
    applyProjectToInputs(getActiveProject());
  }
  renderProjectWorkspace();

};

const loadSavedSettings = async () => {
  if (!window.desktopApp?.getSettings) {
    return;
  }
  try {
    const settings = await window.desktopApp.getSettings();
    applySettings(settings);
    refreshGenerateState();
  } catch (error) {
    addLog(`Could not load app settings: ${error.message}`, 'error');
  }
};

const setDefaultPrefixFromPdf = () => {
  if (!outputPrefixInput || outputPrefixInput.value.trim() !== '') {
    return;
  }
  const pdfBase = selectedFiles.originalPdf?.name
    ? selectedFiles.originalPdf.name.replace(/\.[^.]+$/, '')
    : '';
  if (pdfBase) {
    outputPrefixInput.value = pdfBase;
  }
};

const startNewProjectDraft = () => {
  activeProjectId = '';
  if (projectSelect) {
    projectSelect.value = '';
  }
  if (projectNameInput) {
    projectNameInput.value = '';
    projectNameInput.focus();
  }
  renderProjectWorkspace();
};

const saveProjectFromCurrentInputs = async () => {
  const name = normalizeProjectName(projectNameInput?.value || '');
  if (!name) {
    addLog('Project name is required before saving.', 'warning');
    return;
  }

  const snapshot = buildProjectSnapshotFromInputs();
  const active = getActiveProject();

  if (active) {
    savedProjects = savedProjects.map((project) => {
      if (project.id !== active.id) {
        return project;
      }
      return {
        ...project,
        ...snapshot,
        name,
        updatedAt: new Date().toISOString(),
      };
    });
    addLog(`Project updated: ${name}`, 'success');
  } else {
    let id = makeProjectId();
    while (savedProjects.some((project) => project.id === id)) {
      id = makeProjectId();
    }
    savedProjects = [
      ...savedProjects,
      {
        id,
        name,
        ...snapshot,
        updatedAt: new Date().toISOString(),
      },
    ];
    activeProjectId = id;
    addLog(`Project saved: ${name}`, 'success');
  }

  renderProjectWorkspace();
  await persistSettings();
  refreshGenerateState();
};

const deleteActiveProject = async () => {
  const active = getActiveProject();
  if (!active) {
    return;
  }

  let confirmed = true;
  if (window.desktopApp?.showConfirm) {
    confirmed = await window.desktopApp.showConfirm({
      type: 'warning',
      title: 'Delete Project',
      message: `Delete project "${active.name}"?`,
      detail: 'This only removes the saved workspace profile. It does not delete any files or folders.',
      buttons: ['Delete', 'Cancel'],
    });
  }
  if (!confirmed) {
    return;
  }

  savedProjects = savedProjects.filter((project) => project.id !== active.id);
  activeProjectId = '';
  if (projectSelect) {
    projectSelect.value = '';
  }
  if (projectNameInput) {
    projectNameInput.value = '';
  }
  renderProjectWorkspace();
  await persistSettings();
  refreshGenerateState();
  addLog(`Project deleted: ${active.name}`, 'info');
};

if (card) {
  const dropZone = card.querySelector('.drop-zone');
  const uploadButton = card.querySelector('.upload-button');
  const fileInput = card.querySelector('.file-input');
  const fileName = null;
  const clearCardButton = card.querySelector('.clear-card-button');
  const key = 'originalPdf';

  cardRegistry.set(key, {
    card,
    fileName,
  });

  const syncPrimaryButtonState = () => {
    if (!uploadButton) {
      return;
    }
    const hasFile = Boolean(selectedFiles.originalPdf);
    uploadButton.textContent = hasFile ? 'Clear' : 'Upload';
  };

  clearPrimaryPdf = async (options = {}) => {
    const resetInputs = options.resetInputs !== false;

    if (selectedFiles.originalPdf?.name) {
      lastLoadedPdfName = selectedFiles.originalPdf.name;
    }

    if (outputFolderInput && outputFolderInput.value && outputFolderInput.value !== 'No folder selected') {
      lastUsedOutputFolder = outputFolderInput.value;
    }
    if (outputPrefixInput && outputPrefixInput.value.trim() !== '') {
      lastUsedOutputPrefix = outputPrefixInput.value.trim();
    }

    updateCardDisplay(key, 'No file selected', { selected: false, invalid: false });
    setPdfDropText(defaultPdfDropText, false);
    delete card.dataset.selected;
    fileInput.value = '';
    selectedFiles.originalPdf = null;
    setConversionStatus('Idle. Waiting for input.', 0, 'idle');

    if (resetInputs && outputFolderInput) {
      outputFolderInput.value = 'No folder selected';
    }
    if (resetInputs && outputPrefixInput) {
      outputPrefixInput.value = '';
    }

    resetDocumentOutputState();
    syncPrimaryButtonState();
    addLog('Original PDF cleared. Input fields reset.', 'info');
    await persistSettings();
    refreshGenerateState();
  };

  if (clearCardButton) {
    clearCardButton.addEventListener('click', (event) => {
      event.stopPropagation();
      void clearPrimaryPdf();
    });
  }

  const setFile = async (file) => {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      updateCardDisplay(key, `${file.name} (invalid type)`, { selected: false, invalid: true });
      selectedFiles.originalPdf = null;
      setPdfDropText(defaultPdfDropText, false);
      resetDocumentOutputState();
      addLog('Only PDF files are allowed for Original PDF.', 'error');
      refreshGenerateState();
      return;
    }

    let resolvedPath = file.path || null;
    if (!resolvedPath && window.desktopApp?.getPathForFile) {
      try { resolvedPath = window.desktopApp.getPathForFile(file) || null; } catch (_) {}
    }

    updateCardDisplay(key, file.name, { selected: true, invalid: false });
    setPdfDropText(file.name, true);
    selectedFiles.originalPdf = {
      name: file.name,
      size: file.size,
      type: file.type,
      path: resolvedPath,
    };

    if (!resolvedPath) {
      addLog(`Warning: file path could not be resolved for ${file.name}. Use the Upload button to re-select.`, 'error');
    }

    resetDocumentOutputState();
    lastLoadedPdfName = file.name;
    if (outputFolderInput && (outputFolderInput.value === '' || outputFolderInput.value === 'No folder selected') && lastUsedOutputFolder) {
      outputFolderInput.value = lastUsedOutputFolder;
    }
    if (outputPrefixInput && outputPrefixInput.value.trim() === '' && lastUsedOutputPrefix) {
      outputPrefixInput.value = lastUsedOutputPrefix;
    }

    syncPrimaryButtonState();
    addLog(`Original PDF selected: ${file.name}`);
    await persistSettings();
    refreshGenerateState();
  };

  uploadButton?.addEventListener('click', async () => {
    if (selectedFiles.originalPdf) {
      void clearPrimaryPdf();
      return;
    }

    if (window.desktopApp?.openPdfDialog) {
      const filePath = await window.desktopApp.openPdfDialog();
      if (filePath) {
        const name = filePath.split(/[\/\\]/).pop();
        void setFile({ name, path: filePath, size: 0, type: 'application/pdf' });
      }
      return;
    }

    fileInput?.click();
  });

  fileInput?.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) { return; }
    let resolvedPath = file.path || null;
    if (!resolvedPath && window.desktopApp?.getPathForFile) {
      try { resolvedPath = window.desktopApp.getPathForFile(file) || null; } catch (_) {}
    }
    void setFile({ name: file.name, size: file.size, type: file.type, path: resolvedPath });
  });

  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    card.dataset.dragging = 'true';
  });

  dropZone?.addEventListener('dragleave', () => {
    delete card.dataset.dragging;
  });

  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    delete card.dataset.dragging;
    const [droppedFile] = event.dataTransfer.files;
    if (droppedFile) {
      let resolvedPath = droppedFile.path || null;
      if (!resolvedPath && window.desktopApp?.getPathForFile) {
        try { resolvedPath = window.desktopApp.getPathForFile(droppedFile) || null; } catch (_) {}
      }
      void setFile({ name: droppedFile.name, path: resolvedPath, size: droppedFile.size, type: droppedFile.type });
    }
  });

  dropZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (selectedFiles.originalPdf) {
        void clearPrimaryPdf();
      } else {
        uploadButton?.click();
      }
    }
  });

  syncPrimaryButtonState();
}

if (legacyCard) {
  const dropZone = legacyCard.querySelector('.drop-zone');
  const uploadButton = legacyCard.querySelector('.upload-button');
  const fileInput = legacyCard.querySelector('.legacy-file-input');
  const fileName = legacyCard.querySelector('.file-name');
  const clearCardButton = legacyCard.querySelector('.clear-card-button');

  const setLegacyFile = async (file) => {
    if (!file) {
      return;
    }
    fileName.textContent = file.name;
    legacyCard.dataset.selected = 'true';
    selectedFiles.legacyFile = {
      name: file.name,
      size: file.size,
      type: file.type,
      path: file.path || null,
    };
    addLog(`Legacy file loaded (optional): ${file.name}`);
    await persistSettings();
  };

  if (clearCardButton) {
    clearCardButton.addEventListener('click', (event) => {
      event.stopPropagation();
      fileInput.value = '';
      fileName.textContent = 'No file selected';
      delete legacyCard.dataset.selected;
      selectedFiles.legacyFile = null;
      addLog('Legacy file cleared.');
      void persistSettings();
    });
  }

  uploadButton?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (event) => {
    const [file] = event.target.files;
    void setLegacyFile(file);
  });

  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    legacyCard.dataset.dragging = 'true';
  });

  dropZone?.addEventListener('dragleave', () => {
    delete legacyCard.dataset.dragging;
  });

  dropZone?.addEventListener('drop', (event) => {
    event.preventDefault();
    delete legacyCard.dataset.dragging;
    const [file] = event.dataTransfer.files;
    void setLegacyFile(file);
  });

  dropZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput?.click();
    }
  });
}

const repairCardDialogTitles = {
  sourceDocumentJson: 'Select Source Document JSON',
  repairArtifactJson: 'Select Partial Artifact JSON',
};

repairCards.forEach((repairCard) => {
  const key = `${repairCard.dataset.repairCard || ''}`.trim();
  if (!key) {
    return;
  }

  const dropZone = repairCard.querySelector('.drop-zone');
  const uploadButton = repairCard.querySelector('.upload-button');
  const fileInput = repairCard.querySelector('.repair-file-input');
  const fileName = repairCard.querySelector('.file-name');
  const clearCardButton = repairCard.querySelector('.clear-card-button');

  cardRegistry.set(key, {
    card: repairCard,
    fileName,
  });

  const clearRepairFile = async () => {
    updateCardDisplay(key, 'No file selected', { selected: false, invalid: false });
    if (fileInput) {
      fileInput.value = '';
    }
    selectedFiles[key] = null;
    repairInspection = null;
    repairInspectionLoading = false;
    refreshRepairFileSummary();
    addLog(`${key === 'sourceDocumentJson' ? 'Source document JSON' : 'Partial artifact JSON'} cleared.`, 'info');
    await inspectSelectedRepairArtifact();
    refreshRepairState();
  };

  const setRepairFile = async (file) => {
    if (!file) {
      return;
    }

    let resolvedPath = file.path || null;
    if (!resolvedPath && window.desktopApp?.getPathForFile) {
      try { resolvedPath = window.desktopApp.getPathForFile(file) || null; } catch (_) {}
    }

    const resolvedName = `${file.name || getBaseName(resolvedPath) || ''}`.trim();

    if (!isJsonFileName(resolvedName)) {
      updateCardDisplay(key, `${resolvedName || 'Unknown file'} (invalid type)`, { selected: false, invalid: true });
      selectedFiles[key] = null;
      repairInspection = null;
      repairInspectionLoading = false;
      refreshRepairFileSummary();
      addLog('Only JSON files are supported in the repair panel.', 'error');
      refreshRepairState();
      return;
    }

    updateCardDisplay(key, resolvedName, { selected: true, invalid: false });
    selectedFiles[key] = {
      name: resolvedName,
      size: file.size,
      type: file.type,
      path: resolvedPath,
    };
    repairInspection = null;
    refreshRepairFileSummary();
    addLog(`${key === 'sourceDocumentJson' ? 'Source document JSON' : 'Partial artifact JSON'} selected: ${resolvedName}`, 'info');
    await inspectSelectedRepairArtifact();
    refreshRepairState();
  };

  clearCardButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    void clearRepairFile();
  });

  uploadButton?.addEventListener('click', async () => {
    if (selectedFiles[key]) {
      void clearRepairFile();
      return;
    }

    if (window.desktopApp?.openJsonDialog) {
      const filePath = await window.desktopApp.openJsonDialog({ title: repairCardDialogTitles[key] || 'Select JSON File' });
      if (filePath) {
        void setRepairFile({ name: getBaseName(filePath), path: filePath, size: 0, type: 'application/json' });
      }
      return;
    }

    fileInput?.click();
  });

  fileInput?.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (!file) {
      return;
    }
    void setRepairFile(file);
  });

  const onRepairDragOver = (event) => {
    event.preventDefault();
    repairCard.dataset.dragging = 'true';
  };

  const onRepairDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    delete repairCard.dataset.dragging;
    const file = getDroppedFileFromEvent(event);
    if (file) {
      void setRepairFile(file);
    }
  };

  dropZone?.addEventListener('dragenter', onRepairDragOver);
  dropZone?.addEventListener('dragover', onRepairDragOver);
  repairCard.addEventListener('dragenter', onRepairDragOver);
  repairCard.addEventListener('dragover', onRepairDragOver);

  dropZone?.addEventListener('dragleave', () => {
    delete repairCard.dataset.dragging;
  });

  repairCard.addEventListener('dragleave', () => {
    delete repairCard.dataset.dragging;
  });

  dropZone?.addEventListener('drop', onRepairDrop);
  repairCard.addEventListener('drop', onRepairDrop);

  dropZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (selectedFiles[key]) {
        void clearRepairFile();
      } else {
        uploadButton?.click();
      }
    }
  });
});

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const nextMode = `${button?.dataset?.modeTrigger || ''}`.trim().toLowerCase();
    if (generationInProgress || repairInProgress || exportInProgress) {
      return;
    }
    setTaskMode(currentTaskMode === nextMode ? '' : nextMode);
    void persistSettings();
  });
});

projectSelect?.addEventListener('change', async () => {
  const nextProjectId = `${projectSelect.value || ''}`.trim();
  activeProjectId = savedProjects.some((project) => project.id === nextProjectId)
    ? nextProjectId
    : '';
  const active = getActiveProject();
  if (active) {
    applyProjectToInputs(active);
    addLog(`Project loaded: ${active.name}`, 'info');
  }
  renderProjectWorkspace();
  await persistSettings();
  refreshGenerateState();
});

newProjectButton?.addEventListener('click', () => {
  startNewProjectDraft();
  void persistSettings();
});

saveProjectButton?.addEventListener('click', () => {
  void saveProjectFromCurrentInputs();
});

deleteProjectButton?.addEventListener('click', () => {
  void deleteActiveProject();
});

if (!projectEnvironmentController && typeof createProjectEnvironmentController === 'function') {
  projectEnvironmentController = createProjectEnvironmentController({
    dom: {
      topCreateProjectButton,
      projectCreationTitleEl,
      projectCreationPanel,
      projectLoaderPanel,
      projectDetailsPanel,
      cachedProjectsList,
      topOpenProjectButton,
      closeProjectLoaderButton,
      backToCachedListButton,
      closeProjectDetailsButton,
      openProjectFolderButton,
      removeProjectCacheButton,
    },
    state: {
      getCurrentLoadedProject: () => currentLoadedProject,
      setCurrentLoadedProject: (value) => {
        currentLoadedProject = value;
      },
      setCurrentCreatedProject: (value) => {
        currentCreatedProject = value;
      },
      setCurrentProjectEnvironment: (value) => {
        currentProjectEnvironment = value;
      },
      resetCurriculumState: () => {
        lastCurriculumProjectRoot = '';
        projectCurriculumEntries = [];
        selectedCurriculumFolderPath = '';
      },
      setCurrentTaskMode: (mode) => {
        setTaskMode(mode);
      },
    },
    addLog,
    refreshProjectCurriculumBrowser,
    topCreateProjectDefaultLabel,
    defaultProjectCreationTitle,
  });
}

const setTopCreateProjectLabel = (projectName) => {
  if (projectEnvironmentController?.setTopCreateProjectLabel) {
    projectEnvironmentController.setTopCreateProjectLabel(projectName);
  }
};

const openSavedProjectEnvironment = async (project) => {
  if (projectEnvironmentController?.openSavedProjectEnvironment) {
    await projectEnvironmentController.openSavedProjectEnvironment(project);
  }
};

const loadCachedProjectsList = async () => {
  if (projectEnvironmentController?.loadCachedProjectsList) {
    await projectEnvironmentController.loadCachedProjectsList();
  }
};

projectEnvironmentController?.bindProjectEnvironmentPanelEvents?.();

// ============================================================================
// PROJECT CREATION WORKFLOW EVENT HANDLERS
// ============================================================================

topCreateProjectButton?.addEventListener('click', () => {
  const activeLabel = `${topCreateProjectButton.querySelector('.nav-button-label')?.textContent || ''}`.trim();
  const isEnvironmentMode = activeLabel !== topCreateProjectDefaultLabel;

  if (isEnvironmentMode) {
    projectEnvironmentController?.switchToEnvironmentWorkspace?.(activeLabel);
    return;
  }

  if (projectCreationPanel) {
    if (projectLoaderPanel) {
      projectLoaderPanel.setAttribute('hidden', '');
    }
    if (projectDetailsPanel) {
      projectDetailsPanel.setAttribute('hidden', '');
    }
    if (cachedProjectsList) {
      cachedProjectsList.removeAttribute('hidden');
    }

    projectCreationPanel.removeAttribute('hidden');
    newProjectName?.focus();
    // Reset form
    newProjectName.value = '';
    projectCreationHint.textContent = 'Enter a project name to continue.';
    projectCreationHint.style.color = '#9ec0ff';
    if (projectCreationFields) {
      projectCreationFields.style.display = '';
    }
    if (projectCreationActionRow) {
      projectCreationActionRow.style.display = '';
    }
    if (projectFolderCardsSlot) {
      projectFolderCardsSlot.hidden = true;
    }
    if (projectFolderUploadRow) {
      projectFolderUploadRow.hidden = true;
    }
    resetFolderCardState();
    currentCreatedProject = null;
    generateNewDatasetButton.disabled = true;
  }
});

// Helper function to update Create Project button enabled state
const updateCreateProjectButtonState = () => {
  const hasName = (newProjectName?.value?.trim() || '') !== '';
  generateNewDatasetButton.disabled = !hasName;
};

newProjectName?.addEventListener('input', () => {
  updateCreateProjectButtonState();
});

generateNewDatasetButton?.addEventListener('click', async () => {
  if (projectCreationInProgress) {
    return;
  }
  const projectName = newProjectName?.value?.trim();

  if (!projectName) {
    projectCreationHint.textContent = 'Project name is required';
    projectCreationHint.style.color = '#ffaaaa';
    return;
  }

  projectCreationInProgress = true;
  generateNewDatasetButton.disabled = true;
  projectCreationHint.textContent = 'Creating project folders...';
  projectCreationHint.style.color = '#9ec0ff';

  try {
    if (!window.desktopApp?.createProjectFolders) {
      throw new Error('Create project folders API is not available');
    }

    const createFoldersTimeoutMs = 20000;
    const result = await Promise.race([
      window.desktopApp.createProjectFolders(projectName),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timed out while creating project folders.'));
        }, createFoldersTimeoutMs);
      }),
    ]);
    
    if (result?.success) {
      addLog(`Project folders created successfully for "${projectName}"`, 'info');
      currentCreatedProject = {
        projectName: projectName,
        projectType: result.projectType,
        sourceDocsPath: result.sourceDocsPath,
        foundationSourceDocsPath: result.foundationSourceDocsPath,
        reinforcementSourceDocsPath: result.reinforcementSourceDocsPath,
        exportFilesPath: result.exportFilesPath,
        rootPath: result.rootPath,
      };
      currentProjectEnvironment = { ...currentCreatedProject };
      lastCurriculumProjectRoot = '';
      projectCurriculumEntries = [];
      selectedCurriculumFolderPath = '';

      setTopCreateProjectLabel(projectName);

      projectCreationHint.textContent = `Project "${projectName}" created.`;
      projectCreationHint.style.color = '#7dffb3';

      if (projectCreationPanel) {
        projectCreationPanel.setAttribute('hidden', '');
      }
      projectEnvironmentController?.switchToEnvironmentWorkspace?.(projectName);
      setTaskMode('generate');
      refreshProjectCurriculumBrowser();
    } else {
      throw new Error(result?.error || 'Failed to create project folders');
    }
  } catch (error) {
    projectCreationHint.textContent = `Error: ${error.message}`;
    projectCreationHint.style.color = '#ffaaaa';
    addLog(`Project creation error: ${error.message}`, 'error');
  } finally {
    projectCreationInProgress = false;
    updateCreateProjectButtonState();
  }
});

// ── Folder-card helpers ──────────────────────────────────────────────────────

const FOLDER_CARD_KEYS = ['foundational', 'adapters', 'export'];

const getFolderCardBasePath = (key) => {
  if (!currentCreatedProject) return '';
  if (key === 'foundational') return currentCreatedProject.foundationSourceDocsPath || '';
  if (key === 'adapters')     return currentCreatedProject.reinforcementSourceDocsPath || '';
  if (key === 'export')       return currentCreatedProject.exportFilesPath || '';
  return '';
};

const getFolderCardStage = (key) => {
  if (key === 'foundational') return 'foundation';
  if (key === 'adapters')     return 'reinforcement';
  if (key === 'export')       return 'export';
  return '';
};

const getFolderCardTitle = (key) => {
  if (key === 'foundational') return 'Foundational';
  if (key === 'adapters')     return 'Adapters';
  if (key === 'export')       return 'Export';
  return key;
};

const setProjectBusyState = (isBusy, message = 'Working...') => {
  projectWriteInProgress = Boolean(isBusy);
  if (projectBusyMessage) {
    projectBusyMessage.textContent = message;
  }
  if (projectBusyOverlay) {
    if (projectWriteInProgress) {
      projectBusyOverlay.removeAttribute('hidden');
    } else {
      projectBusyOverlay.setAttribute('hidden', '');
    }
  }
};

const getFolderCardKeyForEntry = (entry) => {
  const normalizePath = (value) => `${value || ''}`.trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
  const entryPath = normalizePath(entry?.path);
  const activeProjectEnvironment = getActiveProjectEnvironment();
  const foundationalPath = normalizePath(activeProjectEnvironment?.foundationSourceDocsPath);
  const adaptersPath = normalizePath(activeProjectEnvironment?.reinforcementSourceDocsPath);
  const exportPath = normalizePath(activeProjectEnvironment?.exportFilesPath);

  if (entryPath && foundationalPath && entryPath === foundationalPath) return 'foundational';
  if (entryPath && adaptersPath && entryPath === adaptersPath) return 'adapters';
  if (entryPath && exportPath && entryPath === exportPath) return 'export';

  const normalized = `${entry?.name || ''}`.trim().toLowerCase();
  if (normalized === 'foundational data') return 'foundational';
  if (normalized === 'adapter data') return 'adapters';
  if (normalized === 'export files') return 'export';
  return '';
};

const getSubfolderListEl = (key) => {
  if (key === 'foundational') return foundationalSubfolderList;
  if (key === 'adapters')     return adaptersSubfolderList;
  if (key === 'export')       return exportSubfolderList;
  return null;
};

const renderFolderCardSubfolders = (key) => {
  const listEl = getSubfolderListEl(key);
  if (!listEl) return;
  const entries = folderCardSubfolders[key] || [];
  listEl.innerHTML = '';
  entries.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'project-subfolder-item';
    li.textContent = name;
    listEl.appendChild(li);
  });
};

const openFolderNamePrompt = (request) => {
  pendingFolderPromptRequest = request || null;
  const key = pendingFolderPromptRequest?.key || '';
  if (folderNamePromptTitle) {
    folderNamePromptTitle.textContent = pendingFolderPromptRequest?.title || `Add subfolder to ${getFolderCardTitle(key)}`;
  }
  if (folderNamePromptInput) {
    folderNamePromptInput.value = '';
  }
  if (folderNamePromptContinueButton) {
    folderNamePromptContinueButton.disabled = true;
  }
  if (folderNamePromptModal) {
    folderNamePromptModal.hidden = false;
    folderNamePromptInput?.focus();
  }
};

const closeFolderNamePrompt = () => {
  pendingFolderPromptRequest = null;
  if (folderNamePromptModal) {
    folderNamePromptModal.hidden = true;
  }
  if (folderNamePromptInput) {
    folderNamePromptInput.value = '';
  }
};

const resetFolderCardState = () => {
  FOLDER_CARD_KEYS.forEach((key) => {
    folderCardSubfolders[key] = [];
    renderFolderCardSubfolders(key);
  });
  closeFolderNamePrompt();
};

const confirmFolderNamePrompt = async () => {
  const request = pendingFolderPromptRequest;
  const key = request?.key || '';
  const label = (folderNamePromptInput?.value || '').trim();
  if (!label) return;

  const isSaveFilesAction = request?.action === 'save-files';
  if (!isSaveFilesAction && !key) {
    addLog('Target folder type is missing for this action.', 'warning');
    return;
  }

  const activeProjectEnvironment = getActiveProjectEnvironment();

  if (!activeProjectEnvironment?.rootPath) {
    addLog('No active project. Create a project first.', 'warning');
    closeFolderNamePrompt();
    return;
  }

  closeFolderNamePrompt();
  setProjectBusyState(true, `Creating "${label}" folder...`);
  try {
    if (request?.action === 'save-files') {
      if (!window.desktopApp?.ingestDroppedProjectEntries) {
        throw new Error('Project drop ingestion API is not available.');
      }

      const filePaths = Array.isArray(request.filePaths) ? request.filePaths : [];
      const importResult = await window.desktopApp.ingestDroppedProjectEntries({
        entryPaths: filePaths,
        targetFolder: request.targetFolder || '',
        subfolderName: label,
      });
      if (!importResult?.success) {
        throw new Error(importResult?.error || 'Failed to import dropped files');
      }

      const copiedCount = Array.isArray(importResult.copied) ? importResult.copied.length : 0;
      await loadProjectCurriculumOverview(true);
      const destinationLabel = request?.folderLabel || getFolderCardTitle(key) || 'Folder';
      addLog(
        `Copied ${copiedCount} source document${copiedCount === 1 ? '' : 's'} into ${destinationLabel} / ${label}.`,
        'info'
      );
      return;
    }

    if (!window.desktopApp?.createProjectSourceSubfolder) {
      throw new Error('Create source subfolder API is not available.');
    }

    const result = await window.desktopApp.createProjectSourceSubfolder({
      label,
      stage: getFolderCardStage(key),
      foundationSourceDocsPath: activeProjectEnvironment.foundationSourceDocsPath || '',
      reinforcementSourceDocsPath: activeProjectEnvironment.reinforcementSourceDocsPath || '',
      exportFilesPath: activeProjectEnvironment.exportFilesPath || '',
    });
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to create subfolder');
    }

    folderCardSubfolders[key] = [...(folderCardSubfolders[key] || []), label];
    renderFolderCardSubfolders(key);
    addLog(`Created subfolder "${label}" in ${getFolderCardTitle(key)}.`, 'info');
  } catch (error) {
    addLog(`Create subfolder failed: ${error.message}`, 'error');
  } finally {
    setProjectBusyState(false);
  }
};

const handleCurriculumFolderDrop = async (entry, event) => {
  if (projectWriteInProgress) {
    addLog('Project folder import already in progress. Please wait.', 'warning');
    return;
  }

  const droppedPaths = getDroppedPathsFromEvent(event);
  if (droppedPaths.length === 0) {
    addLog('No files were detected in the drop payload.', 'warning');
    return;
  }

  if (!window.desktopApp?.ingestDroppedProjectEntries) {
    addLog('Project drop ingestion API is not available.', 'error');
    return;
  }

  const probe = await window.desktopApp.ingestDroppedProjectEntries({
    entryPaths: droppedPaths,
    targetFolder: entry.path,
    allowAutoGroupFiles: true,
  });

  if (probe?.success) {
    const copiedCount = Array.isArray(probe.copied) ? probe.copied.length : 0;

    // If directories were copied and the dropped files also need a subfolder name —
    // refresh the tree first so the already-copied folders appear, then prompt.
    if (probe.requiresSubfolderNameForFiles && Array.isArray(probe.pendingFilePaths) && probe.pendingFilePaths.length > 0) {
      await loadProjectCurriculumOverview(true);
      if (copiedCount > 0) {
        addLog(`Copied ${copiedCount} file${copiedCount === 1 ? '' : 's'} from dropped folders. Now name a subfolder for the remaining files.`, 'info');
      }
      const folderKey = getFolderCardKeyForEntry(entry);
      const safeFolderKey = folderKey || 'foundational';
      const folderLabel = `${entry?.name || getFolderCardTitle(safeFolderKey) || 'Folder'}`.trim();
      openFolderNamePrompt({
        action: 'save-files',
        key: safeFolderKey,
        folderLabel,
        filePaths: probe.pendingFilePaths,
        targetFolder: entry.path,
        title: probe.pendingFilePaths.length === 1
          ? `Name the new folder for this file in ${folderLabel}`
          : `Name the new folder for these ${probe.pendingFilePaths.length} files in ${folderLabel}`,
      });
      return;
    }

    await loadProjectCurriculumOverview(true);
    addLog(
      `Copied ${copiedCount} source document${copiedCount === 1 ? '' : 's'} into ${entry?.name || 'project folder'}.`,
      'info'
    );
    return;
  }

  if (!probe?.requiresSubfolderName) {
    addLog(`Project drop ingestion failed: ${probe?.error || 'Unknown error'}`, 'error');
    return;
  }

  const fileOnlyPaths = Array.isArray(probe.entryPaths) && probe.entryPaths.length > 0
    ? probe.entryPaths
    : [...droppedPaths];

  const folderKey = getFolderCardKeyForEntry(entry);
  const safeFolderKey = folderKey || 'foundational';
  const folderLabel = `${entry?.name || getFolderCardTitle(safeFolderKey) || 'Folder'}`.trim();

  openFolderNamePrompt({
    action: 'save-files',
    key: safeFolderKey,
    folderLabel,
    filePaths: fileOnlyPaths,
    targetFolder: entry.path,
    title: fileOnlyPaths.length === 1
      ? `Name the new folder for this file in ${folderLabel}`
      : `Name the new folder for these files in ${folderLabel}`,
  });
};

// ── Folder-card event handlers ───────────────────────────────────────────────

folderNamePromptInput?.addEventListener('input', () => {
  const hasValue = (folderNamePromptInput.value || '').trim() !== '';
  if (folderNamePromptContinueButton) {
    folderNamePromptContinueButton.disabled = !hasValue;
  }
});

folderNamePromptInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const hasValue = (folderNamePromptInput.value || '').trim() !== '';
    if (hasValue) void confirmFolderNamePrompt();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    closeFolderNamePrompt();
  }
});

folderNamePromptContinueButton?.addEventListener('click', () => {
  void confirmFolderNamePrompt();
});

folderNamePromptCancelButton?.addEventListener('click', () => {
  closeFolderNamePrompt();
});

const attachFolderCardDropHandlers = (dropEl, key) => {
  if (!dropEl) return;
  dropEl.addEventListener('dragover', (e) => {
    if (projectWriteInProgress) return;
    e.preventDefault();
    dropEl.setAttribute('data-dragging', 'true');
  });
  dropEl.addEventListener('dragleave', () => {
    dropEl.removeAttribute('data-dragging');
  });
  dropEl.addEventListener('drop', (e) => {
    if (projectWriteInProgress) return;
    e.preventDefault();
    dropEl.removeAttribute('data-dragging');
    openFolderNamePrompt({ key });
  });
};

attachFolderCardDropHandlers(dropFoundational, 'foundational');
attachFolderCardDropHandlers(dropAdapters, 'adapters');
attachFolderCardDropHandlers(dropExport, 'export');

projectUploadFilesButton?.addEventListener('click', async () => {
  if (projectWriteInProgress) return;
  if (!window.desktopApp?.selectSourceEntries) {
    addLog('Source selection dialog is not available.', 'error');
    return;
  }
  const selectedEntries = await window.desktopApp.selectSourceEntries();
  if (!Array.isArray(selectedEntries) || selectedEntries.length === 0) return;
  addLog(`Selected ${selectedEntries.length} entr${selectedEntries.length === 1 ? 'y' : 'ies'} for upload. Use the folder cards to assign them.`, 'info');
});

exportSourceFolderButton?.addEventListener('click', async () => {
  const selectedPath = await window.desktopApp?.selectFolder?.();
  if (!selectedPath) {
    return;
  }

  exportSourceFolderInput.value = selectedPath;
  addLog(`Export scan folder selected: ${selectedPath}`, 'info');
  await persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

outputPrefixInput?.addEventListener('change', () => {
  if (outputPrefixInput.value.trim() !== '') {
    lastUsedOutputPrefix = outputPrefixInput.value.trim();
  }
  void persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

outputPrefixInput?.addEventListener('blur', () => {
  if (outputPrefixInput.value.trim() !== '') {
    lastUsedOutputPrefix = outputPrefixInput.value.trim();
  }
  void persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

projectNameInput?.addEventListener('change', () => {
  void persistSettings();
  renderProjectWorkspace();
});

projectNameInput?.addEventListener('blur', () => {
  void persistSettings();
  renderProjectWorkspace();
});

datasetNameInput?.addEventListener('change', () => {
  lastUsedDatasetName = datasetNameInput.value.trim();
  void persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

datasetNameInput?.addEventListener('blur', () => {
  lastUsedDatasetName = datasetNameInput.value.trim();
  void persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

repairFastModeInput?.addEventListener('change', () => {
  lastUsedRepairFastMode = Boolean(repairFastModeInput.checked);
  void persistSettings();
  refreshGenerateState();
});

Object.values(checkboxIds).forEach((id) => {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }
  input.addEventListener('change', () => {
    enforceOutputDependencies();
    void persistSettings();
    refreshGenerateState();
  });
});

clearLogButton?.addEventListener('click', () => {
  if (!logWindow) {
    return;
  }
  logWindow.innerHTML = '';
  addLog('Log cleared.');
});

const workflowStateProxy = {
  get apiAvailable() { return apiAvailable; },
  get apiProviderCount() { return apiProviderCount; },
  get apiProviders() { return apiProviders; },
  get selectedFiles() { return selectedFiles; },
  get outputBadgesByKey() { return outputBadgesByKey; },
  get repairInspection() { return repairInspection; },
  get lastUsedDatasetName() { return lastUsedDatasetName; },
  get lastUsedOutputFolder() { return lastUsedOutputFolder; },
  setLastUsedOutputPrefix(value) { lastUsedOutputPrefix = `${value || ''}`; },
  get generationInProgress() { return generationInProgress; },
  set generationInProgress(value) { generationInProgress = Boolean(value); },
  get generationCancelRequested() { return generationCancelRequested; },
  set generationCancelRequested(value) { generationCancelRequested = Boolean(value); },
  get repairInProgress() { return repairInProgress; },
  set repairInProgress(value) { repairInProgress = Boolean(value); },
  get exportInProgress() { return exportInProgress; },
  set exportInProgress(value) { exportInProgress = Boolean(value); },
};

const workflowActionsController = typeof createWorkflowActionsController === 'function'
  ? createWorkflowActionsController({
      dom: {
        repairButton,
        exportButton,
        generateButton,
        cancelButton,
        repairFastModeInput,
        exportSourceFolderInput,
        outputFolderInput,
        datasetNameInput,
        outputPrefixInput,
      },
      state: workflowStateProxy,
      helpers: {
        addLog,
        refreshRepairState,
        refreshGenerateState,
        showWarningPopup,
        inspectSelectedRepairArtifact,
        resetRepairOutputState,
        setRepairBuildState,
        applyRepairProgressUpdate,
        getBaseName,
        normalizeDatasetName,
        isSameOrNestedPath,
        setTaskMode,
        persistSettings,
        setConversionStatus,
        buildRunOutputFolderName,
        joinPath,
        buildDocumentIdPrefix,
        getSelectedOutputs,
        getOutputFileNames,
        clearPrimaryPdf,
        resetDocumentOutputState,
        setSelectedOutputsRunning,
        setOutputReadyState,
        setOutputBuildState,
        updateOutputProviderIndicators,
        buildCombinedGuidance,
        markRunningOutputsAsError,
        getQualityDecision,
        buildRedoGuidanceFromAudit,
        hideQualityResultsModal,
      },
    })
  : null;

workflowActionsController?.bindExecutionHandlers?.();

const bootstrapRendererApp = async () => {
  try {
    refreshGenerateState();
  } catch (error) {
    console.error('Startup refreshGenerateState failed:', error);
    addBootstrapLog(`Startup warning: refresh state failed (${error?.message || 'unknown error'}).`);
  }

  try {
    resetDocumentOutputState();
  } catch (error) {
    console.error('Startup resetDocumentOutputState failed:', error);
    addBootstrapLog(`Startup warning: reset output state failed (${error?.message || 'unknown error'}).`);
  }

  try {
    renderProjectWorkspace();
  } catch (error) {
    console.error('Startup renderProjectWorkspace failed:', error);
    addBootstrapLog(`Startup warning: project workspace render failed (${error?.message || 'unknown error'}).`);
  }

  try {
    await refreshApiAvailability();
  } catch (error) {
    console.error('Startup refreshApiAvailability failed:', error);
    addBootstrapLog(`Startup warning: provider connection check failed (${error?.message || 'unknown error'}).`);
  }

  try {
    await loadSavedSettings();
  } catch (error) {
    console.error('Startup loadSavedSettings failed:', error);
    addBootstrapLog(`Startup warning: settings load failed (${error?.message || 'unknown error'}).`);
  }
};

void bootstrapRendererApp();
