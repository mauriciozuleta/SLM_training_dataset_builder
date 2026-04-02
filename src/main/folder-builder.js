'use strict';

/**
 * folder-builder.js
 *
 * Standalone, portable module for ingesting dropped folders and files into a
 * project target directory.  No UI, no IPC, no hard-coded paths.
 *
 * Rules:
 *   - Directories  → copied as-is: targetFolder/{dirName}/...  (structure preserved)
 *   - Files with subfolderName  → copied flat: targetFolder/{subfolderName}/{file}
 *   - Files without subfolderName, no dirs copied yet
 *                  → { success: false, requiresSubfolderName: true, entryPaths }
 *   - Files without subfolderName, but dirs already copied
 *                  → { success: true, mode: 'partial',
 *                       requiresSubfolderNameForFiles: true, pendingFilePaths }
 */

const path = require('path');
const fs = require('fs').promises;

const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.json', '.md', '.txt', '.doc', '.docx']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sanitizeFolderLabel = (value) =>
  `${value || ''}`
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const isPathInside = (childPath, parentPath) => {
  const normalize = (v) =>
    path.resolve(`${v || ''}`).replace(/\\/g, '/').toLowerCase();
  const child = normalize(childPath);
  const parent = normalize(parentPath).replace(/\/+$/, '');
  return child !== parent && child.startsWith(`${parent}/`);
};

const ensureUniqueDestination = async (basePath) => {
  const ext = path.extname(basePath);
  const stem = ext ? basePath.slice(0, -ext.length) : basePath;
  let candidate = basePath;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access(candidate);
      counter += 1;
      candidate = `${stem}_${counter}${ext}`;
    } catch {
      return candidate;
    }
  }
};

const copyDirectoryPreservingStructure = async (sourceRoot, destinationRoot, copied) => {
  let children;
  try {
    children = await fs.readdir(sourceRoot, { withFileTypes: true });
  } catch {
    return; // unreadable directory – skip silently
  }

  for (const child of children) {
    const sourcePath = path.join(sourceRoot, child.name);
    const destinationPath = path.join(destinationRoot, child.name);

    if (child.isDirectory()) {
      await fs.mkdir(destinationPath, { recursive: true });
      await copyDirectoryPreservingStructure(sourcePath, destinationPath, copied);
      continue;
    }

    if (!child.isFile()) {
      continue;
    }

    const ext = path.extname(sourcePath).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      continue;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    const finalDest = await ensureUniqueDestination(destinationPath);
    await fs.copyFile(sourcePath, finalDest);
    copied.push({ source: sourcePath, destination: finalDest });
  }
};

/**
 * Remove nested paths: if a parent is already in the set, discard children.
 * @param {string[]} inputPaths
 * @returns {Promise<Array<{inputPath: string, stats: import('fs').Stats}>>}
 */
