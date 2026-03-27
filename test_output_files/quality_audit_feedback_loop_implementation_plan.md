# Quality Audit + Feedback Loop Implementation Plan

## Purpose
This plan explains, in simple terms, how to add a quality check at the end of generation, show results clearly, and use those results to improve future runs until quality stays at the best level.

## What You Will Get at the End
- A quality audit runs automatically after files are generated.
- A clear quality rating is shown in the app.
- A user decision window appears with valid options based on the rating.
- A report file is saved for records.
- A machine-readable feedback file is saved so future runs can avoid the same mistakes.
- A repeatable improvement loop that pushes results toward stable Optimum quality.

---

## Step-by-Step Plan

### Step 1: Define the quality levels and rules
Decide the exact meaning of each quality level so everyone uses the same standard.

Proposed levels:
1. Optimum: very low issue rate, safe for training.
2. Acceptable: higher issue rate but still usable.
3. Critical: partially usable, not recommended without fixes.
4. Catastrophic: must regenerate.

Also define:
- What counts as an error.
- What counts as a warning.
- Which issue types are always severe (for example broken structure).

Outcome:
- One shared rating table used by the app, reports, and future automation.

---

### Step 2: Make audit results structured and actionable
Make sure audit output contains not only a summary, but also exact targets to fix.

Each issue should include:
- Issue code (stable name).
- Severity.
- Affected file.
- Exact target (section ID, pair ID, question ID).
- Suggested repair action.

Outcome:
- The app can do targeted repairs instead of redoing everything.

---

### Step 3: Run audit automatically at end of generation
After generation completes, run the audit before final success is declared.

Process:
1. Generate selected artifacts.
2. Run quality audit on generated pair files.
3. Compute overall quality rating.
4. Continue to decision popup.

Outcome:
- Every generation has immediate quality verification.

---

### Step 4: Show a clear results popup in the app
Display a simple, readable popup with:
- Overall quality rating.
- Short explanation of why.
- Counts (errors, warnings, major repeated issues).
- Allowed actions based on rating.

Action policy:
- Optimum: continue/close.
- Acceptable and Critical: Repair, Generate Log for Later, Redo.
- Catastrophic: Redo only.

Outcome:
- User always knows quality status and next best action.

---

### Step 5: Add targeted Repair action
When user chooses Repair, only regenerate affected parts.

Repair behavior:
- Do not regenerate whole document.
- Re-run only problematic sections/questions/pairs.
- Use primary API with a correction prompt based on audit findings.
- Merge repaired content back into existing files.
- Re-run audit after repair.

Outcome:
- Faster and cheaper correction cycle.

---

### Step 6: Add Generate Log for Later action
If user chooses to postpone fixes:
- Save pending repair instructions into metadata of generated files.
- Add a clear flag that dataset has unresolved quality issues.
- Ensure training pipeline can detect and warn/block on this flag.

Outcome:
- Work can continue, but quality debt is tracked and visible.

---

### Step 7: Add Redo action with error-aware guidance
If user chooses Redo:
- Regenerate full document.
- Include previous audit findings in generation guidance so the same errors are less likely.
- Re-run audit automatically after redo.

Outcome:
- Full retry becomes smarter, not blind repetition.

---

### Step 8: Save two report files after each audit
Save both formats in output folder:
1. Human report (`.md`): readable summary for records.
2. Machine report (`.json`): detailed structured findings for automation.

Recommended report sections in `.md`:
- Run metadata.
- Quality rating.
- Top issues.
- Affected sections.
- Recommended actions.
- Change vs previous run (improved/stable/worse).

Outcome:
- You get both easy reading and automation support.

---

### Step 9: Build quality memory for future runs
Create a persistent feedback memory file (or folder) that stores recurring errors and successful fixes.

Before each new generation:
- Read latest memory.
- Inject top recurring issues as generation guardrails.
- Apply known successful fixes as constraints.

Outcome:
- The app improves over time and avoids repeating known failures.

---

### Step 10: Add stability criteria (when to stop rework)
Define what "stable optimum" means.

Example:
- 3 consecutive runs with Optimum rating.
- No severe structural issues.
- No recurring high-impact issue code above threshold.

