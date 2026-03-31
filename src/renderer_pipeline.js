const card = document.querySelector('[data-file-card]');
const requiredCards = document.querySelectorAll('[data-file-card][data-required="true"]');
const generateButton = document.getElementById('generateButton');
const cancelButton = document.getElementById('cancelButton');
const repairButton = document.getElementById('repairButton');
const exportButton = document.getElementById('exportButton');
const generateHint = document.getElementById('generateHint');
const repairHint = document.getElementById('repairHint');
const repairFastModeInput = document.getElementById('repairFastMode');
const exportHint = document.getElementById('exportHint');
const sharedOutputSubtitle = document.getElementById('sharedOutputSubtitle');
const logWindow = document.getElementById('logWindow');
const clearLogButton = document.getElementById('clearLogButton');
const modeButtons = document.querySelectorAll('[data-mode-trigger]');
const modePanels = document.querySelectorAll('[data-mode-panel]');
const projectCurriculumPanel = document.getElementById('projectCurriculumPanel');
const projectCurriculumTitle = document.getElementById('projectCurriculumTitle');
const projectCurriculumSubtitle = document.getElementById('projectCurriculumSubtitle');
const curriculumFoldersList = document.getElementById('curriculumFoldersList');
const curriculumDocumentsList = document.getElementById('curriculumDocumentsList');

const outputFolderInput = document.getElementById('outputFolder');
const outputFolderButton = document.querySelector('[data-select-folder="outputFolder"]');
const datasetNameInput = document.getElementById('datasetName');
const outputPrefixInput = document.getElementById('outputPrefix');
const projectSelect = document.getElementById('projectSelect');
const projectNameInput = document.getElementById('projectName');
const projectStatus = document.getElementById('projectStatus');
const newProjectButton = document.getElementById('newProjectButton');
const saveProjectButton = document.getElementById('saveProjectButton');
const deleteProjectButton = document.getElementById('deleteProjectButton');
const topCreateProjectButton = document.getElementById('topCreateProjectButton');
const topOpenProjectButton = document.getElementById('topOpenProjectButton');
const projectCreationPanel = document.getElementById('projectCreationPanel');
const newProjectName = document.getElementById('newProjectName');
const newProjectType = document.getElementById('newProjectType');
const slmFoundationCell = document.getElementById('slmFoundationCell');
const slmFoundationLabel = document.getElementById('slmFoundationLabel');
const slmReinforcementCell = document.getElementById('slmReinforcementCell');
const slmReinforcementLabel = document.getElementById('slmReinforcementLabel');
const newProjectFolder = document.getElementById('newProjectFolder');
const selectNewProjectFolderButton = document.getElementById('selectNewProjectFolderButton');
const generateNewDatasetButton = document.getElementById('generateNewDatasetButton');
const projectCreationHint = document.getElementById('projectCreationHint');
const projectCreationFields = document.getElementById('projectCreationFields');
const projectCreationActionRow = document.getElementById('projectCreationActionRow');
const sourceDocumentsSlot = document.getElementById('sourceDocumentsSlot');
const sourceDocumentsCard = document.getElementById('sourceDocumentsCard');
const targetFoundationCheckbox = document.getElementById('targetFoundationCheckbox');
const targetReinforcementCheckbox = document.getElementById('targetReinforcementCheckbox');
const targetStageStatus = document.getElementById('targetStageStatus');
const applySourceDocumentsButton = document.getElementById('applySourceDocumentsButton');
const postUploadModal = document.getElementById('postUploadModal');
const postUploadYesButton = document.getElementById('postUploadYesButton');
const postUploadNoButton = document.getElementById('postUploadNoButton');
const postUploadExpanded = document.getElementById('postUploadExpanded');
const newStageFolderLabel = document.getElementById('newStageFolderLabel');
const newStageFolderType = document.getElementById('newStageFolderType');
const createNewStageFolderButton = document.getElementById('createNewStageFolderButton');
const projectBusyOverlay = document.getElementById('projectBusyOverlay');
const projectBusyMessage = document.getElementById('projectBusyMessage');
const uploadedFilesList = document.getElementById('uploadedFilesList');
const uploadedFileCount = document.getElementById('uploadedFileCount');
const projectLoaderPanel = document.getElementById('projectLoaderPanel');
const closeProjectLoaderButton = document.getElementById('closeProjectLoaderButton');
const cachedProjectsList = document.getElementById('cachedProjectsList');
const projectDetailsPanel = document.getElementById('projectDetailsPanel');
const backToCachedListButton = document.getElementById('backToCachedListButton');
const closeProjectDetailsButton = document.getElementById('closeProjectDetailsButton');
const projectDetailsTitle = document.getElementById('projectDetailsTitle');
const projectDetailsType = document.getElementById('projectDetailsType');
const projectDetailsPath = document.getElementById('projectDetailsPath');
const projectDetailsCreated = document.getElementById('projectDetailsCreated');
const projectDocumentsList = document.getElementById('projectDocumentsList');
const openProjectFolderButton = document.getElementById('openProjectFolderButton');
const removeProjectCacheButton = document.getElementById('removeProjectCacheButton');
const datasetNameCell = document.querySelector('[data-dataset-name-cell]');
const commonPrefixCell = document.querySelector('[data-common-prefix-cell]');
const exportSourceFolderInput = document.getElementById('exportSourceFolder');
const exportSourceFolderButton = document.getElementById('exportSourceFolderButton');
const pdfDropTextEl = document.getElementById('pdfDropText');
const legacyCard = document.querySelector('[data-legacy-card]');
const repairCards = document.querySelectorAll('[data-repair-card]');
const defaultPdfDropText = 'Drop the source PDF document to extract the structured chapter JSON.';

const checkboxIds = {
  docJson: 'optDocJson',
  summary: 'optSummaryMd',
  questions: 'optQuestionsJson',
  deterministicPairs: 'optDeterministicPairsJson',
  conversationalPairs: 'optConversationalPairsJson',
};

const apiDependentOutputs = ['docJson', 'summary', 'questions', 'deterministicPairs', 'conversationalPairs'];
const conversionStatusEl = document.getElementById('conversionStatus');
const documentReadyBadge = document.getElementById('documentReadyBadge');
const summaryReadyBadge = document.getElementById('summaryReadyBadge');
const questionReadyBadge = document.getElementById('questionReadyBadge');
const deterministicPairsReadyBadge = document.getElementById('deterministicPairsReadyBadge');
const conversationalPairsReadyBadge = document.getElementById('conversationalPairsReadyBadge');
const documentOutputCard = document.querySelector('[data-document-card]');
const repairStatusCard = document.querySelector('[data-repair-status-card]');
const openAiStatusButton = document.getElementById('openAiStatusButton');
const anthropicStatusButton = document.getElementById('anthropicStatusButton');
const geminiStatusButton = document.getElementById('geminiStatusButton');
const summaryProviderIndicators = document.getElementById('summaryProviderIndicators');
const questionsProviderIndicators = document.getElementById('questionsProviderIndicators');
const conversationalProviderIndicators = document.getElementById('conversationalProviderIndicators');
const repairQuestionsBadge = document.getElementById('repairQuestionsBadge');
const repairConversationalBadge = document.getElementById('repairConversationalBadge');
const repairQuestionsProviderIndicators = document.getElementById('repairQuestionsProviderIndicators');
const repairConversationalProviderIndicators = document.getElementById('repairConversationalProviderIndicators');
const repairSourceFileName = document.getElementById('repairSourceFileName');
const repairTargetFileName = document.getElementById('repairTargetFileName');
const repairAnalysis = document.getElementById('repairAnalysis');
const repairAnalysisSummary = document.getElementById('repairAnalysisSummary');
const repairAnalysisDetails = document.getElementById('repairAnalysisDetails');

const qualityResultsModal = document.getElementById('qualityResultsModal');
const qualityRatingDisplay = document.getElementById('qualityRatingDisplay');
const qualityExplanation = document.getElementById('qualityExplanation');
const errorCountEl = document.getElementById('errorCount');
const warningCountEl = document.getElementById('warningCount');
const weightedPercentEl = document.getElementById('weightedPercent');
const issuesSummary = document.getElementById('issuesSummary');
const qualityActionsContainer = document.getElementById('qualityActionsContainer');

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
let currentProjectCreationDestination = '';
let uploadedSourceDocuments = [];
let currentCreatedProject = null;
let lockedUploadStage = '';
let lockedUploadTargetFolder = '';
let projectWriteInProgress = false;
let currentLoadedProject = null;
let cachedProjectData = null;
let currentProjectEnvironment = null;
let projectCurriculumEntries = [];
let selectedCurriculumFolderPath = '';
let lastCurriculumProjectRoot = '';
const acceptedDocumentTypes = ['.pdf', '.json', '.md', '.txt', '.doc', '.docx'];
const topCreateProjectDefaultLabel = topCreateProjectButton?.querySelector('.nav-button-label')?.textContent || 'Create New Project';
const projectCreationTitleEl = document.querySelector('#projectCreationPanel .project-creation-header h2');
const defaultProjectCreationTitle = projectCreationTitleEl?.textContent || 'Create New Project';

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
    await applyApiOutputAvailability({ available: false, providers: [] });
  }
};

const ensureJsonExtension = (fileName, fallback) => {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
};

const ensureMarkdownExtension = (fileName, fallback) => {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
};

