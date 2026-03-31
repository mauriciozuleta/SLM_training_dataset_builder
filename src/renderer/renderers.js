(() => {
  const renderProjectWorkspaceView = ({
    projectSelect,
    projectNameInput,
    projectStatus,
    deleteProjectButton,
    savedProjects = [],
    activeProject = null,
    previousValue = '',
    getBaseName,
  }) => {
    if (!projectSelect || !projectNameInput || !projectStatus) {
      return;
    }

    projectSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'No saved project selected';
    projectSelect.appendChild(placeholder);

    savedProjects.forEach((project) => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      projectSelect.appendChild(option);
    });

    const selectedValue = activeProject?.id || previousValue;
    projectSelect.value = savedProjects.some((project) => project.id === selectedValue) ? selectedValue : '';

    if (activeProject) {
      projectNameInput.value = activeProject.name;
      const folderLabel = getBaseName((activeProject.outputFolder || '').replace(/[\\/]+$/g, '')) || 'no output folder';
      projectStatus.textContent = `Active project: ${activeProject.name} (output: ${folderLabel}).`;
    } else if (savedProjects.length > 0) {
      projectStatus.textContent = `Saved projects: ${savedProjects.length}. Select one to load its workspace defaults.`;
    } else {
      projectStatus.textContent = 'No saved projects yet. Set folders once, then save them as a project.';
      projectNameInput.value = '';
    }

    if (deleteProjectButton) {
      deleteProjectButton.disabled = !activeProject;
    }
  };

  const renderCurriculumDocumentsView = ({ curriculumDocumentsList, selectedEntry }) => {
    if (!curriculumDocumentsList) {
      return;
    }

    if (!selectedEntry) {
      curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">Select a curriculum folder to view source documents.</p>';
      return;
    }

    const documents = Array.isArray(selectedEntry.documents) ? selectedEntry.documents : [];
    if (documents.length === 0) {
      curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">No supported source documents found in this folder.</p>';
      return;
    }

    curriculumDocumentsList.innerHTML = '';
    documents.forEach((documentEntry) => {
      const item = document.createElement('div');
      item.className = 'curriculum-document-item';
      const extensionLabel = `${documentEntry.extension || ''}`.replace('.', '').toUpperCase() || 'DOC';
      item.innerHTML = `
        <span class="curriculum-document-icon">${extensionLabel.slice(0, 3)}</span>
        <span class="curriculum-document-name">${documentEntry.relativePath || documentEntry.name || 'Document'}</span>
      `;
      curriculumDocumentsList.appendChild(item);
    });
  };

  const renderCurriculumFoldersView = ({
    curriculumFoldersList,
    entries = [],
    selectedPath = '',
    onSelect,
  }) => {
    if (!curriculumFoldersList) {
      return;
    }

    if (entries.length === 0) {
      curriculumFoldersList.innerHTML = '<p class="curriculum-empty">No curriculum folders found for this project.</p>';
      return;
    }

    curriculumFoldersList.innerHTML = '';
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'curriculum-folder-item';
      button.dataset.selected = entry.path === selectedPath ? 'true' : 'false';
      button.innerHTML = `
        <span class="curriculum-folder-title">${entry.name}</span>
        <span class="curriculum-folder-meta">${Number(entry.documentCount || 0)} source document${Number(entry.documentCount || 0) === 1 ? '' : 's'}</span>
      `;
      button.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(entry);
        }
      });
      curriculumFoldersList.appendChild(button);
    });
  };

  const renderTaskModeView = ({
    modeButtons,
    modePanels,
    sharedOutputSubtitle,
    commonPrefixCell,
    outputPrefixInput,
    datasetNameCell,
    datasetNameInput,
    currentTaskMode,
    generationInProgress,
    repairInProgress,
    exportInProgress,
  }) => {
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
        generate: 'Generate mode: choose destination folder and set Add output documents prefix for the next dataset run.',
        repair: 'Repair mode: only the destination folder remains visible here. File naming is ignored and the repaired file is overwritten in place.',
        export: 'Export mode: choose destination folder and set Name Dataset. Export uses that name for the export folder and bucket folders.',
        default: 'Choose a task to reveal only the output settings that matter for that workflow.',
      };
      sharedOutputSubtitle.textContent = subtitles[currentTaskMode] || subtitles.default;
    }

    const isGenerateMode = currentTaskMode === 'generate' || currentTaskMode === '';
    const isExplicitExportMode = currentTaskMode === 'export';
    if (commonPrefixCell) {
      commonPrefixCell.hidden = !isGenerateMode;
    }
    if (outputPrefixInput) {
      outputPrefixInput.disabled = !isGenerateMode;
    }
    if (datasetNameCell) {
      datasetNameCell.hidden = !isExplicitExportMode;
    }
    if (datasetNameInput) {
      datasetNameInput.disabled = !isExplicitExportMode;
    }
  };

  window.rendererRenderers = {
    renderProjectWorkspaceView,
    renderCurriculumDocumentsView,
    renderCurriculumFoldersView,
    renderTaskModeView,
  };
})();