Outcome:
- Clear finish line for quality stabilization.

---

## Recommended Rollout Order
1. Add automatic audit + rating + popup.
2. Add report saving (`.md` + `.json`).
3. Add action gating by rating.
4. Add metadata flags for deferred repairs.
5. Add targeted repair flow.
6. Add smarter redo using past findings.
7. Add persistent quality memory and trend tracking.

This order gives fast value early and reduces risk.

---

## Simple Success Checklist
- Audit runs automatically every time.
- User sees rating and clear next actions.
- Reports are saved for records and automation.
- Deferred issues are flagged in metadata.
- Repair works on specific bad parts only.
- Redo uses previous findings.
- Quality improves across runs and reaches stable Optimum.

---

## Notes for Records
- Plan version: 1.0
- Intended audience: non-technical stakeholders and project tracking
- Location: `test_output_files`

---

## Implementation Log

### Step 1 Execution Record
Status: Completed

Actions implemented:
1. Created a shared quality rules module to centralize rating logic and thresholds:
	- File: `scripts/quality_rating_rules.js`
2. Defined four quality levels with explicit boundaries:
	- Optimum, Acceptable, Critical, Catastrophic
3. Defined weighted scoring model:
	- Error weight = 1.0
	- Warning weight = 0.25
4. Defined threshold limits:
	- Optimum <= 0.5%
	- Acceptable <= 2.0%
	- Critical <= 7.0%
	- Above 7.0% = Catastrophic
5. Defined fatal issue-code set that forces Catastrophic regardless of percentage.
6. Integrated quality rating computation into the audit script:
	- File: `scripts/audit_training_pairs.js`
7. Extended report payload to include:
	- `totalPairs`
	- `overallRating` object (level, weighted score, counts, thresholds)

Validation run and results:
1. Ran audit on conversational artifact with report output.
2. Output quality level: `OPTIMUM`
3. Weighted issue percent: `0.26%`
4. Issues found:
	- 2 warnings
	- 0 errors
5. Report saved:
	- `test_output_files/afh_10 output docs/afh_10_quality_report.json`

Step 1 outcome:
- Quality-level definitions are now implemented in code and reusable.
- Rating is now computed consistently and exported in report output.

### Step 2 Execution Record
Status: Completed

Actions implemented:
1. Upgraded issue objects to be machine-actionable in audit output.
2. Added explicit `target` metadata per issue, including target type and target id.
3. Added `repairGuidance` per issue with:
	- action (`targeted-repair`, `metadata-flag`, `redo`)
	- scope (`pair`, `question`, `section`, `file`)
	- instruction (human-readable next step)
4. Added stable repair-guidance mapping by issue code.
5. Enriched duplicate-conversation findings with exact pair IDs affected.
6. Enriched repeated-subject findings with concrete target IDs (sample affected records).
7. Preserved existing audit behavior and rating output while adding structure.

Validation run and results:
1. Executed audit with report generation on conversational artifact.
2. Report confirmed actionable payload now includes:
	- `target`
	- `repairGuidance`
	- exact IDs for duplicated conversations and repeated-subject samples
3. Quality rating remains stable after changes:
	- Level: `OPTIMUM`
	- Weighted issue percent: `0.26%`
4. Updated report file:
	- `test_output_files/afh_10 output docs/afh_10_quality_report.json`

Step 2 outcome:
- Audit results are now structured for targeted repair orchestration.
- Output is usable by future automation (repair, defer-log, redo decisioning).

### Step 3 Execution Record
Status: Completed

Actions implemented:
1. Refactored the audit script to support both CLI and in-app programmatic execution:
	- Added reusable entry points in `scripts/audit_training_pairs.js`:
		- `resolveAuditTargets(options)`
		- `performAudit(options)`
	- Preserved CLI behavior with `if (require.main === module)` guard.
	- Exported reusable functions for app integration via `module.exports`.
2. Added main-process audit endpoint in Electron:
	- Imported `performAudit` in `main.js`.
	- Added `runPairAudit(payload)` helper to execute audits and return structured results.
	- Registered IPC handler `audit:pairs` to allow renderer-triggered audits.
