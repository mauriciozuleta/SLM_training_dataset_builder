const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const { createDocumentGenerationService } = require('./src/main/services/documentGenerationService');
const { performAudit } = require('./scripts/audit_training_pairs');
const { repairAffectedPairs } = require('./src/main/services/documentGeneration/pairRepairService');
const { persistDeferredQualityLog } = require('./src/main/services/documentGeneration/deferredQualityLogService');
const { getQualityGuardrails, getQualityStabilityStatus, updateQualityMemoryFromAudit } = require('./src/main/services/documentGeneration/qualityMemoryService');
const { createExportDatasetService } = require('./src/main/services/exportDatasetService');
const packageMetadata = require('./package.json');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP_DISPLAY_NAME = 'Pair Generation Desktop';
const APP_VERSION = packageMetadata?.version || '0.0.0';
const LOCAL_USER_DATA_DIR = path.join(__dirname, '.electron-user-data');

app.setName(APP_DISPLAY_NAME);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
try {
  app.setPath('userData', LOCAL_USER_DATA_DIR);
} catch {
  // Keep Electron default userData path if setting a custom path is unavailable.
}

const API_TIMEOUT_MS = Math.max(15000, Number.parseInt(process.env.API_TIMEOUT_MS || '90000', 10) || 90000);
const MAX_QUESTION_TARGET = Math.max(50, Number.parseInt(process.env.MAX_QUESTION_TARGET || '150', 10) || 150);

const documentGenerationService = createDocumentGenerationService({
  fs,
  path,
  env: process.env,
  apiTimeoutMs: API_TIMEOUT_MS,
  maxQuestionTarget: MAX_QUESTION_TARGET,
});
const exportDatasetService = createExportDatasetService({ fs, path });

let activeGenerationAbortController = null;

function normalizeJsonFileName(fileName, fallback) {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  const safe = path.basename(base);
  return safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;
}

function normalizeMarkdownFileName(fileName, fallback) {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  const safe = path.basename(base);
  return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
}

function normalizePathForCompare(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    return '';
  }
  return path.resolve(inputPath).replace(/\\/g, '/').toLowerCase();
}

