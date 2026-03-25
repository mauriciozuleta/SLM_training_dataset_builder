# Unified Workflow Plan

## Current Status

Integration is complete.

- Pair Generation is the primary desktop app.
- PDF extraction is bundled inside this repository at `pdf_to_rag/pdf_to_rag.py`.
- Generate uses the local Python pipeline through Electron IPC (`rag:processPdf`).
- No cloud/API call is required for initial JSON generation.

## Recommendation

Use `pair generation` as the single desktop app and keep PDF-to-RAG as an internal backend module invoked from Electron.

This is the lowest-risk merge because:
- `pair generation` already has the desktop shell, file upload UX, folder selectors, and generation log.
- It already includes an `Original PDF` upload card.
- The PDF-to-RAG code is now included in this workspace as an internal module.

## Target Workflow

1. User loads the source PDF.
2. App runs the Python extraction pipeline (`pdf_to_rag.py`).
3. App receives / saves the chapter JSON output.
4. User loads or generates the chapter blueprint.
5. App generates question bank outputs from the chapter JSON.
6. App generates pair-set outputs for training.

## Best Integration Shape

### Keep Electron as the main UI

Electron should own:
- file picking
- progress log
- output folder selection
- workflow state
- final artifact orchestration

### Keep Python as the document-processing backend

Python should own:
- PDF parsing
- text cleaning
- section detection
- chunking / JSONL export
- diagnostics

## Why Not Merge Everything Into Python UI?

The Electron app is already closer to the end-to-end workflow you want.
The Python Tk UI is useful but is a narrower utility app.
If you force everything into Tkinter, you lose the better desktop shell and future extensibility.

## Concrete Merge Steps

### Step 1: Add an Electron IPC handler

In `pair generation/main.js` add a new handler like:
- `rag:processPdf`

It should:
- accept a PDF path and output folder
- run the local module from `pair generation/pdf_to_rag/pdf_to_rag.py`
- capture stdout/stderr
- return the generated JSON path

### Step 2: Expose it in `preload.js`

Expose a function like:
- `processPdf(payload)`

### Step 3: Update the renderer workflow

In `pair generation/src/renderer.js`:
- make `Original PDF` a first-class workflow input
- if PDF is present and document JSON is absent, process the PDF automatically
- use the returned JSON as the `Document JSON` source for the rest of the workflow

### Step 4: Simplify the UI copy

In `pair generation/src/index.html`:
- rename `Document JSON` to something like `Chapter Source`
- explain that the user can provide either:
  - a prebuilt JSON file, or
  - a source PDF to generate that JSON inside the app

### Step 5: Retire or demote the Tk UI

`pdf_to_rag/pdf_to_rag_ui.py` can become:
- a standalone debug tool, or
- a maintenance-only fallback

It should not be the main workflow entry point if you want one unified app.

## Recommended Final Inputs

Required:
- Blueprint
- Either `Document JSON` or `Original PDF`
- Output folders

Optional:
- Legacy Bank

## Best Longer-Term Improvement

After the merge, the next upgrade should be:
- generate chunk-level `JSONL` from the PDF pipeline
- feed that into question generation and pair generation

That will improve traceability and fine-tuning dataset quality.

## Summary

Yes, these apps should be merged.

The best architecture is:
- `pair generation` = main desktop workflow
- `pdf_to_rag` module (inside this repo) = backend extraction engine invoked from Electron

That gives you one workflow starting from PDF upload without throwing away the code you already have.
