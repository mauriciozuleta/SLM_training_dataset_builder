(() => {
  const NO_FOLDER_SELECTED_LABEL = 'No folder selected';

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

  const isSameOrNestedPath = (candidatePath, basePath) => {
    const candidate = normalizePathForCompare(candidatePath);
    const base = normalizePathForCompare(basePath);
    if (!candidate || !base) {
      return false;
    }
    return candidate === base || candidate.startsWith(`${base}/`);
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

  window.rendererUtils = {
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
  };
})();