const collapseNestedInputPaths = async (inputPaths) => {
  const resolved = [];
  for (const inputPath of inputPaths) {
    try {
      const stats = await fs.stat(inputPath);
      if (stats.isDirectory() || stats.isFile()) {
        resolved.push({ inputPath, stats });
      }
    } catch {
      // inaccessible – ignore
    }
  }

  resolved.sort((a, b) => a.inputPath.length - b.inputPath.length);

  const collapsed = [];
  for (const entry of resolved) {
    const alreadyCovered = collapsed.some((kept) =>
      isPathInside(entry.inputPath, kept.inputPath)
    );
    if (!alreadyCovered) {
      collapsed.push(entry);
    }
  }
  return collapsed;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ingest dropped entries into targetFolder without modifying original structure.
 *
 * @param {object} options
 * @param {string[]} options.entryPaths   - Absolute paths of dropped items
 * @param {string}   options.targetFolder - Destination root
 * @param {string}   [options.subfolderName] - Name for a new subfolder (for file drops)
 *
 * @returns {Promise<IngestResult>}
 *
 * @typedef {object} IngestResult
 * @property {boolean} success
 * @property {string}  [mode]  'folders' | 'files-with-subfolder' | 'partial' | 'mixed-with-subfolder'
 * @property {Array<{source:string,destination:string}>} [copied]
 * @property {boolean} [requiresSubfolderName]         - caller must ask user for a name, then retry
 * @property {boolean} [requiresSubfolderNameForFiles] - dirs were copied; caller must ask for files
 * @property {string[]} [entryPaths]       - original file paths (when requiresSubfolderName)
 * @property {string[]} [pendingFilePaths] - file paths still to copy (when requiresSubfolderNameForFiles)
 * @property {string}  [subfolderName]     - actual (de-duped) name used
 * @property {string}  [subfolderPath]     - absolute path of created subfolder
 * @property {string}  [error]
 */
const ingestDroppedEntries = async ({
  entryPaths,
  targetFolder,
  subfolderName = '',
} = {}) => {
  const paths = Array.isArray(entryPaths)
    ? entryPaths.filter((p) => typeof p === 'string' && p.trim() !== '')
    : [];
  const target = typeof targetFolder === 'string' ? targetFolder.trim() : '';
  const folderLabel = sanitizeFolderLabel(
    typeof subfolderName === 'string' ? subfolderName.trim() : ''
  );

  if (paths.length === 0) {
    return { success: false, error: 'No entries provided' };
  }
  if (!target) {
    return { success: false, error: 'Target folder is required' };
  }

  const uniquePaths = [...new Set(paths.map((p) => path.resolve(p)))];
  const collapsed = await collapseNestedInputPaths(uniquePaths);

  if (collapsed.length === 0) {
    return { success: false, error: 'No accessible entries found' };
  }

  const dirs = collapsed.filter((e) => e.stats.isDirectory());
  const files = collapsed.filter((e) => e.stats.isFile());

  await fs.mkdir(target, { recursive: true });

  const copied = [];

  // ── Copy every directory preserving its full tree ──────────────────────────
  for (const dir of dirs) {
    const destBase = path.join(target, path.basename(dir.inputPath));
    const dest = await ensureUniqueDestination(destBase);
    await fs.mkdir(dest, { recursive: true });
    await copyDirectoryPreservingStructure(dir.inputPath, dest, copied);
  }

  // ── No loose files – all done ──────────────────────────────────────────────
  if (files.length === 0) {
    return { success: true, mode: 'folders', copied };
  }

  // ── Loose files present, but no subfolder name supplied ───────────────────
  if (!folderLabel) {
    if (dirs.length > 0) {
      // Directories already copied; need user input for the files
      return {
        success: true,
        mode: 'partial',
        copied,
        requiresSubfolderNameForFiles: true,
        pendingFilePaths: files.map((f) => f.inputPath),
      };
    }
    // Nothing copied yet; need user to supply a subfolder name
    return {
      success: false,
      requiresSubfolderName: true,
      entryPaths: files.map((f) => f.inputPath),
    };
  }

  // ── Copy loose files into the named subfolder ─────────────────────────────
  const subfolderBase = path.join(target, folderLabel);
  const subfolderPath = await ensureUniqueDestination(subfolderBase);
  await fs.mkdir(subfolderPath, { recursive: true });

  for (const file of files) {
    const ext = path.extname(file.inputPath).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      continue;
    }
    const destBase = path.join(subfolderPath, path.basename(file.inputPath));
    const dest = await ensureUniqueDestination(destBase);
    await fs.copyFile(file.inputPath, dest);
    copied.push({ source: file.inputPath, destination: dest });
  }

  return {
    success: true,
    mode: dirs.length > 0 ? 'mixed-with-subfolder' : 'files-with-subfolder',
    copied,
    subfolderName: path.basename(subfolderPath),
    subfolderPath,
  };
};

module.exports = { ingestDroppedEntries };
