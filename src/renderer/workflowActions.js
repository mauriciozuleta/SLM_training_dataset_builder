(() => {
  const createWorkflowActionsController = (config = {}) => {
    const { dom = {}, state = {}, helpers = {} } = config;

    const bindExecutionHandlers = () => {
      const {
        repairButton,
        exportButton,
        generateButton,
        cancelButton,
        repairFastModeInput,
        exportSourceFolderInput,
        outputFolderInput,
        datasetNameInput,
        outputPrefixInput,
      } = dom;

      const {
        addLog,
        refreshRepairState,
        refreshGenerateState,
        showWarningPopup,
        inspectSelectedRepairArtifact,
        resetRepairOutputState,
        setRepairBuildState,
        applyRepairProgressUpdate,
        getBaseName,
        normalizeDatasetName,
        isSameOrNestedPath,
        setTaskMode,
        persistSettings,
        setConversionStatus,
        buildRunOutputFolderName,
        joinPath,
        buildDocumentIdPrefix,
        getSelectedOutputs,
        getOutputFileNames,
        clearPrimaryPdf,
        resetDocumentOutputState,
        setSelectedOutputsRunning,
        setOutputReadyState,
        setOutputBuildState,
        updateOutputProviderIndicators,
        buildCombinedGuidance,
        markRunningOutputsAsError,
        getQualityDecision,
        buildRedoGuidanceFromAudit,
        hideQualityResultsModal,
      } = helpers;

      repairButton?.addEventListener('click', async () => {
        if (repairButton.disabled) {
          return;
        }

        if (!window.desktopApp?.repairPartialArtifact) {
          addLog('Required repair API is not available.', 'error');
          refreshRepairState();
          return;
        }

        if (!state.apiAvailable) {
          await showWarningPopup('API is required.', 'Set a valid API key in .env, restart the app, then run repair.');
          refreshRepairState();
          return;
        }

        const sourceDocumentPath = state.selectedFiles?.sourceDocumentJson?.path;
        const repairArtifactPath = state.selectedFiles?.repairArtifactJson?.path;
        if (!sourceDocumentPath || !repairArtifactPath) {
          refreshRepairState();
          return;
        }

        if (!state.repairInspection || !state.repairInspection.success || !state.repairInspection.canRepair) {
          await inspectSelectedRepairArtifact();
        }

        if (!state.repairInspection || !state.repairInspection.success || !state.repairInspection.canRepair) {
          refreshRepairState();
          return;
        }

        if (window.desktopApp?.showConfirm) {
          const confirmed = await window.desktopApp.showConfirm({
            type: 'question',
            title: 'Confirm Partial Repair',
            message: 'Resume incomplete sections and overwrite the selected partial artifact?',
            detail: `Source document: ${sourceDocumentPath}\nRepair target: ${repairArtifactPath}\n\nSupported targets: partial questions JSON or partial conversational pairs JSON.`,
            buttons: ['Repair', 'Cancel'],
          });

          if (!confirmed) {
            addLog('Repair cancelled by user.', 'info');
            refreshRepairState();
            return;
          }
        }

        try {
          state.repairInProgress = true;
          resetRepairOutputState();
          if (state.repairInspection.artifactType === 'questions') {
            setRepairBuildState('conversationalPairs', 'skipped', 'SKIP');
            setRepairBuildState('questions', 'running', '0/0');
          } else if (state.repairInspection.artifactType === 'conversationalPairs') {
            setRepairBuildState('questions', 'skipped', 'SKIP');
            setRepairBuildState('conversationalPairs', 'running', '0/0');
          }
          refreshGenerateState();
          const unsubscribeRepairProgress = window.desktopApp?.onArtifactProgress?.((update) => {
            applyRepairProgressUpdate(update);
          }) || (() => {});
          const guardrailSnapshot = await window.desktopApp?.getQualityGuardrails?.({ maxItems: 8 });
          const generationGuidance = `${guardrailSnapshot?.guardrails || ''}`.trim();
          if (generationGuidance) {
            addLog('Loaded persistent quality guardrails for repair.', 'info');
          }

          addLog(`Starting partial repair for ${getBaseName(repairArtifactPath)}...`, 'info');
          let repairResult;
          try {
            repairResult = await window.desktopApp.repairPartialArtifact({
              sourceDocumentPath,
              repairArtifactPath,
              generationGuidance,
              repairMode: repairFastModeInput?.checked ? 'fast' : 'deep',
            });
          } finally {
            unsubscribeRepairProgress();
          }

          if (`${repairResult?.buildStatus || ''}`.toLowerCase() === 'incomplete') {
            addLog(
              `Repair finished with partial output. Remaining incomplete sections: ${Number(repairResult?.remainingIncompleteSections || 0)}.`,
              'warning'
            );
          } else {
            addLog(`Repair completed successfully for ${getBaseName(repairArtifactPath)}.`, 'success');
          }
          await inspectSelectedRepairArtifact();
          addLog(`Repaired artifact saved in place: ${repairResult?.repairedPath || repairArtifactPath}`, 'info');
        } catch (error) {
          setRepairBuildState('questions', 'error');
          setRepairBuildState('conversationalPairs', 'error');
          addLog(`Partial repair failed: ${error?.message || error || 'Unknown error.'}`, 'error');
        } finally {
          state.repairInProgress = false;
          refreshGenerateState();
        }
      });

      exportButton?.addEventListener('click', async () => {
        if (exportButton.disabled) {
          return;
        }

        if (!window.desktopApp?.exportTrainingFiles) {
          addLog('Required export API is not available.', 'error');
          refreshGenerateState();
          return;
        }

        const rootFolder = `${exportSourceFolderInput?.value || ''}`.trim();
        if (!rootFolder || rootFolder === 'No folder selected') {
          refreshGenerateState();
          return;
        }

        if (window.desktopApp?.showConfirm) {
          const datasetName = normalizeDatasetName(datasetNameInput?.value || state.lastUsedDatasetName);
          const confirmed = await window.desktopApp.showConfirm({
            type: 'question',
            title: 'Confirm Export',
            message: 'Create a fresh export folder with documents, questions, and conversational buckets?',
            detail: `Scan root: ${rootFolder}\n\nThe app will create ${datasetName || '<dataset_name>'}_training_files with:\n- ${datasetName || '<dataset_name>'}_documents\n- ${datasetName || '<dataset_name>'}_questions_training_pairs\n- ${datasetName || '<dataset_name>'}_conversational_training_pairs`,
            buttons: ['Export', 'Cancel'],
          });

          if (!confirmed) {
            addLog('Export cancelled by user.', 'info');
            refreshGenerateState();
            return;
          }
        }

        try {
          state.exportInProgress = true;
          refreshGenerateState();
          const destinationFolder = outputFolderInput?.value || state.lastUsedOutputFolder;
          const datasetName = normalizeDatasetName(datasetNameInput?.value || state.lastUsedDatasetName);
          if (!destinationFolder || destinationFolder === 'No folder selected') {
            addLog('Export destination folder is required. Select an output folder first.', 'error');
            refreshGenerateState();
            return;
          }
          if (!datasetName) {
            addLog('Name Dataset is required for export. Set it in Output Settings.', 'error');
            refreshGenerateState();
            return;
          }

          if (isSameOrNestedPath(destinationFolder, rootFolder) || isSameOrNestedPath(rootFolder, destinationFolder)) {
            addLog('Export blocked: destination must not be the same as, inside, or parent of the scan root folder.', 'error');
            refreshGenerateState();
            return;
          }

          addLog(`Scanning ${rootFolder} for training files...`, 'info');
          const exportResult = await window.desktopApp.exportTrainingFiles({ rootFolder, destinationFolder, datasetName });
          addLog(
            `Export complete: ${Number(exportResult?.copiedCount || 0)} files copied (${Number(exportResult?.summary?.questions || 0)} questions, ${Number(exportResult?.summary?.conversationalPairs || 0)} conversational, ${Number(exportResult?.summary?.document || 0)} documents). Totals: ${Number(exportResult?.summary?.totalQuestionPairs || 0)} question pairs, ${Number(exportResult?.summary?.totalConversationalPairs || 0)} conversational pairs.`,
            'success'
          );
          addLog(`Export folder created: ${exportResult?.exportFolder || ''}`, 'info');
          addLog(`Summary created: ${exportResult?.summaryDocumentPath || ''}`, 'info');
          setTaskMode('export');
          await persistSettings();
        } catch (error) {
          addLog(`Export failed: ${error?.message || error || 'Unknown error.'}`, 'error');
        } finally {
          state.exportInProgress = false;
          refreshGenerateState();
        }
      });

      generateButton?.addEventListener('click', async () => {
        if (generateButton.disabled) {
          return;
        }

        if (!window.desktopApp?.processPdf || !window.desktopApp?.buildArtifacts) {
          addLog('Required generation APIs are not available.', 'error');
          setConversionStatus('Generation failed: required local APIs are not available.', 100, 'error');
          return;
        }

        const selectedOutputFolder = outputFolderInput?.value;
        const outputPrefix = (outputPrefixInput?.value || '').trim();
        const runOutputFolderName = buildRunOutputFolderName();
        const outputFolder = joinPath(selectedOutputFolder, runOutputFolderName);
        const documentIdPrefix = buildDocumentIdPrefix();
        const chapterNumberMatch = outputPrefix.match(/(\d{1,3})/);
        const chapterNumberOverride = chapterNumberMatch ? Number.parseInt(chapterNumberMatch[1], 10) : 0;
        const selectedOutputs = getSelectedOutputs();
        const outputFileNames = getOutputFileNames();

        if (!state.apiAvailable) {
          await showWarningPopup('API is required.', 'Set a valid API key in .env, restart the app, then generate.');
          setConversionStatus('Generation blocked: API is required.', 0, 'error');
          return;
        }

        if (!outputPrefix) {
          await showWarningPopup(
            'Output document prefix is required.',
            'Enter a prefix (for example: AFH_2) before running generation.'
          );
          addLog('Generation blocked: output document prefix is required.', 'error');
          setConversionStatus('Generation blocked: output document prefix is required.', 0, 'error');
          return;
        }

        if (!state.selectedFiles?.originalPdf?.path) {
          await showWarningPopup('Source PDF is required.', 'Use Upload to select the source PDF first.');
          if (state.selectedFiles?.originalPdf?.name && window.desktopApp?.openPdfDialog) {
            addLog('File path missing - please re-select the PDF using the Upload button.', 'error');
            setConversionStatus('Re-select PDF using the Upload button.', 0, 'error');
          } else {
            addLog('Source PDF is required.', 'error');
            setConversionStatus('Generation blocked: source PDF is required.', 0, 'error');
          }
          return;
        }

        if (!selectedOutputFolder || selectedOutputFolder === 'No folder selected') {
          await showWarningPopup('Output folder is required.', 'Select a destination folder before generating files.');
          addLog('Output folder is required.', 'error');
          setConversionStatus('Generation blocked: output folder is required.', 0, 'error');
          return;
        }

        if (!Object.values(selectedOutputs).some(Boolean)) {
          await showWarningPopup('Select at least one output artifact.', 'Choose one or more output types, then generate.');
          addLog('Select at least one output artifact.', 'error');
          setConversionStatus('Generation blocked: no output type selected.', 0, 'error');
          return;
        }

        if (window.desktopApp?.showConfirm) {
          const chosen = Object.entries(selectedOutputs)
            .filter(([, enabled]) => enabled)
            .map(([key]) => `${key} -> ${outputFileNames[key]}`)
            .join('\n');

          const confirmed = await window.desktopApp.showConfirm({
            type: 'question',
            title: 'Confirm Pipeline Run',
            message: 'Generate selected outputs from the loaded PDF?',
            detail: `PDF: ${state.selectedFiles.originalPdf.name}\nSelected destination: ${selectedOutputFolder}\nRun folder: ${runOutputFolderName}\nFinal output path: ${outputFolder}\n\nSelected outputs:\n${chosen}`,
            buttons: ['Generate', 'Cancel'],
          });

          if (!confirmed) {
            addLog('Generation cancelled by user.');
            setConversionStatus('Generation cancelled.', 0, 'idle');
            return;
          }

          addLog('Confirmed. Starting generation pipeline...');
          setConversionStatus('Starting pipeline...', 5, 'running');
        }

        let allowOverwrite = false;
        let completed = false;
        const sourcePdf = {
          ...state.selectedFiles.originalPdf,
        };

        try {
          state.generationInProgress = true;
          state.generationCancelRequested = false;
          await clearPrimaryPdf({ resetInputs: false });
          refreshGenerateState();
          while (!completed) {
            try {
              setConversionStatus('Preparing conversion...', 10, 'running');
              resetDocumentOutputState();
              setSelectedOutputsRunning(selectedOutputs, ['docJson']);
              addLog(`Output folder for this run: ${outputFolder}`, 'info');
              addLog('Starting local PDF extraction (PDF to RAG, no API calls)...');

              const pdfPayload = {
                pdfPath: sourcePdf.path,
                docType: 'auto',
                outputDir: outputFolder,
                outputFileName: outputFileNames.docJson,
                idPrefix: documentIdPrefix,
                chapterNumberOverride,
                allowOverwrite,
              };

              setConversionStatus('Converting PDF to JSON...', 35, 'running');
              const extracted = await window.desktopApp.processPdf(pdfPayload);
              addLog(`Initial document JSON / MD created locally: ${extracted.outputPath}`, 'success');
              if (extracted?.markdownPath) {
                addLog(`Initial document Markdown created locally: ${extracted.markdownPath}`, 'success');
              }
              if (selectedOutputs.docJson) {
                setOutputReadyState('docJson', true);
              }

              setConversionStatus('Writing selected output files...', 75, 'running');
              addLog('Building selected artifacts...');
              const unsubscribeArtifactProgress = window.desktopApp?.onArtifactProgress?.((update) => {
                const key = update?.key;
                const statusState = `${update?.state || ''}`.trim().toLowerCase();
                if (!key || !state.outputBadgesByKey?.[key]) {
                  return;
                }

                if (statusState === 'running') {
                  const progressText = `${update?.progressText || ''}`.trim();
                  setOutputBuildState(key, 'running', progressText);
                  updateOutputProviderIndicators(key, update);
                  return;
                }
                if (statusState === 'completed') {
                  setOutputReadyState(key, true);
                  return;
                }
                if (statusState === 'incomplete') {
                  setOutputBuildState(key, 'incomplete', 'PARTIAL');
                  return;
                }
                if (statusState === 'skipped') {
                  setOutputBuildState(key, 'skipped', 'SKIP');
                  return;
                }
                if (statusState === 'error') {
                  setOutputBuildState(key, 'error');
                }
              }) || (() => {});

              let result;
              const guardrailSnapshot = await window.desktopApp?.getQualityGuardrails?.({ maxItems: 8 });
              const memoryGuardrails = `${guardrailSnapshot?.guardrails || ''}`.trim();
              if (memoryGuardrails) {
                addLog('Loaded persistent quality guardrails from previous runs.', 'info');
              }
              if (guardrailSnapshot?.stability) {
                const stability = guardrailSnapshot.stability;
                addLog(
                  stability.isStableOptimum
                    ? `Stable optimum reached (${Number(stability.consecutiveOptimumRuns || 0)} consecutive optimum run(s)).`
                    : `Stable optimum not yet reached. ${Array.isArray(stability.reasons) && stability.reasons.length > 0 ? stability.reasons[0] : 'More clean runs are required.'}`,
                  stability.isStableOptimum ? 'success' : 'info'
                );
              }

              const runBuildArtifacts = ({ allowLocalFallback = false, overwrite = allowOverwrite, generationGuidance = '' } = {}) => window.desktopApp.buildArtifacts({
                outputDir: outputFolder,
                selectedOutputs,
                outputFileNames,
                documentJson: extracted.data,
                documentJsonPath: extracted.outputPath,
                allowOverwrite: overwrite,
                allowLocalFallback,
                generationGuidance: buildCombinedGuidance(memoryGuardrails, generationGuidance),
                idPrefix: documentIdPrefix,
                apiProviderCount: state.apiProviderCount,
                apiProviders: state.apiProviders,
              });

              const annotateArtifactsFromAudit = async (auditResult, qualityReportPath, writtenEntries = []) => {
                if (!window.desktopApp?.annotateArtifactQualityMetadata) {
                  return;
                }

                const artifactPaths = Array.isArray(writtenEntries)
                  ? writtenEntries
                    .map((entry) => `${entry?.path || ''}`.trim())
                    .filter((filePath) => filePath.toLowerCase().endsWith('.json'))
                  : [];

                if (artifactPaths.length === 0) {
                  return;
                }

                try {
                  const annotationResult = await window.desktopApp.annotateArtifactQualityMetadata({
                    artifactPaths,
                    qualityReportPath,
                    auditResult,
                  });

                  if (annotationResult?.updatedFiles > 0) {
                    addLog(`Embedded quality metadata into ${annotationResult.updatedFiles} JSON artifact(s).`, 'info');
                  }
                  if (Array.isArray(annotationResult?.errors) && annotationResult.errors.length > 0) {
                    addLog(`Quality metadata annotation completed with ${annotationResult.errors.length} warning(s).`, 'warning');
                  }
                } catch (error) {
                  addLog(`Could not embed quality metadata: ${error?.message || error}`, 'warning');
                }
              };

              try {
                result = await runBuildArtifacts({ allowLocalFallback: false });
              } finally {
                unsubscribeArtifactProgress();
              }

              const artifactStatuses = result?.summary?.artifactStatuses || {};

              if (Array.isArray(result?.written) && result.written.length > 0) {
                result.written.forEach((entry) => {
                  if (entry?.key === 'docJson' && entry?.reused) {
                    addLog(`Document JSON / MD already created: ${entry.path}`, 'info');
                    setOutputReadyState('docJson', true);
                    return;
                  }
                  if (entry?.key === 'summary') {
                    if (`${artifactStatuses.summary?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                      setOutputBuildState('summary', 'incomplete', 'PARTIAL');
                    } else {
                      setOutputReadyState('summary', true);
                    }
                  }
                  if (entry?.key === 'questions') {
                    if (`${artifactStatuses.questions?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                      setOutputBuildState('questions', 'incomplete', 'PARTIAL');
                    } else {
                      setOutputReadyState('questions', true);
                    }
                  }
                  if (entry?.key === 'deterministicPairs') {
                    setOutputReadyState('deterministicPairs', true);
                  }
                  if (entry?.key === 'conversationalPairs') {
                    if (`${artifactStatuses.conversationalPairs?.buildStatus || 'complete'}`.toLowerCase() === 'incomplete') {
                      setOutputBuildState('conversationalPairs', 'incomplete', 'PARTIAL');
                    } else {
                      setOutputReadyState('conversationalPairs', true);
                    }
                  }
                  addLog(`Saved (${entry.key}): ${entry.path}`, 'success');
                });

                if (result?.summary?.routingMode) {
                  const configured = Array.isArray(result?.summary?.providersConfigured)
                    ? result.summary.providersConfigured.join(', ')
                    : 'none';
                  const assigned = result?.summary?.providersAssigned || {};
                  const observedProviders = result?.summary?.providersObserved || {};
                  const observedModels = result?.summary?.modelsObserved || {};
                  const providerSummary = (key) => {
                    const list = Array.isArray(observedProviders?.[key]) ? observedProviders[key] : [];
                    return list.length > 0 ? list.join(', ') : 'none';
                  };
                  const modelSummary = (key) => {
                    const list = Array.isArray(observedModels?.[key]) ? observedModels[key] : [];
                    return list.length > 0 ? list.join(', ') : 'none';
                  };
                  addLog(
                    `API routing: ${result.summary.routingMode} | configured: ${configured} | assigned summary/questions/conversational: ${assigned.summary || 'auto'}/${assigned.questions || 'auto'}/${assigned.conversational || 'auto'} | observed providers: ${providerSummary('summary')}/${providerSummary('questions')}/${providerSummary('conversational')} | observed models: ${modelSummary('summary')}/${modelSummary('questions')}/${modelSummary('conversational')}`,
                    'info'
                  );
                }
              } else {
                addLog('No selected artifacts were written.', 'info');
              }

              Object.entries(artifactStatuses).forEach(([key, status]) => {
                const buildStatus = `${status?.buildStatus || ''}`.toLowerCase();
                const failureReason = `${status?.failureReason || ''}`.trim();
                const incompleteSections = Array.isArray(status?.incompleteSections) ? status.incompleteSections : [];

                if (buildStatus === 'incomplete') {
                  const failedCount = incompleteSections.filter((entry) => `${entry?.status || ''}`.toLowerCase() === 'failed').length;
                  setOutputBuildState(key, 'incomplete', 'PARTIAL');
                  addLog(
                    `${key} saved as partial output. Failed sections: ${failedCount}. ${failureReason || 'Repair can continue from incomplete sections.'}`,
                    'warning'
                  );
                }

                if (buildStatus === 'skipped') {
                  setOutputBuildState(key, 'skipped', 'SKIP');
                  addLog(`${key} skipped. ${failureReason || 'A required upstream artifact was incomplete.'}`, 'warning');
                }
              });

              const auditCandidates = Array.isArray(result?.written)
                ? result.written
                  .filter((entry) => {
                    const key = `${entry?.key || ''}`;
                    if (!['conversationalPairs', 'deterministicPairs'].includes(key)) {
                      return false;
                    }
                    return `${artifactStatuses?.[key]?.buildStatus || 'complete'}`.toLowerCase() === 'complete';
                  })
                  .map((entry) => `${entry?.path || ''}`)
                  .filter(Boolean)
                : [];

              if (auditCandidates.length === 0) {
                const pairArtifactsIncomplete = ['conversationalPairs', 'deterministicPairs'].some((key) => {
                  const status = `${artifactStatuses?.[key]?.buildStatus || ''}`.toLowerCase();
                  return status === 'incomplete' || status === 'skipped';
                });
                if (pairArtifactsIncomplete) {
                  addLog('Quality audit skipped because at least one pair artifact is partial or was skipped.', 'warning');
                }
              }

              if (auditCandidates.length > 0 && window.desktopApp?.auditPairs) {
                const qualityReportPath = joinPath(outputFolder, `${documentIdPrefix || 'output'}_quality_report.json`);
                addLog(`Running quality audit on ${auditCandidates.length} pair artifact(s)...`, 'info');
                try {
                  const auditResult = await window.desktopApp.auditPairs({
                    files: auditCandidates,
                    reportPath: qualityReportPath,
                  });

                  const rating = auditResult?.overallRating || {};
                  const level = `${rating.level || 'unknown'}`.toUpperCase();
                  const weightedPct = Number(rating?.weightedIssuePercent || 0);
                  const errors = Number(rating?.errorCount || 0);
                  const warnings = Number(rating?.warningCount || 0);

                  const auditLogLevel = errors > 0 ? 'error' : (warnings > 0 ? 'warning' : 'success');
                  addLog(
                    `Quality audit complete: ${level} (${weightedPct}%). Errors: ${errors}, Warnings: ${warnings}.`,
                    auditLogLevel
                  );
                  addLog(`Quality report saved: ${qualityReportPath}`, 'info');
                  await annotateArtifactsFromAudit(auditResult, qualityReportPath, result?.written || []);

                  const userDecision = await getQualityDecision(auditResult);
                  addLog(`User action selected: ${userDecision}`, 'info');

                  if (userDecision === 'repair') {
                    addLog('Repair action selected. Regenerating affected pairs...', 'info');

                    const pairFilePaths = {};
                    if (Array.isArray(result?.written)) {
                      result.written.forEach((entry) => {
                        if (entry?.key === 'deterministicPairs' && entry?.path) {
                          pairFilePaths.deterministic = entry.path;
                        }
                        if (entry?.key === 'conversationalPairs' && entry?.path) {
                          pairFilePaths.conversational = entry.path;
                        }
                      });
                    }

                    try {
                      const repairResult = await window.desktopApp?.repairPairs?.({
                        auditResult,
                        deterministicPairPath: pairFilePaths.deterministic,
                        conversationalPairPath: pairFilePaths.conversational,
                        outputFolder,
                      });

                      if (repairResult?.success) {
                        const totalRepaired = (repairResult?.repairs?.deterministic?.merged || 0) +
                                             (repairResult?.repairs?.conversational?.merged || 0);
                        addLog(`Repair complete: ${totalRepaired} pairs regenerated.`, 'success');

                        addLog('Running quality audit after repair...', 'info');
                        const postRepairAudit = await window.desktopApp.auditPairs({
                          files: auditCandidates,
                          reportPath: qualityReportPath,
                        });

                        await annotateArtifactsFromAudit(postRepairAudit, qualityReportPath, result?.written || []);

                        addLog('Post-repair audit complete. Displaying updated results...', 'info');
                        const newDecision = await getQualityDecision(postRepairAudit);

                        const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                          decision: 'repair',
                          auditResult,
                          postAuditResult: postRepairAudit,
                          maxGuardrails: 8,
                        });
                        if (memoryUpdate?.stability) {
                          addLog(
                            memoryUpdate.stability.isStableOptimum
                              ? 'Stable optimum criteria satisfied after repair.'
                              : `Stability check after repair: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                            memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                          );
                        }

                        if (newDecision !== 'close') {
                          addLog(`Follow-up action selected: ${newDecision}`, 'info');
                        } else {
                          addLog('Updated quality results reviewed.', 'info');
                        }
                      } else {
                        addLog(`Repair encountered issues: ${repairResult?.message || 'Unknown error'}`, 'warning');
                      }
                    } catch (repairError) {
                      const message = `${repairError?.message || repairError || 'Unknown repair error.'}`;
                      addLog(`Pair repair failed: ${message}`, 'error');
                    }
                  } else if (userDecision === 'defer-log') {
                    const deferredLogPath = joinPath(outputFolder, `${documentIdPrefix || 'output'}_pending_repairs.json`);
                    addLog('Defer-log selected. Recording unresolved issues for later repair...', 'warning');

                    try {
                      const deferResult = await window.desktopApp?.deferQualityLog?.({
                        auditResult,
                        files: auditCandidates,
                        deferredLogPath,
                      });

                      if (deferResult?.ok) {
                        const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                          decision: 'defer-log',
                          auditResult,
                          maxGuardrails: 8,
                        });
                        if (memoryUpdate?.stability) {
                          addLog(`Stability check after defer-log: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`, 'info');
                        }

                        addLog(
                          `Deferred quality log saved. Pending issues: ${deferResult.totalPendingIssues}. Files flagged: ${deferResult.filesAnnotated}.`,
                          'warning'
                        );
                        addLog(`Deferred log path: ${deferredLogPath}`, 'info');
                      } else {
                        addLog('Deferred quality log completed with some file annotation errors.', 'warning');
                      }
                    } catch (deferError) {
                      const message = `${deferError?.message || deferError || 'Unknown defer-log error.'}`;
                      addLog(`Deferred log failed: ${message}`, 'error');
                    }
                  } else if (userDecision === 'redo') {
                    addLog('Regeneration selected. Rebuilding artifacts with audit-informed guidance...', 'warning');
                    const redoGuidance = buildRedoGuidanceFromAudit(auditResult);
                    if (redoGuidance) {
                      addLog('Applying previous audit findings as regeneration guidance.', 'info');
                    }

                    try {
                      const redoResult = await runBuildArtifacts({
                        allowLocalFallback: true,
                        overwrite: true,
                        generationGuidance: redoGuidance,
                      });

                      if (Array.isArray(redoResult?.written) && redoResult.written.length > 0) {
                        redoResult.written.forEach((entry) => {
                          addLog(`Redo saved (${entry.key}): ${entry.path}`, 'success');
                        });
                      }

                      const redoAuditCandidates = Array.isArray(redoResult?.written)
                        ? redoResult.written
                          .filter((entry) => ['conversationalPairs', 'deterministicPairs'].includes(`${entry?.key || ''}`))
                          .map((entry) => `${entry?.path || ''}`)
                          .filter(Boolean)
                        : [];

                      const postRedoCandidates = redoAuditCandidates.length > 0 ? redoAuditCandidates : auditCandidates;
                      if (postRedoCandidates.length > 0) {
                        addLog('Running quality audit after redo...', 'info');
                        const postRedoAudit = await window.desktopApp.auditPairs({
                          files: postRedoCandidates,
                          reportPath: qualityReportPath,
                        });

                        await annotateArtifactsFromAudit(
                          postRedoAudit,
                          qualityReportPath,
                          Array.isArray(redoResult?.written) && redoResult.written.length > 0
                            ? redoResult.written
                            : (result?.written || [])
                        );

                        const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                          decision: 'redo',
                          auditResult,
                          postAuditResult: postRedoAudit,
                          maxGuardrails: 8,
                        });
                        if (memoryUpdate?.stability) {
                          addLog(
                            memoryUpdate.stability.isStableOptimum
                              ? 'Stable optimum criteria satisfied after redo.'
                              : `Stability check after redo: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                            memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                          );
                        }

                        const postRedoRating = postRedoAudit?.overallRating || {};
                        addLog(
                          `Post-redo quality: ${`${postRedoRating?.level || 'unknown'}`.toUpperCase()} (${Number(postRedoRating?.weightedIssuePercent || 0)}%).`,
                          'info'
                        );

                        const followUpDecision = await getQualityDecision(postRedoAudit);
                        addLog(`Post-redo action selected: ${followUpDecision}`, 'info');
                      }
                    } catch (redoError) {
                      const message = `${redoError?.message || redoError || 'Unknown redo error.'}`;
                      addLog(`Redo failed: ${message}`, 'error');
                    }
                  } else if (userDecision === 'close') {
                    const memoryUpdate = await window.desktopApp?.updateQualityMemoryFromAudit?.({
                      decision: 'close',
                      auditResult,
                      maxGuardrails: 8,
                    });
                    if (memoryUpdate?.stability) {
                      addLog(
                        memoryUpdate.stability.isStableOptimum
                          ? 'Stable optimum criteria satisfied.'
                          : `Stability check: ${memoryUpdate.stability.reasons?.[0] || 'not yet stable.'}`,
                        memoryUpdate.stability.isStableOptimum ? 'success' : 'info'
                      );
                    }
                    addLog('Audit results reviewed.', 'info');
                  }
                } catch (auditError) {
                  const message = `${auditError?.message || auditError || 'Unknown audit error.'}`;
                  addLog(`Quality audit failed: ${message}`, 'warning');
                  hideQualityResultsModal();
                }
              }

              const finalArtifactStatuses = result?.summary?.artifactStatuses || {};
              const hasPartialArtifacts = Object.values(finalArtifactStatuses).some((status) => {
                const buildStatus = `${status?.buildStatus || ''}`.toLowerCase();
                return buildStatus === 'incomplete' || buildStatus === 'skipped';
              });

              if (hasPartialArtifacts) {
                setConversionStatus('Conversion completed with partial artifacts.', 100, 'warning');
                addLog('Pipeline completed with partial artifacts. Review incomplete sections before final use.', 'warning');
              } else {
                setConversionStatus('Conversion completed successfully.', 100, 'success');
                addLog('Pipeline completed successfully.', 'success');
              }
              if (outputPrefixInput) {
                outputPrefixInput.value = '';
                if (typeof state.setLastUsedOutputPrefix === 'function') {
                  state.setLastUsedOutputPrefix('');
                }
              }
              await persistSettings();
              completed = true;
            } catch (error) {
              const message = error?.message || 'Unknown generation error.';
              const isCollision = /already exist/i.test(message);

              if (isCollision && !allowOverwrite && window.desktopApp?.showConfirm) {
                const continueOverwrite = await window.desktopApp.showConfirm({
                  type: 'warning',
                  title: 'File Already Exists',
                  message: 'A file already exists with that name. Do you want to overwrite?',
                  detail: '',
                  buttons: ['Confirm', 'Cancel'],
                });

                if (continueOverwrite) {
                  allowOverwrite = true;
                  setConversionStatus('Continuing with overwrite...', 20, 'running');
                  markRunningOutputsAsError();
                  addLog('User chose to continue and overwrite existing files.', 'info');
                  continue;
                }

                await showWarningPopup(
                  'Generation cancelled.',
                  'The existing file was not overwritten.'
                );
                setConversionStatus('Generation cancelled: existing file kept.', 0, 'idle');
                return;
              }

              if (isCollision && allowOverwrite) {
                await showWarningPopup(
                  'Could not overwrite the existing file.',
                  'Try again after restarting the app, or change the output prefix.'
                );
                setConversionStatus('Generation stopped: file name conflict remains.', 0, 'error');
                return;
              }

              if (/generation cancelled by user/i.test(message)) {
                throw new Error('Generation cancelled by user.');
              }

              const apiFailed = /api is required|api analysis failed/i.test(message);
              if (apiFailed) {
                markRunningOutputsAsError();
                await showWarningPopup('API generation failed.', 'No files were generated. Check API key and try again.');
                setConversionStatus('Generation failed: API unavailable or analysis failed.', 0, 'error');
                return;
              }

              await window.desktopApp?.showAlert?.({
                type: 'error',
                title: 'Generation Failed',
                message: 'The pipeline could not complete.',
                detail: message,
              });
              throw error;
            }
          }
        } catch (error) {
          const message = `${error?.message || error || 'Unknown generation error.'}`;
          if (/generation cancelled by user/i.test(message)) {
            setConversionStatus('Generation cancelled by user.', 0, 'idle');
            addLog('Pipeline cancelled by user.', 'warning');
          } else {
            markRunningOutputsAsError();
            setConversionStatus(`Conversion failed: ${message}`, 100, 'error');
            addLog(`Pipeline failed: ${message}`, 'error');
          }
        } finally {
          state.generationInProgress = false;
          state.generationCancelRequested = false;
          refreshGenerateState();
        }
      });

      cancelButton?.addEventListener('click', async () => {
        if (!state.generationInProgress || state.generationCancelRequested) {
          return;
        }

        state.generationCancelRequested = true;
        refreshGenerateState();
        addLog('Cancellation requested by user...', 'warning');

        try {
          await window.desktopApp?.cancelGeneration?.();
        } catch (error) {
          addLog(`Cancellation request failed: ${error.message}`, 'error');
        }
      });
    };

    return {
      bindExecutionHandlers,
    };
  };

  window.rendererWorkflowActions = {
    createWorkflowActionsController,
  };
})();