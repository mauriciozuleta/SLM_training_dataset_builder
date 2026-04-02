# Modular Pipeline Implementation Plan

## 1. Goal

Implement the target book-level pipeline with minimal disruption and maximum reuse of existing modules:

- Indexing generator is only for main document RAG/full-context support.
- Metadata + quality reporting runs per book after all chapter outputs are complete.
- Question and conversational outputs include impact grading (`high`, `medium`, `low`).
- Export policy:
  - Base dataset: 15% of all foundational deterministic + conversational pairs, capped at 20,000 pairs.
  - Adapter datasets: remaining 85% (kept as quick-reference sources by domain/book/folder strategy).
  - Extra conversational out-of-subject add-on: 20% of base count (for 20,000 base -> 4,000 extra), while keeping final merged training set <= 25,000.
- Deterministic and conversational remain separated in source folders; merged only in final export artifact.

---

## 2. Current App Inventory (What Exists Now)

### 2.1 Main orchestration and IPC

Current state in `main.js`:

- Generation path already exists:
  - `rag:processPdf` -> local PDF extraction.
  - `generation:buildArtifacts` -> summary/questions/deterministic/conversational artifact build.
- Audit and quality path already exists:
  - `audit:pairs` -> pair quality audit script.
  - Quality memory services for guardrails and stability.
  - Repair and defer-log loops.
- Export path already exists:
  - `dataset:exportTrainingFiles` -> scans folders and exports grouped outputs.
- Project curriculum discovery exists:
  - `project:getCurriculumOverview` returns stage/folder document lists.

### 2.2 Document generation modules

Current modular services in `src/main/services/documentGeneration`:

- `apiClient.js` (provider routing/failover)
- `summaryGenerator.js`
- `questionBankGenerator.js`
- `deterministicPairGenerator.js`
- `conversationalPairGenerator.js`
- `artifactWriter.js` (artifact orchestration + output writing)
- `partialArtifactRepairService.js`
- `pairRepairService.js`
- `qualityMemoryService.js`
- `deferredQualityLogService.js`

`documentGenerationService.js` already composes these modules cleanly.

### 2.3 Renderer workflow

Current state in `src/renderer/workflowActions.js` + `src/renderer_pipeline.js`:

- End-to-end Generate flow exists (PDF -> artifacts -> audit -> decision loop).
- Export flow exists.
- Curriculum browser exists.
- Queue UI scaffolding exists (checkbox selection and queue state currently UI/state-oriented).

### 2.4 Export service

Current state in `src/main/services/exportDatasetService.js`:

- Scans for source outputs.
- Keeps deterministic/conversational/documents in separate export buckets.
- Builds summary markdown.
- Does not yet implement the new 15%/85%/20% policy and merged final training file cap logic.

### 2.5 Quality output behavior

Current state:

- One JSON report per generation run path is now the default (markdown optional).
- Quality metadata embedding into generated JSON artifacts now exists.
- No book-level "all chapters completed" quality rollup gate yet.

---

## 3. Gap Analysis (What Is Missing)

1. Book-level pipeline orchestration is missing.
- Current flow is chapter/run-centric, not "run when whole book is complete".

2. Impact grading for generated content is missing.
- Question entries and conversational pairs do not carry `impactLevel` classification.

3. Export policy engine is missing.
- Need deterministic selector implementing:
  - 15% base cap 20k
  - 85% adapter retention
  - +20% conversational out-of-subject addon
  - total <= 25k

4. Indexing generator is not explicit as first-class module.
- Need clear artifact + service boundary for document index output (RAG-only purpose).

5. Final merged training artifact is missing.
- Deterministic/conversational are separate today (good), but policy-driven merged final JSONL is not yet produced.

6. Per-book quality/metadata aggregate report is missing.
- Current quality is run-level; need book-level aggregate generated once chapter outputs are complete.

---

## 4. Modular Target Architecture

## 4.1 New/expanded modules

1. `src/main/services/pipeline/bookReadinessService.js`
- Responsibility:
  - Determine expected chapter set for a book.
  - Validate chapter artifact completeness.
  - Return readiness status (`ready`, `missing`, `partial`).
- Reuse:
  - `project:getCurriculumOverview` data shape.
  - Existing artifact naming helpers.

2. `src/main/services/documentGeneration/impactScoring.js`
- Responsibility:
  - Assign `impactLevel` (`high`, `medium`, `low`) using deterministic heuristics + optional API hints.
- Reuse:
  - Existing `subjects`, section metadata, section weights.
  - Existing generation metadata structures.

3. `src/main/services/pipeline/bookQualityRollupService.js`
- Responsibility:
  - Run/aggregate quality across all chapter pair files in a book.
  - Emit one book-level quality report JSON.
  - Embed summary metadata back into relevant artifacts if needed.
- Reuse:
  - `performAudit` output schema.
  - Existing quality metadata annotation helper.

4. `src/main/services/pipeline/datasetSelectionPolicyService.js`
- Responsibility:
  - Implement exact 15%/85%/20%/25k logic.
  - Partition selected pairs into:
    - base pool
    - out-of-subject conversational addon
    - adapter remainder
- Reuse:
  - Existing deterministic/conversational pair schemas.
  - Existing export scanning logic.

5. `src/main/services/pipeline/mergedDatasetWriter.js`
- Responsibility:
  - Write final merged JSONL training file.
  - Preserve provenance fields (`sourceBook`, `chapterId`, `pairType`, `impactLevel`, `selectionReason`).
