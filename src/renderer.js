const cards = document.querySelectorAll('[data-file-card]');
const requiredCards = document.querySelectorAll('[data-file-card][data-required="true"]');
const destinationInputs = document.querySelectorAll('.destination-input');
const generateButton = document.getElementById('generateButton');
const generateHint = document.getElementById('generateHint');
const logWindow = document.getElementById('logWindow');
const clearLogButton = document.getElementById('clearLogButton');
const useSameFolderButton = document.getElementById('useSameFolderButton');
const getBaseName = (filePath) => (filePath ? filePath.split(/[/\\]/).pop() : '');

const destinationLabels = {
  extractedJsonFolder: 'Extracted Chapter JSON',
  questionBankFolder: 'Question Bank',
  pairSetFolder: 'Pair Set',
};

const outputFileNameInputs = {
  extractedJson: 'extractedJsonFileName',
  questionBank: 'questionBankFileName',
  pairSet: 'pairSetFileName',
};

const settingsInputIds = {
  extractedJsonFolder: 'extractedJsonFolder',
  questionBankFolder: 'questionBankFolder',
  pairSetFolder: 'pairSetFolder',
  extractedJsonFileName: outputFileNameInputs.extractedJson,
  questionBankFileName: outputFileNameInputs.questionBank,
  pairSetFileName: outputFileNameInputs.pairSet,
};

const cardRegistry = new Map();

const selectedFiles = {
  blueprint: null,
  documentJson: null,
  legacyBank: null,
  originalPdf: null,
};

const blueprintValidation = {
  valid: false,
  errors: [],
};

let blueprintData = null;
let documentJsonData = null;

const documentJsonValidation = {
  valid: false,
};

const updateCardDisplay = (key, fileLabel, options = {}) => {
  const cardInfo = cardRegistry.get(key);
  if (!cardInfo) {
    return;
  }

  cardInfo.fileName.textContent = fileLabel;
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

const getTimeStamp = () => {
  return new Date().toLocaleTimeString([], { hour12: false });
};

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

const syncTargetTotalQuestions = (data) => {
  const qb = data?.questionBank;
  if (!qb || !Array.isArray(qb.sectionBlueprints)) {
    return { changed: false, previous: null, next: null };
  }

  const sectionTotal = qb.sectionBlueprints.reduce((sum, section) => {
    const count = Number(section?.requiredQuestions);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);

  if (qb.targetTotalQuestions !== sectionTotal) {
    const previous = qb.targetTotalQuestions;
    qb.targetTotalQuestions = sectionTotal;
    return { changed: true, previous, next: sectionTotal };
  }

  return { changed: false, previous: qb.targetTotalQuestions, next: sectionTotal };
};

const validateBlueprintData = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      errors: ['Blueprint root must be a JSON object.'],
    };
  }

  const qb = data.questionBank;
  if (!qb || typeof qb !== 'object' || Array.isArray(qb)) {
    return {
      valid: false,
      errors: ['Missing questionBank object.'],
    };
  }

  const requiredStringFields = [
    'chapterId',
    'bookId',
    'chapterTitle',
    'sourceRelativePath',
    'generatedAt',
    'modelUsed',
    'modelVersion',
  ];

  requiredStringFields.forEach((field) => {
    if (typeof qb[field] !== 'string' || qb[field].trim() === '') {
      errors.push(`questionBank.${field} must be a non-empty string.`);
    }
  });

  if (!Array.isArray(qb.sectionBlueprints) || qb.sectionBlueprints.length === 0) {
    errors.push('questionBank.sectionBlueprints must be a non-empty array.');
  } else {
    // Accept BookId.Chapter.Section (e.g. AFH.3.1) or bare Chapter.Section (e.g. 3.18)
    const sectionIdPattern = /^([A-Za-z][A-Za-z0-9]*\.)?\d+\.\d+$/;
    const seenIds = new Set();

    qb.sectionBlueprints.forEach((section, index) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        errors.push(`sectionBlueprints[${index}] must be an object.`);
        return;
      }

      const sectionIdentifier = section.sectionId || section.id;
      if (typeof sectionIdentifier !== 'string' || sectionIdentifier.trim() === '') {
        errors.push(`sectionBlueprints[${index}] must include sectionId or id as a non-empty string.`);
      } else if (!sectionIdPattern.test(sectionIdentifier.trim())) {
        errors.push(`sectionBlueprints[${index}] id "${sectionIdentifier}" must follow format BookId.Chapter.Section (e.g. AFH.1.1).`);
      } else if (seenIds.has(sectionIdentifier.trim())) {
        errors.push(`sectionBlueprints[${index}] duplicate section ID "${sectionIdentifier}".`);
      } else {
        seenIds.add(sectionIdentifier.trim());
      }

      if (typeof section.sectionTitle !== 'string' || section.sectionTitle.trim() === '') {
        errors.push(`sectionBlueprints[${index}].sectionTitle must be a non-empty string.`);
      }

      if (!Number.isFinite(section.weightPercentage)) {
        errors.push(`sectionBlueprints[${index}].weightPercentage must be a number.`);
      }

      if (!Number.isFinite(section.requiredQuestions) || section.requiredQuestions <= 0) {
        errors.push(`sectionBlueprints[${index}].requiredQuestions must be a positive number.`);
      }

      if (typeof section.rationale !== 'string' || section.rationale.trim() === '') {
        errors.push(`sectionBlueprints[${index}].rationale must be a non-empty string.`);
      }
    });

    // targetTotalQuestions is synchronized from section totals at load time.
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const repairBlueprintData = (data) => {
  const qb = data.questionBank;
  const repairs = [];

  // Repair 1: Normalize section IDs missing the book prefix
  const bookId = qb.bookId;
  qb.sectionBlueprints.forEach((section) => {
    const idField = 'sectionId' in section ? 'sectionId' : 'id';
    const rawId = (section[idField] || '').trim();
    if (rawId && /^\d/.test(rawId)) {
      const fixed = `${bookId}.${rawId}`;
      section[idField] = fixed;
      repairs.push(`ID normalized: "${rawId}" → "${fixed}"`);
    }
  });

  // Repair 2: Keep targetTotalQuestions in sync with section totals
  const sync = syncTargetTotalQuestions(data);
  if (sync.changed) {
    repairs.push(`targetTotalQuestions synchronized: ${sync.previous} → ${sync.next}`);
  }

  return { data, repairs };
};

