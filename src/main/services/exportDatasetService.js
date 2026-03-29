function createExportDatasetService({ fs, path }) {
  const normalizeText = (value) => `${value || ''}`.trim();

  const toSafeTimestamp = () => {
    const now = new Date();
    const pad = (value) => `${value}`.padStart(2, '0');
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '-',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join('');
  };

  const looksLikeTrainingFile = (fileName) => {
    const normalized = normalizeText(fileName).toLowerCase();
    if (!normalized.endsWith('.json')) {
      return false;
    }
    return normalized.includes('_questions.json') || normalized.includes('_conversational_training_pairs.json');
  };

  async function collectMatchingFiles(rootFolder, currentFolder = rootFolder, matches = []) {
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentFolder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) {
          continue;
        }
        await collectMatchingFiles(rootFolder, absolutePath, matches);
        continue;
      }

      if (entry.isFile() && looksLikeTrainingFile(entry.name)) {
        matches.push({
          sourcePath: absolutePath,
          relativePath: path.relative(rootFolder, absolutePath),
          type: entry.name.toLowerCase().includes('_questions.json') ? 'questions' : 'conversationalPairs',
        });
      }
    }
    return matches;
  }

  async function createUniqueExportFolder(rootFolder) {
    const normalizedRoot = rootFolder.replace(/[\\/]+$/g, '');
    const parentFolder = path.dirname(normalizedRoot);
    const sourceFolderName = path.basename(normalizedRoot);
    const baseName = `${sourceFolderName}_training_files`;
    let attempt = 0;
    while (attempt < 50) {
      const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
      const candidate = path.join(parentFolder, `${baseName}${suffix}`);
      try {
        await fs.mkdir(candidate, { recursive: false });
        return candidate;
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }
      }
      attempt += 1;
    }

    throw new Error('Could not allocate a unique training export folder name.');
  }

  async function exportTrainingFiles(options = {}) {
    const rootFolder = normalizeText(options?.rootFolder);
    if (!rootFolder) {
      throw new Error('Missing export root folder.');
    }

    const stat = await fs.stat(rootFolder).catch(() => null);
    if (!stat?.isDirectory?.()) {
      throw new Error('Export root folder does not exist or is not a directory.');
    }

    const files = await collectMatchingFiles(rootFolder);
    if (files.length === 0) {
      throw new Error('No question or conversational training files were found in the selected folder.');
    }

    const exportFolder = await createUniqueExportFolder(rootFolder);
    const copied = [];
    for (const file of files) {
      const destinationPath = path.join(exportFolder, file.relativePath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(file.sourcePath, destinationPath);
      copied.push({
        ...file,
        destinationPath,
      });
    }

    return {
      success: true,
      exportFolder,
      copiedCount: copied.length,
      copied,
      summary: {
        questions: copied.filter((entry) => entry.type === 'questions').length,
        conversationalPairs: copied.filter((entry) => entry.type === 'conversationalPairs').length,
      },
    };
  }

  return {
    exportTrainingFiles,
  };
}

module.exports = {
  createExportDatasetService,
};