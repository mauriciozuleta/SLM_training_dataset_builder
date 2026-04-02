(() => {
  const createProjectEnvironmentController = (config = {}) => {
    const {
      dom = {},
      state = {},
      addLog = () => {},
      refreshProjectCurriculumBrowser = () => {},
      topCreateProjectDefaultLabel = 'Create New Project',
      defaultProjectCreationTitle = 'Create New Project',
    } = config;

    const formatProjectEnvironmentLabel = (projectType) => {
      const value = `${projectType || ''}`.trim();
      if (value === 'single-dataset') {
        return 'Single Dataset';
      }
      if (value === 'subject-dataset') {
        return 'Subject Dataset';
      }
      if (value === 'slm-training') {
        return 'SLM Training';
      }
      return 'Environment';
    };

    const setTopCreateProjectLabel = (projectName) => {
      const safeName = `${projectName || ''}`.trim();
      const projectLabel = safeName || topCreateProjectDefaultLabel;

      if (dom.topCreateProjectButton) {
        const labelEl = dom.topCreateProjectButton.querySelector('.nav-button-label');
        if (labelEl) {
          labelEl.textContent = projectLabel;
        }
      }

      if (dom.projectCreationTitleEl) {
        dom.projectCreationTitleEl.textContent = safeName ? projectLabel : defaultProjectCreationTitle;
      }
    };

    const switchToEnvironmentWorkspace = (activeLabel = '') => {
      if (dom.projectCreationPanel) {
        dom.projectCreationPanel.setAttribute('hidden', '');
      }
      if (dom.projectLoaderPanel) {
        dom.projectLoaderPanel.setAttribute('hidden', '');
      }
      if (dom.projectDetailsPanel) {
        dom.projectDetailsPanel.setAttribute('hidden', '');
      }
      if (dom.cachedProjectsList) {
        dom.cachedProjectsList.removeAttribute('hidden');
      }

      const chooseTaskPanel = document.querySelector('.mode-panel');
      chooseTaskPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (activeLabel) {
        addLog(`Switched to environment: ${activeLabel}`, 'info');
      }
    };

    const openSavedProjectEnvironment = async (project) => {
      if (!project) {
        return;
      }

      try {
        if (window.desktopApp?.loadCachedProject && project.rootPath) {
          await window.desktopApp.loadCachedProject(project.rootPath);
        }

        state.setCurrentLoadedProject?.(project);
        const createdProject = {
          projectName: project.projectName || '',
          projectType: project.projectType || '',
          rootPath: project.rootPath || '',
          foundationSourceDocsPath: project.foundationSourceDocsPath || '',
          reinforcementSourceDocsPath: project.reinforcementSourceDocsPath || '',
          exportFilesPath: project.exportFilesPath || '',
          sourceDocsPath: project.foundationSourceDocsPath || project.reinforcementSourceDocsPath || '',
        };
        state.setCurrentCreatedProject?.(createdProject);
        state.setCurrentProjectEnvironment?.({ ...createdProject });
        state.resetCurriculumState?.();

        setTopCreateProjectLabel(project.projectName);
        switchToEnvironmentWorkspace();
        state.setCurrentTaskMode?.('generate');
        refreshProjectCurriculumBrowser();
        addLog(`Opened project environment: ${project.projectName || 'Saved project'}`, 'info');
      } catch (error) {
        addLog(`Could not open project environment: ${error.message}`, 'error');
      }
    };

    const loadCachedProjectsList = async () => {
      try {
        if (!dom.cachedProjectsList) {
          return;
        }

        dom.cachedProjectsList.innerHTML = '<p class="cached-projects-empty">Loading saved projects...</p>';

        const result = await window.desktopApp.getCachedProjects();
        if (!result.success) {
          dom.cachedProjectsList.innerHTML = '<p class="cached-projects-empty">No saved projects found.</p>';
          addLog(`Saved project lookup failed: ${result.error || 'unknown error'}`, 'warning');
          return;
        }

        const projects = result.projects || [];
        if (projects.length > 0) {
          addLog(`Loaded ${projects.length} project${projects.length === 1 ? '' : 's'} from managed workspace.`, 'info');
        }
        if (projects.length === 0) {
          dom.cachedProjectsList.innerHTML = '<p class="cached-projects-empty">No projects yet. Use \'Create New Project\' to get started.</p>';
          return;
        }

        dom.cachedProjectsList.innerHTML = '';
        projects.forEach((project) => {
          const card = document.createElement('div');
          card.className = 'project-card';

          const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          card.innerHTML = `
            <h4 class="project-card-title">${project.projectName || 'Unnamed Project'}</h4>
            <p class="project-card-type">${project.projectType || 'unknown'}</p>
            <p class="project-card-path">${project.rootPath}</p>
            <p class="project-card-date">Created: ${createdDate}</p>
          `;

          card.addEventListener('click', () => {
            void openSavedProjectEnvironment(project);
          });

          dom.cachedProjectsList.appendChild(card);
        });
      } catch (error) {
        console.error('Failed to load cached projects:', error);
        if (dom.cachedProjectsList) {
          dom.cachedProjectsList.innerHTML = '<p class="cached-projects-empty">Error loading projects. Try again.</p>';
        }
      }
    };

    const bindProjectEnvironmentPanelEvents = () => {
      dom.topOpenProjectButton?.addEventListener('click', () => {
        if (dom.projectLoaderPanel) {
          if (dom.projectCreationPanel) {
            dom.projectCreationPanel.setAttribute('hidden', '');
          }
          dom.projectLoaderPanel.removeAttribute('hidden');
          void loadCachedProjectsList();
          if (dom.projectDetailsPanel) {
            dom.projectDetailsPanel.setAttribute('hidden', '');
          }
          if (dom.cachedProjectsList) {
            dom.cachedProjectsList.removeAttribute('hidden');
          }
          dom.projectLoaderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      dom.closeProjectLoaderButton?.addEventListener('click', () => {
        if (dom.projectLoaderPanel) {
          dom.projectLoaderPanel.setAttribute('hidden', '');
        }
      });

      dom.backToCachedListButton?.addEventListener('click', () => {
        if (dom.projectDetailsPanel) {
          dom.projectDetailsPanel.setAttribute('hidden', '');
        }
        if (dom.cachedProjectsList) {
          dom.cachedProjectsList.removeAttribute('hidden');
        }
        state.setCurrentLoadedProject?.(null);
      });

      dom.closeProjectDetailsButton?.addEventListener('click', () => {
        if (dom.projectLoaderPanel) {
          dom.projectLoaderPanel.setAttribute('hidden', '');
        }
        if (dom.projectDetailsPanel) {
          dom.projectDetailsPanel.setAttribute('hidden', '');
        }
        state.setCurrentLoadedProject?.(null);
      });

      dom.openProjectFolderButton?.addEventListener('click', async () => {
        const loadedProject = state.getCurrentLoadedProject?.();
        if (!loadedProject || !loadedProject.rootPath) {
          addLog('No project selected', 'warning');
          return;
        }

        try {
          const result = await window.desktopApp.openFolder(loadedProject.rootPath);
          if (result.success) {
            addLog(`Opened: ${loadedProject.rootPath}`, 'info');
          } else {
            addLog(`Could not open folder: ${result.error}`, 'warning');
          }
        } catch (error) {
          console.error('Failed to open folder:', error);
          addLog(`Error: ${error.message}`, 'warning');
        }
      });

      dom.removeProjectCacheButton?.addEventListener('click', async () => {
        const loadedProject = state.getCurrentLoadedProject?.();
        if (!loadedProject || !loadedProject.rootPath) {
          addLog('No project to remove', 'warning');
          return;
        }

        try {
          const projectName = loadedProject.projectName || 'Unnamed Project';
          const confirmed = await window.desktopApp.showConfirm({
            title: 'Remove from Cache',
            message: `Remove "${projectName}" from the project cache?`,
            detail: 'The project files will not be deleted, only removed from the saved projects list.',
          });

          if (!confirmed) {
            return;
          }

          const result = await window.desktopApp.removeCachedProject(loadedProject.rootPath);
          if (result.success) {
            addLog(`Removed from cache: ${projectName}`, 'info');
            if (dom.projectDetailsPanel) {
              dom.projectDetailsPanel.setAttribute('hidden', '');
            }
            if (dom.cachedProjectsList) {
              dom.cachedProjectsList.removeAttribute('hidden');
            }
            state.setCurrentLoadedProject?.(null);
            void loadCachedProjectsList();
          } else {
            addLog(`Failed to remove project: ${result.error}`, 'warning');
          }
        } catch (error) {
          console.error('Error removing project:', error);
          addLog(`Error: ${error.message}`, 'warning');
        }
      });
    };

    return {
      formatProjectEnvironmentLabel,
      setTopCreateProjectLabel,
      switchToEnvironmentWorkspace,
      openSavedProjectEnvironment,
      loadCachedProjectsList,
      bindProjectEnvironmentPanelEvents,
    };
  };

  window.rendererProjectEnvironment = {
    createProjectEnvironmentController,
  };
})();