- Reuse:
  - Existing export folder creation + path safety logic.

6. `src/main/services/pipeline/indexArtifactService.js`
- Responsibility:
  - Persist and version index artifact for RAG/full-context support only.
- Reuse:
  - Existing output folder conventions and doc JSON outputs.

## 4.2 Existing modules to extend (not rewrite)

1. `questionBankGenerator.js`
- Add `impactLevel` per question item.
- Keep existing structure and fallback logic.

2. `conversationalPairGenerator.js`
- Add `impactLevel` per pair.
- Optionally support `outOfSubject` flag for policy selector.

3. `artifactWriter.js`
- Include indexing artifact writing hook.
- Pass through impact metadata with no schema break.

4. `exportDatasetService.js`
- Keep scan/copy helpers.
- Delegate pair selection logic to `datasetSelectionPolicyService`.

5. `main.js`
- Add IPC endpoints for:
  - book readiness check
  - book-level rollup generation
  - policy-driven merged export

---

## 5. Data Contract Additions

Keep backward compatibility while adding optional fields.

### 5.1 Question bank entries

Add optional field per question:

- `impactLevel`: `high | medium | low`

### 5.2 Deterministic pairs

Carry from question:

- `impactLevel`

### 5.3 Conversational pairs

Add:

- `impactLevel`
- `outOfSubject` (boolean, optional; default false)

### 5.4 Merged JSONL record

Canonical row for final train file:

- `id`
- `pairType` (`deterministic` | `conversational`)
- `input` / `messages` (depending on pair type)
- `target` or `label`
- `impactLevel`
- `outOfSubject` (if conversational)
- `sourceBook`
- `chapterId`
- `sourcePath`
- `selectionBucket` (`base15`, `conv_oos_bonus20`, `adapter85`)

---

## 6. Implementation Phases (Incremental)

## Phase 1: Impact labels in generation

- Add `impactLevel` generation and persistence in:
  - `questionBankGenerator.js`
  - `deterministicPairGenerator.js`
  - `conversationalPairGenerator.js`
- Add tests/validation script checks for allowed values.

Deliverable:
- Newly generated chapter artifacts include impact labels.

## Phase 2: Book readiness + book-level quality rollup

- Implement `bookReadinessService`.
- Implement `bookQualityRollupService` using existing audit schema.
- Add IPC + optional UI trigger for "Finalize book" operation.

Deliverable:
- One per-book metadata + quality report after all chapters ready.

## Phase 3: Policy selector engine

- Implement `datasetSelectionPolicyService`:
  - Compute total foundational pool.
  - Select base 15% capped at 20k.
  - Select extra conversational out-of-subject = 20% of base.
  - Enforce max final <= 25k.
  - Mark remaining as adapter pool.
- Deterministic seed/ordering for reproducibility.

Deliverable:
- Deterministic policy output manifest (`selection_manifest.json`).

## Phase 4: Merged final dataset export

- Implement `mergedDatasetWriter` (JSONL).
- Extend `exportDatasetService` to call policy + writer.
- Keep source-folder separation untouched.

Deliverable:
- `*_training_merged.jsonl` with <= 25k rows and policy metadata.

## Phase 5: Index artifact formalization

- Add `indexArtifactService` and explicit output naming/versioning.
- Wire into generation flow only for RAG/full-context support.

Deliverable:
- Consistent index artifact lifecycle independent of pair export.

---

## 7. Reuse-First Mapping

Reuse as-is:

- Provider verification/failover (`apiClient.js`)
- Existing generation orchestrator (`artifactWriter.js`)
- Audit engine (`scripts/audit_training_pairs.js`)
- Quality memory/stability services
- Export filesystem guards and path allocators
- Curriculum/book folder discovery IPC

Refactor minimally:

- Move selection math out of `exportDatasetService` into policy module.
- Add optional fields, avoid breaking existing readers.

Avoid:

- Rewriting current generate/repair loops.
- Changing source deterministic/conversational folder separation.

---

## 8. Risks and Mitigations

1. Risk: inconsistent pair counts across metadata and arrays.
- Mitigation: reuse existing count validators and fail export on mismatch.

2. Risk: impact scoring drift over time.
- Mitigation: deterministic baseline heuristics + optional audit warnings.

3. Risk: non-reproducible selection.
- Mitigation: fixed seed and sorted canonical ordering before sampling.

4. Risk: oversized merged dataset.
- Mitigation: hard cap in policy module with explicit log/report.

---

## 9. Acceptance Criteria

1. For a complete foundational book, one command/operation produces:
- per-book metadata summary
- per-book quality summary
- policy manifest
- merged final JSONL (<= 25k)
- adapter remainder outputs

2. Generated question and conversational artifacts include `impactLevel`.

3. Export policy enforces:
- base = 15% pool, max 20k
- conversational out-of-subject bonus = 20% of base
- total merged <= 25k

4. Deterministic and conversational sources remain separated pre-export.

5. Existing chapter generation pipeline still works for current users without mandatory migration.

---

## 10. Suggested First Build Slice

Start with Phase 1 + Phase 3 core policy skeleton first:

- Add `impactLevel` to generation outputs.
- Build policy module with dry-run manifest only (no file writes).

Why:

- Fast validation of business logic.
- Minimal UI changes.
- Gives immediate visibility into whether the 15%/85%/20% policy produces expected counts before full export wiring.
