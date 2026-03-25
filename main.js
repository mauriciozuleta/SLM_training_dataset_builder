const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const { createDocumentGenerationService } = require('./src/main/services/documentGenerationService');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_TIMEOUT_MS = Math.max(15000, Number.parseInt(process.env.API_TIMEOUT_MS || '90000', 10) || 90000);
const MAX_QUESTION_TARGET = Math.max(20, Number.parseInt(process.env.MAX_QUESTION_TARGET || '80', 10) || 80);

const documentGenerationService = createDocumentGenerationService({
  fs,
  path,
  env: process.env,
  apiTimeoutMs: API_TIMEOUT_MS,
  maxQuestionTarget: MAX_QUESTION_TARGET,
});

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

function createWindow() {
  const mainWindow = new BrowserWindow({
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

  ipcMain.handle('settings:get', async () => {
    return loadAppSettings();
  });

  ipcMain.handle('settings:save', async (_event, payload) => {
    return saveAppSettings(payload);
  });

  ipcMain.handle('api:status', async () => {
    return getApiStatus();
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

  ipcMain.handle('rag:processPdf', async (_event, payload) => {
    return processPdfToJson(payload);
  });

  ipcMain.handle('generation:buildArtifacts', async (_event, payload) => {
    return writeSelectedArtifacts(payload);
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