function normalizeDocumentIdPrefix(prefix) {
  const raw = typeof prefix === 'string' ? prefix.trim() : '';
  if (!raw) {
    return '';
  }

  return raw
    .replace(/\s+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

async function loadAppSettings() {
  const settingsPath = getSettingsFilePath();
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAppSettings(settings) {
  const settingsPath = getSettingsFilePath();
  const next = settings && typeof settings === 'object' ? settings : {};
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function normalizeProjectCacheEntry(projectData) {
  const rootPath = `${projectData?.rootPath || ''}`.trim();
  if (!rootPath) {
    return null;
  }

  return {
    projectName: `${projectData?.projectName || ''}`.trim() || path.basename(rootPath),
    projectType: `${projectData?.projectType || 'single-dataset'}`.trim(),
    rootPath,
    foundationSourceDocsPath: `${projectData?.foundationSourceDocsPath || ''}`.trim(),
    reinforcementSourceDocsPath: `${projectData?.reinforcementSourceDocsPath || ''}`.trim(),
    createdAt: `${projectData?.createdAt || new Date().toISOString()}`,
    lastAccessedAt: `${projectData?.lastAccessedAt || new Date().toISOString()}`,
  };
}

async function updateProjectIndex(settings, projectData) {
  const nextSettings = settings && typeof settings === 'object' ? settings : {};
  const entry = normalizeProjectCacheEntry(projectData);
  if (!entry) {
    return { settings: nextSettings, entry: null };
  }

  const normalizedRoot = path.resolve(entry.rootPath);
  const cachedProjects = Array.isArray(nextSettings.cachedProjects) ? nextSettings.cachedProjects : [];
  nextSettings.cachedProjects = cachedProjects.filter((proj) => {
    const existingRoot = `${proj?.rootPath || ''}`.trim();
    return existingRoot && path.resolve(existingRoot) !== normalizedRoot;
  });
  nextSettings.cachedProjects.unshift(entry);
  if (nextSettings.cachedProjects.length > 50) {
    nextSettings.cachedProjects = nextSettings.cachedProjects.slice(0, 50);
  }

  const searchRoots = Array.isArray(nextSettings.projectSearchRoots) ? nextSettings.projectSearchRoots : [];
  const candidateRoots = [path.dirname(entry.rootPath), entry.rootPath];
  for (const candidate of candidateRoots) {
    const raw = `${candidate || ''}`.trim();
    if (!raw) {
      continue;
    }
    const normalizedCandidate = path.resolve(raw);
    if (!searchRoots.some((existing) => {
      const existingRaw = `${existing || ''}`.trim();
      return existingRaw && path.resolve(existingRaw) === normalizedCandidate;
    })) {
      searchRoots.unshift(normalizedCandidate);
    }
  }
  nextSettings.projectSearchRoots = searchRoots.slice(0, 25);

  return { settings: nextSettings, entry };
}

async function discoverProjectsInRoots(searchRoots) {
  const roots = Array.isArray(searchRoots) ? searchRoots : [];
  const found = [];
  const seenRoots = new Set();
  const searchedPaths = [];

  for (const root of roots) {
    const rawRoot = `${root || ''}`.trim();
    if (!rawRoot) {
      continue;
    }
    const normalizedRoot = path.resolve(rawRoot);
    if (seenRoots.has(normalizedRoot)) {
      continue;
    }
    seenRoots.add(normalizedRoot);
    searchedPaths.push(normalizedRoot);

    try {
      await fs.access(normalizedRoot);
    } catch {
      continue;
    }

    const queue = [{ dirPath: normalizedRoot, depth: 0 }];
    let visitedCount = 0;
    const maxDepth = 3;
    const maxVisitedDirs = 1200;

    while (queue.length > 0 && visitedCount < maxVisitedDirs) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      visitedCount += 1;

      const manifestPath = path.join(current.dirPath, 'project_manifest.json');
      try {
        const manifestRaw = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestRaw);
        const normalizedEntry = normalizeProjectCacheEntry({
          projectName: manifest?.projectName || path.basename(current.dirPath),
          projectType: manifest?.projectType || 'single-dataset',
          rootPath: current.dirPath,
          createdAt: manifest?.createdAt,
          foundationSourceDocsPath: manifest?.projectType === 'slm-training' ? '' : '',
          reinforcementSourceDocsPath: manifest?.projectType === 'slm-training' ? '' : '',
        });
        if (normalizedEntry) {
          found.push(normalizedEntry);
        }
        continue;
      } catch {
        // Not a project root; continue traversal.
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      let children = [];
      try {
        children = await fs.readdir(current.dirPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const child of children) {
        if (!child.isDirectory()) {
          continue;
        }
        queue.push({ dirPath: path.join(current.dirPath, child.name), depth: current.depth + 1 });
      }
    }
  }

  const deduped = [];
  const seenProjectPaths = new Set();
  for (const project of found) {
    const rootPath = `${project?.rootPath || ''}`.trim();
    if (!rootPath) {
      continue;
    }
    const normalized = path.resolve(rootPath);
    if (seenProjectPaths.has(normalized)) {
      continue;
    }
    seenProjectPaths.add(normalized);
    deduped.push(project);
  }

  return { projects: deduped, searchedPaths };
}

function getPythonLaunchers() {
  const launchers = [];
  const pushLauncher = (command, args = []) => {
    if (!command) {
      return;
    }
    if (!launchers.some((launcher) => launcher.command === command && launcher.args.join(' ') === args.join(' '))) {
      launchers.push({ command, args });
    }
  };

  pushLauncher(process.env.PYTHON);
  pushLauncher('C:\\Program Files\\Python310\\python.exe');
  pushLauncher('py', ['-3.10']);
  pushLauncher('python');

  return launchers;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`Command failed with exit code ${code}.`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function isMissingPdfMinerError(error) {
  const stderr = `${error?.stderr || ''}`.toLowerCase();
  const stdout = `${error?.stdout || ''}`.toLowerCase();
  return stderr.includes("no module named 'pdfminer'")
    || stderr.includes('no module named pdfminer')
    || stdout.includes("no module named 'pdfminer'")
    || stdout.includes('no module named pdfminer');
}

async function installPdfToRagRequirements(launcher, ragDir) {
  const requirementsPath = path.join(ragDir, 'requirements.txt');
  await fs.access(requirementsPath);

  return runCommand(
    launcher.command,
    [...launcher.args, '-m', 'pip', 'install', '-r', requirementsPath, '--disable-pip-version-check'],
    { cwd: ragDir, env: { ...process.env } }
  );
}

async function processPdfToJson(payload) {
  const pdfPath = payload?.pdfPath;
  if (!pdfPath) {
    throw new Error('Missing pdfPath.');
  }

  const allowOverwrite = Boolean(payload?.allowOverwrite);
  const docType = payload?.docType || 'auto';
  const outputDir = payload?.outputDir || path.join(app.getPath('temp'), 'pair-generation-rag');
  const outputFileName = normalizeJsonFileName(payload?.outputFileName, 'chapter_rag.json');
  const idPrefix = normalizeDocumentIdPrefix(payload?.idPrefix);
  const chapterNumberOverride = Number.parseInt(payload?.chapterNumberOverride, 10);
  const safeChapterOverride = Number.isFinite(chapterNumberOverride) && chapterNumberOverride > 0
    ? chapterNumberOverride
    : 0;
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputFileName);

  if (!allowOverwrite) {
    try {
      const existingEntries = await fs.readdir(outputDir);
      const existingNames = new Set(existingEntries.map((entry) => entry.toLowerCase()));
      if (!existingNames.has(outputFileName.toLowerCase())) {
        throw Object.assign(new Error('Not found.'), { code: 'ENOENT' });
      }
      throw new Error(`Output file already exists: ${outputPath}`);
    } catch (error) {
      if (error?.code && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const ragDir = path.resolve(__dirname, 'pdf_to_rag');
  const ragScript = path.join(ragDir, 'pdf_to_rag.py');
  try {
    await fs.access(ragScript);
  } catch {
    throw new Error(`PDF to RAG script not found at: ${ragScript}`);
  }

  const pythonCode = [
    'import json, os, sys',
    'sys.path.insert(0, os.environ["PDF_TO_RAG_DIR"])',
    'from pdf_to_rag import process_pdf',
    'override = int(os.environ.get("PDF_CHAPTER_OVERRIDE", "0") or 0)',
    'result = process_pdf(os.environ["PDF_INPUT_PATH"], os.environ["PDF_OUTPUT_DIR"], output_filename=os.environ.get("PDF_OUTPUT_FILE"), doc_type=os.environ.get("PDF_DOC_TYPE", "auto"), chapter_number_override=(override if override > 0 else None), prefix=os.environ.get("PDF_PREFIX", ""))',
    'md_path = os.path.splitext(result)[0] + ".md"',
    'print("__PDF_TO_RAG_RESULT__" + json.dumps({"output_path": result, "markdown_path": md_path}))',
  ].join('; ');

  const env = {
    ...process.env,
    PDF_TO_RAG_DIR: ragDir,
    PDF_INPUT_PATH: pdfPath,
    PDF_OUTPUT_DIR: outputDir,
    PDF_OUTPUT_FILE: outputFileName,
    PDF_DOC_TYPE: docType,
    PDF_CHAPTER_OVERRIDE: String(safeChapterOverride || 0),
    PDF_PREFIX: idPrefix,
  };

  const executeExtraction = async (launcher) => {
    const { stdout, stderr } = await runCommand(
      launcher.command,
      [...launcher.args, '-c', pythonCode],
      { env, cwd: ragDir }
    );

    const resultLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('__PDF_TO_RAG_RESULT__'));

    if (!resultLine) {
      const parseError = new Error('PDF extraction completed but returned no output path.');
      parseError.stdout = stdout;
      parseError.stderr = stderr;
      throw parseError;
    }

    const parsed = JSON.parse(resultLine.replace('__PDF_TO_RAG_RESULT__', ''));
    const outputPath = parsed.output_path;
    const markdownPath = parsed.markdown_path;
    const fileContent = await fs.readFile(outputPath, 'utf8');

    return {
      outputPath,
      markdownPath,
      data: JSON.parse(fileContent),
      stdout,
      stderr,
      launcher: launcher.command,
    };
  };

  let lastError = null;
  for (const launcher of getPythonLaunchers()) {
    try {
      return await executeExtraction(launcher);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue;
      }

      if (isMissingPdfMinerError(error)) {
        try {
          await installPdfToRagRequirements(launcher, ragDir);
          return await executeExtraction(launcher);
        } catch (installOrRetryError) {
          lastError = installOrRetryError;
          continue;
        }
      }

      lastError = error;
    }
  }

  const detail = lastError?.stderr || lastError?.message || 'Unknown Python launcher failure.';
  throw new Error(
    `Unable to process PDF with the Python extractor. ${detail} If needed, install dependencies with: python -m pip install -r pdf_to_rag/requirements.txt`
  );
}

async function writeSelectedArtifacts(payload) {
  return documentGenerationService.writeSelectedArtifacts(payload);
}

function getApiStatus() {
  return documentGenerationService.getApiStatus();
}

async function verifyApiProviders() {
  return documentGenerationService.verifyApiProviders();
}

async function runPairAudit(payload = {}) {
  const result = performAudit({
    root: payload?.root,
    file: payload?.file,
    files: payload?.files,
    reportPath: payload?.reportPath,
    failOnWarning: Boolean(payload?.failOnWarning),
  });

  if (!result.ok && result.exitCode === 2) {
    throw new Error(result.message || 'No pair files found for audit.');
  }

  return result;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: `${APP_DISPLAY_NAME} v${APP_VERSION}`,
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:showConfirm', async (_event, options) => {
    const result = await dialog.showMessageBox({
      type: options.type || 'question',
      buttons: options.buttons || ['Proceed', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: options.title || 'Confirm',
      message: options.message || 'Are you sure?',
      detail: options.detail || '',
    });

    return result.response === 0;
  });

  ipcMain.handle('dialog:showAlert', async (_event, options) => {
    await dialog.showMessageBox({
      type: options.type || 'info',
      buttons: ['OK'],
      title: options.title || 'Notice',
      message: options.message || '',
      detail: options.detail || '',
    });
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('dialog:selectSourceEntries', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Source Files Or Folder',
      properties: ['openFile', 'openDirectory', 'multiSelections', 'createDirectory'],
      filters: [
        {
          name: 'Supported Documents',
          extensions: ['pdf', 'json', 'md', 'txt', 'doc', 'docx'],
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return result.filePaths;
  });

  ipcMain.handle('project:createFolders', async (_event, projectName, destinationFolder, projectType, foundationLabel, reinforcementLabel) => {
    try {
      if (!projectName || typeof projectName !== 'string') {
        return { success: false, error: 'Invalid project name' };
      }

      if (!destinationFolder || typeof destinationFolder !== 'string') {
        return { success: false, error: 'Invalid destination folder' };
      }

      const validProjectTypes = new Set(['single-dataset', 'subject-dataset', 'slm-training']);
      const normalizedType = validProjectTypes.has(projectType) ? projectType : 'single-dataset';

      const normalizedName = projectName.trim().replace(/[/\\?%*:|"<>]/g, '_');
      const projectSlug = normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'project';
      const projectRoot = path.join(destinationFolder, normalizedName);
      await fs.mkdir(projectRoot, { recursive: true });

      let relativeFolders = [];
      let sourceDocsPath = '';
      let foundationSourceDocsPath = '';
      let reinforcementSourceDocsPath = '';

      if (normalizedType === 'single-dataset') {
        relativeFolders = [
          'source_documents/input',
          'source_documents/archived',
          'dataset/outputs',
          'dataset/quality_reports',
          'dataset/exports',
          'logs',
        ];
        sourceDocsPath = path.join(projectRoot, 'source_documents', 'input');
        foundationSourceDocsPath = sourceDocsPath;
        reinforcementSourceDocsPath = sourceDocsPath;
      } else if (normalizedType === 'subject-dataset') {
        relativeFolders = [
          'source_documents/chapters',
          'source_documents/shared_resources',
          'dataset/chapter_outputs',
          'dataset/merged_subject_dataset',
          'dataset/quality_reports',
          'dataset/exports',
          'indexes',
          'logs',
        ];
        sourceDocsPath = path.join(projectRoot, 'source_documents', 'chapters');
        foundationSourceDocsPath = sourceDocsPath;
        reinforcementSourceDocsPath = sourceDocsPath;
      } else {
        const foundationSlug = `${foundationLabel || ''}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || projectSlug;
        const reinforcementSlug = `${reinforcementLabel || ''}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || `${projectSlug}_phase_2`;
        const foundationStageFolder = `01_foundation_${foundationSlug}`;
        const reinforcementStageFolder = `02_reinforcement_${reinforcementSlug}`;

        relativeFolders = [
          `curriculum/${foundationStageFolder}/source_documents`,
          `curriculum/${foundationStageFolder}/dataset`,
          `curriculum/${foundationStageFolder}/quality_reports`,
          `curriculum/${foundationStageFolder}/exports`,
          `curriculum/${reinforcementStageFolder}/source_documents`,
          `curriculum/${reinforcementStageFolder}/dataset`,
          `curriculum/${reinforcementStageFolder}/quality_reports`,
          `curriculum/${reinforcementStageFolder}/exports`,
          'training_packs/pack_v1/train',
          'training_packs/pack_v1/validation',
          'training_packs/pack_v1/test',
          'training_packs/pack_v1/metadata',
          'evaluations/benchmark_runs',
          'evaluations/scorecards',
          'models/checkpoints',
          'models/final',
          'registry',
          'logs',
        ];
        sourceDocsPath = path.join(projectRoot, 'curriculum', foundationStageFolder, 'source_documents');
        foundationSourceDocsPath = path.join(projectRoot, 'curriculum', foundationStageFolder, 'source_documents');
        reinforcementSourceDocsPath = path.join(projectRoot, 'curriculum', reinforcementStageFolder, 'source_documents');
      }

      await Promise.all(relativeFolders.map((folder) => fs.mkdir(path.join(projectRoot, folder), { recursive: true })));

      const manifestPath = path.join(projectRoot, 'project_manifest.json');
      const manifestPayload = {
        projectName: normalizedName,
        projectType: normalizedType,
        foundationLabel: `${foundationLabel || ''}`.trim(),
        reinforcementLabel: `${reinforcementLabel || ''}`.trim(),
        createdAt: new Date().toISOString(),
        rootPath: projectRoot,
      };
      await fs.writeFile(manifestPath, `${JSON.stringify(manifestPayload, null, 2)}\n`, 'utf8');

      const existingSettings = await loadAppSettings();
      const indexed = await updateProjectIndex(existingSettings, {
        projectName: normalizedName,
        projectType: normalizedType,
        rootPath: projectRoot,
        foundationSourceDocsPath,
        reinforcementSourceDocsPath,
        createdAt: manifestPayload.createdAt,
      });
      await saveAppSettings(indexed.settings);

      return {
        success: true,
        projectName: normalizedName,
        projectType: normalizedType,
        rootPath: projectRoot,
        sourceDocsPath,
        foundationSourceDocsPath,
        reinforcementSourceDocsPath,
        createdFolders: relativeFolders,
        manifestPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to create project folders',
      };
    }
  });

  ipcMain.handle('settings:get', async () => {
    return loadAppSettings();
  });

  ipcMain.handle('project:inspectSourceEntries', async (_event, payload) => {
    try {
      const entryPaths = Array.isArray(payload?.entryPaths)
        ? payload.entryPaths.filter((entry) => typeof entry === 'string' && entry.trim() !== '')
        : [];
      const acceptedExtensions = new Set(['.pdf', '.json', '.md', '.txt', '.doc', '.docx']);

      const collectFileEntries = async (entryPath) => {
        const stats = await fs.stat(entryPath);
        if (stats.isFile()) {
          return [entryPath];
        }
        if (!stats.isDirectory()) {
          return [];
        }

        const children = await fs.readdir(entryPath, { withFileTypes: true });
        const nested = await Promise.all(
          children.map((child) => collectFileEntries(path.join(entryPath, child.name)))
        );
        return nested.flat();
      };

      const entries = [];
      for (const rawEntryPath of entryPaths) {
        const entryPath = path.resolve(rawEntryPath);
        const stats = await fs.stat(entryPath);
        const fileEntries = await collectFileEntries(entryPath);
        const acceptedDocuments = fileEntries
          .filter((sourcePath) => acceptedExtensions.has(path.extname(sourcePath).toLowerCase()))
          .map((sourcePath) => ({
            path: sourcePath,
            name: path.basename(sourcePath),
            relativePath: stats.isDirectory() ? path.relative(entryPath, sourcePath) : path.basename(sourcePath),
          }));

        entries.push({
          path: entryPath,
          name: path.basename(entryPath),
          isDirectory: stats.isDirectory(),
          documents: acceptedDocuments,
        });
      }

      return { success: true, entries };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to inspect source entries',
      };
    }
  });

  ipcMain.handle('project:createSourceSubfolder', async (_event, payload) => {
    try {
      const stage = `${payload?.stage || ''}`.trim().toLowerCase();
      const label = `${payload?.label || ''}`.trim();
      const foundationPath = `${payload?.foundationSourceDocsPath || ''}`.trim();
      const reinforcementPath = `${payload?.reinforcementSourceDocsPath || ''}`.trim();
      if (!label) {
        return { success: false, error: 'Folder label is required' };
      }
      if (!stage || !['foundation', 'reinforcement'].includes(stage)) {
        return { success: false, error: 'Valid stage is required' };
      }

      const basePath = stage === 'foundation' ? foundationPath : reinforcementPath;
      if (!basePath) {
        return { success: false, error: `Source path is not available for ${stage}` };
      }

      const sanitizedLabel = label
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!sanitizedLabel) {
        return { success: false, error: 'Folder label is not valid' };
      }

      const stageRootPath = path.dirname(basePath);
      const curriculumRootPath = path.dirname(stageRootPath);

      const existingStageFolders = await fs.readdir(curriculumRootPath, { withFileTypes: true });
      const stageNumbers = existingStageFolders
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const match = entry.name.match(/^(\d+)_/);
          return match ? Number.parseInt(match[1], 10) : 0;
        })
        .filter((value) => Number.isFinite(value) && value > 0);
      const nextStageNumber = (stageNumbers.length > 0 ? Math.max(...stageNumbers) : 0) + 1;
      const stagePrefix = `${nextStageNumber}`.padStart(2, '0');

      let folderName = `${stagePrefix}_${stage}_${sanitizedLabel}`;
      let stageFolderPath = path.join(curriculumRootPath, folderName);
      let counter = 1;
      while (true) {
        try {
          await fs.access(stageFolderPath);
          counter += 1;
          folderName = `${stagePrefix}_${stage}_${sanitizedLabel}_${counter}`;
          stageFolderPath = path.join(curriculumRootPath, folderName);
        } catch {
          break;
        }
      }

      const sourceDocumentsPath = path.join(stageFolderPath, 'source_documents');
      await Promise.all([
        fs.mkdir(sourceDocumentsPath, { recursive: true }),
        fs.mkdir(path.join(stageFolderPath, 'dataset'), { recursive: true }),
        fs.mkdir(path.join(stageFolderPath, 'quality_reports'), { recursive: true }),
        fs.mkdir(path.join(stageFolderPath, 'exports'), { recursive: true }),
      ]);

      return {
        success: true,
        stage,
        folderName,
        folderPath: sourceDocumentsPath,
        stageFolderPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to create source subfolder',
      };
    }
  });

  ipcMain.handle('project:addSourceDocuments', async (_event, payload) => {
    try {
      const filePaths = Array.isArray(payload?.filePaths) ? payload.filePaths.filter((entry) => typeof entry === 'string' && entry.trim() !== '') : [];
      const targetFolder = typeof payload?.targetFolder === 'string' ? payload.targetFolder.trim() : '';
      if (filePaths.length === 0) {
        return { success: false, error: 'No source files provided' };
      }
      if (!targetFolder) {
        return { success: false, error: 'Target folder is required' };
      }

      const acceptedExtensions = new Set(['.pdf', '.json', '.md', '.txt', '.doc', '.docx']);
      const uniqueInputPaths = [...new Set(filePaths.map((entry) => path.resolve(entry)))];
      const copied = [];

      const collectFileEntries = async (entryPath) => {
        const stats = await fs.stat(entryPath);
        if (stats.isFile()) {
          return [entryPath];
        }
        if (!stats.isDirectory()) {
          return [];
        }

        const children = await fs.readdir(entryPath, { withFileTypes: true });
        const nested = await Promise.all(
          children.map((child) => collectFileEntries(path.join(entryPath, child.name)))
        );
        return nested.flat();
      };

      const ensureUniqueDestination = async (baseDestination) => {
        const extension = path.extname(baseDestination);
        const stem = extension ? baseDestination.slice(0, -extension.length) : baseDestination;
        let candidate = baseDestination;
        let counter = 1;
        while (true) {
          try {
            await fs.access(candidate);
            counter += 1;
            candidate = `${stem}_${counter}${extension}`;
          } catch {
            return candidate;
          }
        }
      };

      await fs.mkdir(targetFolder, { recursive: true });

      for (const entryPath of uniqueInputPaths) {
        const allFiles = await collectFileEntries(entryPath);
        for (const sourcePath of allFiles) {
          const extension = path.extname(sourcePath).toLowerCase();
          if (!acceptedExtensions.has(extension)) {
            continue;
          }

          const destinationBase = path.join(targetFolder, path.basename(sourcePath));
          const destinationPath = await ensureUniqueDestination(destinationBase);
          await fs.copyFile(sourcePath, destinationPath);
          copied.push({ source: sourcePath, destination: destinationPath });
        }
      }

      return {
        success: true,
        copied,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to add project source documents',
      };
    }
  });

  ipcMain.handle('settings:save', async (_event, payload) => {
    return saveAppSettings(payload);
  });

  ipcMain.handle('project:cacheProject', async (_event, projectData) => {
    try {
      const settings = await loadAppSettings();
      const indexed = await updateProjectIndex(settings, projectData || {});
      if (!indexed.entry) {
        return { success: false, error: 'Missing rootPath for cache entry' };
      }
      await saveAppSettings(indexed.settings);
      return { success: true, cachedProjects: indexed.settings.cachedProjects || [] };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to cache project' };
    }
  });

  ipcMain.handle('project:getCachedProjects', async () => {
    try {
      const settings = await loadAppSettings();
      const cachedProjects = Array.isArray(settings.cachedProjects) ? settings.cachedProjects : [];
      const diagnostics = {
        fromCacheCount: 0,
        recoveredCount: 0,
        searchedPaths: [],
      };

      // Filter out projects whose root paths no longer exist
      const validProjects = [];
      for (const project of cachedProjects) {
        const rootPath = `${project?.rootPath || ''}`.trim();
        if (!rootPath) {
          continue;
        }
        try {
          await fs.access(rootPath);
          validProjects.push(project);
        } catch {
          // Project path no longer exists, skip it
        }
      }
      diagnostics.fromCacheCount = validProjects.length;

      let mergedProjects = [...validProjects];
      const needsRecoveryScan = mergedProjects.length === 0;
      if (needsRecoveryScan) {
        const searchRoots = Array.isArray(settings.projectSearchRoots) ? [...settings.projectSearchRoots] : [];
        searchRoots.push(process.cwd());
        searchRoots.push(path.dirname(process.cwd()));
        const discovered = await discoverProjectsInRoots(searchRoots);
        diagnostics.searchedPaths = discovered.searchedPaths;
        diagnostics.recoveredCount = discovered.projects.length;
        if (discovered.projects.length > 0) {
          const byRoot = new Map();
          for (const project of [...mergedProjects, ...discovered.projects]) {
            const rootPath = `${project?.rootPath || ''}`.trim();
            if (!rootPath) {
              continue;
            }
            byRoot.set(path.resolve(rootPath), project);
          }
          mergedProjects = Array.from(byRoot.values());
        }
      }

      // Update cache to remove stale entries
      if (mergedProjects.length !== cachedProjects.length || diagnostics.recoveredCount > 0) {
        const updatedSettings = settings;
        updatedSettings.cachedProjects = mergedProjects;
        if (!Array.isArray(updatedSettings.projectSearchRoots)) {
          updatedSettings.projectSearchRoots = [];
        }
        for (const project of mergedProjects) {
          const rootPath = `${project?.rootPath || ''}`.trim();
          if (!rootPath) {
            continue;
          }
          const parentPath = path.dirname(rootPath);
          if (!updatedSettings.projectSearchRoots.some((entry) => path.resolve(`${entry || ''}`) === path.resolve(parentPath))) {
            updatedSettings.projectSearchRoots.unshift(parentPath);
          }
        }
        updatedSettings.projectSearchRoots = updatedSettings.projectSearchRoots.slice(0, 25);
        await saveAppSettings(updatedSettings);
      }

      return { success: true, projects: mergedProjects, diagnostics };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to retrieve cached projects' };
    }
  });

  ipcMain.handle('project:removeCachedProject', async (_event, projectRootPath) => {
    try {
      if (!projectRootPath || typeof projectRootPath !== 'string') {
        return { success: false, error: 'Invalid project path' };
      }

      const settings = await loadAppSettings();
      const cachedProjects = Array.isArray(settings.cachedProjects) ? settings.cachedProjects : [];

      const filtered = cachedProjects.filter(
        (proj) => path.resolve(proj.rootPath) !== path.resolve(projectRootPath)
      );

      settings.cachedProjects = filtered;
      await saveAppSettings(settings);
      return { success: true, cachedProjects: filtered };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to remove cached project' };
    }
  });

  ipcMain.handle('project:listProjectDocuments', async (_event, projectRootPath) => {
    try {
      if (!projectRootPath || typeof projectRootPath !== 'string') {
        return { success: false, error: 'Invalid project path' };
      }

      await fs.access(projectRootPath);

      const documents = {};
      const acceptedExtensions = new Set(['.pdf', '.json', '.md', '.txt', '.doc', '.docx']);

      const collectFiles = async (dirPath, maxDepth = 3, currentDepth = 0) => {
        if (currentDepth > maxDepth) return [];

        const files = [];
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              const nested = await collectFiles(fullPath, maxDepth, currentDepth + 1);
              files.push(...nested);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (acceptedExtensions.has(ext)) {
                files.push({
                  path: fullPath,
                  name: entry.name,
                  relativePath: path.relative(projectRootPath, fullPath),
                  extension: ext,
                });
              }
            }
          }
        } catch {
          // Skip directories we can't read
        }
        return files;
      };

      // Scan common source directories
      const sourceSearchPaths = [
        'source_documents',
        'curriculum',
      ];

      for (const searchPath of sourceSearchPaths) {
        const fullPath = path.join(projectRootPath, searchPath);
        try {
          const files = await collectFiles(fullPath);
          if (files.length > 0) {
            documents[searchPath] = files;
          }
        } catch {
          // Directory doesn't exist or can't be read
        }
      }

      return { success: true, projectPath: projectRootPath, documents };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to list project documents' };
    }
  });

  ipcMain.handle('project:getCurriculumOverview', async (_event, projectRootPath) => {
    try {
      const rootPath = `${projectRootPath || ''}`.trim();
      if (!rootPath) {
        return { success: false, error: 'Invalid project path' };
      }

      await fs.access(rootPath);

      const acceptedExtensions = new Set(['.pdf', '.json', '.md', '.txt', '.doc', '.docx']);
      const collectDocuments = async (basePath) => {
        const docs = [];
        const walk = async (entryPath) => {
          const stats = await fs.stat(entryPath);
          if (stats.isFile()) {
            const ext = path.extname(entryPath).toLowerCase();
            if (acceptedExtensions.has(ext)) {
              docs.push({
                name: path.basename(entryPath),
                path: entryPath,
                relativePath: path.relative(basePath, entryPath),
                extension: ext,
              });
            }
            return;
          }
          if (!stats.isDirectory()) {
            return;
          }
          const children = await fs.readdir(entryPath, { withFileTypes: true });
          for (const child of children) {
            await walk(path.join(entryPath, child.name));
          }
        };

        try {
          await walk(basePath);
        } catch {
          return [];
        }

        return docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      };

      const entries = [];
      const curriculumRoot = path.join(rootPath, 'curriculum');
      try {
        const stageDirs = await fs.readdir(curriculumRoot, { withFileTypes: true });
        for (const stageDir of stageDirs) {
          if (!stageDir.isDirectory()) {
            continue;
          }
          const stagePath = path.join(curriculumRoot, stageDir.name);
          const sourceDocumentsPath = path.join(stagePath, 'source_documents');
          let documents = [];
          try {
            await fs.access(sourceDocumentsPath);
            documents = await collectDocuments(sourceDocumentsPath);
          } catch {
            documents = [];
          }

          entries.push({
            name: stageDir.name,
            path: stagePath,
            sourceDocumentsPath,
            documentCount: documents.length,
            documents,
          });
        }
      } catch {
        const sourceRoot = path.join(rootPath, 'source_documents');
        try {
          await fs.access(sourceRoot);
          const documents = await collectDocuments(sourceRoot);
          entries.push({
            name: 'source_documents',
            path: sourceRoot,
            sourceDocumentsPath: sourceRoot,
            documentCount: documents.length,
            documents,
          });
        } catch {
          // No curriculum/source_documents available.
        }
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, entries };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to load curriculum overview' };
    }
  });

  ipcMain.handle('project:loadCachedProject', async (_event, projectRootPath) => {
    try {
      if (!projectRootPath || typeof projectRootPath !== 'string') {
        return { success: false, error: 'Invalid project path' };
      }

      await fs.access(projectRootPath);

      const manifestPath = path.join(projectRootPath, 'project_manifest.json');
      let manifest = {};
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(manifestContent);
      } catch {
        // Manifest doesn't exist or can't be parsed
      }

      const settings = await loadAppSettings();
      const cachedProjects = Array.isArray(settings.cachedProjects) ? settings.cachedProjects : [];

      const projectEntry = cachedProjects.find(
        (proj) => path.resolve(proj.rootPath) === path.resolve(projectRootPath)
      );

      if (projectEntry) {
        projectEntry.lastAccessedAt = new Date().toISOString();
        settings.cachedProjects = cachedProjects;
        await saveAppSettings(settings);
      }

      return {
        success: true,
        projectPath: projectRootPath,
        manifest,
        projectEntry: projectEntry || {},
      };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to load cached project' };
    }
  });

  ipcMain.handle('system:openFolder', async (_event, folderPath) => {
    try {
      if (!folderPath || typeof folderPath !== 'string') {
        return { success: false, error: 'Invalid folder path' };
      }

      await fs.access(folderPath);

      const normalizedPath = path.resolve(folderPath);
      
      if (process.platform === 'win32') {
        spawn('explorer.exe', [normalizedPath]);
      } else if (process.platform === 'darwin') {
        spawn('open', [normalizedPath]);
      } else if (process.platform === 'linux') {
        spawn('xdg-open', [normalizedPath]);
      } else {
        return { success: false, error: `Unsupported platform: ${process.platform}` };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to open folder' };
    }
  });

  ipcMain.handle('api:status', async () => {
    return getApiStatus();
  });

  ipcMain.handle('api:verify', async () => {
    return verifyApiProviders();
  });

  ipcMain.handle('audit:pairs', async (_event, payload) => {
    return runPairAudit(payload);
  });

  ipcMain.handle('pairs:repair', async (_event, payload) => {
    try {
      const result = await repairAffectedPairs(payload);
      return result;
    } catch (error) {
      throw new Error(`Pair repair failed: ${error.message}`);
    }
  });

  ipcMain.handle('pairs:deferLog', async (_event, payload) => {
    try {
      const result = await persistDeferredQualityLog(payload || {});
      return result;
    } catch (error) {
      throw new Error(`Deferred quality log failed: ${error.message}`);
    }
  });

  ipcMain.handle('quality-memory:getGuardrails', async (_event, payload) => {
    try {
      return await getQualityGuardrails(payload || {});
    } catch (error) {
      throw new Error(`Quality memory read failed: ${error.message}`);
    }
  });

  ipcMain.handle('quality-memory:updateFromAudit', async (_event, payload) => {
    try {
      return await updateQualityMemoryFromAudit(payload || {});
    } catch (error) {
      throw new Error(`Quality memory update failed: ${error.message}`);
    }
  });

  ipcMain.handle('quality-memory:getStability', async (_event, payload) => {
    try {
      return await getQualityStabilityStatus(payload || {});
    } catch (error) {
      throw new Error(`Quality stability check failed: ${error.message}`);
    }
  });

  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      title: 'Select Source PDF',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('dialog:openJson', async (_event, options = {}) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      title: options?.title || 'Select JSON File',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('rag:processPdf', async (_event, payload) => {
    return processPdfToJson(payload);
  });

  ipcMain.handle('generation:buildArtifacts', async (event, payload) => {
    if (activeGenerationAbortController) {
      throw new Error('A generation process is already running.');
    }

    activeGenerationAbortController = new AbortController();
    const runtimeApiStatus = getApiStatus();
    const runtimeProviders = Array.isArray(runtimeApiStatus?.providers)
      ? runtimeApiStatus.providers
      : [];
    try {
      return await writeSelectedArtifacts({
        ...payload,
        apiProviders: runtimeProviders,
        abortSignal: activeGenerationAbortController.signal,
        onProgress: (update) => {
          event.sender.send('generation:artifactProgress', update);
        },
        onLog: (logEvent) => {
          event.sender.send('generation:statusLog', logEvent);
        },
      });
    } finally {
      activeGenerationAbortController = null;
    }
  });

  ipcMain.handle('generation:repairPartialArtifact', async (event, payload) => {
    if (activeGenerationAbortController) {
      throw new Error('A generation or repair process is already running.');
    }

    activeGenerationAbortController = new AbortController();
    const runtimeApiStatus = getApiStatus();
    const runtimeProviders = Array.isArray(runtimeApiStatus?.providers)
      ? runtimeApiStatus.providers
      : [];

    try {
      return await documentGenerationService.repairPartialArtifact({
        ...payload,
        apiProviders: runtimeProviders,
        abortSignal: activeGenerationAbortController.signal,
        onProgress: (update) => {
          event.sender.send('generation:artifactProgress', update);
        },
        onLog: (logEvent) => {
          event.sender.send('generation:statusLog', logEvent);
        },
      });
    } finally {
      activeGenerationAbortController = null;
    }
  });

  ipcMain.handle('generation:inspectRepairArtifact', async (_event, payload) => {
    return documentGenerationService.inspectRepairArtifact(payload || {});
  });

  ipcMain.handle('dataset:exportTrainingFiles', async (_event, payload) => {
    return exportDatasetService.exportTrainingFiles(payload || {});
  });

  ipcMain.handle('generation:cancel', async () => {
    if (!activeGenerationAbortController) {
      return { cancelled: false, reason: 'No active generation.' };
    }
    activeGenerationAbortController.abort();
    return { cancelled: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});