const getBlueprintRepairSuggestions = (data) => {
  const qb = data?.questionBank;
  if (!qb || !Array.isArray(qb.sectionBlueprints)) {
    return { hasRepairs: false, fixes: [] };
  }

  const fixes = [];
  const bareCount = qb.sectionBlueprints.filter((section) => {
    const sectionIdentifier = (section?.sectionId || section?.id || '').trim();
    return /^\d+\.\d+$/.test(sectionIdentifier);
  }).length;

  if (bareCount > 0) {
    fixes.push(
      `Add "${qb.bookId}." prefix to ${bareCount} section ID(s)\n  (e.g. "3.18" -> "${qb.bookId}.3.18")`
    );
  }

  const currentSum = qb.sectionBlueprints.reduce((sum, section) => sum + (section.requiredQuestions || 0), 0);
  if (Number.isFinite(currentSum) && qb.targetTotalQuestions !== currentSum) {
    fixes.push(`Set targetTotalQuestions from section total: ${qb.targetTotalQuestions} -> ${currentSum}`);
  }

  return { hasRepairs: fixes.length > 0, fixes };
};

const validateDocumentJson = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Document JSON root must be a non-empty object.' };
  }

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return { valid: false, error: 'Document JSON is empty — no content found.' };
  }

  // Warn about common expected top-level fields but don't block on them
  const hints = [];
  const commonFields = ['title', 'sections', 'content', 'chapters', 'chapterTitle', 'chapterId'];
  const hasAny = commonFields.some((f) => f in data);
  if (!hasAny) {
    hints.push(`No common chapter fields found (expected one of: ${commonFields.join(', ')}).`);
  }

  return { valid: true, hints, keyCount: keys.length };
};

const getDestinationsReady = () => {
  return Array.from(destinationInputs).every((input) => input.value && input.value !== 'No folder selected');
};

const ensureJsonExtension = (fileName, fallback) => {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
};

const getOutputFileNames = () => ({
  extractedJson: ensureJsonExtension(document.getElementById(outputFileNameInputs.extractedJson)?.value, 'chapter_rag.json'),
  questionBank: ensureJsonExtension(document.getElementById(outputFileNameInputs.questionBank)?.value, 'question_bank.generated.json'),
  pairSet: ensureJsonExtension(document.getElementById(outputFileNameInputs.pairSet)?.value, 'pair_set.generated.json'),
});

