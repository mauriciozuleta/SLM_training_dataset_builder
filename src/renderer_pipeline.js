const card = document.querySelector('[data-file-card]');
const requiredCards = document.querySelectorAll('[data-file-card][data-required="true"]');
const generateButton = document.getElementById('generateButton');
const cancelButton = document.getElementById('cancelButton');
const repairButton = document.getElementById('repairButton');
const exportButton = document.getElementById('exportButton');
const generateHint = document.getElementById('generateHint');
const repairHint = document.getElementById('repairHint');
const exportHint = document.getElementById('exportHint');
const sharedOutputSubtitle = document.getElementById('sharedOutputSubtitle');
const logWindow = document.getElementById('logWindow');
const clearLogButton = document.getElementById('clearLogButton');
const modeButtons = document.querySelectorAll('[data-mode-trigger]');
const modePanels = document.querySelectorAll('[data-mode-panel]');

const outputFolderInput = document.getElementById('outputFolder');
const outputFolderButton = document.querySelector('[data-select-folder="outputFolder"]');
const outputPrefixInput = document.getElementById('outputPrefix');
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
let apiAvailable = false;
let apiProviderCount = 0;
let apiProviders = [];
let generationInProgress = false;
let generationCancelRequested = false;
let repairInProgress = false;
let exportInProgress = false;
let currentTaskMode = '';
let repairInspection = null;
let repairInspectionLoading = false;
let repairInspectionRequestId = 0;
let clearPrimaryPdf = async () => {};

const getTimeStamp = () => new Date().toLocaleTimeString([], { hour12: false });

const addLog = (message, level = 'info') => {
  if (!logWindow) {
    return;
  }
  const line = document.createElement('p');
  line.className = `log-line log-${level}`;
  line.textContent = `[${getTimeStamp()}] ${message}`;
  logWindow.appendChild(line);
  logWindow.scrollTop = logWindow.scrollHeight;
};

const unsubscribeGenerationLog = window.desktopApp?.onGenerationLog?.((entry) => {
  const message = `${entry?.message || ''}`.trim();
  if (!message) {
    return;
  }
  addLog(message, `${entry?.level || 'info'}`.toLowerCase());
}) || (() => {});

const showWarningPopup = async (message, detail = '') => {
  if (!window.desktopApp?.showAlert) {
    return;
  }
  await window.desktopApp.showAlert({
    type: 'warning',
    title: 'Attention Required',
    message,
    detail,
  });
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
      generate: 'Generate mode: choose destination folder and output prefix used for the next dataset run.',
      repair: 'Repair mode: output prefix is ignored. The repaired file keeps its original filename and is overwritten in place.',
      export: 'Export mode: output prefix is ignored. Export creates a folder named <selected-folder>_training_files.',
      default: 'Shared for all tasks: choose a destination folder and output prefix/file name base.',
    };
    sharedOutputSubtitle.textContent = subtitles[currentTaskMode] || subtitles.default;
  }

  const isGenerateMode = currentTaskMode === 'generate' || currentTaskMode === '';
  if (commonPrefixCell) {
    commonPrefixCell.hidden = !isGenerateMode;
  }
  if (outputPrefixInput) {
    outputPrefixInput.disabled = !isGenerateMode;
  }
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
  const ready = !generationInProgress && !repairInProgress && !exportInProgress && hasExportFolder;
  exportButton.disabled = !ready;
  exportButton.textContent = exportInProgress ? 'Exporting...' : 'Export Training Files';

  if (exportInProgress) {
    exportHint.textContent = 'Export in progress. Please wait.';
    return;
  }

  if (!hasExportFolder) {
    exportHint.textContent = 'Select a root folder that contains generated output folders.';
    return;
  }

  const folderName = getBaseName(`${exportSourceFolderInput?.value || ''}`.replace(/[\\/]+$/g, '')) || 'selected_folder';
  exportHint.textContent = `Ready to scan recursively and create ${folderName}_training_files with only questions and conversational files.`;
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
  outputFolder: outputFolderInput?.value || '',
  outputPrefix: outputPrefixInput?.value || '',
  exportSourceFolder: exportSourceFolderInput?.value || '',
  currentTaskMode,
  selectedOutputs: getSelectedOutputs(),
  lastLoadedPdfName,
  lastUsed: {
    outputFolder: lastUsedOutputFolder,
    outputPrefix: lastUsedOutputPrefix,
  },
});

const persistSettings = async () => {
  if (!window.desktopApp?.saveSettings) {
    return;
  }
  try {
    await window.desktopApp.saveSettings(collectSettings());
  } catch (error) {
    addLog(`Could not save app settings: ${error.message}`, 'error');
  }
};

const applySettings = (settings) => {
  if (!settings || typeof settings !== 'object') {
    return;
  }

  if (outputFolderInput && typeof settings.outputFolder === 'string' && settings.outputFolder.trim() !== '') {
    outputFolderInput.value = settings.outputFolder;
  }

  if (outputPrefixInput && typeof settings.outputPrefix === 'string') {
    outputPrefixInput.value = settings.outputPrefix;
  }

  if (exportSourceFolderInput && typeof settings.exportSourceFolder === 'string' && settings.exportSourceFolder.trim() !== '') {
    exportSourceFolderInput.value = settings.exportSourceFolder;
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
  }

  if (outputFolderInput && (outputFolderInput.value === '' || outputFolderInput.value === 'No folder selected') && lastUsedOutputFolder) {
    outputFolderInput.value = lastUsedOutputFolder;
  }

  if (outputPrefixInput && outputPrefixInput.value.trim() === '' && lastUsedOutputPrefix) {
    outputPrefixInput.value = lastUsedOutputPrefix;
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
  refreshGenerateState();
});

outputPrefixInput?.addEventListener('change', () => {
  if (outputPrefixInput.value.trim() !== '') {
    lastUsedOutputPrefix = outputPrefixInput.value.trim();
  }
  void persistSettings();
});

outputPrefixInput?.addEventListener('blur', () => {
  if (outputPrefixInput.value.trim() !== '') {
    lastUsedOutputPrefix = outputPrefixInput.value.trim();
  }
  void persistSettings();
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
    const confirmed = await window.desktopApp.showConfirm({
      type: 'question',
      title: 'Confirm Export',
      message: 'Create a fresh export folder with only questions and conversational training files?',
      detail: `Scan root: ${rootFolder}\n\nThe app will scan this folder recursively and create ${getBaseName(rootFolder.replace(/[\\/]+$/g, ''))}_training_files. Relative subfolders are preserved for copied files.`,
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
    addLog(`Scanning ${rootFolder} for training files...`, 'info');
    const exportResult = await window.desktopApp.exportTrainingFiles({ rootFolder });
    addLog(
      `Export complete: ${Number(exportResult?.copiedCount || 0)} files copied (${Number(exportResult?.summary?.questions || 0)} questions, ${Number(exportResult?.summary?.conversationalPairs || 0)} conversational).`,
      'success'
    );
    addLog(`Export folder created: ${exportResult?.exportFolder || ''}`, 'info');
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
void loadSavedSettings().then(() => refreshApiAvailability());