const normalizeDatasetName = (value) => {
  const raw = `${value || ''}`.trim();
  return raw
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const normalizePathForCompare = (value) => `${value || ''}`
  .trim()
  .replace(/\\+/g, '/')
  .replace(/\/+$/g, '')
  .toLowerCase();

const NO_FOLDER_SELECTED_LABEL = 'No folder selected';

const readFolderInputValue = (input) => {
  const raw = `${input?.value || ''}`.trim();
  return raw && raw !== NO_FOLDER_SELECTED_LABEL ? raw : '';
};

const writeFolderInputValue = (input, value) => {
  if (!input) {
    return;
  }
  input.value = `${value || ''}`.trim() || NO_FOLDER_SELECTED_LABEL;
};

const normalizeProjectName = (value) => `${value || ''}`.trim();

const makeProjectId = () => `project_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

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
  if (!projectSelect || !projectNameInput || !projectStatus) {
    return;
  }

  const previousValue = `${projectSelect.value || ''}`;
  projectSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'No saved project selected';
  projectSelect.appendChild(placeholder);

  savedProjects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });

  const active = getActiveProject();
  const selectedValue = active?.id || previousValue;
  projectSelect.value = savedProjects.some((project) => project.id === selectedValue) ? selectedValue : '';

  if (active) {
    projectNameInput.value = active.name;
    const folderLabel = getBaseName(active.outputFolder.replace(/[\\/]+$/g, '')) || 'no output folder';
    projectStatus.textContent = `Active project: ${active.name} (output: ${folderLabel}).`;
  } else if (savedProjects.length > 0) {
    projectStatus.textContent = `Saved projects: ${savedProjects.length}. Select one to load its workspace defaults.`;
  } else {
    projectStatus.textContent = 'No saved projects yet. Set folders once, then save them as a project.';
    projectNameInput.value = '';
  }

  if (deleteProjectButton) {
    deleteProjectButton.disabled = !active;
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

const isSameOrNestedPath = (candidatePath, basePath) => {
  const candidate = normalizePathForCompare(candidatePath);
  const base = normalizePathForCompare(basePath);
  if (!candidate || !base) {
    return false;
  }
  return candidate === base || candidate.startsWith(`${base}/`);
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

const joinPath = (basePath, childName) => {
  const safeBase = `${basePath || ''}`.trim().replace(/[\\/]+$/g, '');
  if (!safeBase) {
    return childName;
  }
  return `${safeBase}\\${childName}`;
};

const getBaseName = (fullPath) => {
  if (typeof fullPath !== 'string') {
    return '';
  }
  const normalized = fullPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || fullPath;
};

const isJsonFileName = (fileName) => `${fileName || ''}`.trim().toLowerCase().endsWith('.json');

const parseDroppedPath = (rawValue) => {
  const value = `${rawValue || ''}`.trim();
  if (!value) {
    return '';
  }

  const firstLine = value.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean) || '';
  if (!firstLine) {
    return '';
  }

  if (/^file:\/\//i.test(firstLine)) {
    try {
      const url = new URL(firstLine);
      return decodeURIComponent(url.pathname || '').replace(/^\/+([A-Za-z]:)/, '$1');
    } catch (_) {
      return firstLine.replace(/^file:\/\//i, '').replace(/^\/+([A-Za-z]:)/, '$1');
    }
  }

  return firstLine;
};

const inferRepairArtifactTypeFromName = (fileName) => {
  const lowerName = `${fileName || ''}`.trim().toLowerCase();
  if (!lowerName) {
    return '';
  }
  if (lowerName.includes('conversational') || lowerName.includes('conversation')) {
    return 'conversationalPairs';
  }
  if (lowerName.includes('question')) {
    return 'questions';
  }
  return '';
};

const formatRepairSectionList = (sections = [], maxItems = 5) => {
  const list = (Array.isArray(sections) ? sections : [])
    .map((entry) => `${entry?.sectionId || ''}`.trim())
    .filter(Boolean);
  if (!list.length) {
    return '';
  }
  if (list.length <= maxItems) {
    return list.join(', ');
  }
  return `${list.slice(0, maxItems).join(', ')}, +${list.length - maxItems} more`;
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

const renderCurriculumDocuments = (folderPath = '') => {
  if (!curriculumDocumentsList) {
    return;
  }

  const selectedEntry = projectCurriculumEntries.find((entry) => entry.path === folderPath) || null;
  if (!selectedEntry) {
    curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">Select a curriculum folder to view source documents.</p>';
    return;
  }

  const documents = Array.isArray(selectedEntry.documents) ? selectedEntry.documents : [];
  if (documents.length === 0) {
    curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">No supported source documents found in this folder.</p>';
    return;
  }

  curriculumDocumentsList.innerHTML = '';
  documents.forEach((documentEntry) => {
    const item = document.createElement('div');
    item.className = 'curriculum-document-item';
    const extensionLabel = `${documentEntry.extension || ''}`.replace('.', '').toUpperCase() || 'DOC';
    item.innerHTML = `
      <span class="curriculum-document-icon">${extensionLabel.slice(0, 3)}</span>
      <span class="curriculum-document-name">${documentEntry.relativePath || documentEntry.name || 'Document'}</span>
    `;
    curriculumDocumentsList.appendChild(item);
  });
};

const renderCurriculumFolders = () => {
  if (!curriculumFoldersList) {
    return;
  }

  if (projectCurriculumEntries.length === 0) {
    curriculumFoldersList.innerHTML = '<p class="curriculum-empty">No curriculum folders found for this project.</p>';
    renderCurriculumDocuments('');
    return;
  }

  curriculumFoldersList.innerHTML = '';
  projectCurriculumEntries.forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'curriculum-folder-item';
    button.dataset.selected = entry.path === selectedCurriculumFolderPath ? 'true' : 'false';
    button.innerHTML = `
      <span class="curriculum-folder-title">${entry.name}</span>
      <span class="curriculum-folder-meta">${Number(entry.documentCount || 0)} source document${Number(entry.documentCount || 0) === 1 ? '' : 's'}</span>
    `;
    button.addEventListener('click', () => {
      selectedCurriculumFolderPath = entry.path;
      renderCurriculumFolders();
      renderCurriculumDocuments(selectedCurriculumFolderPath);
    });
    curriculumFoldersList.appendChild(button);
  });

  renderCurriculumDocuments(selectedCurriculumFolderPath);
};

const loadProjectCurriculumOverview = async (forceRefresh = false) => {
  const activeProjectEnvironment = getActiveProjectEnvironment();
  const projectRoot = `${activeProjectEnvironment?.rootPath || ''}`.trim();
  if (!projectRoot || !window.desktopApp?.getProjectCurriculumOverview) {
    projectCurriculumEntries = [];
    selectedCurriculumFolderPath = '';
    renderCurriculumFolders();
    return;
  }

  if (!forceRefresh && projectRoot === lastCurriculumProjectRoot && projectCurriculumEntries.length > 0) {
    renderCurriculumFolders();
    return;
  }

  if (curriculumFoldersList) {
    curriculumFoldersList.innerHTML = '<p class="curriculum-empty">Loading curriculum folders...</p>';
  }
  if (curriculumDocumentsList) {
    curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">Select a curriculum folder to view source documents.</p>';
  }

  try {
    const result = await window.desktopApp.getProjectCurriculumOverview(projectRoot);
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to load curriculum folders');
    }
    projectCurriculumEntries = Array.isArray(result.entries) ? result.entries : [];
    selectedCurriculumFolderPath = projectCurriculumEntries[0]?.path || '';
    lastCurriculumProjectRoot = projectRoot;

    const projectName = activeProjectEnvironment?.projectName || 'Project';
    if (projectCurriculumTitle) {
      projectCurriculumTitle.textContent = `${projectName} curriculum`;
    }
    if (projectCurriculumSubtitle) {
      projectCurriculumSubtitle.textContent = 'Select a curriculum folder to inspect its source documents.';
    }

    renderCurriculumFolders();
  } catch (error) {
    projectCurriculumEntries = [];
    selectedCurriculumFolderPath = '';
    lastCurriculumProjectRoot = projectRoot;
    if (curriculumFoldersList) {
      curriculumFoldersList.innerHTML = '<p class="curriculum-empty">Could not load curriculum folders for this project.</p>';
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

const refreshTaskModeState = () => {
  modeButtons.forEach((button) => {
    const buttonMode = `${button?.dataset?.modeTrigger || ''}`.trim();
    button.setAttribute('aria-pressed', currentTaskMode === buttonMode ? 'true' : 'false');
    button.disabled = generationInProgress || repairInProgress || exportInProgress;
  });

  modePanels.forEach((panel) => {
    const panelMode = `${panel?.dataset?.modePanel || ''}`.trim();
    panel.hidden = currentTaskMode !== panelMode;
  });

  if (sharedOutputSubtitle) {
    const subtitles = {
      generate: 'Generate mode: choose destination folder and set Add output documents prefix for the next dataset run.',
      repair: 'Repair mode: only the destination folder remains visible here. File naming is ignored and the repaired file is overwritten in place.',
      export: 'Export mode: choose destination folder and set Name Dataset. Export uses that name for the export folder and bucket folders.',
      default: 'Choose a task to reveal only the output settings that matter for that workflow.',
    };
    sharedOutputSubtitle.textContent = subtitles[currentTaskMode] || subtitles.default;
  }

  const isGenerateMode = currentTaskMode === 'generate' || currentTaskMode === '';
  const isExplicitExportMode = currentTaskMode === 'export';
  if (commonPrefixCell) {
    commonPrefixCell.hidden = !isGenerateMode;
  }
  if (outputPrefixInput) {
    outputPrefixInput.disabled = !isGenerateMode;
  }
  if (datasetNameCell) {
    datasetNameCell.hidden = !isExplicitExportMode;
  }
  if (datasetNameInput) {
    datasetNameInput.disabled = !isExplicitExportMode;
  }

  refreshProjectCurriculumBrowser();
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
  if (!exportButton || !exportHint) {
    return;
  }

  const hasExportFolder = Boolean(exportSourceFolderInput?.value && exportSourceFolderInput.value !== 'No folder selected');
  const hasDestinationFolder = Boolean(outputFolderInput?.value && outputFolderInput.value !== 'No folder selected');
  const normalizedDatasetName = normalizeDatasetName(datasetNameInput?.value || lastUsedDatasetName);
  const hasDatasetName = Boolean(normalizedDatasetName);
  const ready = !generationInProgress && !repairInProgress && !exportInProgress && hasExportFolder && hasDestinationFolder && hasDatasetName;
  exportButton.disabled = !ready;
  exportButton.textContent = exportInProgress ? 'Exporting...' : 'Export Training Files';

  if (exportInProgress) {
    exportHint.textContent = 'Export in progress. Please wait.';
    return;
  }

  if (!hasExportFolder) {
    exportHint.textContent = 'Select a root folder that contains generated output folders to scan.';
    return;
  }

  if (!hasDestinationFolder) {
    exportHint.textContent = 'Select a destination folder where the export will be created (shared output folder setting above).';
    return;
  }

  if (!hasDatasetName) {
    exportHint.textContent = 'Set Name Dataset (Export only). It is used to name the export folder and subfolders.';
    return;
  }

  const destFolder = getBaseName(`${outputFolderInput?.value || ''}`.replace(/[\\/]+$/g, '')) || 'output';
  exportHint.textContent = `Ready to create ${normalizedDatasetName}_training_files inside ${destFolder} with ${normalizedDatasetName}_documents, ${normalizedDatasetName}_questions_training_pairs, and ${normalizedDatasetName}_conversational_training_pairs.`;
};

const refreshRepairState = () => {
  if (!repairButton || !repairHint) {
    return;
  }

  const hasSourceDocument = Boolean(selectedFiles.sourceDocumentJson?.path);
  const hasRepairArtifact = Boolean(selectedFiles.repairArtifactJson?.path);
  const inspectedReady = Boolean(
    repairInspection
    && repairInspection.success
    && repairInspection.canRepair
    && Number(repairInspection.incompleteSectionCount || 0) > 0
  );
  const ready = !generationInProgress
    && !repairInProgress
    && !exportInProgress
    && !repairInspectionLoading
    && apiAvailable
    && hasSourceDocument
    && hasRepairArtifact
    && inspectedReady;
  repairButton.disabled = !ready;
  repairButton.textContent = repairInProgress ? 'Repairing...' : 'Repair Partial Artifact';

  if (repairInProgress) {
    repairHint.textContent = 'Repair in progress. Please wait.';
    return;
  }

  if (!apiAvailable) {
    repairHint.textContent = 'API is required before repair can start.';
    return;
  }

  if (!hasSourceDocument || !hasRepairArtifact) {
    repairHint.textContent = 'Select the source document JSON and a partial questions or conversational pairs JSON.';
    return;
  }

  if (repairInspectionLoading) {
    repairHint.textContent = 'Reading repair metadata and required fixes...';
    return;
  }

  if (repairInspection && !repairInspection.success) {
    repairHint.textContent = `Repair metadata check failed: ${repairInspection.message || 'Unsupported or invalid metadata.'}`;
    return;
  }

  if (repairInspection && !repairInspection.canRepair) {
    const missingCount = Array.isArray(repairInspection.missingFromSource)
      ? repairInspection.missingFromSource.length
      : 0;
    if (missingCount > 0) {
      repairHint.textContent = `Repair blocked: ${missingCount} incomplete section(s) from metadata are missing in the selected source document JSON.`;
      return;
    }
    repairHint.textContent = 'No incomplete sections found in metadata. This artifact does not require repair.';
    return;
  }

  const detectedType = repairInspection?.artifactType || inferRepairArtifactTypeFromName(selectedFiles.repairArtifactJson?.name || '');
  repairHint.textContent = detectedType === 'conversationalPairs'
    ? 'Ready to resume incomplete conversational sections and overwrite the selected partial artifact.'
    : 'Ready to resume incomplete question sections and overwrite the selected partial artifact.';
};

const refreshGenerateState = () => {
  if (!generateButton || !generateHint) {
    return;
  }

  const appBusy = generationInProgress || repairInProgress || exportInProgress;
  const ready = !appBusy && getRequiredUploadsReady() && getDestinationsReady() && hasSelectedOutput();
  generateButton.disabled = !ready;
  generateButton.textContent = generationInProgress ? 'Generating...' : 'Generate';
  if (cancelButton) {
    cancelButton.disabled = !generationInProgress;
    cancelButton.textContent = generationCancelRequested ? 'Cancelling...' : 'Cancel';
  }

  if (generationInProgress) {
    generateHint.textContent = 'Generation in progress. Please wait.';
    refreshRepairState();
    return;
  }

  if (repairInProgress) {
    generateHint.textContent = 'Repair in progress. Please wait.';
    refreshRepairState();
    refreshExportState();
    refreshTaskModeState();
    return;
  }

  if (exportInProgress) {
    generateHint.textContent = 'Export in progress. Please wait.';
    refreshRepairState();
    refreshExportState();
    refreshTaskModeState();
    return;
  }

  if (!apiAvailable) {
    generateHint.textContent = ready
      ? 'API is required before generation can start.'
      : 'Set API credentials, then select PDF/output options.';
    refreshRepairState();
    refreshExportState();
    refreshTaskModeState();
    return;
  }

  generateHint.textContent = ready
    ? 'Ready to process PDF and generate selected outputs.'
    : 'Select the PDF, output folder, and at least one output type.';
  refreshRepairState();
  refreshExportState();
  refreshTaskModeState();
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

// ============================================================================
// PROJECT CREATION WORKFLOW EVENT HANDLERS
// ============================================================================

topCreateProjectButton?.addEventListener('click', () => {
  const activeLabel = `${topCreateProjectButton.querySelector('.nav-button-label')?.textContent || ''}`.trim();
  const isEnvironmentMode = activeLabel !== topCreateProjectDefaultLabel;

  if (isEnvironmentMode) {
    if (projectCreationPanel) {
      projectCreationPanel.setAttribute('hidden', '');
    }
    if (projectLoaderPanel) {
      projectLoaderPanel.setAttribute('hidden', '');
    }
    if (projectDetailsPanel) {
      projectDetailsPanel.setAttribute('hidden', '');
    }
    if (cachedProjectsList) {
      cachedProjectsList.removeAttribute('hidden');
    }

    const chooseTaskPanel = document.querySelector('.mode-panel');
    chooseTaskPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    addLog(`Switched to environment: ${activeLabel}`, 'info');
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
    if (newProjectType) {
      newProjectType.value = 'single-dataset';
    }
    if (slmFoundationLabel) {
      slmFoundationLabel.value = '';
    }
    if (slmReinforcementLabel) {
      slmReinforcementLabel.value = '';
    }
    if (slmFoundationCell) {
      slmFoundationCell.setAttribute('hidden', '');
    }
    if (slmReinforcementCell) {
      slmReinforcementCell.setAttribute('hidden', '');
    }
    newProjectFolder.value = '';
    currentProjectCreationDestination = '';
    projectCreationHint.textContent = 'Select project name, type, and destination folder to continue.';
    projectCreationHint.style.color = '#9ec0ff';
    if (projectCreationFields) {
      projectCreationFields.style.display = '';
    }
    if (projectCreationActionRow) {
      projectCreationActionRow.style.display = '';
    }
    if (sourceDocumentsSlot) {
      sourceDocumentsSlot.style.display = 'none';
    }
    if (targetFoundationCheckbox) {
      targetFoundationCheckbox.checked = false;
      targetFoundationCheckbox.disabled = false;
    }
    if (targetReinforcementCheckbox) {
      targetReinforcementCheckbox.checked = false;
      targetReinforcementCheckbox.disabled = false;
    }
    closePostUploadModal();
    unlockStageSelection();
    currentCreatedProject = null;
    uploadedSourceDocuments = [];
    refreshUploadedFilesList();
    generateNewDatasetButton.disabled = true;
  }
});

const formatProjectEnvironmentLabel = (projectType) => {
  const value = `${projectType || ''}`.trim();
  if (value === 'single-dataset') {
    return 'Single Dataset';
  }
  if (value === 'subject-dataset') {
    return 'Subject Dataset';
  }
  if (value === 'slm-training') {
    return 'SLM Training';
  }
  return 'Environment';
};

const setTopCreateProjectLabel = (projectName, projectType) => {
  const safeName = `${projectName || ''}`.trim();
  const projectLabel = safeName
    ? `${safeName} - ${formatProjectEnvironmentLabel(projectType)}`
    : topCreateProjectDefaultLabel;

  if (topCreateProjectButton) {
    const labelEl = topCreateProjectButton.querySelector('.nav-button-label');
    if (labelEl) {
      labelEl.textContent = projectLabel;
    }
  }

  if (projectCreationTitleEl) {
    projectCreationTitleEl.textContent = safeName
      ? projectLabel
      : defaultProjectCreationTitle;
  }

  if (!safeName) {
    return;
  }
};

const openSavedProjectEnvironment = async (project) => {
  if (!project) {
    return;
  }

  try {
    // Update last-access metadata when available.
    if (window.desktopApp?.loadCachedProject && project.rootPath) {
      await window.desktopApp.loadCachedProject(project.rootPath);
    }

    currentLoadedProject = project;
    currentCreatedProject = {
      projectName: project.projectName || '',
      projectType: project.projectType || '',
      rootPath: project.rootPath || '',
      foundationSourceDocsPath: project.foundationSourceDocsPath || '',
      reinforcementSourceDocsPath: project.reinforcementSourceDocsPath || '',
      sourceDocsPath: project.foundationSourceDocsPath || project.reinforcementSourceDocsPath || '',
    };
    currentProjectEnvironment = { ...currentCreatedProject };
    lastCurriculumProjectRoot = '';
    projectCurriculumEntries = [];
    selectedCurriculumFolderPath = '';

    setTopCreateProjectLabel(project.projectName, project.projectType);

    if (projectLoaderPanel) {
      projectLoaderPanel.setAttribute('hidden', '');
    }
    if (projectDetailsPanel) {
      projectDetailsPanel.setAttribute('hidden', '');
    }
    if (cachedProjectsList) {
      cachedProjectsList.removeAttribute('hidden');
    }
    if (projectCreationPanel) {
      projectCreationPanel.setAttribute('hidden', '');
    }

    const chooseTaskPanel = document.querySelector('.mode-panel');
    chooseTaskPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    refreshProjectCurriculumBrowser();
    addLog(`Opened project environment: ${project.projectName || 'Saved project'}`, 'info');
  } catch (error) {
    addLog(`Could not open project environment: ${error.message}`, 'error');
  }
};

topOpenProjectButton?.addEventListener('click', () => {
  if (projectLoaderPanel) {
    if (projectCreationPanel) {
      projectCreationPanel.setAttribute('hidden', '');
    }
    projectLoaderPanel.removeAttribute('hidden');
    loadCachedProjectsList();
    // Hide details panel, show projects list
    if (projectDetailsPanel) {
      projectDetailsPanel.setAttribute('hidden', '');
    }
    if (cachedProjectsList) {
      cachedProjectsList.removeAttribute('hidden');
    }
    projectLoaderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

closeProjectLoaderButton?.addEventListener('click', () => {
  if (projectLoaderPanel) {
    projectLoaderPanel.setAttribute('hidden', '');
  }
});

backToCachedListButton?.addEventListener('click', () => {
  if (projectDetailsPanel) {
    projectDetailsPanel.setAttribute('hidden', '');
  }
  if (cachedProjectsList) {
    cachedProjectsList.removeAttribute('hidden');
  }
  currentLoadedProject = null;
});

closeProjectDetailsButton?.addEventListener('click', () => {
  if (projectLoaderPanel) {
    projectLoaderPanel.setAttribute('hidden', '');
  }
  if (projectDetailsPanel) {
    projectDetailsPanel.setAttribute('hidden', '');
  }
  currentLoadedProject = null;
});

openProjectFolderButton?.addEventListener('click', async () => {
  if (!currentLoadedProject || !currentLoadedProject.rootPath) {
    addLog('No project selected', 'warning');
    return;
  }

  try {
    const result = await window.desktopApp.openFolder(currentLoadedProject.rootPath);
    if (result.success) {
      addLog(`Opened: ${currentLoadedProject.rootPath}`, 'info');
    } else {
      addLog(`Could not open folder: ${result.error}`, 'warning');
    }
  } catch (error) {
    console.error('Failed to open folder:', error);
    addLog(`Error: ${error.message}`, 'warning');
  }
});

removeProjectCacheButton?.addEventListener('click', async () => {
  if (!currentLoadedProject || !currentLoadedProject.rootPath) {
    addLog('No project to remove', 'warning');
    return;
  }

  try {
    const projectName = currentLoadedProject.projectName || 'Unnamed Project';
    const confirmed = await window.desktopApp.showConfirm({
      title: 'Remove from Cache',
      message: `Remove "${projectName}" from the project cache?`,
      detail: 'The project files will not be deleted, only removed from the saved projects list.',
    });

    if (!confirmed) {
      return;
    }

    const result = await window.desktopApp.removeCachedProject(currentLoadedProject.rootPath);
    if (result.success) {
      addLog(`Removed from cache: ${projectName}`, 'info');
      // Go back to projects list
      if (projectDetailsPanel) {
        projectDetailsPanel.setAttribute('hidden', '');
      }
      if (cachedProjectsList) {
        cachedProjectsList.removeAttribute('hidden');
      }
      currentLoadedProject = null;
      loadCachedProjectsList();
    } else {
      addLog(`Failed to remove project: ${result.error}`, 'warning');
    }
  } catch (error) {
    console.error('Error removing project:', error);
    addLog(`Error: ${error.message}`, 'warning');
  }
});

// Helper function to update Create Project button enabled state
const updateCreateProjectButtonState = () => {
  const hasName = (newProjectName?.value?.trim() || '') !== '';
  const hasFolder = (currentProjectCreationDestination?.trim() || '') !== '';
  const hasType = (newProjectType?.value || '').trim() !== '';
  const requiresReinforcementLabel = `${newProjectType?.value || ''}`.trim() === 'slm-training';
  const hasReinforcementLabel = (slmReinforcementLabel?.value?.trim() || '') !== '';
  generateNewDatasetButton.disabled = !(hasName && hasFolder && hasType && (!requiresReinforcementLabel || hasReinforcementLabel));
};

const updateProjectTypeSpecificFields = () => {
  const isSlmTraining = `${newProjectType?.value || ''}`.trim() === 'slm-training';
  if (!slmFoundationCell || !slmReinforcementCell) {
    return;
  }

  if (isSlmTraining) {
    slmFoundationCell.removeAttribute('hidden');
    slmReinforcementCell.removeAttribute('hidden');
  } else {
    slmFoundationCell.setAttribute('hidden', '');
    slmReinforcementCell.setAttribute('hidden', '');
    if (slmFoundationLabel) {
      slmFoundationLabel.value = '';
    }
    if (slmReinforcementLabel) {
      slmReinforcementLabel.value = '';
    }
  }
};

newProjectName?.addEventListener('input', () => {
  updateCreateProjectButtonState();
});

newProjectType?.addEventListener('change', () => {
  updateProjectTypeSpecificFields();
  updateCreateProjectButtonState();
});

slmReinforcementLabel?.addEventListener('input', () => {
  updateCreateProjectButtonState();
});

slmFoundationLabel?.addEventListener('input', () => {
  updateCreateProjectButtonState();
});

selectNewProjectFolderButton?.addEventListener('click', async () => {
  if (!window.desktopApp?.selectFolder) {
    addLog('Folder selection is not available', 'error');
    return;
  }

  const selectedPath = await window.desktopApp.selectFolder();
  if (selectedPath) {
    currentProjectCreationDestination = selectedPath;
    newProjectFolder.value = selectedPath;
    addLog(`Project folder selected: ${selectedPath}`, 'info');
    updateCreateProjectButtonState();
  }
});

generateNewDatasetButton?.addEventListener('click', async () => {
  if (projectWriteInProgress) {
    return;
  }
  const projectName = newProjectName?.value?.trim();
  const projectType = `${newProjectType?.value || ''}`.trim();
  const foundationLabel = `${slmFoundationLabel?.value || ''}`.trim();
  const reinforcementLabel = `${slmReinforcementLabel?.value || ''}`.trim();
  const destinationFolder = currentProjectCreationDestination?.trim();

  if (!projectName) {
    projectCreationHint.textContent = 'Project name is required';
    projectCreationHint.style.color = '#ffaaaa';
    return;
  }

  if (!destinationFolder) {
    projectCreationHint.textContent = 'Destination folder is required';
    projectCreationHint.style.color = '#ffaaaa';
    return;
  }

  if (!projectType) {
    projectCreationHint.textContent = 'Project type is required';
    projectCreationHint.style.color = '#ffaaaa';
    return;
  }

  if (projectType === 'slm-training' && !reinforcementLabel) {
    projectCreationHint.textContent = 'SLM reinforcement label is required';
    projectCreationHint.style.color = '#ffaaaa';
    return;
  }

  projectCreationInProgress = true;
  generateNewDatasetButton.disabled = true;
  projectCreationHint.textContent = 'Creating project folders...';
  projectCreationHint.style.color = '#9ec0ff';
  setProjectBusyState(true, 'Generating project structure...');

  try {
    if (!window.desktopApp?.createProjectFolders) {
      throw new Error('Create project folders API is not available');
    }

    const result = await window.desktopApp.createProjectFolders(projectName, destinationFolder, projectType, foundationLabel, reinforcementLabel);
    
    if (result?.success) {
      addLog(`Project folders created successfully for "${projectName}"`, 'info');
      currentCreatedProject = {
        projectName: projectName,
        projectType: result.projectType,
        sourceDocsPath: result.sourceDocsPath,
        foundationSourceDocsPath: result.foundationSourceDocsPath,
        reinforcementSourceDocsPath: result.reinforcementSourceDocsPath,
        rootPath: result.rootPath,
      };
      currentProjectEnvironment = { ...currentCreatedProject };
      lastCurriculumProjectRoot = '';
      projectCurriculumEntries = [];
      selectedCurriculumFolderPath = '';

      setTopCreateProjectLabel(projectName, result.projectType);

      // Cache the project for quick access
      await cacheProjectAfterCreation(currentCreatedProject);

      if (window.desktopApp?.showAlert) {
        await window.desktopApp.showAlert({
          type: 'info',
          title: 'Project Created',
          message: `Project structure created for "${projectName}".`,
          detail: 'You can now drag and drop source files below.',
        });
      }

      if (projectCreationFields) {
        projectCreationFields.style.display = 'none';
      }
      if (projectCreationActionRow) {
        projectCreationActionRow.style.display = 'none';
      }

      // Show source documents upload slot
      if (sourceDocumentsSlot) {
        sourceDocumentsSlot.style.display = 'grid';
      }

      // Reset file list
      uploadedSourceDocuments = [];
      refreshUploadedFilesList();
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
    generateNewDatasetButton.disabled = false;
    setProjectBusyState(false);
  }
});

// File handling functions for source documents
const validateDocumentFile = (file) => {
  const fileName = file.name.toLowerCase();
  return acceptedDocumentTypes.some(type => fileName.endsWith(type));
};

const getSelectedUploadStage = () => {
  if (lockedUploadStage) {
    return lockedUploadStage;
  }
  if (targetFoundationCheckbox?.checked) {
    return 'foundation';
  }
  if (targetReinforcementCheckbox?.checked) {
    return 'reinforcement';
  }
  return '';
};

const updateApplySourceDocumentsButtonState = () => {
  const loadedDocuments = uploadedSourceDocuments.flatMap((entry) => Array.isArray(entry.documents) ? entry.documents : []);
  const hasFiles = loadedDocuments.length > 0;
  const selectedStage = getSelectedUploadStage();
  const hasStage = selectedStage !== '';

  if (targetStageStatus) {
    if (!hasFiles) {
      targetStageStatus.textContent = 'Target stage: load documents first';
    } else if (!hasStage) {
      targetStageStatus.textContent = 'Target stage: select Foundation or Reinforcement to continue';
    } else if (selectedStage === 'foundation') {
      targetStageStatus.textContent = lockedUploadStage ? 'Target stage: Foundation (locked)' : 'Target stage: Foundation (ready)';
    } else {
      targetStageStatus.textContent = lockedUploadStage ? 'Target stage: Reinforcement (locked)' : 'Target stage: Reinforcement (ready)';
    }
  }

  if (applySourceDocumentsButton) {
    applySourceDocumentsButton.disabled = !(hasFiles && hasStage);
    applySourceDocumentsButton.hidden = !hasFiles;
  }
};

const updateCreateSubfolderButtonState = () => {
  const label = (newStageFolderLabel?.value?.trim() || '');
  const hasLabel = label !== '';
  const hasStage = (newStageFolderType?.value || '').trim() !== '';
  if (createNewStageFolderButton) {
    createNewStageFolderButton.textContent = hasLabel ? `Create New "${label}" Folder` : 'Create New Folder';
    createNewStageFolderButton.disabled = !(hasLabel && hasStage);
  }
};

const resetPostUploadModal = () => {
  if (postUploadExpanded) {
    postUploadExpanded.setAttribute('hidden', '');
  }
  if (newStageFolderLabel) {
    newStageFolderLabel.value = '';
  }
  if (newStageFolderType) {
    newStageFolderType.value = '';
  }
  updateCreateSubfolderButtonState();
};

const openPostUploadModal = () => {
  if (!postUploadModal) {
    return;
  }
  postUploadModal.removeAttribute('hidden');
  resetPostUploadModal();
};

const closePostUploadModal = () => {
  if (!postUploadModal) {
    return;
  }
  postUploadModal.setAttribute('hidden', '');
  resetPostUploadModal();
};

const setLockedStageSelection = (stage, targetFolder = '') => {
  lockedUploadStage = stage || '';
  lockedUploadTargetFolder = targetFolder || '';
  if (targetFoundationCheckbox) {
    targetFoundationCheckbox.checked = stage === 'foundation';
    targetFoundationCheckbox.disabled = Boolean(stage);
  }
  if (targetReinforcementCheckbox) {
    targetReinforcementCheckbox.checked = stage === 'reinforcement';
    targetReinforcementCheckbox.disabled = Boolean(stage);
  }
  updateApplySourceDocumentsButtonState();
};

const unlockStageSelection = () => {
  lockedUploadStage = '';
  lockedUploadTargetFolder = '';
  if (targetFoundationCheckbox) {
    targetFoundationCheckbox.checked = false;
    targetFoundationCheckbox.disabled = false;
  }
  if (targetReinforcementCheckbox) {
    targetReinforcementCheckbox.checked = false;
    targetReinforcementCheckbox.disabled = false;
  }
  updateApplySourceDocumentsButtonState();
};

const setProjectBusyState = (isBusy, message = 'Generating project structure...') => {
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

const loadCachedProjectsList = async () => {
  try {
    if (!cachedProjectsList) return;

    cachedProjectsList.innerHTML = '<p class="cached-projects-empty">Loading saved projects...</p>';

    const result = await window.desktopApp.getCachedProjects();
    if (!result.success) {
      cachedProjectsList.innerHTML = '<p class="cached-projects-empty">No saved projects found.</p>';
      addLog(`Saved project lookup failed: ${result.error || 'unknown error'}`, 'warning');
      return;
    }

    const diagnostics = result.diagnostics || {};
    const cacheCount = Number.isFinite(diagnostics.fromCacheCount) ? diagnostics.fromCacheCount : 0;
    const recoveredCount = Number.isFinite(diagnostics.recoveredCount) ? diagnostics.recoveredCount : 0;
    if (cacheCount > 0 || recoveredCount > 0) {
      addLog(`Saved projects loaded: ${cacheCount} indexed, ${recoveredCount} recovered by scan.`, 'info');
    }
    if (Array.isArray(diagnostics.searchedPaths) && diagnostics.searchedPaths.length > 0) {
      addLog(`Project search paths: ${diagnostics.searchedPaths.join(' | ')}`, 'info');
    }

    const projects = result.projects || [];
    if (projects.length === 0) {
      cachedProjectsList.innerHTML = '<p class="cached-projects-empty">No saved projects found. Create one, or check log for scanned paths.</p>';
      return;
    }

    cachedProjectsList.innerHTML = '';
    projects.forEach((project) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      
      const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      card.innerHTML = `
        <h4 class="project-card-title">${project.projectName || 'Unnamed Project'}</h4>
        <p class="project-card-type">${project.projectType || 'unknown'}</p>
        <p class="project-card-path">${project.rootPath}</p>
        <p class="project-card-date">Created: ${createdDate}</p>
      `;

      card.addEventListener('click', () => {
        void openSavedProjectEnvironment(project);
      });

      cachedProjectsList.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load cached projects:', error);
    if (cachedProjectsList) {
      cachedProjectsList.innerHTML = '<p class="cached-projects-empty">Error loading projects. Try again.</p>';
    }
  }
};

const showProjectDetails = async (project) => {
  try {
    // Hide projects list, show details
    if (cachedProjectsList) {
      cachedProjectsList.setAttribute('hidden', '');
    }
    if (projectDetailsPanel) {
      projectDetailsPanel.removeAttribute('hidden');
    }

    currentLoadedProject = project;

    if (projectDetailsTitle) {
      projectDetailsTitle.textContent = project.projectName || 'Project';
    }

    if (projectDetailsType) {
      projectDetailsType.textContent = project.projectType || 'Unknown';
    }

    if (projectDetailsPath) {
      projectDetailsPath.textContent = project.rootPath;
    }

    if (projectDetailsCreated) {
      const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      projectDetailsCreated.textContent = createdDate;
    }

    // Load and display documents
    if (projectDocumentsList) {
      projectDocumentsList.innerHTML = '<p class="loading-text">Scanning for documents...</p>';

      const docsResult = await window.desktopApp.listProjectDocuments(project.rootPath);
      if (docsResult.success) {
        const documents = docsResult.documents || {};
        if (Object.keys(documents).length === 0) {
          projectDocumentsList.innerHTML = '<p class="loading-text">No documents found in this project.</p>';
        } else {
          projectDocumentsList.innerHTML = '';
          Object.entries(documents).forEach(([folder, files]) => {
            const label = document.createElement('strong');
            label.className = 'document-folder-label';
            label.textContent = `📁 ${folder}`;
            projectDocumentsList.appendChild(label);

            files.forEach((file) => {
              const item = document.createElement('div');
              item.className = 'document-item';
              item.textContent = `📄 ${file.relativePath}`;
              projectDocumentsList.appendChild(item);
            });
          });
        }
      } else {
        projectDocumentsList.innerHTML = '<p class="loading-text">Could not load documents.</p>';
      }
    }
  } catch (error) {
    console.error('Error showing project details:', error);
    if (projectDocumentsList) {
      projectDocumentsList.innerHTML = '<p class="loading-text" style="color: #ff9999;">Error loading project details.</p>';
    }
  }
};

const cacheProjectAfterCreation = async (projectData) => {
  try {
    if (!projectData || !projectData.rootPath) {
      console.warn('Invalid project data for caching');
      return;
    }

    const result = await window.desktopApp.cacheProject({
      projectName: projectData.projectName,
      projectType: projectData.projectType,
      rootPath: projectData.rootPath,
      foundationSourceDocsPath: projectData.foundationSourceDocsPath,
      reinforcementSourceDocsPath: projectData.reinforcementSourceDocsPath,
      createdAt: new Date().toISOString(),
    });

    if (result.success) {
      addLog(`Project cached: ${projectData.projectName}`, 'info');
    } else {
      console.warn('Failed to cache project:', result.error);
    }
  } catch (error) {
    console.error('Error caching project:', error);
  }
};

const resolveNativeFilePath = (file) => {
  if (!file) {
    return '';
  }
  if (window.desktopApp?.getPathForFile) {
    const pathValue = window.desktopApp.getPathForFile(file);
    if (typeof pathValue === 'string' && pathValue.trim() !== '') {
      return pathValue;
    }
  }
  if (typeof file.path === 'string' && file.path.trim() !== '') {
    return file.path;
  }
  return '';
};

const getSourcePathTailName = (inputPath) => {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    return 'folder';
  }
  const normalized = inputPath.replace(/\\/g, '/');
  const chunks = normalized.split('/').filter(Boolean);
  return chunks[chunks.length - 1] || 'folder';
};

const addUploadedSourcePath = (entryPath, displayName, isDirectory = false) => {
  if (typeof entryPath !== 'string' || entryPath.trim() === '') {
    return Promise.resolve(false);
  }

  const normalizedPath = entryPath.trim();
  const isDuplicate = uploadedSourceDocuments.some((f) => f.path === normalizedPath);
  if (isDuplicate) {
    addLog(`Source already added: ${displayName || normalizedPath}`, 'info');
    return Promise.resolve(false);
  }

  const resolvedDisplayName = displayName || getSourcePathTailName(normalizedPath);
  return (async () => {
    if (!window.desktopApp?.inspectProjectSourceEntries) {
      addLog('Source inspection API is not available.', 'error');
      return false;
    }

    const result = await window.desktopApp.inspectProjectSourceEntries({ entryPaths: [normalizedPath] });
    if (!result?.success) {
      addLog(`Could not inspect source: ${resolvedDisplayName}`, 'warning');
      return false;
    }

    const inspectedEntry = Array.isArray(result.entries) ? result.entries[0] : null;
    if (!inspectedEntry) {
      addLog(`Could not inspect source: ${resolvedDisplayName}`, 'warning');
      return false;
    }

    uploadedSourceDocuments.push({
      name: resolvedDisplayName,
      path: normalizedPath,
      isDirectory: Boolean(isDirectory || inspectedEntry.isDirectory),
      documents: Array.isArray(inspectedEntry.documents) ? inspectedEntry.documents : [],
    });
    refreshUploadedFilesList();
    addLog(`${isDirectory || inspectedEntry.isDirectory ? 'Folder' : 'File'} added: ${resolvedDisplayName}`, 'info');
    return true;
  })();
};

const addUploadedFile = (file) => {
  if (!validateDocumentFile(file)) {
    addLog(`File type not accepted: ${file.name}. Accepted: PDF, JSON, MD, TXT, DOC, DOCX`, 'warning');
    return false;
  }

  const nativePath = resolveNativeFilePath(file);
  if (!nativePath) {
    addLog(`Could not resolve native path for: ${file.name}`, 'warning');
    return false;
  }

  const isDuplicate = uploadedSourceDocuments.some((f) => f.path === nativePath);
  if (isDuplicate) {
    addLog(`File already added: ${file.name}`, 'info');
    return false;
  }

  return addUploadedSourcePath(nativePath, file.name, false);
};

const addDroppedSourceEntry = (file) => {
  if (!file) {
    return;
  }

  if (validateDocumentFile(file)) {
    void addUploadedFile(file);
    return;
  }

  const nativePath = resolveNativeFilePath(file);
  if (!nativePath) {
    addLog(`Unsupported drop item: ${file.name || 'Unknown entry'}`, 'warning');
    return;
  }

  // When a folder is dropped on Electron, the path resolves but extension checks fail.
  void addUploadedSourcePath(nativePath, `[Folder] ${getSourcePathTailName(nativePath)}`, true);
};

const refreshUploadedFilesList = () => {
  if (!uploadedFilesList) return;

  uploadedFilesList.innerHTML = '';
  const iconMap = {
    '.pdf': '📄',
    '.json': '{ }',
    '.md': '📝',
    '.txt': '📋',
    '.doc': '📑',
    '.docx': '📑'
  };

  uploadedSourceDocuments.forEach((entry) => {
    const group = document.createElement('div');
    group.className = 'uploaded-source-group';

    const title = document.createElement('div');
    title.className = 'uploaded-source-title';
    title.textContent = `${entry.isDirectory ? 'Folder' : 'Source'}: ${entry.name}`;
    group.appendChild(title);

    const docs = document.createElement('div');
    docs.className = 'uploaded-source-docs';

    const documentEntries = Array.isArray(entry.documents) ? entry.documents : [];
    if (documentEntries.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'uploaded-file-item';
      emptyItem.innerHTML = '<span class="uploaded-file-icon">!</span><span>No supported documents found.</span>';
      docs.appendChild(emptyItem);
    } else {
      documentEntries.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'uploaded-file-item';
        const ext = `${file.name || ''}`.split('.').pop().toLowerCase();
        const icon = iconMap[`.${ext}`] || '📎';
        item.innerHTML = `
          <span class="uploaded-file-icon">${icon}</span>
          <span>${file.relativePath || file.name}</span>
        `;
        docs.appendChild(item);
      });
    }

    group.appendChild(docs);
    uploadedFilesList.appendChild(group);
  });

  const loadedDocuments = uploadedSourceDocuments.flatMap((entry) => Array.isArray(entry.documents) ? entry.documents : []);
  if (uploadedFileCount) {
    uploadedFileCount.textContent = `${loadedDocuments.length} file${loadedDocuments.length !== 1 ? 's' : ''}`;
  }
  updateApplySourceDocumentsButtonState();
};

targetFoundationCheckbox?.addEventListener('change', () => {
  if (targetFoundationCheckbox.checked && targetReinforcementCheckbox) {
    targetReinforcementCheckbox.checked = false;
  }
  updateApplySourceDocumentsButtonState();
});

targetReinforcementCheckbox?.addEventListener('change', () => {
  if (targetReinforcementCheckbox.checked && targetFoundationCheckbox) {
    targetFoundationCheckbox.checked = false;
  }
  updateApplySourceDocumentsButtonState();
});

sourceDocumentsCard?.addEventListener('dragover', (event) => {
  if (projectWriteInProgress) {
    return;
  }
  event.preventDefault();
  sourceDocumentsCard.style.opacity = '0.7';
});

sourceDocumentsCard?.addEventListener('dragleave', () => {
  sourceDocumentsCard.style.opacity = '1';
});

sourceDocumentsCard?.addEventListener('drop', (event) => {
  if (projectWriteInProgress) {
    return;
  }
  event.preventDefault();
  sourceDocumentsCard.style.opacity = '1';
  
  const files = event.dataTransfer.files;
  Array.from(files).forEach((file) => {
    void addDroppedSourceEntry(file);
  });
});

const uploadSourceDocumentsButton = document.querySelector('[data-upload-source-documents]');
uploadSourceDocumentsButton?.addEventListener('click', async () => {
  if (projectWriteInProgress) {
    return;
  }
  if (!window.desktopApp?.selectSourceEntries) {
    addLog('Source selection dialog is not available.', 'error');
    return;
  }

  const selectedEntries = await window.desktopApp.selectSourceEntries();
  if (!Array.isArray(selectedEntries) || selectedEntries.length === 0) {
    return;
  }

  selectedEntries.forEach((entryPath) => {
    void addUploadedSourcePath(entryPath, getSourcePathTailName(entryPath));
  });
});

applySourceDocumentsButton?.addEventListener('click', async () => {
  if (projectWriteInProgress) {
    return;
  }
  const stage = getSelectedUploadStage();
  if (!stage) {
    addLog('Select Foundation or Reinforcement before adding files.', 'warning');
    return;
  }

  if (!currentCreatedProject) {
    addLog('Create a project first before adding files.', 'warning');
    return;
  }

  if (!window.desktopApp?.addProjectSourceDocuments) {
    addLog('Add project source documents API is not available.', 'error');
    return;
  }

  const filePaths = uploadedSourceDocuments.map((entry) => entry.path).filter(Boolean);
  if (filePaths.length === 0) {
    addLog('Load at least one file or folder before continuing.', 'warning');
    return;
  }

  let targetFolder = '';
  if (lockedUploadTargetFolder) {
    targetFolder = lockedUploadTargetFolder;
  } else if (stage === 'foundation') {
    targetFolder = currentCreatedProject.foundationSourceDocsPath || currentCreatedProject.sourceDocsPath || '';
  } else if (stage === 'reinforcement') {
    targetFolder = currentCreatedProject.reinforcementSourceDocsPath || currentCreatedProject.sourceDocsPath || '';
  }

  if (!targetFolder) {
    addLog(`Target folder is not available for ${stage}.`, 'error');
    return;
  }

  const applyButtonLabel = applySourceDocumentsButton.textContent;
  applySourceDocumentsButton.disabled = true;
  applySourceDocumentsButton.textContent = 'Adding...';
  setProjectBusyState(true, 'Writing files...');
  try {
    const result = await window.desktopApp.addProjectSourceDocuments({ filePaths, targetFolder });
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to add source documents');
    }
    const copiedCount = Array.isArray(result.copied) ? result.copied.length : 0;
    if (copiedCount === 0) {
      addLog(`No supported files were added to ${stage} folder.`, 'warning');
      if (window.desktopApp?.showAlert) {
        await window.desktopApp.showAlert({
          type: 'warning',
          title: 'No Files Added',
          message: 'No supported documents were found in the loaded entries.',
          detail: 'Supported types: PDF, JSON, MD, TXT, DOC, DOCX',
        });
      }
    } else {
      addLog(`Added ${copiedCount} source file(s) to ${stage} folder.`, 'info');
      if (window.desktopApp?.showAlert) {
        await window.desktopApp.showAlert({
          type: 'info',
          title: 'Files Added',
          message: `Added ${copiedCount} file(s) to ${stage}.`,
          detail: `Target folder: ${targetFolder}`,
        });
      }
      uploadedSourceDocuments = [];
      refreshUploadedFilesList();
      openPostUploadModal();
    }
  } catch (error) {
    addLog(`Add source documents failed: ${error.message}`, 'error');
    if (window.desktopApp?.showAlert) {
      await window.desktopApp.showAlert({
        type: 'error',
        title: 'Add Files Failed',
        message: 'Could not add files to the selected stage folder.',
        detail: `${error.message}`,
      });
    }
  } finally {
    applySourceDocumentsButton.textContent = applyButtonLabel || 'Add Loaded Files To Selected Stage';
    setProjectBusyState(false);
    updateApplySourceDocumentsButtonState();
  }
});

postUploadYesButton?.addEventListener('click', () => {
  if (projectWriteInProgress) {
    return;
  }
  if (postUploadExpanded) {
    postUploadExpanded.removeAttribute('hidden');
  }
  updateCreateSubfolderButtonState();
});

postUploadNoButton?.addEventListener('click', () => {
  if (projectWriteInProgress) {
    return;
  }
  closePostUploadModal();
  if (projectCreationPanel) {
    projectCreationPanel.setAttribute('hidden', '');
  }
  if (sourceDocumentsSlot) {
    sourceDocumentsSlot.style.display = 'none';
  }
  unlockStageSelection();
});

newStageFolderLabel?.addEventListener('input', () => {
  updateCreateSubfolderButtonState();
});

newStageFolderType?.addEventListener('change', () => {
  updateCreateSubfolderButtonState();
});

createNewStageFolderButton?.addEventListener('click', async () => {
  if (projectWriteInProgress) {
    return;
  }
  const label = `${newStageFolderLabel?.value || ''}`.trim();
  const stage = `${newStageFolderType?.value || ''}`.trim();
  if (!label || !stage) {
    updateCreateSubfolderButtonState();
    return;
  }
  if (!currentCreatedProject) {
    addLog('Create a project first before creating source folders.', 'warning');
    return;
  }
  if (!window.desktopApp?.createProjectSourceSubfolder) {
    addLog('Create source subfolder API is not available.', 'error');
    return;
  }

  createNewStageFolderButton.disabled = true;
  setProjectBusyState(true, 'Generating project structure...');
  try {
    const result = await window.desktopApp.createProjectSourceSubfolder({
      label,
      stage,
      foundationSourceDocsPath: currentCreatedProject.foundationSourceDocsPath || currentCreatedProject.sourceDocsPath,
      reinforcementSourceDocsPath: currentCreatedProject.reinforcementSourceDocsPath || currentCreatedProject.sourceDocsPath,
    });
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to create new source folder');
    }

    setLockedStageSelection(stage, result.folderPath);
    addLog(`Created ${stage} source folder: ${result.folderName}`, 'info');
    resetPostUploadModal();
  } catch (error) {
    addLog(`Create source folder failed: ${error.message}`, 'error');
    updateCreateSubfolderButtonState();
  } finally {
    setProjectBusyState(false);
  }
});

// Close button handlers
const closeProjectCreationButton = document.getElementById('closeProjectCreationButton');
closeProjectCreationButton?.addEventListener('click', () => {
  const createdProjectSnapshot = currentCreatedProject ? {
    projectName: currentCreatedProject.projectName,
    projectType: currentCreatedProject.projectType,
  } : null;

  if (projectCreationPanel) {
    projectCreationPanel.setAttribute('hidden', '');
  }
  // Hide source documents slot when closing creation panel
  if (sourceDocumentsSlot) {
    sourceDocumentsSlot.style.display = 'none';
  }
  if (targetFoundationCheckbox) {
    targetFoundationCheckbox.checked = false;
    targetFoundationCheckbox.disabled = false;
  }
  if (targetReinforcementCheckbox) {
    targetReinforcementCheckbox.checked = false;
    targetReinforcementCheckbox.disabled = false;
  }
  closePostUploadModal();
  unlockStageSelection();
  currentCreatedProject = null;
  uploadedSourceDocuments = [];
  refreshUploadedFilesList();

  if (createdProjectSnapshot?.projectName) {
    setTopCreateProjectLabel(createdProjectSnapshot.projectName, createdProjectSnapshot.projectType);
  }
});

outputFolderButton?.addEventListener('click', async () => {
  if (!window.desktopApp?.selectFolder || !outputFolderInput) {
    return;
  }

  const selectedPath = await window.desktopApp.selectFolder();
  if (!selectedPath) {
    return;
  }

  outputFolderInput.value = selectedPath;
  lastUsedOutputFolder = selectedPath;
  addLog(`Output folder selected: ${selectedPath}`);
  await persistSettings();
  renderProjectWorkspace();
  refreshGenerateState();
});

exportSourceFolderButton?.addEventListener('click', async () => {
  if (!window.desktopApp?.selectFolder || !exportSourceFolderInput) {
    return;
  }

  const selectedPath = await window.desktopApp.selectFolder();
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

repairButton?.addEventListener('click', async () => {
  if (repairButton.disabled) {
    return;
  }

  if (!window.desktopApp?.repairPartialArtifact) {
    addLog('Required repair API is not available.', 'error');
    refreshRepairState();
    return;
  }

  if (!apiAvailable) {
    await showWarningPopup('API is required.', 'Set a valid API key in .env, restart the app, then run repair.');
    refreshRepairState();
    return;
  }

  const sourceDocumentPath = selectedFiles.sourceDocumentJson?.path;
  const repairArtifactPath = selectedFiles.repairArtifactJson?.path;
  if (!sourceDocumentPath || !repairArtifactPath) {
    refreshRepairState();
    return;
  }

  if (!repairInspection || !repairInspection.success || !repairInspection.canRepair) {
    await inspectSelectedRepairArtifact();
  }

  if (!repairInspection || !repairInspection.success || !repairInspection.canRepair) {
    refreshRepairState();
    return;
  }

  if (window.desktopApp?.showConfirm) {
    const confirmed = await window.desktopApp.showConfirm({
      type: 'question',
      title: 'Confirm Partial Repair',
      message: 'Resume incomplete sections and overwrite the selected partial artifact?',
      detail: `Source document: ${sourceDocumentPath}\nRepair target: ${repairArtifactPath}\n\nSupported targets: partial questions JSON or partial conversational pairs JSON.`,
      buttons: ['Repair', 'Cancel'],
    });

    if (!confirmed) {
      addLog('Repair cancelled by user.', 'info');
      refreshRepairState();
      return;
    }
  }

  try {
    repairInProgress = true;
    resetRepairOutputState();
    if (repairInspection.artifactType === 'questions') {
      setRepairBuildState('conversationalPairs', 'skipped', 'SKIP');
      setRepairBuildState('questions', 'running', '0/0');
    } else if (repairInspection.artifactType === 'conversationalPairs') {
      setRepairBuildState('questions', 'skipped', 'SKIP');
      setRepairBuildState('conversationalPairs', 'running', '0/0');
    }
    refreshGenerateState();
    const unsubscribeRepairProgress = window.desktopApp?.onArtifactProgress?.((update) => {
      applyRepairProgressUpdate(update);
    }) || (() => {});
    const guardrailSnapshot = await window.desktopApp?.getQualityGuardrails?.({ maxItems: 8 });
    const generationGuidance = `${guardrailSnapshot?.guardrails || ''}`.trim();
    if (generationGuidance) {
      addLog('Loaded persistent quality guardrails for repair.', 'info');
    }

    addLog(`Starting partial repair for ${getBaseName(repairArtifactPath)}...`, 'info');
    let repairResult;
    try {
      repairResult = await window.desktopApp.repairPartialArtifact({
        sourceDocumentPath,
        repairArtifactPath,
        generationGuidance,
        repairMode: repairFastModeInput?.checked ? 'fast' : 'deep',
      });
    } finally {
      unsubscribeRepairProgress();
    }

    if (`${repairResult?.buildStatus || ''}`.toLowerCase() === 'incomplete') {
      addLog(
        `Repair finished with partial output. Remaining incomplete sections: ${Number(repairResult?.remainingIncompleteSections || 0)}.`,
        'warning'
      );
    } else {
      addLog(`Repair completed successfully for ${getBaseName(repairArtifactPath)}.`, 'success');
    }
    await inspectSelectedRepairArtifact();
    addLog(`Repaired artifact saved in place: ${repairResult?.repairedPath || repairArtifactPath}`, 'info');
  } catch (error) {
    setRepairBuildState('questions', 'error');
    setRepairBuildState('conversationalPairs', 'error');
    addLog(`Partial repair failed: ${error?.message || error || 'Unknown error.'}`, 'error');
  } finally {
    repairInProgress = false;
    refreshGenerateState();
  }
});

exportButton?.addEventListener('click', async () => {
  if (exportButton.disabled) {
    return;
  }

  if (!window.desktopApp?.exportTrainingFiles) {
    addLog('Required export API is not available.', 'error');
    refreshGenerateState();
    return;
  }

  const rootFolder = `${exportSourceFolderInput?.value || ''}`.trim();
  if (!rootFolder || rootFolder === 'No folder selected') {
    refreshGenerateState();
    return;
  }

  if (window.desktopApp?.showConfirm) {
    const datasetName = normalizeDatasetName(datasetNameInput?.value || lastUsedDatasetName);
    const confirmed = await window.desktopApp.showConfirm({
      type: 'question',
      title: 'Confirm Export',
      message: 'Create a fresh export folder with documents, questions, and conversational buckets?',
      detail: `Scan root: ${rootFolder}\n\nThe app will create ${datasetName || '<dataset_name>'}_training_files with:\n- ${datasetName || '<dataset_name>'}_documents\n- ${datasetName || '<dataset_name>'}_questions_training_pairs\n- ${datasetName || '<dataset_name>'}_conversational_training_pairs`,
      buttons: ['Export', 'Cancel'],
    });

    if (!confirmed) {
      addLog('Export cancelled by user.', 'info');
      refreshGenerateState();
      return;
    }
  }

  try {
    exportInProgress = true;
    refreshGenerateState();
    const destinationFolder = outputFolderInput?.value || lastUsedOutputFolder;
    const datasetName = normalizeDatasetName(datasetNameInput?.value || lastUsedDatasetName);
    if (!destinationFolder || destinationFolder === 'No folder selected') {
      addLog('Export destination folder is required. Select an output folder first.', 'error');
      refreshGenerateState();
      return;
    }
    if (!datasetName) {
      addLog('Name Dataset is required for export. Set it in Output Settings.', 'error');
      refreshGenerateState();
      return;
    }

    if (isSameOrNestedPath(destinationFolder, rootFolder) || isSameOrNestedPath(rootFolder, destinationFolder)) {
      addLog('Export blocked: destination must not be the same as, inside, or parent of the scan root folder.', 'error');
      refreshGenerateState();
      return;
    }

    addLog(`Scanning ${rootFolder} for training files...`, 'info');
    const exportResult = await window.desktopApp.exportTrainingFiles({ rootFolder, destinationFolder, datasetName });
    addLog(
      `Export complete: ${Number(exportResult?.copiedCount || 0)} files copied (${Number(exportResult?.summary?.questions || 0)} questions, ${Number(exportResult?.summary?.conversationalPairs || 0)} conversational, ${Number(exportResult?.summary?.document || 0)} documents). Totals: ${Number(exportResult?.summary?.totalQuestionPairs || 0)} question pairs, ${Number(exportResult?.summary?.totalConversationalPairs || 0)} conversational pairs.`,
      'success'
    );
    addLog(`Export folder created: ${exportResult?.exportFolder || ''}`, 'info');
    addLog(`Summary created: ${exportResult?.summaryDocumentPath || ''}`, 'info');
    setTaskMode('export');
    await persistSettings();
  } catch (error) {
    addLog(`Export failed: ${error?.message || error || 'Unknown error.'}`, 'error');
  } finally {
    exportInProgress = false;
    refreshGenerateState();
  }
});

generateButton?.addEventListener('click', async () => {
  if (generateButton.disabled) {
    return;
  }

  if (!window.desktopApp?.processPdf || !window.desktopApp?.buildArtifacts) {
    addLog('Required generation APIs are not available.', 'error');
    setConversionStatus('Generation failed: required local APIs are not available.', 100, 'error');
    return;
  }

  const selectedOutputFolder = outputFolderInput?.value;
  const outputPrefix = (outputPrefixInput?.value || '').trim();
  const runOutputFolderName = buildRunOutputFolderName();
  const outputFolder = joinPath(selectedOutputFolder, runOutputFolderName);
  const documentIdPrefix = buildDocumentIdPrefix();
  const chapterNumberMatch = outputPrefix.match(/(\d{1,3})/);
  const chapterNumberOverride = chapterNumberMatch ? Number.parseInt(chapterNumberMatch[1], 10) : 0;
  const selectedOutputs = getSelectedOutputs();
  const outputFileNames = getOutputFileNames();

  if (!apiAvailable) {
    await showWarningPopup('API is required.', 'Set a valid API key in .env, restart the app, then generate.');
    setConversionStatus('Generation blocked: API is required.', 0, 'error');
    return;
  }

  if (!outputPrefix) {
    await showWarningPopup(
      'Output document prefix is required.',
      'Enter a prefix (for example: AFH_2) before running generation.'
    );
    addLog('Generation blocked: output document prefix is required.', 'error');
    setConversionStatus('Generation blocked: output document prefix is required.', 0, 'error');
    return;
  }

  if (!selectedFiles.originalPdf?.path) {
    await showWarningPopup('Source PDF is required.', 'Use Upload to select the source PDF first.');
    if (selectedFiles.originalPdf?.name && window.desktopApp?.openPdfDialog) {
      addLog('File path missing — please re-select the PDF using the Upload button.', 'error');
      setConversionStatus('Re-select PDF using the Upload button.', 0, 'error');
    } else {
      addLog('Source PDF is required.', 'error');
      setConversionStatus('Generation blocked: source PDF is required.', 0, 'error');
    }
    return;
  }

  if (!selectedOutputFolder || selectedOutputFolder === 'No folder selected') {
    await showWarningPopup('Output folder is required.', 'Select a destination folder before generating files.');
    addLog('Output folder is required.', 'error');
    setConversionStatus('Generation blocked: output folder is required.', 0, 'error');
    return;
  }

  if (!Object.values(selectedOutputs).some(Boolean)) {
    await showWarningPopup('Select at least one output artifact.', 'Choose one or more output types, then generate.');
    addLog('Select at least one output artifact.', 'error');
    setConversionStatus('Generation blocked: no output type selected.', 0, 'error');
    return;
  }

  if (window.desktopApp?.showConfirm) {
    const chosen = Object.entries(selectedOutputs)
      .filter(([, enabled]) => enabled)
      .map(([key]) => `${key} -> ${outputFileNames[key]}`)
      .join('\n');

    const confirmed = await window.desktopApp.showConfirm({
      type: 'question',
      title: 'Confirm Pipeline Run',
      message: 'Generate selected outputs from the loaded PDF?',
      detail: `PDF: ${selectedFiles.originalPdf.name}\nSelected destination: ${selectedOutputFolder}\nRun folder: ${runOutputFolderName}\nFinal output path: ${outputFolder}\n\nSelected outputs:\n${chosen}`,
      buttons: ['Generate', 'Cancel'],
    });

    if (!confirmed) {
      addLog('Generation cancelled by user.');
      setConversionStatus('Generation cancelled.', 0, 'idle');
      return;
    }

    // Immediate visual feedback: dialog closed, processing starting
    addLog('Confirmed. Starting generation pipeline...');
    setConversionStatus('Starting pipeline...', 5, 'running');
  }

  let allowOverwrite = false;
  let completed = false;
  const sourcePdf = {
    ...selectedFiles.originalPdf,
  };

  try {
    generationInProgress = true;
    generationCancelRequested = false;
    await clearPrimaryPdf({ resetInputs: false });
    refreshGenerateState();
    while (!completed) {
      try {
        setConversionStatus('Preparing conversion...', 10, 'running');
        resetDocumentOutputState();
        setSelectedOutputsRunning(selectedOutputs, ['docJson']);
        addLog(`Output folder for this run: ${outputFolder}`, 'info');
        addLog('Starting local PDF extraction (PDF to RAG, no API calls)...');

        const pdfPayload = {
          pdfPath: sourcePdf.path,
          docType: 'auto',
          outputDir: outputFolder,
          outputFileName: outputFileNames.docJson,
          idPrefix: documentIdPrefix,
          chapterNumberOverride,
          allowOverwrite,
        };

        setConversionStatus('Converting PDF to JSON...', 35, 'running');
        const extracted = await window.desktopApp.processPdf(pdfPayload);
        addLog(`Initial document JSON / MD created locally: ${extracted.outputPath}`, 'success');
        if (extracted?.markdownPath) {
          addLog(`Initial document Markdown created locally: ${extracted.markdownPath}`, 'success');
        }
        if (selectedOutputs.docJson) {
          setOutputReadyState('docJson', true);
        }

        setConversionStatus('Writing selected output files...', 75, 'running');
        addLog('Building selected artifacts...');
        const unsubscribeArtifactProgress = window.desktopApp?.onArtifactProgress?.((update) => {
          const key = update?.key;
          const state = `${update?.state || ''}`.trim().toLowerCase();
          if (!key || !outputBadgesByKey[key]) {
            return;
          }

          if (state === 'running') {
              const progressText = `${update?.progressText || ''}`.trim();
              setOutputBuildState(key, 'running', progressText);
              updateOutputProviderIndicators(key, update);
            return;
          }
          if (state === 'completed') {
            setOutputReadyState(key, true);
            return;
          }
          if (state === 'incomplete') {
            setOutputBuildState(key, 'incomplete', 'PARTIAL');
            return;
          }
          if (state === 'skipped') {
            setOutputBuildState(key, 'skipped', 'SKIP');
            return;
          }
          if (state === 'error') {
            setOutputBuildState(key, 'error');
          }
        }) || (() => {});

        let result;
        try {
          const guardrailSnapshot = await window.desktopApp?.getQualityGuardrails?.({ maxItems: 8 });
          const memoryGuardrails = `${guardrailSnapshot?.guardrails || ''}`.trim();
          if (memoryGuardrails) {
            addLog('Loaded persistent quality guardrails from previous runs.', 'info');
          }
          if (guardrailSnapshot?.stability) {
            const stability = guardrailSnapshot.stability;
            addLog(
              stability.isStableOptimum
                ? `Stable optimum reached (${Number(stability.consecutiveOptimumRuns || 0)} consecutive optimum run(s)).`
                : `Stable optimum not yet reached. ${Array.isArray(stability.reasons) && stability.reasons.length > 0 ? stability.reasons[0] : 'More clean runs are required.'}`,
              stability.isStableOptimum ? 'success' : 'info'
            );
          }

          const runBuildArtifacts = ({ allowLocalFallback = false, overwrite = allowOverwrite, generationGuidance = '' } = {}) => window.desktopApp.buildArtifacts({
            outputDir: outputFolder,
            selectedOutputs,
            outputFileNames,
            documentJson: extracted.data,
            documentJsonPath: extracted.outputPath,
            allowOverwrite: overwrite,
            allowLocalFallback,
            generationGuidance: buildCombinedGuidance(memoryGuardrails, generationGuidance),
            idPrefix: documentIdPrefix,
            apiProviderCount,
            apiProviders,
          });

          result = await runBuildArtifacts({ allowLocalFallback: false });
        } finally {
          unsubscribeArtifactProgress();
        }

        const artifactStatuses = result?.summary?.artifactStatuses || {};

        if (Array.isArray(result?.written) && result.written.length > 0) {
          result.written.forEach((entry) => {
            if (entry?.key === 'docJson' && entry?.reused) {
              addLog(`Document JSON / MD already created: ${entry.path}`, 'info');
              setOutputReadyState('docJson', true);
              return;
            }
            if (entry?.key === 'summary') {
              if (`${artifactStatuses.summary?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                setOutputBuildState('summary', 'incomplete', 'PARTIAL');
              } else {
                setOutputReadyState('summary', true);
              }
            }
            if (entry?.key === 'questions') {
              if (`${artifactStatuses.questions?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                setOutputBuildState('questions', 'incomplete', 'PARTIAL');
              } else {
                setOutputReadyState('questions', true);
              }
            }
            if (entry?.key === 'deterministicPairs') {
              setOutputReadyState('deterministicPairs', true);
            }
            if (entry?.key === 'conversationalPairs') {
              if (`${artifactStatuses.conversationalPairs?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                setOutputBuildState('conversationalPairs', 'incomplete', 'PARTIAL');
              } else {
                setOutputReadyState('conversationalPairs', true);
              }
            }
            addLog(`Saved (${entry.key}): ${entry.path}`, 'success');
          });

          if (result?.summary?.routingMode) {
            const configured = Array.isArray(result?.summary?.providersConfigured)
              ? result.summary.providersConfigured.join(', ')
              : 'none';
            const assigned = result?.summary?.providersAssigned || {};
            const observedProviders = result?.summary?.providersObserved || {};
            const observedModels = result?.summary?.modelsObserved || {};
            const providerSummary = (key) => {
              const list = Array.isArray(observedProviders?.[key]) ? observedProviders[key] : [];
              return list.length > 0 ? list.join(', ') : 'none';
            };
            const modelSummary = (key) => {
              const list = Array.isArray(observedModels?.[key]) ? observedModels[key] : [];
              return list.length > 0 ? list.join(', ') : 'none';
            };
            addLog(
              `API routing: ${result.summary.routingMode} | configured: ${configured} | assigned summary/questions/conversational: ${assigned.summary || 'auto'}/${assigned.questions || 'auto'}/${assigned.conversational || 'auto'} | observed providers: ${providerSummary('summary')}/${providerSummary('questions')}/${providerSummary('conversational')} | observed models: ${modelSummary('summary')}/${modelSummary('questions')}/${modelSummary('conversational')}`,
              'info'
            );
          }
        } else {
          addLog('No selected artifacts were written.', 'info');
        }

        Object.entries(artifactStatuses).forEach(([key, status]) => {
          const buildStatus = `${status?.buildStatus || ''}`.toLowerCase();
          const failureReason = `${status?.failureReason || ''}`.trim();
          const incompleteSections = Array.isArray(status?.incompleteSections) ? status.incompleteSections : [];

          if (buildStatus === 'incomplete') {
            const failedCount = incompleteSections.filter((entry) => `${entry?.status || ''}`.toLowerCase() === 'failed').length;
            setOutputBuildState(key, 'incomplete', 'PARTIAL');
            addLog(
              `${key} saved as partial output. Failed sections: ${failedCount}. ${failureReason || 'Repair can continue from incomplete sections.'}`,
              'warning'
            );
          }

          if (buildStatus === 'skipped') {
            setOutputBuildState(key, 'skipped', 'SKIP');
            addLog(`${key} skipped. ${failureReason || 'A required upstream artifact was incomplete.'}`, 'warning');
          }
        });

        const auditCandidates = Array.isArray(result?.written)
          ? result.written
            .filter((entry) => {
              const key = `${entry?.key || ''}`;
              if (!['conversationalPairs', 'deterministicPairs'].includes(key)) {
                return false;
              }
              return `${artifactStatuses?.[key]?.buildStatus || 'complete'}`.toLowerCase() === 'complete';
            })
            .map((entry) => `${entry?.path || ''}`)
            .filter(Boolean)
          : [];

        if (auditCandidates.length === 0) {
          const pairArtifactsIncomplete = ['conversationalPairs', 'deterministicPairs'].some((key) => {
            const status = `${artifactStatuses?.[key]?.buildStatus || ''}`.toLowerCase();
            return status === 'incomplete' || status === 'skipped';
          });
          if (pairArtifactsIncomplete) {
            addLog('Quality audit skipped because at least one pair artifact is partial or was skipped.', 'warning');
          }
        }

        if (auditCandidates.length > 0 && window.desktopApp?.auditPairs) {
          const qualityReportPath = joinPath(outputFolder, `${documentIdPrefix || 'output'}_quality_report.json`);
          addLog(`Running quality audit on ${auditCandidates.length} pair artifact(s)...`, 'info');
          try {
            const auditResult = await window.desktopApp.auditPairs({
              files: auditCandidates,
              reportPath: qualityReportPath,
            });

            const rating = auditResult?.overallRating || {};
            const level = `${rating.level || 'unknown'}`.toUpperCase();
            const weightedPct = Number(rating?.weightedIssuePercent || 0);
            const errors = Number(rating?.errorCount || 0);
            const warnings = Number(rating?.warningCount || 0);

            const auditLogLevel = errors > 0 ? 'error' : (warnings > 0 ? 'warning' : 'success');
            addLog(
              `Quality audit complete: ${level} (${weightedPct}%). Errors: ${errors}, Warnings: ${warnings}.`,
              auditLogLevel
            );
            addLog(`Quality report saved: ${qualityReportPath}`, 'info');

            // Show quality results modal and wait for user decision
            const userDecision = await getQualityDecision(auditResult);
            addLog(`User action selected: ${userDecision}`, 'info');

            // Handle user decision
            if (userDecision === 'repair') {
              addLog('Repair action selected. Regenerating affected pairs...', 'info');

              // Extract pair file paths from result
              const pairFilePaths = {};
              if (Array.isArray(result?.written)) {
                result.written.forEach((entry) => {
                  if (entry?.key === 'deterministicPairs' && entry?.path) {
                    pairFilePaths.deterministic = entry.path;
                  }
                  if (entry?.key === 'conversationalPairs' && entry?.path) {
                    pairFilePaths.conversational = entry.path;
                  }
                });
              }

              try {
                const repairResult = await window.desktopApp?.repairPairs?.({
                  auditResult,
                  deterministicPairPath: pairFilePaths.deterministic,
                  conversationalPairPath: pairFilePaths.conversational,
                  outputFolder,
                });

                if (repairResult?.success) {
                  const totalRepaired = (repairResult?.repairs?.deterministic?.merged || 0) +
                                       (repairResult?.repairs?.conversational?.merged || 0);
                  addLog(`Repair complete: ${totalRepaired} pairs regenerated.`, 'success');

                  // Re-run audit after repair
                  addLog('Running quality audit after repair...', 'info');
                  const postRepairAudit = await window.desktopApp.auditPairs({
                    files: auditCandidates,
                    reportPath: qualityReportPath,
                  });

                  addLog('Post-repair audit complete. Displaying updated results...', 'info');
                  const newDecision = await getQualityDecision(postRepairAudit);

                  const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                    decision: 'repair',
                    auditResult,
                    postAuditResult: postRepairAudit,
                    maxGuardrails: 8,
                  });
                  if (memoryUpdate?.stability) {
                    addLog(
                      memoryUpdate.stability.isStableOptimum
                        ? 'Stable optimum criteria satisfied after repair.'
                        : `Stability check after repair: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                      memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                    );
                  }

                  if (newDecision !== 'close') {
                    addLog(`Follow-up action selected: ${newDecision}`, 'info');
                  } else {
                    addLog('Updated quality results reviewed.', 'info');
                  }
                } else {
                  addLog(`Repair encountered issues: ${repairResult?.message || 'Unknown error'}`, 'warning');
                }
              } catch (repairError) {
                const message = `${repairError?.message || repairError || 'Unknown repair error.'}`;
                addLog(`Pair repair failed: ${message}`, 'error');
              }
            } else if (userDecision === 'defer-log') {
              const deferredLogPath = joinPath(outputFolder, `${documentIdPrefix || 'output'}_pending_repairs.json`);
              addLog('Defer-log selected. Recording unresolved issues for later repair...', 'warning');

              try {
                const deferResult = await window.desktopApp?.deferQualityLog?.({
                  auditResult,
                  files: auditCandidates,
                  deferredLogPath,
                });

                if (deferResult?.ok) {
                  const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                    decision: 'defer-log',
                    auditResult,
                    maxGuardrails: 8,
                  });
                  if (memoryUpdate?.stability) {
                    addLog(`Stability check after defer-log: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`, 'info');
                  }

                  addLog(
                    `Deferred quality log saved. Pending issues: ${deferResult.totalPendingIssues}. Files flagged: ${deferResult.filesAnnotated}.`,
                    'warning'
                  );
                  addLog(`Deferred log path: ${deferredLogPath}`, 'info');
                } else {
                  addLog('Deferred quality log completed with some file annotation errors.', 'warning');
                }
              } catch (deferError) {
                const message = `${deferError?.message || deferError || 'Unknown defer-log error.'}`;
                addLog(`Deferred log failed: ${message}`, 'error');
              }
            } else if (userDecision === 'redo') {
              addLog('Regeneration selected. Rebuilding artifacts with audit-informed guidance...', 'warning');
              const redoGuidance = buildRedoGuidanceFromAudit(auditResult);
              if (redoGuidance) {
                addLog('Applying previous audit findings as regeneration guidance.', 'info');
              }

              try {
                const redoResult = await runBuildArtifacts({
                  allowLocalFallback: true,
                  overwrite: true,
                  generationGuidance: redoGuidance,
                });

                if (Array.isArray(redoResult?.written) && redoResult.written.length > 0) {
                  redoResult.written.forEach((entry) => {
                    addLog(`Redo saved (${entry.key}): ${entry.path}`, 'success');
                  });
                }

                const redoAuditCandidates = Array.isArray(redoResult?.written)
                  ? redoResult.written
                    .filter((entry) => ['conversationalPairs', 'deterministicPairs'].includes(`${entry?.key || ''}`))
                    .map((entry) => `${entry?.path || ''}`)
                    .filter(Boolean)
                  : [];

                const postRedoCandidates = redoAuditCandidates.length > 0 ? redoAuditCandidates : auditCandidates;
                if (postRedoCandidates.length > 0) {
                  addLog('Running quality audit after redo...', 'info');
                  const postRedoAudit = await window.desktopApp.auditPairs({
                    files: postRedoCandidates,
                    reportPath: qualityReportPath,
                  });

                  const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                    decision: 'redo',
                    auditResult,
                    postAuditResult: postRedoAudit,
                    maxGuardrails: 8,
                  });
                  if (memoryUpdate?.stability) {
                    addLog(
                      memoryUpdate.stability.isStableOptimum
                        ? 'Stable optimum criteria satisfied after redo.'
                        : `Stability check after redo: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                      memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                    );
                  }

                  const postRedoRating = postRedoAudit?.overallRating || {};
                  addLog(
                    `Post-redo quality: ${`${postRedoRating?.level || 'unknown'}`.toUpperCase()} (${Number(postRedoRating?.weightedIssuePercent || 0)}%).`,
                    'info'
                  );

                  const followUpDecision = await getQualityDecision(postRedoAudit);
                  addLog(`Post-redo action selected: ${followUpDecision}`, 'info');
                }
              } catch (redoError) {
                const message = `${redoError?.message || redoError || 'Unknown redo error.'}`;
                addLog(`Redo failed: ${message}`, 'error');
              }
            } else if (userDecision === 'close') {
              const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                decision: 'close',
                auditResult,
                maxGuardrails: 8,
              });
              if (memoryUpdate?.stability) {
                addLog(
                  memoryUpdate.stability.isStableOptimum
                    ? 'Stable optimum criteria satisfied.'
                    : `Stability check: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                  memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                );
              }
              addLog('Audit results reviewed.', 'info');
            }
          } catch (auditError) {
            const message = `${auditError?.message || auditError || 'Unknown audit error.'}`;
            addLog(`Quality audit failed: ${message}`, 'warning');
            hideQualityResultsModal();
          }
        }

        const finalArtifactStatuses = result?.summary?.artifactStatuses || {};
        const hasPartialArtifacts = Object.values(finalArtifactStatuses).some((status) => {
          const buildStatus = `${status?.buildStatus || ''}`.toLowerCase();
          return buildStatus === 'incomplete' || buildStatus === 'skipped';
        });

        if (hasPartialArtifacts) {
          setConversionStatus('Conversion completed with partial artifacts.', 100, 'warning');
          addLog('Pipeline completed with partial artifacts. Review incomplete sections before final use.', 'warning');
        } else {
          setConversionStatus('Conversion completed successfully.', 100, 'success');
          addLog('Pipeline completed successfully.', 'success');
        }
        if (outputPrefixInput) {
          outputPrefixInput.value = '';
          lastUsedOutputPrefix = '';
        }
        await persistSettings();
        completed = true;
      } catch (error) {
        const message = error?.message || 'Unknown generation error.';
        const isCollision = /already exist/i.test(message);

        if (isCollision && !allowOverwrite && window.desktopApp?.showConfirm) {
          const continueOverwrite = await window.desktopApp.showConfirm({
            type: 'warning',
            title: 'File Already Exists',
            message: 'A file already exists with that name. Do you want to overwrite?',
            detail: '',
            buttons: ['Confirm', 'Cancel'],
          });

          if (continueOverwrite) {
            allowOverwrite = true;
            setConversionStatus('Continuing with overwrite...', 20, 'running');
            markRunningOutputsAsError();
            addLog('User chose to continue and overwrite existing files.', 'info');
            continue;
          }

          await showWarningPopup(
            'Generation cancelled.',
            'The existing file was not overwritten.'
          );
          setConversionStatus('Generation cancelled: existing file kept.', 0, 'idle');
          return;
        }

        if (isCollision && allowOverwrite) {
          await showWarningPopup(
            'Could not overwrite the existing file.',
            'Try again after restarting the app, or change the output prefix.'
          );
          setConversionStatus('Generation stopped: file name conflict remains.', 0, 'error');
          return;
        }

        if (/generation cancelled by user/i.test(message)) {
          throw new Error('Generation cancelled by user.');
        }

        const apiFailed = /api is required|api analysis failed/i.test(message);
        if (apiFailed) {
          markRunningOutputsAsError();
          await showWarningPopup('API generation failed.', 'No files were generated. Check API key and try again.');
          setConversionStatus('Generation failed: API unavailable or analysis failed.', 0, 'error');
          return;
        }

        await window.desktopApp?.showAlert?.({
          type: 'error',
          title: 'Generation Failed',
          message: 'The pipeline could not complete.',
          detail: message,
        });
        throw error;
      }
    }
  } catch (error) {
    const message = `${error?.message || error || 'Unknown generation error.'}`;
    if (/generation cancelled by user/i.test(message)) {
      setConversionStatus('Generation cancelled by user.', 0, 'idle');
      addLog('Pipeline cancelled by user.', 'warning');
    } else {
      markRunningOutputsAsError();
      setConversionStatus(`Conversion failed: ${message}`, 100, 'error');
      addLog(`Pipeline failed: ${message}`, 'error');
    }
  } finally {
    generationInProgress = false;
    generationCancelRequested = false;
    refreshGenerateState();
  }
});
  cancelButton?.addEventListener('click', async () => {
    if (!generationInProgress || generationCancelRequested) {
      return;
    }

    generationCancelRequested = true;
    refreshGenerateState();
    addLog('Cancellation requested by user...', 'warning');

    try {
      await window.desktopApp?.cancelGeneration?.();
    } catch (error) {
      addLog(`Cancellation request failed: ${error.message}`, 'error');
    }
  });

refreshGenerateState();
resetDocumentOutputState();
renderProjectWorkspace();
void loadSavedSettings().then(() => refreshApiAvailability());
