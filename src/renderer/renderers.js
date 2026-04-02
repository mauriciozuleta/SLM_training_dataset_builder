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

  const renderCurriculumDocumentsView = ({
    curriculumDocumentsList,
    selectedEntry,
    selectedDocumentPaths = new Set(),
    generationQueue = [],
    onToggleDocument,
    collapsedGroupKeys = new Set(),
    onToggleGroup,
  }) => {
    if (!curriculumDocumentsList) {
      return;
    }

    if (!selectedEntry) {
      curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">Select a project folder to view source documents.</p>';
      return;
    }

    const documents = Array.isArray(selectedEntry.documents) ? selectedEntry.documents : [];
    if (documents.length === 0) {
      curriculumDocumentsList.innerHTML = '<p class="curriculum-empty">No source documents found in this folder.</p>';
      return;
    }

    curriculumDocumentsList.innerHTML = '';

    const groupedDocuments = new Map();
    documents.forEach((documentEntry) => {
      const relativePath = `${documentEntry.relativePath || documentEntry.name || ''}`.trim();
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const pathParts = normalizedPath.split('/').filter(Boolean);

      let groupKey = '__root__';
      let displayPath = documentEntry.name || 'Document';
      if (pathParts.length > 1) {
        groupKey = pathParts[0];
        displayPath = pathParts.slice(1).join('/');
      } else if (pathParts.length === 1) {
        displayPath = pathParts[0];
      }

      if (!groupedDocuments.has(groupKey)) {
        groupedDocuments.set(groupKey, []);
      }
      groupedDocuments.get(groupKey).push({
        documentEntry,
        displayPath,
      });
    });

    const queueSummary = document.createElement('div');
    queueSummary.className = 'curriculum-queue-summary';
    const queuedCount = Array.isArray(generationQueue) ? generationQueue.length : 0;
    queueSummary.innerHTML = `
      <span class="curriculum-queue-title">Generation queue</span>
      <span class="curriculum-queue-count">${queuedCount} document${queuedCount === 1 ? '' : 's'} selected</span>
    `;
    curriculumDocumentsList.appendChild(queueSummary);

    Array.from(groupedDocuments.entries())
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .forEach(([groupKey, groupDocuments]) => {
        const section = document.createElement('section');
        section.className = 'curriculum-document-group';
        const collapsed = collapsedGroupKeys instanceof Set ? collapsedGroupKeys.has(groupKey) : false;

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'curriculum-document-group-header';
        header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        header.innerHTML = `
          <span class="curriculum-document-folder-icon">DIR</span>
          <div class="curriculum-document-group-copy">
            <p class="curriculum-document-group-title">${groupKey === '__root__' ? 'Root files' : groupKey}</p>
            <p class="curriculum-document-group-meta">${groupDocuments.length} file${groupDocuments.length === 1 ? '' : 's'}</p>
          </div>
          <span class="curriculum-document-group-toggle">${collapsed ? '+' : '-'}</span>
        `;
        header.addEventListener('click', () => {
          if (typeof onToggleGroup === 'function') {
            onToggleGroup(groupKey);
          }
        });
        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'curriculum-document-group-body';
        body.hidden = collapsed;

        groupDocuments.forEach(({ documentEntry, displayPath }) => {
          const item = document.createElement('div');
          item.className = 'curriculum-document-item';
          const extensionLabel = `${documentEntry.extension || ''}`.replace('.', '').toUpperCase() || 'DOC';
          const pathKey = `${documentEntry.path || ''}`.trim();
          const inputId = `curriculumDoc_${Math.random().toString(36).slice(2)}`;
          const isSelected = selectedDocumentPaths instanceof Set
            ? selectedDocumentPaths.has(pathKey)
            : false;

          // Split displayPath into subfolder prefix + filename so they can be colored separately.
          const rawDisplay = displayPath || documentEntry.name || 'Document';
          const lastSlash = rawDisplay.lastIndexOf('/');
          const folderPrefix = lastSlash >= 0 ? rawDisplay.slice(0, lastSlash + 1) : '';
          const fileName = lastSlash >= 0 ? rawDisplay.slice(lastSlash + 1) : rawDisplay;
          const labelHtml = folderPrefix
            ? `<span class="curriculum-document-name-path">${folderPrefix}</span><span class="curriculum-document-name-file">${fileName}</span>`
            : `<span class="curriculum-document-name-file">${fileName}</span>`;

          item.innerHTML = `
            <input id="${inputId}" class="curriculum-document-checkbox" type="checkbox" ${isSelected ? 'checked' : ''} />
            <span class="curriculum-document-icon">${extensionLabel.slice(0, 3)}</span>
            <label for="${inputId}" class="curriculum-document-name">${labelHtml}</label>
          `;
          const checkbox = item.querySelector('.curriculum-document-checkbox');
          checkbox?.addEventListener('change', (event) => {
            if (typeof onToggleDocument === 'function') {
              onToggleDocument(documentEntry, Boolean(event.target.checked));
            }
          });
          body.appendChild(item);
        });

        section.appendChild(body);
        curriculumDocumentsList.appendChild(section);
      });

    if (queuedCount > 0) {
      const queuePreview = document.createElement('div');
      queuePreview.className = 'curriculum-queue-preview';
      const previewItems = generationQueue
        .slice(0, 5)
        .map((entry) => `${entry?.folderName || 'folder'}: ${entry?.relativePath || entry?.name || 'Document'}`);
      queuePreview.innerHTML = `
        <p class="curriculum-queue-preview-title">Queued next</p>
        <p class="curriculum-queue-preview-items">${previewItems.join(' | ')}</p>
      `;
      curriculumDocumentsList.appendChild(queuePreview);
    }
  };

  const renderCurriculumFoldersView = ({
    curriculumFoldersList,
    entries = [],
    selectedPath = '',
    onSelect,
    onDropFiles,
    isDropEnabled = false,
  }) => {
    if (!curriculumFoldersList) {
      return;
    }

    if (entries.length === 0) {
      curriculumFoldersList.innerHTML = '<p class="curriculum-empty">No project folders found for this project.</p>';
      return;
    }

    const toDisplayFolderName = (entryName = '') => {
      const normalized = `${entryName || ''}`.trim().toLowerCase();
      if (normalized === 'foundational data') {
        return 'Foundational';
      }
      if (normalized === 'adapter data') {
        return 'Adapters';
      }
      if (normalized === 'export files') {
        return 'Export';
      }
      return entryName || 'Folder';
    };

    curriculumFoldersList.innerHTML = '';
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'curriculum-folder-item';
      button.dataset.selected = entry.path === selectedPath ? 'true' : 'false';
      button.innerHTML = `
        <span class="curriculum-folder-title">${toDisplayFolderName(entry.name)}</span>
        <span class="curriculum-folder-meta">${Number(entry.documentCount || 0)} source document${Number(entry.documentCount || 0) === 1 ? '' : 's'}</span>
        <span class="curriculum-folder-drop-hint">${isDropEnabled ? 'Drop files or folders here' : 'Drop disabled while the app is busy'}</span>
      `;
      button.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(entry);
        }
      });
      if (isDropEnabled && typeof onDropFiles === 'function') {
        const clearDragging = () => {
          button.removeAttribute('data-dragging');
        };

        const setDragging = (event) => {
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
          }
          button.setAttribute('data-dragging', 'true');
        };

        button.addEventListener('dragenter', setDragging);
        button.addEventListener('dragover', setDragging);
        button.addEventListener('dragleave', clearDragging);
        button.addEventListener('drop', (event) => {
          event.preventDefault();
          clearDragging();
          void onDropFiles(entry, event);
        });
      }
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