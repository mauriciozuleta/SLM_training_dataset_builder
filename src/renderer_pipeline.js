const card = document.querySelector('[data-file-card]');
const requiredCards = document.querySelectorAll('[data-file-card][data-required="true"]');
const generateButton = document.getElementById('generateButton');
const generateHint = document.getElementById('generateHint');
const logWindow = document.getElementById('logWindow');
const clearLogButton = document.getElementById('clearLogButton');

const outputFolderInput = document.getElementById('outputFolder');
const outputFolderButton = document.querySelector('[data-select-folder="outputFolder"]');
const outputPrefixInput = document.getElementById('outputPrefix');
const pdfDropTextEl = document.getElementById('pdfDropText');
const legacyCard = document.querySelector('[data-legacy-card]');
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
const apiStatusEl = document.getElementById('apiStatus');

const outputBadgesByKey = {
  docJson: documentReadyBadge,
  summary: summaryReadyBadge,
  questions: questionReadyBadge,
  deterministicPairs: deterministicPairsReadyBadge,
  conversationalPairs: conversationalPairsReadyBadge,
};

const cardRegistry = new Map();
const selectedFiles = { originalPdf: null, legacyFile: null };
let lastLoadedPdfName = '';
let lastUsedOutputFolder = '';
let lastUsedOutputPrefix = '';
let apiAvailable = false;
let apiProviderCount = 0;
let apiProviders = [];
let generationInProgress = false;
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

const setConversionStatus = (message, percent = 0, state = 'idle') => {
  if (documentOutputCard) {
    documentOutputCard.dataset.state = state;
  }

  // Keep message/percent parameters for compatibility with existing call sites.
  void message;
  void percent;
};

const setOutputBuildState = (key, state = 'idle') => {
  const badge = outputBadgesByKey[key];
  if (!badge) {
    return;
  }

  if (state === 'idle') {
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    delete badge.dataset.state;
    badge.textContent = '';
    return;
  }

  badge.hidden = false;
  badge.setAttribute('aria-hidden', 'false');
  badge.dataset.state = state;

  if (state === 'success') {
    badge.textContent = '✓';
    return;
  }
  if (state === 'error') {
    badge.textContent = '!';
    return;
  }

  badge.textContent = '';
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

const applyApiOutputAvailability = async (available, providers = []) => {
  apiAvailable = Boolean(available);
  apiProviderCount = Array.isArray(providers) ? providers.length : 0;
  apiProviders = Array.isArray(providers) ? providers.slice() : [];

  if (apiStatusEl) {
    if (!apiAvailable) {
      apiStatusEl.textContent = 'API unavailable. Generation is disabled until API credentials are available. Performance reduced due API availability.';
    } else if (apiProviderCount < 2) {
      apiStatusEl.textContent = `API available (${providers.join(', ') || 'configured'}). Performance reduced due API availability.`;
    } else {
      apiStatusEl.textContent = `APIs available (${providers.join(', ')}). Parallel API execution enabled.`;
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
  if (!window.desktopApp?.getApiStatus) {
    await applyApiOutputAvailability(false, []);
    return;
  }

  try {
    const status = await window.desktopApp.getApiStatus();
    await applyApiOutputAvailability(status?.available, status?.providers || []);
  } catch (error) {
    addLog(`Could not verify API availability: ${error.message}`, 'error');
    await applyApiOutputAvailability(false, []);
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

const refreshGenerateState = () => {
  if (!generateButton || !generateHint) {
    return;
  }

  const ready = !generationInProgress && getRequiredUploadsReady() && getDestinationsReady() && hasSelectedOutput();
  generateButton.disabled = !ready;
  generateButton.textContent = generationInProgress ? 'Generating...' : 'Generate';

  if (generationInProgress) {
    generateHint.textContent = 'Generation in progress. Please wait.';
    return;
  }

  if (!apiAvailable) {
    generateHint.textContent = ready
      ? 'API is required before generation can start.'
      : 'Set API credentials, then select PDF/output options.';
    return;
  }

  generateHint.textContent = ready
    ? 'Ready to process PDF and generate selected outputs.'
    : 'Select the PDF, output folder, and at least one output type.';
};

const collectSettings = () => ({
  outputFolder: outputFolderInput?.value || '',
  outputPrefix: outputPrefixInput?.value || '',
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

  enforceOutputDependencies();

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
            setOutputBuildState(key, 'running');
            return;
          }
          if (state === 'completed') {
            setOutputReadyState(key, true);
            return;
          }
          if (state === 'error') {
            setOutputBuildState(key, 'error');
          }
        }) || (() => {});

        let result;
        try {
          result = await window.desktopApp.buildArtifacts({
            outputDir: outputFolder,
            selectedOutputs,
            outputFileNames,
            documentJson: extracted.data,
            documentJsonPath: extracted.outputPath,
            allowOverwrite,
            idPrefix: documentIdPrefix,
            apiProviderCount,
            apiProviders,
          });
        } finally {
          unsubscribeArtifactProgress();
        }

        if (Array.isArray(result?.written) && result.written.length > 0) {
          result.written.forEach((entry) => {
            if (entry?.key === 'docJson' && entry?.reused) {
              addLog(`Document JSON / MD already created: ${entry.path}`, 'info');
              setOutputReadyState('docJson', true);
              return;
            }
            if (entry?.key === 'summary') {
              setOutputReadyState('summary', true);
            }
            if (entry?.key === 'questions') {
              setOutputReadyState('questions', true);
            }
            if (entry?.key === 'deterministicPairs') {
              setOutputReadyState('deterministicPairs', true);
            }
            if (entry?.key === 'conversationalPairs') {
              setOutputReadyState('conversationalPairs', true);
            }
            addLog(`Saved (${entry.key}): ${entry.path}`, 'success');
          });
        } else {
          addLog('No selected artifacts were written.', 'info');
        }

        setConversionStatus('Conversion completed successfully.', 100, 'success');
        addLog('Pipeline completed successfully.', 'success');
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
    markRunningOutputsAsError();
    setConversionStatus(`Conversion failed: ${error.message}`, 100, 'error');
    addLog(`Pipeline failed: ${error.message}`, 'error');
  } finally {
    generationInProgress = false;
    refreshGenerateState();
  }
});

refreshGenerateState();
resetDocumentOutputState();
void loadSavedSettings().then(() => refreshApiAvailability());