const collectSettings = () => {
  const settings = {};
  Object.entries(settingsInputIds).forEach(([key, id]) => {
    const element = document.getElementById(id);
    if (element) {
      settings[key] = element.value;
    }
  });
  return settings;
};

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
  Object.entries(settingsInputIds).forEach(([key, id]) => {
    const value = settings[key];
    const element = document.getElementById(id);
    if (element && typeof value === 'string' && value.trim() !== '') {
      element.value = value;
    }
  });
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

const setDefaultOutputNamesFromInputs = () => {
  const pdfBase = selectedFiles.originalPdf?.name ? selectedFiles.originalPdf.name.replace(/\.[^.]+$/, '') : '';
  const blueprintBase = selectedFiles.blueprint?.name ? selectedFiles.blueprint.name.replace(/\.[^.]+$/, '') : '';

  const extractedInput = document.getElementById(outputFileNameInputs.extractedJson);
  const questionBankInput = document.getElementById(outputFileNameInputs.questionBank);
  const pairSetInput = document.getElementById(outputFileNameInputs.pairSet);

  if (extractedInput && (!extractedInput.value || extractedInput.value === 'chapter_rag.json')) {
    extractedInput.value = ensureJsonExtension(pdfBase ? `${pdfBase}_rag` : 'chapter_rag', 'chapter_rag.json');
  }

  if (questionBankInput && (!questionBankInput.value || questionBankInput.value === 'question_bank.generated.json')) {
    questionBankInput.value = ensureJsonExtension(blueprintBase || 'question_bank.generated', 'question_bank.generated.json');
  }

  if (pairSetInput && (!pairSetInput.value || pairSetInput.value === 'pair_set.generated.json')) {
    const pairBase = blueprintBase ? `${blueprintBase}.pair_set.generated` : 'pair_set.generated';
    pairSetInput.value = ensureJsonExtension(pairBase, 'pair_set.generated.json');
  }
};

const applyFolderToAllOutputs = (selectedPath) => {
  Object.keys(destinationLabels).forEach((targetId) => {
    const targetInput = document.getElementById(targetId);
    if (targetInput) {
      targetInput.value = selectedPath;
    }
  });
};

const getRequiredUploadsReady = () => {
  return Array.from(requiredCards).every((card) => card.dataset.selected === 'true');
};

const refreshGenerateState = () => {
  if (!generateButton || !generateHint) {
    return;
  }

  const ready = getRequiredUploadsReady() && getDestinationsReady();
  generateButton.disabled = !ready;
  generateHint.textContent = ready
    ? 'Ready to extract from PDF and generate outputs.'
    : 'Select the PDF, blueprint, and all output destinations, or choose one folder for all outputs.';
};

