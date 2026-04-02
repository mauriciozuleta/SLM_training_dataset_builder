(() => {
  const createPipelineViewController = (config = {}) => {
    const dom = config.dom || {};
    const state = config.state || {};
    const helpers = config.helpers || {};

    const {
      modeButtons = [],
      modePanels = [],
      sharedOutputSubtitle,
      commonPrefixCell,
      outputPrefixInput,
      datasetNameCell,
      datasetNameInput,
      exportButton,
      exportHint,
      exportSourceFolderInput,
      outputFolderInput,
      repairButton,
      repairHint,
      generateButton,
      generateHint,
      cancelButton,
    } = dom;

    const getValue = (reader, fallback = '') => {
      try {
        const value = reader();
        return value == null ? fallback : value;
      } catch (_) {
        return fallback;
      }
    };

    const renderTaskModeSection = () => {
      if (typeof config.renderTaskModeView === 'function') {
        config.renderTaskModeView({
          modeButtons,
          modePanels,
          sharedOutputSubtitle,
          commonPrefixCell,
          outputPrefixInput,
          datasetNameCell,
          datasetNameInput,
          currentTaskMode: getValue(() => state.currentTaskMode, ''),
          generationInProgress: Boolean(getValue(() => state.generationInProgress, false)),
          repairInProgress: Boolean(getValue(() => state.repairInProgress, false)),
          exportInProgress: Boolean(getValue(() => state.exportInProgress, false)),
        });
      }

      if (typeof helpers.refreshProjectCurriculumBrowser === 'function') {
        helpers.refreshProjectCurriculumBrowser();
      }
    };

    const renderExportSection = () => {
      if (!exportButton || !exportHint) {
        return;
      }

      const generationInProgress = Boolean(getValue(() => state.generationInProgress, false));
      const repairInProgress = Boolean(getValue(() => state.repairInProgress, false));
      const exportInProgress = Boolean(getValue(() => state.exportInProgress, false));
      const hasExportFolder = Boolean(exportSourceFolderInput?.value && exportSourceFolderInput.value !== 'No folder selected');
      const hasDestinationFolder = Boolean(outputFolderInput?.value && outputFolderInput.value !== 'No folder selected');
      const normalizedDatasetName = helpers.normalizeDatasetName
        ? helpers.normalizeDatasetName(datasetNameInput?.value || getValue(() => state.lastUsedDatasetName, ''))
        : `${datasetNameInput?.value || ''}`.trim();
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

      const outputFolderName = helpers.getBaseName
        ? helpers.getBaseName(`${outputFolderInput?.value || ''}`.replace(/[\\/]+$/g, '')) || 'output'
        : 'output';
      exportHint.textContent = `Ready to create ${normalizedDatasetName}_training_files inside ${outputFolderName} with ${normalizedDatasetName}_documents, ${normalizedDatasetName}_questions_training_pairs, and ${normalizedDatasetName}_conversational_training_pairs.`;
    };

    const renderRepairSection = () => {
      if (!repairButton || !repairHint) {
        return;
      }

      const generationInProgress = Boolean(getValue(() => state.generationInProgress, false));
      const repairInProgress = Boolean(getValue(() => state.repairInProgress, false));
      const exportInProgress = Boolean(getValue(() => state.exportInProgress, false));
      const apiAvailable = Boolean(getValue(() => state.apiAvailable, false));
      const selectedFiles = getValue(() => state.selectedFiles, {});
      const hasSourceDocument = Boolean(selectedFiles.sourceDocumentJson?.path);
      const hasRepairArtifact = Boolean(selectedFiles.repairArtifactJson?.path);
      const repairInspection = getValue(() => state.repairInspection, null);
      const repairInspectionLoading = Boolean(getValue(() => state.repairInspectionLoading, false));
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

      const detectType = helpers.inferRepairArtifactTypeFromName
        ? helpers.inferRepairArtifactTypeFromName(selectedFiles.repairArtifactJson?.name || '')
        : '';
      const detectedType = repairInspection?.artifactType || detectType;
      repairHint.textContent = detectedType === 'conversationalPairs'
        ? 'Ready to resume incomplete conversational sections and overwrite the selected partial artifact.'
        : 'Ready to resume incomplete question sections and overwrite the selected partial artifact.';
    };

    const renderGenerateSection = () => {
      if (!generateButton || !generateHint) {
        return;
      }

      const generationInProgress = Boolean(getValue(() => state.generationInProgress, false));
      const repairInProgress = Boolean(getValue(() => state.repairInProgress, false));
      const exportInProgress = Boolean(getValue(() => state.exportInProgress, false));
      const generationCancelRequested = Boolean(getValue(() => state.generationCancelRequested, false));
      const appBusy = generationInProgress || repairInProgress || exportInProgress;
      const requiredUploadsReady = Boolean(getValue(() => state.requiredUploadsReady, false));
      const destinationsReady = Boolean(getValue(() => state.destinationsReady, false));
      const hasSelectedOutput = Boolean(getValue(() => state.hasSelectedOutput, false));
      const apiAvailable = Boolean(getValue(() => state.apiAvailable, false));

      const ready = !appBusy && requiredUploadsReady && destinationsReady && hasSelectedOutput;
      generateButton.disabled = !ready;
      generateButton.textContent = generationInProgress ? 'Generating...' : 'Generate';

      if (cancelButton) {
        cancelButton.disabled = !generationInProgress;
        cancelButton.textContent = generationCancelRequested ? 'Cancelling...' : 'Cancel';
      }

      if (generationInProgress) {
        generateHint.textContent = 'Generation in progress. Please wait.';
        return;
      }

      if (repairInProgress) {
        generateHint.textContent = 'Repair in progress. Please wait.';
        return;
      }

      if (exportInProgress) {
        generateHint.textContent = 'Export in progress. Please wait.';
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

    const renderAllSections = () => {
      renderTaskModeSection();
      renderExportSection();
      renderRepairSection();
      renderGenerateSection();
    };

    return {
      renderTaskModeSection,
      renderExportSection,
      renderRepairSection,
      renderGenerateSection,
      renderAllSections,
    };
  };

  window.rendererPipelineView = {
    createPipelineViewController,
  };
})();
