function createProjectStructureService({ fs, path }) {
  const ROOT_FOLDERS = {
    foundationalData: 'Foundational data',
    adapterData: 'adapter data',
    exportFiles: 'export files',
  };

  const EXPORT_FOLDERS = {
    baseDataset: 'Base dataset',
    adapterDatasets: 'adapter datasets',
  };

  const sanitizeProjectName = (projectName) => `${projectName || ''}`
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_');

  const getRequiredRelativeFolders = () => [
    ROOT_FOLDERS.foundationalData,
    ROOT_FOLDERS.adapterData,
    ROOT_FOLDERS.exportFiles,
    `${ROOT_FOLDERS.exportFiles}/${EXPORT_FOLDERS.baseDataset}`,
    `${ROOT_FOLDERS.exportFiles}/${EXPORT_FOLDERS.adapterDatasets}`,
  ];

  const buildProjectPaths = (projectRoot) => ({
    projectRoot,
    sourceDocsPath: path.join(projectRoot, ROOT_FOLDERS.foundationalData),
    foundationSourceDocsPath: path.join(projectRoot, ROOT_FOLDERS.foundationalData),
    reinforcementSourceDocsPath: path.join(projectRoot, ROOT_FOLDERS.adapterData),
    exportFilesPath: path.join(projectRoot, ROOT_FOLDERS.exportFiles),
    baseDatasetPath: path.join(projectRoot, ROOT_FOLDERS.exportFiles, EXPORT_FOLDERS.baseDataset),
    adapterDatasetsPath: path.join(projectRoot, ROOT_FOLDERS.exportFiles, EXPORT_FOLDERS.adapterDatasets),
  });

  const createInitialProjectStructure = async ({ projectName, destinationFolder }) => {
    const normalizedName = sanitizeProjectName(projectName);
    if (!normalizedName) {
      throw new Error('Invalid project name');
    }

    const projectRoot = path.join(destinationFolder, normalizedName);
    await fs.mkdir(projectRoot, { recursive: true });

    const relativeFolders = getRequiredRelativeFolders();
    await Promise.all(relativeFolders.map((folder) => fs.mkdir(path.join(projectRoot, folder), { recursive: true })));

    return {
      normalizedName,
      createdFolders: relativeFolders,
      ...buildProjectPaths(projectRoot),
    };
  };

  const getPrimarySourceFolderEntries = () => [
    {
      key: 'foundational',
      name: ROOT_FOLDERS.foundationalData,
      folder: ROOT_FOLDERS.foundationalData,
    },
    {
      key: 'adapter',
      name: ROOT_FOLDERS.adapterData,
      folder: ROOT_FOLDERS.adapterData,
    },
  ];

  const getSourceSearchFolders = () => [
    ROOT_FOLDERS.foundationalData,
    ROOT_FOLDERS.adapterData,
    'source_documents',
    'curriculum',
  ];

  return {
    ROOT_FOLDERS,
    EXPORT_FOLDERS,
    sanitizeProjectName,
    getRequiredRelativeFolders,
    buildProjectPaths,
    createInitialProjectStructure,
    getPrimarySourceFolderEntries,
    getSourceSearchFolders,
  };
}

module.exports = {
  createProjectStructureService,
};