cards.forEach((card) => {
  const dropZone = card.querySelector('.drop-zone');
  const uploadButton = card.querySelector('.upload-button');
  const fileInput = card.querySelector('.file-input');
  const fileName = card.querySelector('.file-name');
  const clearCardButton = card.querySelector('.clear-card-button');
  const title = card.querySelector('h2')?.textContent?.trim();
  cardRegistry.set(title === 'Blueprint' ? 'blueprint' : title === 'Document JSON' ? 'documentJson' : title === 'Legacy Bank' ? 'legacyBank' : title === 'Original PDF' ? 'originalPdf' : title, {
    card,
    fileName,
    title,
  });

  let key = null;
  if (title === 'Blueprint') key = 'blueprint';
  if (title === 'Document JSON') key = 'documentJson';
  if (title === 'Legacy Bank') key = 'legacyBank';
  if (title === 'Original PDF') key = 'originalPdf';

  if (clearCardButton) {
    clearCardButton.addEventListener('click', (event) => {
      event.stopPropagation();
      updateCardDisplay(key, 'No file selected', { selected: false, invalid: false });
      delete card.dataset.selected;
      fileInput.value = '';

      if (key === 'blueprint') {
        blueprintData = null;
        blueprintValidation.valid = false;
        blueprintValidation.errors = [];
        selectedFiles.blueprint = null;
      } else if (key === 'documentJson') {
        documentJsonData = null;
        documentJsonValidation.valid = false;
        selectedFiles.documentJson = null;
      } else if (key) {
        selectedFiles[key] = null;
      }

      addLog(`${title || 'File'} cleared.`);
      refreshGenerateState();
    });
  }

  const setFile = async (file) => {
    if (!file) {
      return;
    }

    if (key === 'blueprint') {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const repairSuggestions = getBlueprintRepairSuggestions(parsed);

        if (repairSuggestions.hasRepairs && window.desktopApp?.showConfirm) {
          const confirmed = await window.desktopApp.showConfirm({
            type: 'warning',
            title: 'Blueprint Repair Available',
            message: 'This blueprint has issues that can be fixed automatically.',
            detail: `Fixes to apply:\n\n${repairSuggestions.fixes.join('\n\n')}\n\nProceed with repair?`,
            buttons: ['Repair & Accept', 'Skip Repair'],
          });

          if (confirmed) {
            const { data: repaired, repairs } = repairBlueprintData(parsed);
            addLog('Repair applied:', 'info');
            repairs.forEach((r) => addLog(`  ✓ ${r}`, 'success'));
          } else {
            addLog('Repair skipped by user.', 'info');
          }
        }

        const result = validateBlueprintData(parsed);

        blueprintValidation.valid = result.valid;
        blueprintValidation.errors = result.errors;

        if (!result.valid) {
          // Classify errors: repairable vs structural
          const repairablePatterns = [
            /must follow format BookId/,
          ];
          const repairableErrors = result.errors.filter((e) =>
            repairablePatterns.some((p) => p.test(e))
          );
          const unrepairableErrors = result.errors.filter((e) =>
            !repairablePatterns.some((p) => p.test(e))
          );

          addLog('Blueprint validation failed.', 'error');
          result.errors.slice(0, 6).forEach((errorLine) => addLog(`- ${errorLine}`, 'error'));
          if (result.errors.length > 6) {
            addLog(`- ...and ${result.errors.length - 6} more issues.`, 'error');
          }

          // Offer repair if all errors are auto-fixable
          if (repairableErrors.length > 0 && unrepairableErrors.length === 0 && window.desktopApp?.showConfirm) {
            const fixes = repairSuggestions.fixes;

            const confirmed = await window.desktopApp.showConfirm({
              type: 'warning',
              title: 'Blueprint Repair Available',
              message: 'This blueprint has issues that can be fixed automatically.',
              detail: `Fixes to apply:\n\n${fixes.join('\n\n')}\n\nProceed with repair?`,
              buttons: ['Repair & Accept', 'Cancel'],
            });

            if (confirmed) {
              const { data: repaired, repairs } = repairBlueprintData(parsed);
              addLog('Repair applied:', 'info');
              repairs.forEach((r) => addLog(`  \u2713 ${r}`, 'success'));

              const recheck = validateBlueprintData(repaired);
              if (recheck.valid) {
                blueprintValidation.valid = true;
                blueprintValidation.errors = [];
                blueprintData = repaired;
                delete card.dataset.invalid;

                const qbFixed = repaired.questionBank;
                const PAIRS_PER_QUESTION = 11;
                const totalQ = qbFixed.targetTotalQuestions;
                addLog('Blueprint accepted after repair.', 'success');
                addLog(`Book: ${qbFixed.bookId}  |  Chapter: ${qbFixed.chapterTitle}`, 'success');
                addLog(`Sections: ${qbFixed.sectionBlueprints.length}  |  Questions: ${totalQ}`, 'success');
                addLog(`Estimated training pairs: ${totalQ * PAIRS_PER_QUESTION}  (${totalQ} \u00d7 ${PAIRS_PER_QUESTION})`, 'success');

                fileName.textContent = file.name;
                card.dataset.selected = 'true';
                selectedFiles.blueprint = { name: file.name, size: file.size, type: file.type };
                refreshGenerateState();
                return;
              } else {
                addLog('Repair could not resolve all issues.', 'error');
                recheck.errors.forEach((e) => addLog(`- ${e}`, 'error'));
              }
            } else {
              addLog('Repair cancelled.', 'info');
            }
          }

          fileName.textContent = `${file.name} (invalid)`;
          card.dataset.selected = 'false';
          card.dataset.invalid = 'true';
          selectedFiles.blueprint = null;
          blueprintData = null;
          refreshGenerateState();
          return;
        }

        delete card.dataset.invalid;
        blueprintData = parsed;

        const qb = parsed.questionBank;
        const PAIRS_PER_QUESTION = 11; // 3 correct + 8 wrong
        const totalQ = qb.targetTotalQuestions;
        const totalPairs = totalQ * PAIRS_PER_QUESTION;

        addLog('Blueprint format is correct.', 'success');
        addLog(`Book: ${qb.bookId}  |  Chapter: ${qb.chapterTitle}`, 'success');
        addLog(`Sections: ${qb.sectionBlueprints.length}  |  Total questions to generate: ${totalQ}`, 'success');
        addLog(`Estimated training pairs: ${totalPairs}  (${totalQ} questions × ${PAIRS_PER_QUESTION} answers each)`, 'success');
      } catch (error) {
        blueprintValidation.valid = false;
        blueprintValidation.errors = [
          'Blueprint must be valid JSON matching the expected questionBank structure.',
        ];
        fileName.textContent = `${file.name} (invalid JSON)`;
        card.dataset.selected = 'false';
        card.dataset.invalid = 'true';
        selectedFiles.blueprint = null;
        blueprintData = null;
        addLog('Blueprint validation failed: invalid JSON format.', 'error');
        refreshGenerateState();
        return;
      }
    }

    if (key === 'documentJson') {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = validateDocumentJson(parsed);

        if (!result.valid) {
          fileName.textContent = `${file.name} (invalid)`;
          card.dataset.selected = 'false';
          card.dataset.invalid = 'true';
          documentJsonData = null;
          documentJsonValidation.valid = false;
          addLog(`Document JSON validation failed: ${result.error}`, 'error');
          refreshGenerateState();
          return;
        }

        delete card.dataset.invalid;
        documentJsonData = parsed;
        documentJsonValidation.valid = true;
        addLog(`Document JSON loaded: ${file.name}  (${result.keyCount} top-level fields)`, 'success');
        if (result.hints && result.hints.length > 0) {
          result.hints.forEach((h) => addLog(`  Note: ${h}`, 'info'));
        }
      } catch {
        fileName.textContent = `${file.name} (invalid JSON)`;
        card.dataset.selected = 'false';
        card.dataset.invalid = 'true';
        documentJsonData = null;
        documentJsonValidation.valid = false;
        addLog('Document JSON validation failed: invalid JSON format.', 'error');
        refreshGenerateState();
        return;
      }
    }

    fileName.textContent = file.name;
    card.dataset.selected = 'true';
    if (key) {
      selectedFiles[key] = {
        name: file.name,
        size: file.size,
        type: file.type,
        path: file.path || null,
      };
    }
    if (key === 'originalPdf' || key === 'blueprint') {
      setDefaultOutputNamesFromInputs();
      void persistSettings();
    }
    if (key !== 'documentJson') {
      addLog(`${title || 'File'} selected: ${file.name}`);
    }
    refreshGenerateState();
  };

  uploadButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    void setFile(file);
  });

  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    card.dataset.dragging = 'true';
  });

  dropZone.addEventListener('dragleave', () => {
    delete card.dataset.dragging;
  });

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    delete card.dataset.dragging;
    const [file] = event.dataTransfer.files;
    void setFile(file);
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
});