3. Exposed secure preload bridge for renderer usage:
	- Added `auditPairs(payload)` in `preload.js` to invoke `ipcRenderer.invoke('audit:pairs', payload)`.
4. Integrated automatic post-generation audit in renderer workflow:
	- In `src/renderer_pipeline.js`, after artifact write completion:
		- Collect generated pair artifacts (`conversationalPairs`, `deterministicPairs`).
		- Run audit automatically when pair artifacts exist.
		- Save report to run output folder as `<documentIdPrefix>_quality_report.json`.
		- Log quality level, weighted issue percent, error/warning counts, and report path.
	- Audit failures are surfaced as warning logs without blocking already successful artifact generation.

Validation run and results:
1. Static validation:
	- No syntax/problems reported in:
		- `src/renderer_pipeline.js`
		- `main.js`
		- `preload.js`
		- `scripts/audit_training_pairs.js`
2. CLI compatibility validation:
	- Ran: `npm run audit:pairs -- --file "test_output_files/afh_10 output docs/afh_10_conversational_training_pairs.json" --report "test_output_files/afh_10 output docs/afh_10_quality_report_step3_check.json"`
	- Result summary:
		- Quality level: `OPTIMUM`
		- Weighted issue percent: `0.26%`
		- Errors: `0`
		- Warnings: `2`
	- Report saved:
		- `test_output_files/afh_10 output docs/afh_10_quality_report_step3_check.json`

Step 3 outcome:
- Automatic quality verification is now part of the generation flow for pair artifacts.
- The audit engine is reusable from both terminal and app workflow.
- Generation users now receive immediate quality feedback and report output location without manual audit steps.

### Step 4 Execution Record
Status: Completed

Actions implemented:
1. Created a quality results modal dialog component in the UI:
	- File: `src/index.html`
	- Added hidden modal overlay with quality results display.
	- Modal includes:
		- Quality rating level with color-coded styling.
		- Human-readable explanation of the rating.
		- Statistical summary (error count, warning count, weighted issue %).
		- List of top recurring issues affecting the dataset.
		- Action buttons gated by quality level.
2. Added modal styling:
	- File: `src/styles.css`
	- Dark-mode modal with backdrop blur and smooth slide-in animation.
	- Color-coded rating display (green=optimum, yellow=acceptable, orange=critical, red=catastrophic).
	- Button styling per action type (primary, secondary, danger, neutral).
	- Responsive design for various screen sizes.
3. Implemented quality results logic in renderer:
	- File: `src/renderer_pipeline.js`
	- Added modal element references and helper functions:
		- `getQualityExplanation(level)`: Returns user-friendly description for each quality level.
		- `getIssuesSummaryText(auditResult)`: Extracts top 3 issue types for quick visual reference.
		- `showQualityResultsModal(auditResult)`: Populates modal with audit data and displays it.
		- `hideQualityResultsModal()`: Closes the modal.
		- `getQualityDecision(auditResult)`: Waits for user button selection and returns the chosen action.
4. Integrated modal display into post-generation workflow:
	- After audit completes successfully, the modal automatically displays.
	- User selects an action based on their quality level:
		- **Optimum**: "Close" button (continue/finish).
		- **Acceptable or Critical**: "Repair Selected Issues", "Generate Log for Later", "Regenerate" buttons.
		- **Catastrophic**: "Regenerate" button only.
	- Selected action is logged with placeholder notices for Steps 5–7 implementation.
5. Modal actions are now gated by quality level:
	- Ensures users only see options that make sense for their current quality state.
	- Logs selected action for future workflow steps.

Validation run and results:
1. Static validation:
	- No syntax/problems in:
		- `src/renderer_pipeline.js`
		- `src/index.html`
		- `src/styles.css`
2. Code inspection:
	- Modal functions added and integrated into audit completion handler.
	- User decision polling implemented with 100ms check interval.
	- Modal actions properly formatted with style classes from CSS.

Step 4 outcome:
- Quality audit results are now displayed in a user-friendly dialog.
- Users see clear explanation of what each quality level means.
- Action buttons are dynamically gated by the audit rating level.
- The workflow now pauses after audit completion to collect user feedback before proceeding.
- All user decisions are logged for future workflow execution and stepped implementation.