const destinationButtons = document.querySelectorAll('[data-select-folder]');

destinationButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (!window.desktopApp?.selectFolder) {
      return;
    }

    const targetId = button.dataset.selectFolder;
    const targetInput = document.getElementById(targetId);

    if (!targetInput) {
      return;
    }

    const selectedPath = await window.desktopApp.selectFolder();
    if (selectedPath) {
      targetInput.value = selectedPath;
      addLog(`Destination selected for ${destinationLabels[targetId] || targetId}.`);
      await persistSettings();
      refreshGenerateState();
    }
  });
});

if (useSameFolderButton) {
  useSameFolderButton.addEventListener('click', async () => {
    if (!window.desktopApp?.selectFolder) {
      return;
    }

    const selectedPath = await window.desktopApp.selectFolder();
    if (selectedPath) {
      applyFolderToAllOutputs(selectedPath);
      addLog(`One folder selected for all outputs: ${selectedPath}`, 'success');
      await persistSettings();
      refreshGenerateState();
    }
  });
}

Object.values(outputFileNameInputs).forEach((id) => {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }
  input.addEventListener('change', () => {
    input.value = ensureJsonExtension(input.value, input.value || 'output.json');
    void persistSettings();
  });
  input.addEventListener('blur', () => {
    input.value = ensureJsonExtension(input.value, input.value || 'output.json');
    void persistSettings();
  });
});

if (clearLogButton && logWindow) {
  clearLogButton.addEventListener('click', () => {
    logWindow.innerHTML = '';
    addLog('Log cleared.');
  });
}

if (generateButton) {
  generateButton.addEventListener('click', async () => {
    if (generateButton.disabled) {
      return;
    }

    if (!window.desktopApp?.createPlaceholders) {
      addLog('Generate API not available.', 'error');
      return;
    }

    const extractedJsonFolder = document.getElementById('extractedJsonFolder')?.value;
    const questionBankFolder = document.getElementById('questionBankFolder')?.value;
    const pairSetFolder = document.getElementById('pairSetFolder')?.value;
    const outputFileNames = getOutputFileNames();

    // Pre-generate confirmation popup
    if (window.desktopApp?.showConfirm) {
      const qb = blueprintData?.questionBank;
      const PAIRS_PER_QUESTION = 11;
      const totalQ = qb?.targetTotalQuestions ?? 0;
      const totalPairs = totalQ * PAIRS_PER_QUESTION;

      const detail = [
        `Book:         ${qb?.bookId ?? '—'}`,
        `Chapter:      ${qb?.chapterTitle ?? '—'}`,
        `Sections:     ${qb?.sectionBlueprints?.length ?? 0}`,
        ``,
        `Questions to generate:  ${totalQ}`,
        `Training pairs:         ${totalPairs}`,
        ``,
        `Extracted JSON → ${extractedJsonFolder}\\${outputFileNames.extractedJson}`,
        `Question Bank → ${questionBankFolder}\\${outputFileNames.questionBank}`,
        `Pair Set      → ${pairSetFolder}\\${outputFileNames.pairSet}`,
      ].join('\n');

      const confirmed = await window.desktopApp.showConfirm({
        type: 'question',
        title: 'Confirm Generation',
        message: 'Review the generation parameters and confirm to proceed.',
        detail,
        buttons: ['Generate', 'Cancel'],
      });

      if (!confirmed) {
        addLog('Generation cancelled by user.');
        return;
      }
    }

    try {
      generateButton.disabled = true;
      addLog('Generation confirmed. Starting...');

      if (!selectedFiles.originalPdf?.path) {
        throw new Error('Source PDF is required.');
      }

      if (!window.desktopApp?.processPdf) {
        throw new Error('PDF extraction API not available.');
      }

      addLog('Extracting structured chapter JSON from PDF...');
      if (documentJsonData) {
        addLog('A manual document JSON was provided, but the PDF extraction result will be used for this run.', 'info');
      }

      const extracted = await window.desktopApp.processPdf({
        pdfPath: selectedFiles.originalPdf.path,
        docType: 'auto',
        outputDir: extractedJsonFolder,
        outputFileName: outputFileNames.extractedJson,
      });

      documentJsonData = extracted.data;
      documentJsonValidation.valid = true;
      selectedFiles.documentJson = {
        name: getBaseName(extracted.outputPath),
        size: JSON.stringify(extracted.data).length,
        type: 'application/json',
        path: extracted.outputPath,
        generated: true,
      };
      updateCardDisplay('documentJson', `${selectedFiles.documentJson.name} (generated)`, { selected: true, invalid: false });
      addLog(`Chapter JSON generated: ${extracted.outputPath}`, 'success');

      addLog('Creating placeholder question bank JSON...');

      const result = await window.desktopApp.createPlaceholders({
        questionBankFolder,
        pairSetFolder,
        outputFileNames,
        inputs: selectedFiles,
        blueprintData,
        documentJsonData,
      });

      addLog(`Question bank saved: ${result.questionBankPath}`, 'success');
      addLog(`Questions written: ${result.totalQuestions}`, 'success');
      addLog(`Pair set saved: ${result.pairSetPath}`, 'success');
      addLog(`Pairs written: ${result.totalPairs}  (${result.totalQuestions} questions × 11 answers each)`, 'success');
      addLog('Generation completed successfully.', 'success');
      await persistSettings();
    } catch (error) {
      addLog(`Generation failed: ${error.message}`, 'error');
    } finally {
      refreshGenerateState();
    }
  });
}

refreshGenerateState();
void loadSavedSettings();