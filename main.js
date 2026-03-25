const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_TIMEOUT_MS = Math.max(15000, Number.parseInt(process.env.API_TIMEOUT_MS || '90000', 10) || 90000);
const MAX_QUESTION_TARGET = Math.max(20, Number.parseInt(process.env.MAX_QUESTION_TARGET || '80', 10) || 80);

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`API request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeJsonFileName(fileName, fallback) {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  const safe = path.basename(base);
  return safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;
}

function normalizeMarkdownFileName(fileName, fallback) {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  const base = raw || fallback;
  const safe = path.basename(base);
  return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
}

function normalizePathForCompare(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    return '';
  }
  return path.resolve(inputPath).replace(/\\/g, '/').toLowerCase();
}

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

async function loadAppSettings() {
  const settingsPath = getSettingsFilePath();
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAppSettings(settings) {
  const settingsPath = getSettingsFilePath();
  const next = settings && typeof settings === 'object' ? settings : {};
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function getPythonLaunchers() {
  const launchers = [];
  const pushLauncher = (command, args = []) => {
    if (!command) {
      return;
    }
    if (!launchers.some((launcher) => launcher.command === command && launcher.args.join(' ') === args.join(' '))) {
      launchers.push({ command, args });
    }
  };

  pushLauncher(process.env.PYTHON);
  pushLauncher('C:\\Program Files\\Python310\\python.exe');
  pushLauncher('py', ['-3.10']);
  pushLauncher('python');

  return launchers;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`Command failed with exit code ${code}.`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function isMissingPdfMinerError(error) {
  const stderr = `${error?.stderr || ''}`.toLowerCase();
  const stdout = `${error?.stdout || ''}`.toLowerCase();
  return stderr.includes("no module named 'pdfminer'")
    || stderr.includes('no module named pdfminer')
    || stdout.includes("no module named 'pdfminer'")
    || stdout.includes('no module named pdfminer');
}

async function installPdfToRagRequirements(launcher, ragDir) {
  const requirementsPath = path.join(ragDir, 'requirements.txt');
  await fs.access(requirementsPath);

  return runCommand(
    launcher.command,
    [...launcher.args, '-m', 'pip', 'install', '-r', requirementsPath, '--disable-pip-version-check'],
    { cwd: ragDir, env: { ...process.env } }
  );
}

async function processPdfToJson(payload) {
  const pdfPath = payload?.pdfPath;
  if (!pdfPath) {
    throw new Error('Missing pdfPath.');
  }

  const allowOverwrite = Boolean(payload?.allowOverwrite);
  const docType = payload?.docType || 'auto';
  const outputDir = payload?.outputDir || path.join(app.getPath('temp'), 'pair-generation-rag');
  const outputFileName = normalizeJsonFileName(payload?.outputFileName, 'chapter_rag.json');
  const idPrefix = typeof payload?.idPrefix === 'string' ? payload.idPrefix.trim() : '';
  const chapterNumberOverride = Number.parseInt(payload?.chapterNumberOverride, 10);
  const safeChapterOverride = Number.isFinite(chapterNumberOverride) && chapterNumberOverride > 0
    ? chapterNumberOverride
    : 0;
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputFileName);

  if (!allowOverwrite) {
    try {
      const existingEntries = await fs.readdir(outputDir);
      const existingNames = new Set(existingEntries.map((entry) => entry.toLowerCase()));
      if (!existingNames.has(outputFileName.toLowerCase())) {
        throw Object.assign(new Error('Not found.'), { code: 'ENOENT' });
      }
      throw new Error(`Output file already exists: ${outputPath}`);
    } catch (error) {
      if (error?.code && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const ragDir = path.resolve(__dirname, 'pdf_to_rag');
  const ragScript = path.join(ragDir, 'pdf_to_rag.py');
  try {
    await fs.access(ragScript);
  } catch {
    throw new Error(`PDF to RAG script not found at: ${ragScript}`);
  }

  const pythonCode = [
    'import json, os, sys',
    'sys.path.insert(0, os.environ["PDF_TO_RAG_DIR"])',
    'from pdf_to_rag import process_pdf',
    'override = int(os.environ.get("PDF_CHAPTER_OVERRIDE", "0") or 0)',
    'result = process_pdf(os.environ["PDF_INPUT_PATH"], os.environ["PDF_OUTPUT_DIR"], output_filename=os.environ.get("PDF_OUTPUT_FILE"), doc_type=os.environ.get("PDF_DOC_TYPE", "auto"), chapter_number_override=(override if override > 0 else None), prefix=os.environ.get("PDF_PREFIX", ""))',
    'md_path = os.path.splitext(result)[0] + ".md"',
    'print("__PDF_TO_RAG_RESULT__" + json.dumps({"output_path": result, "markdown_path": md_path}))',
  ].join('; ');

  const env = {
    ...process.env,
    PDF_TO_RAG_DIR: ragDir,
    PDF_INPUT_PATH: pdfPath,
    PDF_OUTPUT_DIR: outputDir,
    PDF_OUTPUT_FILE: outputFileName,
    PDF_DOC_TYPE: docType,
    PDF_CHAPTER_OVERRIDE: String(safeChapterOverride || 0),
    PDF_PREFIX: idPrefix,
  };

  const executeExtraction = async (launcher) => {
    const { stdout, stderr } = await runCommand(
      launcher.command,
      [...launcher.args, '-c', pythonCode],
      { env, cwd: ragDir }
    );

    const resultLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith('__PDF_TO_RAG_RESULT__'));

    if (!resultLine) {
      const parseError = new Error('PDF extraction completed but returned no output path.');
      parseError.stdout = stdout;
      parseError.stderr = stderr;
      throw parseError;
    }

    const parsed = JSON.parse(resultLine.replace('__PDF_TO_RAG_RESULT__', ''));
    const outputPath = parsed.output_path;
    const markdownPath = parsed.markdown_path;
    const fileContent = await fs.readFile(outputPath, 'utf8');

    return {
      outputPath,
      markdownPath,
      data: JSON.parse(fileContent),
      stdout,
      stderr,
      launcher: launcher.command,
    };
  };

  let lastError = null;
  for (const launcher of getPythonLaunchers()) {
    try {
      return await executeExtraction(launcher);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue;
      }

      if (isMissingPdfMinerError(error)) {
        try {
          await installPdfToRagRequirements(launcher, ragDir);
          return await executeExtraction(launcher);
        } catch (installOrRetryError) {
          lastError = installOrRetryError;
          continue;
        }
      }

      lastError = error;
    }
  }

  const detail = lastError?.stderr || lastError?.message || 'Unknown Python launcher failure.';
  throw new Error(
    `Unable to process PDF with the Python extractor. ${detail} If needed, install dependencies with: python -m pip install -r pdf_to_rag/requirements.txt`
  );
}

function summarizeDocument(documentJson) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const totalChars = sections.reduce((sum, sec) => sum + (sec?.content?.length || 0), 0);
  const topSections = sections
    .slice()
    .sort((a, b) => (b?.content?.length || 0) - (a?.content?.length || 0))
    .slice(0, 8)
    .map((sec) => ({
      id: sec.id || null,
      title: sec.title || 'Untitled',
      chars: sec?.content?.length || 0,
    }));

  return {
    chapter: documentJson?.chapter ?? null,
    chapterTitle: documentJson?.title || 'Unknown',
    sectionCount: sections.length,
    totalCharacters: totalChars,
    modelUsed: 'deterministic',
    synopsis: `Chapter ${documentJson?.chapter ?? '?'} contains ${sections.length} sections with ${totalChars} characters of extracted content.`,
    keySections: topSections,
    generatedAt: new Date().toISOString(),
  };
}

function countWords(text) {
  return `${text || ''}`.trim().split(/\s+/).filter(Boolean).length;
}

function trimMarkdownToMaxWords(markdown, maxWords) {
  const lines = `${markdown || ''}`.split('\n');
  const kept = [];
  let words = 0;

  for (const line of lines) {
    const lineWords = line.trim().split(/\s+/).filter(Boolean);
    if (lineWords.length === 0) {
      kept.push(line);
      continue;
    }
    if (words + lineWords.length <= maxWords) {
      kept.push(line);
      words += lineWords.length;
      continue;
    }

    const remain = maxWords - words;
    if (remain > 0) {
      kept.push(lineWords.slice(0, remain).join(' '));
    }
    break;
  }

  return `${kept.join('\n').trim()}\n`;
}

function tokenizeForSimilarity(text) {
  return new Set(
    `${text || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
  );
}

function jaccardSimilarity(a, b) {
  const setA = tokenizeForSimilarity(a);
  const setB = tokenizeForSimilarity(b);
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function hasExcessiveChunkOverlap(markdown, chunkSummaries) {
  const candidates = Array.isArray(chunkSummaries) ? chunkSummaries : [];
  if (!markdown || candidates.length === 0) {
    return false;
  }

  const markdownLead = `${markdown}`.split(/\s+/).slice(0, 220).join(' ');
  const maxSimilarity = candidates.reduce((max, chunk) => Math.max(max, jaccardSimilarity(markdownLead, chunk)), 0);
  return maxSimilarity >= 0.72;
}

async function buildSummaryFromApi(documentJson, fallbackSummary, idContext = null) {
  try {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const chapterTitle = documentJson?.title || 'Unknown';
  const chapterNumber = Number.isFinite(Number(idContext?.chapterNumber)) && Number(idContext?.chapterNumber) > 0
    ? Number(idContext.chapterNumber)
    : (documentJson?.chapter ?? null);
  const bookId = `${idContext?.bookId || inferBookId(documentJson) || 'DOC'}`.toUpperCase();

  // Proportional allocation
  const SUMMARY_MIN_WORDS = 500;
  const SUMMARY_MAX_WORDS = 750;
  const totalSectionWords = sections.reduce((sum, sec) => sum + (sec?.wordCount || 0), 0) || 1;
  const summaryWordBudget = Math.max(SUMMARY_MIN_WORDS, Math.min(SUMMARY_MAX_WORDS, Math.round(totalSectionWords / 8)));
  // If totalSectionWords is much larger than max, clamp to max
  const totalSummaryWords = Math.max(SUMMARY_MIN_WORDS, Math.min(SUMMARY_MAX_WORDS, totalSectionWords));

  // Allocate words per section
  const sectionAllocations = sections.map((sec) => {
    const proportion = (sec?.wordCount || 0) / totalSectionWords;
    const allocated = Math.max(30, Math.round(proportion * totalSummaryWords));
    return { ...sec, summaryWordBudget: allocated };
  });

  // Summarize each section to its allocated word count
  const sectionSummaries = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let modelUsed = 'api';
  let modelVersion = 'unknown';
  for (let i = 0; i < sectionAllocations.length; i += 1) {
    const sec = sectionAllocations[i];
    const sectionPrompt = [
      'You are an expert aviation instructor.',
      `Summarize the following section in ${sec.summaryWordBudget} words or fewer, focusing on key learning objectives and facts.`,
      'Return JSON only with key "summary" containing a detailed section summary paragraph.',
    ].join(' ');
    const sectionPayload = {
      chapterTitle,
      chapterNumber,
      bookId,
      sectionTitle: sec.title,
      sectionId: sec.id,
      sectionIndex: i + 1,
      totalSections: sectionAllocations.length,
      sectionText: sec.content,
      wordBudget: sec.summaryWordBudget,
      instruction: `Summarize this section in ${sec.summaryWordBudget} words or fewer.`,
    };
    const sectionResult = await callPreferredApiJson(sectionPrompt, sectionPayload);
    const sectionSummary = typeof sectionResult?.json?.summary === 'string'
      ? sectionResult.json.summary.trim()
      : typeof sectionResult?.json?.chunkSummary === 'string'
        ? sectionResult.json.chunkSummary.trim()
        : typeof sectionResult?.json?.text === 'string'
          ? sectionResult.json.text.trim()
          : '';
    if (sectionSummary) {
      sectionSummaries.push(sectionSummary);
    }
    modelUsed = sectionResult?.modelUsed || modelUsed;
    modelVersion = sectionResult?.modelVersion || modelVersion;
    totalInputTokens += Number(sectionResult?.usage?.prompt_tokens || 0);
    totalOutputTokens += Number(sectionResult?.usage?.completion_tokens || 0);
  }

  // Merge all section summaries into a chapter summary
  const mergeSystemPrompt = [
    'You are an expert aviation instructor.',
    'Merge all section summaries into one coherent chapter summary for student pilots without adding external facts.',
    'Return JSON only with keys: markdown, synopsis, keyPoints, estimatedReadTime.',
    'markdown must be a comprehensive 500-750 word summary in markdown with sections:',
    'Overview, Key Learning Objectives, Main Concepts, Key Terms and Definitions, Summary of Important Facts.',
    'The summary must synthesize material from the entire chapter, not mirror any single section.',
    'Do not include headings like "Additional Detail from Source Sections" or "Source Section".',
  ].join(' ');
  const mergePayload = {
    chapterTitle,
    chapterNumber,
    bookId,
    sectionSummaries,
    instruction: 'Produce one final chapter summary from all section summaries with broad section coverage and non-redundant wording.',
  };
  const mergeResult = await callPreferredApiJson(mergeSystemPrompt, mergePayload);
  const apiMarkdown = typeof mergeResult?.json?.markdown === 'string'
    ? mergeResult.json.markdown.trim()
    : '';
  const overview = typeof mergeResult?.json?.synopsis === 'string'
    ? mergeResult.json.synopsis.trim()
    : fallbackSummary.synopsis;
  const keyPoints = Array.isArray(mergeResult?.json?.keyPoints)
    ? mergeResult.json.keyPoints.map((value) => `${value || ''}`.trim()).filter(Boolean)
    : [];
  totalInputTokens += Number(mergeResult?.usage?.prompt_tokens || 0);
  totalOutputTokens += Number(mergeResult?.usage?.completion_tokens || 0);
  modelUsed = mergeResult?.modelUsed || modelUsed;
  modelVersion = mergeResult?.modelVersion || modelVersion;
  const markdownWordCount = countWords(apiMarkdown);

  let finalMarkdown = markdownWordCount > 0
    ? `${apiMarkdown}\n`
    : '';
  let finalWordCount = countWords(finalMarkdown);

  if (finalWordCount < SUMMARY_MIN_WORDS || finalWordCount > SUMMARY_MAX_WORDS) {
    try {
      const normalizePrompt = [
        'You are an expert aviation instructor.',
        'Rewrite the provided chapter summary without adding external facts and ensure chapter-wide coverage.',
        `Return JSON only with key "markdown" between ${SUMMARY_MIN_WORDS} and ${SUMMARY_MAX_WORDS} words.`,
        'Keep markdown headings and keep aviation terminology accurate.',
        'Do not create headings like "Additional Detail from Source Sections" or "Source Section".',
      ].join(' ');

      const normalizePayload = {
        chapterTitle,
        chapterNumber,
        bookId,
        minWords: SUMMARY_MIN_WORDS,
        maxWords: SUMMARY_MAX_WORDS,
        draftMarkdown: finalMarkdown,
        sectionSummaries,
      };

      const normalizeResult = await callPreferredApiJson(normalizePrompt, normalizePayload);
      const normalizedMarkdown = typeof normalizeResult?.json?.markdown === 'string'
        ? normalizeResult.json.markdown.trim()
        : '';

      if (normalizedMarkdown) {
        finalMarkdown = `${normalizedMarkdown}\n`;
        totalInputTokens += Number(normalizeResult?.usage?.prompt_tokens || 0);
        totalOutputTokens += Number(normalizeResult?.usage?.completion_tokens || 0);
        modelUsed = normalizeResult?.modelUsed || modelUsed;
        modelVersion = normalizeResult?.modelVersion || modelVersion;
      }
    } catch (_error) {
      // fall through to deterministic shaping
    }
  }

  finalWordCount = countWords(finalMarkdown);
  const overlapsChunk = hasExcessiveChunkOverlap(finalMarkdown, sectionSummaries);

  if ((finalWordCount < SUMMARY_MIN_WORDS || overlapsChunk) && sectionSummaries.length > 0) {
    try {
      const rewritePrompt = [
        'You are an expert aviation instructor rewriting a chapter summary.',
        `Return JSON only with key "markdown" between ${SUMMARY_MIN_WORDS} and ${SUMMARY_MAX_WORDS} words.`,
        'Use these exact headings: Overview, Key Learning Objectives, Main Concepts, Key Terms and Definitions, Summary of Important Facts.',
        'Synthesize all section summaries as one narrative and avoid copying wording from any single section.',
        'Do not include headings like "Additional Detail from Source Sections" or "Source Section".',
      ].join(' ');

      const rewritePayload = {
        chapterTitle,
        chapterNumber,
        bookId,
        minWords: SUMMARY_MIN_WORDS,
        maxWords: SUMMARY_MAX_WORDS,
        priorMarkdown: finalMarkdown,
        sectionSummaries,
      };

      const rewriteResult = await callPreferredApiJson(rewritePrompt, rewritePayload);
      const rewrittenMarkdown = typeof rewriteResult?.json?.markdown === 'string'
        ? rewriteResult.json.markdown.trim()
        : '';

      if (rewrittenMarkdown) {
        finalMarkdown = `${rewrittenMarkdown}\n`;
        totalInputTokens += Number(rewriteResult?.usage?.prompt_tokens || 0);
        totalOutputTokens += Number(rewriteResult?.usage?.completion_tokens || 0);
        modelUsed = rewriteResult?.modelUsed || modelUsed;
        modelVersion = rewriteResult?.modelVersion || modelVersion;
      }
    } catch (_error) {
      // final fallback below
    }
  }

  finalWordCount = countWords(finalMarkdown);

  if (finalWordCount < SUMMARY_MIN_WORDS) {
    finalMarkdown = buildDeterministicDetailedSummaryMarkdown(documentJson, idContext);
    finalWordCount = countWords(finalMarkdown);
  }

  if (finalWordCount > SUMMARY_MAX_WORDS) {
    finalMarkdown = trimMarkdownToMaxWords(finalMarkdown, SUMMARY_MAX_WORDS);
  }

  return {
    ...fallbackSummary,
    chapter: chapterNumber,
    markdown: finalMarkdown,
    synopsis: overview,
    keyPoints: keyPoints.slice(0, 24),
    estimatedReadTime: Math.max(
      1,
      Number.isFinite(Number(mergeResult?.json?.estimatedReadTime))
        ? Number(mergeResult.json.estimatedReadTime)
        : Math.round(finalMarkdown.length / 1200)
    ),
    modelUsed,
    modelVersion,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    generatedAt: new Date().toISOString(),
  };
  } catch (_error) {
    return {
      ...fallbackSummary,
      markdown: buildDeterministicDetailedSummaryMarkdown(documentJson, idContext),
      summaryError: _error?.message || 'API summary generation failed.',
      keyPoints: (fallbackSummary?.keySections || []).map((section) => section?.title).filter(Boolean),
      estimatedReadTime: Math.max(1, Math.round((fallbackSummary?.totalCharacters || 0) / 1200)),
      modelUsed: fallbackSummary?.modelUsed || 'deterministic',
      modelVersion: fallbackSummary?.modelVersion || 'fallback',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

function buildFallbackSummaryMarkdown(summary) {
  const lines = [];
  lines.push(`# Chapter Summary: ${summary?.chapterTitle || 'Unknown'}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(summary?.synopsis || 'Summary unavailable.');
  lines.push('');
  lines.push('## Key Sections');
  const sections = Array.isArray(summary?.keySections) ? summary.keySections : [];
  if (sections.length === 0) {
    lines.push('- No section highlights were available.');
  } else {
    sections.forEach((section) => {
      lines.push(`- ${section?.title || 'Untitled'} (${section?.id || 'n/a'})`);
    });
  }
  lines.push('');
  lines.push('## Metadata');
  lines.push(`- Chapter: ${summary?.chapter ?? 'n/a'}`);
  lines.push(`- Sections: ${summary?.sectionCount ?? 0}`);
  lines.push(`- Characters: ${summary?.totalCharacters ?? 0}`);
  lines.push(`- Model Used: ${summary?.modelVersion || summary?.modelUsed || 'unknown'}`);
  lines.push(`- Generated At: ${summary?.generatedAt || new Date().toISOString()}`);
  return `${lines.join('\n')}\n`;
}

function buildDeterministicDetailedSummaryMarkdown(documentJson, idContext = null) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const chapterTitle = documentJson?.title || 'Unknown';
  const chapterNumber = Number.isFinite(Number(idContext?.chapterNumber)) && Number(idContext?.chapterNumber) > 0
    ? Number(idContext.chapterNumber)
    : (documentJson?.chapter ?? '?');

  const lines = [];
  lines.push(`# Chapter Summary: ${chapterTitle}`);
  lines.push('');
  lines.push('## Overview');
  lines.push(`Chapter ${chapterNumber} covers ${sections.length} sections and focuses on pilot technique, control accuracy, risk awareness, and standards-based decision making.`);
  lines.push('');
  lines.push('## Key Learning Objectives');

  const objectiveTitles = sections.slice(0, 6).map((section, idx) => section?.title || `Section ${idx + 1}`);
  if (!objectiveTitles.length) {
    lines.push('- Identify and apply the chapter\'s core procedures and safety priorities.');
  } else {
    objectiveTitles.forEach((title) => {
      lines.push(`- Understand and apply ${title.toLowerCase()} in practical training scenarios.`);
    });
  }

  lines.push('');
  lines.push('## Main Concepts');

  sections.slice(0, 10).forEach((section, idx) => {
    const title = section?.title || `Section ${idx + 1}`;
    const content = `${section?.content || ''}`.replace(/\s+/g, ' ').trim();
    const words = content.split(/\s+/).filter(Boolean);
    const excerpt = words.slice(0, 45).join(' ');
    lines.push(`- ${title}: ${excerpt ? `${excerpt}${words.length > 45 ? '...' : ''}` : 'No extractable content was available.'}`);
  });

  lines.push('');
  lines.push('## Key Terms and Definitions');
  const keyTerms = objectiveTitles.slice(0, 6);
  if (!keyTerms.length) {
    lines.push('- **Operational Control**: The coordinated use of attitude, power, and trim to maintain desired aircraft performance.');
  } else {
    keyTerms.forEach((term) => {
      lines.push(`- **${term}**: A primary chapter concept that supports safe execution and consistent pilot performance.`);
    });
  }

  lines.push('');
  lines.push('## Summary of Important Facts');
  lines.push('- Emphasis is placed on safe, standards-driven operation and consistent pilot judgment.');
  lines.push('- Regulatory, procedural, and risk-management concepts are integrated across sections.');
  lines.push('- Mastery of fundamentals in this chapter supports successful progression to advanced maneuvers and evaluations.');
  lines.push('- Practical operation details should still be validated against the source chapter text during study.');

  return `${lines.join('\n')}\n`;
}

function inferBookId(documentJson) {
  const chapterTitle = `${documentJson?.title || ''}`.toLowerCase();
  if (chapterTitle.includes('airplane flying handbook') || chapterTitle.includes('faa-h-8083-3')) {
    return 'AFH';
  }
  if (chapterTitle.includes('pilot\'s handbook') || chapterTitle.includes('phak')) {
    return 'PHAK';
  }
  return 'DOC';
}

function parseIdContextFromPrefix(prefix, documentJson) {
  const raw = typeof prefix === 'string' ? prefix.trim() : '';
  const bookMatch = raw.match(/[A-Za-z]{2,}/);
  const chapterMatch = raw.match(/(\d{1,3})/);

  const inferredBook = inferBookId(documentJson);
  const inferredChapter = normalizeChapterNumber(documentJson?.chapter);

  const bookId = (bookMatch?.[0] || inferredBook || 'DOC').toUpperCase();
  const chapterNumber = chapterMatch ? normalizeChapterNumber(chapterMatch[1]) : inferredChapter;

  return {
    bookId,
    chapterNumber,
    chapterId: `${bookId.toLowerCase()}_${chapterNumber || 0}`,
    idBase: `${bookId.toLowerCase()}_${chapterNumber || 0}`,
  };
}

function normalizeChapterNumber(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function buildStableSectionId(bookId, chapterNumber, sectionIndex) {
  return `${bookId.toLowerCase()}_${chapterNumber}_${sectionIndex}`;
}

function buildQuestionId(sectionId, questionIndex, totalQuestions) {
  return `${sectionId}_q-${questionIndex}-${totalQuestions}`;
}

function buildStructuredQuestionId(bookId, chapterNumber, sectionOrdinal, questionOrdinal) {
  const book = `${bookId || 'DOC'}`.trim().toUpperCase() || 'DOC';
  const chapter = Math.max(0, Number.parseInt(chapterNumber, 10) || 0);
  const section = Math.max(1, Number.parseInt(sectionOrdinal, 10) || 1);
  const question = Math.max(1, Number.parseInt(questionOrdinal, 10) || 1);
  return `${book}.${chapter}.${section}.${question}`;
}

function extractSectionOrdinal(sectionId, fallback = 0) {
  const asText = `${sectionId || ''}`.trim();
  const underscoreMatch = asText.match(/_(\d+)$/);
  if (underscoreMatch) {
    return Number.parseInt(underscoreMatch[1], 10);
  }
  const dotMatch = asText.match(/\.(\d+)$/);
  if (dotMatch) {
    return Number.parseInt(dotMatch[1], 10);
  }
  return fallback;
}

function normalizeWeightDistribution(blueprintSections) {
  if (!Array.isArray(blueprintSections) || blueprintSections.length === 0) {
    return blueprintSections;
  }

  const sum = blueprintSections.reduce((acc, sec) => acc + (Number(sec.weightPercentage) || 0), 0);
  if (sum <= 0) {
    const equalWeight = Number((100 / blueprintSections.length).toFixed(2));
    return blueprintSections.map((sec) => ({ ...sec, weightPercentage: equalWeight }));
  }

  const normalized = blueprintSections.map((sec) => ({
    ...sec,
    weightPercentage: Number((((Number(sec.weightPercentage) || 0) / sum) * 100).toFixed(2)),
  }));

  const normalizedSum = normalized.reduce((acc, sec) => acc + sec.weightPercentage, 0);
  const delta = Number((100 - normalizedSum).toFixed(2));
  if (Math.abs(delta) > 0 && normalized.length > 0) {
    normalized[normalized.length - 1].weightPercentage = Number(
      (normalized[normalized.length - 1].weightPercentage + delta).toFixed(2)
    );
  }

  return normalized;
}

function buildDeterministicBlueprintSections(documentJson, bookId, chapterNumber) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const weights = sections.map((sec) => Math.max(1, sec?.content?.length || 0));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  const blueprintSections = sections.map((sec, idx) => {
    const sectionIndex = idx + 1;
    const sectionId = buildStableSectionId(bookId, chapterNumber, sectionIndex);
    const weightPercentage = (weights[idx] / totalWeight) * 100;
    const charCount = sec?.content?.length || 0;
    const requiredQuestions = Math.max(1, Math.ceil(charCount / 900));

    return {
      sectionId,
      sectionTitle: sec.title || `Section ${sectionIndex}`,
      weightPercentage: Number(weightPercentage.toFixed(2)),
      requiredQuestions,
      rationale: 'Deterministic fallback based on section length and content density.',
    };
  });

  return normalizeWeightDistribution(blueprintSections);
}

function extractJsonObject(text) {
  if (typeof text !== 'string') {
    throw new Error('API response was not valid text.');
  }
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('API response did not contain a JSON object.');
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callOpenAiBlueprintAnalysis(payload) {
  const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an aviation training assessment designer. Analyze chapter sections and allocate weighted question requirements for comprehensive evaluation. Return JSON only.',
        },
        {
          role: 'user',
          content: payload?.promptText || JSON.stringify(payload),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include completion content.');
  }

  return {
    modelUsed: 'openai',
    modelVersion: model,
    analysis: extractJsonObject(content),
  };
}

async function callAnthropicBlueprintAnalysis(payload) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system: [
        'You are an aviation training design analyst.',
        'Analyze section relevance and return strict JSON only.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const textParts = (data?.content || [])
    .filter((part) => part?.type === 'text')
    .map((part) => part?.text || '')
    .join('\n');

  if (!textParts) {
    throw new Error('Anthropic response did not include completion content.');
  }

  return {
    modelUsed: 'anthropic',
    modelVersion: model,
    analysis: extractJsonObject(textParts),
  };
}

async function callGeminiJson(systemPrompt, payload, modelHint = null) {
  const model = modelHint || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const promptText = [
    `${systemPrompt || ''}`.trim(),
    '',
    'Return valid JSON only.',
    '',
    'Payload JSON:',
    JSON.stringify(payload),
  ].join('\n');

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY || '')}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const textParts = (data?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');

  if (!textParts) {
    throw new Error('Gemini response did not include completion content.');
  }

  return {
    modelUsed: 'gemini',
    modelVersion: model,
    json: extractJsonObject(textParts),
    usage: null,
  };
}

async function callGeminiBlueprintAnalysis(payload) {
  const system = [
    'You are an aviation training assessment designer.',
    'Analyze chapter sections and allocate weighted question requirements for comprehensive evaluation.',
    'Return JSON only.',
  ].join(' ');

  const result = await callGeminiJson(system, {
    promptText: payload?.promptText || '',
    sectionsJson: payload?.sectionsJson || [],
    chapterTitle: payload?.chapterTitle || 'Unknown',
    bookId: payload?.bookId || 'DOC',
    chapterId: payload?.chapterId || null,
  });

  return {
    modelUsed: result.modelUsed,
    modelVersion: result.modelVersion,
    analysis: result.json,
  };
}

async function callOpenAiJson(systemPrompt, payload, modelHint = null) {
  const model = modelHint || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  const promptText = `${systemPrompt || ''}`;
  const enforcedSystemPrompt = /json/i.test(promptText)
    ? promptText
    : `${promptText} Return valid JSON only.`.trim();
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: enforcedSystemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include completion content.');
  }

  return {
    modelUsed: 'openai',
    modelVersion: model,
    json: extractJsonObject(content),
    usage: data?.usage || null,
  };
}

async function callAnthropicJson(systemPrompt, payload, modelHint = null) {
  const model = modelHint || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const textParts = (data?.content || [])
    .filter((part) => part?.type === 'text')
    .map((part) => part?.text || '')
    .join('\n');

  if (!textParts) {
    throw new Error('Anthropic response did not include completion content.');
  }

  return {
    modelUsed: 'anthropic',
    modelVersion: model,
    json: extractJsonObject(textParts),
    usage: {
      prompt_tokens: Number(data?.usage?.input_tokens || 0),
      completion_tokens: Number(data?.usage?.output_tokens || 0),
    },
  };
}

function getProviderOrder(providers) {
  const available = Array.isArray(providers) ? providers.slice() : [];
  const priorityRaw = `${process.env.API_PROVIDER_PRIORITY || ''}`.trim();
  if (!priorityRaw) {
    return available;
  }

  const preferred = priorityRaw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const ordered = [];
  preferred.forEach((provider) => {
    if (available.includes(provider) && !ordered.includes(provider)) {
      ordered.push(provider);
    }
  });
  available.forEach((provider) => {
    if (!ordered.includes(provider)) {
      ordered.push(provider);
    }
  });
  return ordered;
}

async function callPreferredApiJson(systemPrompt, payload, modelHint = null) {
  const status = getApiStatus();
  if (!status.available) {
    throw new Error('API is not available.');
  }

  const orderedProviders = getProviderOrder(status.providers);
  const attempts = [];
  if (orderedProviders.includes('openai')) {
    attempts.push(() => callOpenAiJson(systemPrompt, payload, modelHint));
  }
  if (orderedProviders.includes('anthropic')) {
    attempts.push(() => callAnthropicJson(systemPrompt, payload, modelHint));
  }
  if (orderedProviders.includes('gemini')) {
    attempts.push(() => callGeminiJson(systemPrompt, payload, modelHint));
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No API provider call succeeded.');
}

function buildBlueprintRequestPayload(documentJson, idContext) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const chapterTitle = documentJson?.title || 'Unknown';
  const bookId = idContext?.bookId || inferBookId(documentJson);
  const chapterId = idContext?.chapterId || `${bookId.toLowerCase()}_${normalizeChapterNumber(documentJson?.chapter)}`;

  const sectionsJson = sections.map((sec, idx) => ({
    sectionId: `${sec?.id || `${normalizeChapterNumber(documentJson?.chapter) || 0}.${idx + 1}`}`,
    sectionTitle: sec?.title || `Section ${idx + 1}`,
    characterCount: (sec?.content || '').length,
    excerpt: (sec?.content || '').replace(/\s+/g, ' ').trim().slice(0, 900),
  }));

  const promptText = [
    'Create a question bank blueprint for this chapter.',
    '',
    `Chapter title: ${chapterTitle}`,
    `Book: ${bookId}`,
    `Chapter ID: ${chapterId}`,
    '',
    'Sections JSON:',
    JSON.stringify(sectionsJson, null, 2),
    '',
    'Output format:',
    '{',
    '  "targetTotalQuestions": number,',
    '  "notes": "short explanation",',
    '  "sections": [',
    '    {',
    '      "sectionId": "exact section id",',
    '      "sectionTitle": "section title",',
    '      "weightPercentage": number,',
    '      "requiredQuestions": number,',
    '      "rationale": "short rationale"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Use every section exactly once.',
    '- Weight percentages should total 100.',
    '- Every section must have at least 1 question.',
    '- Give more questions to safety-critical or high-complexity sections.',
    '- Keep rationale concise and practical.',
  ].join('\n');

  return {
    chapterTitle,
    bookId,
    chapterId,
    sectionsJson,
    promptText,
  };
}

function distributeQuestionsByWeight(sections, targetTotal) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [];
  }

  const safeTarget = Math.max(sections.length, Number.parseInt(targetTotal, 10) || sections.length);
  const weighted = sections.map((section) => ({
    ...section,
    requiredQuestions: Math.max(1, Number.parseInt(section?.requiredQuestions, 10) || 0),
  }));

  const hasProvided = weighted.some((section) => Number.parseInt(section?.requiredQuestions, 10) > 0);
  if (!hasProvided) {
    weighted.forEach((section) => {
      const weight = Math.max(0.01, Number(section?.weightPercentage) || 0.01);
      section.requiredQuestions = Math.max(1, Math.round((safeTarget * weight) / 100));
    });
  }

  let currentTotal = weighted.reduce((sum, section) => sum + Math.max(1, Number(section.requiredQuestions) || 1), 0);
  let guard = 0;
  while (currentTotal !== safeTarget && guard < 5000) {
    guard += 1;
    if (currentTotal < safeTarget) {
      const next = weighted
        .slice()
        .sort((a, b) => (Number(b.weightPercentage) || 0) - (Number(a.weightPercentage) || 0))[0];
      next.requiredQuestions += 1;
      currentTotal += 1;
      continue;
    }

    const next = weighted
      .slice()
      .sort((a, b) => (Number(a.weightPercentage) || 0) - (Number(b.weightPercentage) || 0))
      .find((section) => section.requiredQuestions > 1);
    if (!next) {
      break;
    }
    next.requiredQuestions -= 1;
    currentTotal -= 1;
  }

  return weighted;
}

function buildBlueprintFromApiAnalysis(documentJson, analysis, providerMeta, idContext) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const bookId = idContext?.bookId || inferBookId(documentJson);
  const chapterNumber = normalizeChapterNumber(idContext?.chapterNumber ?? documentJson?.chapter);
  const totalChars = sections.reduce((sum, sec) => sum + Math.max(1, (sec?.content || '').length), 0);
  const minimumComprehensiveTarget = Math.max(sections.length, Math.ceil(totalChars / 500));

  const byId = new Map();
  const byIndex = new Map();
  const apiSections = Array.isArray(analysis?.sections)
    ? analysis.sections
    : Array.isArray(analysis?.sectionBlueprints)
      ? analysis.sectionBlueprints
      : [];
  apiSections.forEach((item) => {
    const sid = `${item?.sectionId || ''}`.trim();
    if (sid) {
      byId.set(sid, item);
    }
    const index = Number.parseInt(item?.sectionIndex, 10);
    if (Number.isFinite(index) && index >= 1) {
      byIndex.set(index, item);
    }
  });

  const apiTarget = Number.parseInt(analysis?.targetTotalQuestions ?? analysis?.totalRequiredQuestions, 10);
  const targetTotal = Number.isFinite(apiTarget) && apiTarget > 0
    ? Math.max(apiTarget, minimumComprehensiveTarget)
    : minimumComprehensiveTarget;

  let blueprintSections = sections.map((sec, idx) => {
    const sectionIndex = idx + 1;
    const exactSourceId = `${sec?.id || `${chapterNumber}.${sectionIndex}`}`;
    const api = byId.get(exactSourceId) || byIndex.get(sectionIndex) || {};
    const fallbackChars = Math.max(1, (sec?.content || '').length);
    return {
      sectionId: buildStableSectionId(bookId, chapterNumber, sectionIndex),
      sourceSectionId: exactSourceId,
      sectionTitle: sec?.title || `Section ${sectionIndex}`,
      weightPercentage: Number(api?.weightPercentage) > 0
        ? Number(Number(api.weightPercentage).toFixed(2))
        : fallbackChars,
      requiredQuestions: Number.parseInt(api?.requiredQuestions, 10) || 0,
      subjects: Array.isArray(api?.subjects)
        ? api.subjects.map((value) => `${value || ''}`.trim()).filter(Boolean)
        : [],
      rationale: `${api?.rationale || 'Derived from API section relevance analysis.'}`.trim(),
      modelUsed: providerMeta?.modelVersion || providerMeta?.modelUsed || 'api-analysis',
    };
  });

  blueprintSections = normalizeWeightDistribution(blueprintSections);
  blueprintSections = distributeQuestionsByWeight(blueprintSections, targetTotal);
  const totalRequiredQuestions = blueprintSections.reduce(
    (sum, section) => sum + Math.max(1, Number(section?.requiredQuestions) || 1),
    0,
  );

  return {
    questionBank: {
      chapterId: idContext?.chapterId || `${bookId.toLowerCase()}-ch${chapterNumber || 0}`,
      bookId,
      chapterTitle: documentJson?.title || 'Unknown',
      sourceRelativePath: '',
      generatedAt: new Date().toISOString(),
      modelUsed: providerMeta?.modelUsed || 'api-analysis',
      modelVersion: providerMeta?.modelVersion || 'unknown',
      totalRequiredQuestions,
      sectionBlueprints: blueprintSections,
      notes: typeof analysis?.notes === 'string' ? analysis.notes : undefined,
    },
  };
}

async function buildBlueprint(documentJson, options = {}) {
  const idContext = parseIdContextFromPrefix(options?.idPrefix, documentJson);
  const bookId = idContext.bookId;
  const chapterNumber = idContext.chapterNumber;
  const fallbackSections = buildDeterministicBlueprintSections(documentJson, bookId, chapterNumber);
  const fallbackSectionsWithModel = fallbackSections.map((sec) => ({
    ...sec,
    modelUsed: 'deterministic',
  }));

  const baseFallback = {
    questionBank: {
      chapterId: idContext.chapterId,
      bookId,
      chapterTitle: documentJson?.title || 'Unknown',
      sourceRelativePath: '',
      generatedAt: new Date().toISOString(),
      modelUsed: 'deterministic',
      modelVersion: 'v2',
      totalRequiredQuestions: fallbackSectionsWithModel.reduce(
        (sum, section) => sum + Math.max(1, Number(section?.requiredQuestions) || 1),
        0,
      ),
      sectionBlueprints: fallbackSectionsWithModel,
      notes: 'Fallback analysis used because API was unavailable or returned invalid output.',
    },
  };

  const status = getApiStatus();
  if (!status.available) {
    const apiRequiredError = new Error('API is required to generate output artifacts.');
    apiRequiredError.code = 'API_REQUIRED';
    throw apiRequiredError;
  }

  const payload = buildBlueprintRequestPayload(documentJson, idContext);

  const orderedProviders = getProviderOrder(status.providers);
  let lastError = null;
  for (const provider of orderedProviders) {
    try {
      if (provider === 'openai') {
        const result = await callOpenAiBlueprintAnalysis(payload);
        return buildBlueprintFromApiAnalysis(documentJson, result.analysis, result, idContext);
      }
      if (provider === 'anthropic') {
        const result = await callAnthropicBlueprintAnalysis(payload);
        return buildBlueprintFromApiAnalysis(documentJson, result.analysis, result, idContext);
      }
      if (provider === 'gemini') {
        const result = await callGeminiBlueprintAnalysis(payload);
        return buildBlueprintFromApiAnalysis(documentJson, result.analysis, result, idContext);
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    const apiError = new Error(`API analysis failed: ${lastError?.message || 'Unknown API analysis failure.'}`);
    apiError.code = 'API_ANALYSIS_FAILED';
    throw apiError;
  }

  return baseFallback;
}

function buildSectionBlueprintsFromDocument(documentJson, idContext) {
  const sections = Array.isArray(documentJson?.sections) ? documentJson.sections : [];
  const bookId = `${idContext?.bookId || inferBookId(documentJson) || 'DOC'}`.toUpperCase();
  const chapterNumber = normalizeChapterNumber(idContext?.chapterNumber ?? documentJson?.chapter);
  const chapterId = idContext?.chapterId || `${bookId.toLowerCase()}_${chapterNumber || 0}`;

  const computedTotalWords = sections.reduce((sum, sec) => {
    const wc = Number(sec?.wordCount);
    if (Number.isFinite(wc) && wc > 0) {
      return sum + wc;
    }
    const fallbackWords = `${sec?.content || ''}`.trim().split(/\s+/).filter(Boolean).length;
    return sum + fallbackWords;
  }, 0);
  const totalWords = Number.isFinite(Number(documentJson?.totalWords)) && Number(documentJson?.totalWords) > 0
    ? Number(documentJson.totalWords)
    : computedTotalWords;
  const safeTotalWords = totalWords > 0 ? totalWords : 1;

  const rawBlueprintSections = sections.map((sec, idx) => {
    const sectionIndex = idx + 1;
    const sectionId = `${sec?.id || `${idContext?.idBase || `${bookId.toLowerCase()}_${chapterNumber || 0}`}.${sectionIndex}`}`;
    const sectionTitle = sec?.title || sec?.SectionTitle || `Section ${sectionIndex}`;
    const sectionWordCount = Number.isFinite(Number(sec?.wordCount)) && Number(sec?.wordCount) > 0
      ? Number(sec.wordCount)
      : `${sec?.content || ''}`.trim().split(/\s+/).filter(Boolean).length;
    const providedWeight = Number(sec?.sectionWeight ?? sec?.SectionWeight);
    const weightPercentage = Number.isFinite(providedWeight) && providedWeight > 0
      ? providedWeight
      : (sectionWordCount / safeTotalWords) * 100;

    return {
      sectionId,
      sectionIndex,
      sectionTitle,
      weightPercentage: Number(weightPercentage.toFixed(2)),
      requiredQuestions: 0,
      subjects: [sectionTitle],
      rationale: 'Derived directly from document section word distribution.',
      sourceWordCount: sectionWordCount,
    };
  });

  const weightedSections = normalizeWeightDistribution(rawBlueprintSections);
  const targetTotalQuestions = Math.min(
    MAX_QUESTION_TARGET,
    Math.max(
      weightedSections.length || 1,
      Math.ceil((totalWords || safeTotalWords) / 220)
    )
  );
  const sectionBlueprints = distributeQuestionsByWeight(weightedSections, targetTotalQuestions);
  const totalRequiredQuestions = sectionBlueprints.reduce(
    (sum, section) => sum + Math.max(1, Number(section?.requiredQuestions) || 1),
    0,
  );

  return {
    chapterId,
    bookId,
    chapterNumber,
    chapterTitle: documentJson?.title || documentJson?.DocTitle || 'Unknown',
    totalRequiredQuestions,
    sectionBlueprints,
  };
}

async function buildQuestionBankFromDocument(documentJson, idContext) {
  const qb = buildSectionBlueprintsFromDocument(documentJson, idContext);
  if (!qb || !Array.isArray(qb.sectionBlueprints) || qb.sectionBlueprints.length === 0) {
    return { questionBank: { generatedAt: new Date().toISOString(), modelUsed: 'deterministic', targetTotalQuestions: 0, questions: [] } };
  }

  const targetTotalQuestions = Math.max(
    1,
    Number(qb?.totalRequiredQuestions)
      || qb.sectionBlueprints.reduce(
        (sum, section) => sum + Math.max(1, Number(section?.requiredQuestions) || 1),
        0,
      )
  );

  const questions = [];
  const chapterNumber = Number(qb?.chapterNumber) || 0;
  const bookId = `${qb?.bookId || 'DOC'}`.toUpperCase();

  const normalizeTextArray = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }
        if (item && typeof item === 'object' && typeof item.text === 'string') {
          return item.text.trim();
        }
        return '';
      })
      .filter(Boolean);
  };

  const countTextWords = (value) => `${value || ''}`.trim().split(/\s+/).filter(Boolean).length;
  const isGenericOptionText = (text) => {
    const normalized = `${text || ''}`.trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    return /^((correct|incorrect|wrong)\s+option\s+\d+|option\s+\d+)$/.test(normalized);
  };

  const isValidQuestionStem = (stem) => {
    if (!stem) {
      return false;
    }
    if (countTextWords(stem) < 8) {
      return false;
    }
    return stem.endsWith('?');
  };

  const isRichAnswer = (text) => {
    if (!text) {
      return false;
    }
    if (isGenericOptionText(text)) {
      return false;
    }
    const words = countTextWords(text);
    return words >= 5;
  };

  const systemPrompt = [
    'You are generating aviation exam questions for one section at a time.',
    'Return JSON with a single key "questions" (array).',
    'Generate exactly requiredQuestions questions for the provided sectionId.',
    'Each question object must have exactly these keys: sectionId, question, correct_answers, wrong_answers, subjects.',
    'sectionId must exactly match the provided sectionId.',
    'question must be a complete exam-style sentence ending with a question mark and at least 8 words.',
    'correct_answers must be exactly 3 complete and meaningful strings, each at least 5 words.',
    'wrong_answers must be exactly 8 plausible but incorrect complete strings, each at least 5 words.',
    'Do not use single-word answers, short fragments, or placeholder patterns like "Option 1".',
    'Do not duplicate answer text between correct_answers and wrong_answers.',
    'subjects must be one or more topical strings.',
    'Do not include ids for questions or answers; the system assigns ids.',
    'Do not return markdown or explanations. Return raw JSON only.',
  ].join(' ');

  const providerUsages = [];

  const collectSectionQuestions = async (section, requiredTotal) => {
    const sectionId = `${section?.sectionId || ''}`.trim();
    const sectionTitle = `${section?.sectionTitle || 'Section'}`.trim();
    const accepted = [];
    const seenQuestionKeys = new Set();
    const maxAttemptsPerQuestion = 6;

    for (let questionSlot = 1; questionSlot <= requiredTotal; questionSlot += 1) {
      let acceptedThisSlot = false;

      for (let attempt = 1; attempt <= maxAttemptsPerQuestion && !acceptedThisSlot; attempt += 1) {
        const payload = {
          chapterId: qb.chapterId,
          chapterTitle: qb.chapterTitle,
          sectionId,
          sectionTitle,
          requiredQuestions: 1,
          questionSlot,
          totalRequiredQuestions: requiredTotal,
          existingQuestionStems: accepted.map((item) => item.question),
          instruction: 'Return exactly one valid question object inside questions array.',
        };

        const apiResult = await callPreferredApiJson(systemPrompt, payload);
        providerUsages.push({ modelUsed: apiResult?.modelUsed || 'unknown', modelVersion: apiResult?.modelVersion || 'unknown' });
        const rawQuestions = Array.isArray(apiResult?.json?.questions) ? apiResult.json.questions : [];

        for (const raw of rawQuestions) {
          const rawSectionId = `${raw?.sectionId || ''}`.trim();
          if (rawSectionId !== sectionId) {
            continue;
          }

          const stem = typeof raw?.question === 'string' ? raw.question.trim() : '';
          if (!isValidQuestionStem(stem)) {
            continue;
          }

          const stemKey = stem.toLowerCase();
          if (seenQuestionKeys.has(stemKey)) {
            continue;
          }

          const correctAnswers = normalizeTextArray(raw?.correct_answers).slice(0, 3);
          const wrongAnswers = normalizeTextArray(raw?.wrong_answers).slice(0, 8);
          if (correctAnswers.length !== 3 || wrongAnswers.length !== 8) {
            continue;
          }
          if (!correctAnswers.every(isRichAnswer) || !wrongAnswers.every(isRichAnswer)) {
            continue;
          }

          const dedupeProbe = new Set(
            [...correctAnswers, ...wrongAnswers]
              .map((text) => text.toLowerCase())
          );
          if (dedupeProbe.size !== 11) {
            continue;
          }

          const subjects = Array.isArray(raw?.subjects)
            ? raw.subjects.map((value) => `${value || ''}`.trim()).filter(Boolean)
            : [];

          seenQuestionKeys.add(stemKey);
          accepted.push({
            sectionId,
            question: stem,
            subjects: subjects.length ? subjects : [sectionTitle],
            correctAnswers,
            wrongAnswers,
          });
          acceptedThisSlot = true;
          break;
        }
      }
    }

    if (accepted.length < requiredTotal) {
      throw new Error(`Could not generate enough valid questions for section ${sectionId}. Required ${requiredTotal}, got ${accepted.length}.`);
    }

    return accepted;
  };

  const questionsBySection = new Map();
  for (const section of qb.sectionBlueprints) {
    const sectionId = `${section?.sectionId || ''}`.trim();
    if (!sectionId) {
      continue;
    }
    const requiredTotal = Math.max(1, Number(section?.requiredQuestions) || 1);
    const generated = await collectSectionQuestions(section, requiredTotal);
    questionsBySection.set(sectionId, generated);
  }

  for (const section of qb.sectionBlueprints) {
    const sectionId = `${section?.sectionId || ''}`.trim();
    if (!sectionId) {
      continue;
    }

    const generated = questionsBySection.get(sectionId) || [];
    const requiredTotal = Math.max(1, Number(section?.requiredQuestions) || 1);
    if (generated.length !== requiredTotal) {
      throw new Error(`Question count mismatch for section ${sectionId}. Required ${requiredTotal}, got ${generated.length}.`);
    }

    const sectionOrdinal = Math.max(1, Number(section?.sectionIndex) || extractSectionOrdinal(sectionId, 1));
    for (let idx = 0; idx < generated.length; idx += 1) {
      const item = generated[idx];
      const questionOrdinal = idx + 1;
      const qid = buildStructuredQuestionId(bookId, chapterNumber, sectionOrdinal, questionOrdinal);
      questions.push({
        id: qid,
        question: item.question,
        correct_answers: item.correctAnswers.map((text, answerIndex) => ({ id: `${qid}.c.${answerIndex + 1}`, text })),
        wrong_answers: item.wrongAnswers.map((text, answerIndex) => ({ id: `${qid}.w.${answerIndex + 1}`, text })),
        source: `${bookId} Chapter ${chapterNumber} — ${section.sectionTitle}`,
        subjects: item.subjects,
      });
    }
  }

  const uniqueModelUsed = [...new Set(providerUsages.map((entry) => entry.modelUsed).filter(Boolean))];
  const uniqueModelVersion = [...new Set(providerUsages.map((entry) => entry.modelVersion).filter(Boolean))];

  return {
    questionBank: {
      ...qb,
      generatedAt: new Date().toISOString(),
      modelUsed: uniqueModelUsed.length === 1 ? uniqueModelUsed[0] : (uniqueModelUsed.join('+') || 'unknown'),
      modelVersion: uniqueModelVersion.length === 1 ? uniqueModelVersion[0] : (uniqueModelVersion.join('+') || 'unknown'),
      generationPolicyVersion: 'question-quality-gate-v2',
      totalRequiredQuestions: targetTotalQuestions,
      targetTotalQuestions: questions.length,
      questions,
    },
  };
}

function buildDeterministicTrainingPairs(questionBankDocument, idContext) {
  const qb = questionBankDocument?.questionBank;
  const questions = Array.isArray(qb?.questions) ? qb.questions : [];
  const idBase = idContext?.idBase || 'doc_0';
  const pairs = [];

  questions.forEach((question, questionOffset) => {
    const qid = `${question?.id || ''}`.trim();
    const qIndex = questionOffset + 1;
    const qTotal = questions.length;
    const sectionOrdinal = qIndex;

    const correct = Array.isArray(question?.correct_answers) ? question.correct_answers.slice(0, 3) : [];
    const wrong = Array.isArray(question?.wrong_answers) ? question.wrong_answers.slice(0, 8) : [];

    while (correct.length < 3) {
      const next = correct.length + 1;
      correct.push({ id: `${qid}.c.${next}`, text: `[Correct answer ${next}]` });
    }
    while (wrong.length < 8) {
      const next = wrong.length + 1;
      wrong.push({ id: `${qid}.w.${next}`, text: `[Wrong answer ${next}]` });
    }

    const ordered = [
      ...correct.map((entry) => ({ type: 'correct', text: entry.text })),
      ...wrong.map((entry) => ({ type: 'wrong', text: entry.text })),
    ];

    ordered.forEach((entry, pairIdx) => {
      const pos = pairIdx + 1;
      const pairId = `${idBase}_d_${sectionOrdinal}-q-${qIndex}-${qTotal}_p${pos}-11`;
      pairs.push({
        id: pairId,
        sourceQuestionId: qid,
        sourceSectionId: question?.source || null,
        input: question?.question || '',
        output: entry.text,
        label: entry.type,
        modelUsed: 'deterministic',
      });
    });
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      chapterId: idContext?.chapterId || null,
      chapterTitle: qb?.chapterTitle || null,
      modelUsed: 'deterministic',
      totalQuestions: questions.length,
      totalPairs: pairs.length,
      pairsPerQuestion: 11,
      type: 'deterministic-training',
    },
    pairs,
  };
}

async function buildBalancedTrainingRecord(questionBankDocument, deterministicTraining, idContext) {
  const qb = questionBankDocument?.questionBank || {};
  const questions = Array.isArray(qb?.questions) ? qb.questions : [];
  const deterministicPairs = Array.isArray(deterministicTraining?.pairs) ? deterministicTraining.pairs : [];

  const targetTotal = Math.max(1, Math.floor(deterministicPairs.length * 0.3));
  const sampledQuestions = questions.slice(0, Math.max(1, Math.min(40, questions.length)));

  const payload = {
    chapterId: qb.chapterId || idContext?.chapterId || null,
    chapterTitle: qb.chapterTitle || null,
    targetTotal,
    questions: sampledQuestions.map((question) => ({
      id: question?.id,
      source: question?.source,
      subjects: Array.isArray(question?.subjects) ? question.subjects : [],
      question: question?.question,
      correct_answers: (question?.correct_answers || []).map((item) => item?.text).filter(Boolean),
      wrong_answers: (question?.wrong_answers || []).map((item) => item?.text).filter(Boolean),
    })),
  };

  const systemPrompt = [
    'You generate instruction-tuning records for aviation study assistants.',
    'Return JSON with key "records" as an array.',
    'Each record requires: instruction, context, response, metadata.',
    'context must be a concise source anchor, not a long paragraph (prefer one short line).',
    'metadata must include source, topic, difficulty.',
    'topic should align with subjects used in the question bank.',
    'Do not include markdown. JSON only.',
  ].join(' ');

  const apiResult = await callPreferredApiJson(systemPrompt, payload);
  const rawRecords = Array.isArray(apiResult?.json?.records) ? apiResult.json.records : [];
  const questionById = new Map(sampledQuestions.map((question) => [`${question?.id || ''}`.trim(), question]));

  const records = [];

  for (const raw of rawRecords) {
    if (records.length >= targetTotal) {
      break;
    }

    const instruction = typeof raw?.instruction === 'string' ? raw.instruction.trim() : '';
    const context = typeof raw?.context === 'string' ? raw.context.trim() : '';
    const response = typeof raw?.response === 'string' ? raw.response.trim() : '';
    const source = typeof raw?.metadata?.source === 'string' ? raw.metadata.source.trim() : '';
    const topic = typeof raw?.metadata?.topic === 'string' ? raw.metadata.topic.trim() : '';
    const difficulty = typeof raw?.metadata?.difficulty === 'string' ? raw.metadata.difficulty.trim() : '';
    const sourceQuestionId = typeof raw?.sourceQuestionId === 'string' ? raw.sourceQuestionId.trim() : '';
    const sourceQuestion = questionById.get(sourceQuestionId);
    const fallbackSource = sourceQuestion?.source || `${qb?.bookId || 'DOC'} chapter ${idContext?.chapterNumber || '?'}`;
    const fallbackTopic = Array.isArray(sourceQuestion?.subjects) && sourceQuestion.subjects.length
      ? sourceQuestion.subjects[0]
      : 'General';
    const compactContext = context.length > 180 ? context.slice(0, 180).trim() : context;
    const finalContext = compactContext || fallbackSource;

    if (!instruction || !response) {
      continue;
    }

    records.push({
      instruction,
      context: finalContext,
      response,
      metadata: {
        source: source || fallbackSource,
        topic: topic || fallbackTopic,
        difficulty: difficulty || 'Intermediate',
      },
    });
  }

  if (!records.length) {
    throw new Error('API returned no balanced training records.');
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      chapter: idContext?.chapterNumber || null,
      chapterTitle: qb?.chapterTitle || 'Unknown',
      totalRecords: records.length,
      type: 'instruction-training-record',
      modelUsed: apiResult.modelUsed,
      modelVersion: apiResult.modelVersion,
      targetTotal,
    },
    records,
  };
}

async function writeSelectedArtifacts(payload) {
  const outputDir = payload?.outputDir;
  if (!outputDir) {
    throw new Error('Missing outputDir.');
  }

  const allowOverwrite = Boolean(payload?.allowOverwrite);
  const selectedOutputs = payload?.selectedOutputs || {};
  const fileNames = payload?.outputFileNames || {};
  const documentJson = payload?.documentJson || {};
  const documentJsonPath = typeof payload?.documentJsonPath === 'string' ? payload.documentJsonPath : '';
  const idPrefix = typeof payload?.idPrefix === 'string' ? payload.idPrefix : '';
  const idContext = parseIdContextFromPrefix(idPrefix, documentJson);
  await fs.mkdir(outputDir, { recursive: true });

  const written = [];

  const needsSummary = Boolean(selectedOutputs.summary);
  const needsBlueprint = Boolean(selectedOutputs.blueprint);
  const needsQuestionBank = Boolean(selectedOutputs.questionBank || selectedOutputs.deterministicTraining || selectedOutputs.trainingRecord);
  const needsDeterministicTraining = Boolean(selectedOutputs.deterministicTraining || selectedOutputs.trainingRecord);
  const needsTrainingRecord = Boolean(selectedOutputs.trainingRecord);

  let blueprint = null;
  let questionBank = null;
  let deterministicTraining = null;
  let trainingRecord = null;

  const fallbackSummary = summarizeDocument(documentJson);
  let summary = fallbackSummary;

  if (needsBlueprint) {
    blueprint = await buildBlueprint(documentJson, { idPrefix });
  }

  if (needsQuestionBank) {
    questionBank = await buildQuestionBankFromDocument(documentJson, idContext);
  }

  if (needsDeterministicTraining) {
    deterministicTraining = buildDeterministicTrainingPairs(questionBank, idContext);
  }

  if (needsTrainingRecord) {
    trainingRecord = await buildBalancedTrainingRecord(questionBank, deterministicTraining, idContext);
  }

  if (needsSummary) {
    try {
      summary = await buildSummaryFromApi(documentJson, fallbackSummary, idContext);
      if (needsQuestionBank) {
        summary.modelUsed = questionBank?.questionBank?.modelUsed || summary.modelUsed;
        summary.modelVersion = questionBank?.questionBank?.modelVersion || summary.modelVersion;
      } else if (needsBlueprint) {
        summary.modelUsed = blueprint?.questionBank?.modelUsed || summary.modelUsed;
        summary.modelVersion = blueprint?.questionBank?.modelVersion || summary.modelVersion;
      }
    } catch (_error) {
      summary = {
        ...fallbackSummary,
        markdown: buildDeterministicDetailedSummaryMarkdown(documentJson, idContext),
      };
    }
  }

  const outputMap = [
    {
      key: 'docJson',
      fileName: normalizeJsonFileName(fileNames.docJson, 'chapter_rag.json'),
      data: documentJson,
    },
    {
      key: 'summary',
      fileName: normalizeMarkdownFileName(fileNames.summary, 'chapter_summary.md'),
      data: typeof summary?.markdown === 'string' && summary.markdown.trim()
        ? `${summary.markdown.trim()}\n`
        : buildFallbackSummaryMarkdown(summary),
      contentType: 'text/markdown',
    },
    {
      key: 'blueprint',
      fileName: normalizeJsonFileName(fileNames.blueprint, 'chapter_blueprint.json'),
      data: blueprint,
    },
    {
      key: 'questionBank',
      fileName: normalizeJsonFileName(fileNames.questionBank, 'question_bank.generated.json'),
      data: questionBank,
    },
    {
      key: 'trainingRecord',
      fileName: normalizeJsonFileName(fileNames.trainingRecord, 'balanced_training_record.json'),
      data: trainingRecord,
    },
    {
      key: 'deterministicTraining',
      fileName: normalizeJsonFileName(fileNames.deterministicTraining, 'deterministic_training.json'),
      data: deterministicTraining,
    },
  ];

  const docJsonTarget = outputMap.find((entry) => entry.key === 'docJson');
  const extractedDocMatchesTarget = Boolean(docJsonTarget)
    && normalizePathForCompare(documentJsonPath) !== ''
    && normalizePathForCompare(path.join(outputDir, docJsonTarget.fileName)) === normalizePathForCompare(documentJsonPath);

  const selectedEntries = outputMap.filter((entry) => {
    if (!selectedOutputs[entry.key]) {
      return false;
    }
    if (entry.key === 'docJson' && extractedDocMatchesTarget) {
      return false;
    }
    return true;
  });

  const seenFileNames = new Set();
  for (const entry of selectedEntries) {
    const lowered = entry.fileName.toLowerCase();
    if (seenFileNames.has(lowered)) {
      throw new Error(`Duplicate output file name detected (case-insensitive): ${entry.fileName}`);
    }
    seenFileNames.add(lowered);
  }

  const existingPaths = [];
  const existingEntries = await fs.readdir(outputDir);
  const existingNames = new Set(existingEntries.map((entry) => entry.toLowerCase()));
  for (const entry of selectedEntries) {
    const outPath = path.join(outputDir, entry.fileName);
    if (existingNames.has(entry.fileName.toLowerCase())) {
      existingPaths.push(outPath);
    }
  }

  if (!allowOverwrite && existingPaths.length > 0) {
    throw new Error(`Output file(s) already exist:\n${existingPaths.join('\n')}`);
  }

  if (selectedOutputs.docJson && extractedDocMatchesTarget) {
    written.push({ key: 'docJson', path: path.join(outputDir, docJsonTarget.fileName), reused: true });
  }

  for (const entry of selectedEntries) {
    const outPath = path.join(outputDir, entry.fileName);
    if (entry.contentType === 'text/markdown') {
      await fs.writeFile(outPath, entry.data, 'utf8');
    } else {
      await fs.writeFile(outPath, `${JSON.stringify(entry.data, null, 2)}\n`, 'utf8');
    }
    written.push({ key: entry.key, path: outPath });
  }

  return {
    written,
    summary: {
      selectedCount: written.length,
      totalRequiredQuestions: Number(blueprint?.questionBank?.totalRequiredQuestions)
        || (blueprint?.questionBank?.sectionBlueprints || []).reduce(
          (sum, sec) => sum + (Number(sec?.requiredQuestions) || 0),
          0
        ),
    },
  };
}

function getApiStatus() {
  const providers = [];

  if (typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim() !== '') {
    providers.push('openai');
  }

  if (typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.trim() !== '') {
    providers.push('anthropic');
  }

  if (typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.trim() !== '') {
    providers.push('gemini');
  }

  return {
    available: providers.length > 0,
    providers,
  };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('dialog:showConfirm', async (_event, options) => {
    const result = await dialog.showMessageBox({
      type: options.type || 'question',
      buttons: options.buttons || ['Proceed', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: options.title || 'Confirm',
      message: options.message || 'Are you sure?',
      detail: options.detail || '',
    });

    return result.response === 0;
  });

  ipcMain.handle('dialog:showAlert', async (_event, options) => {
    await dialog.showMessageBox({
      type: options.type || 'info',
      buttons: ['OK'],
      title: options.title || 'Notice',
      message: options.message || '',
      detail: options.detail || '',
    });
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('settings:get', async () => {
    return loadAppSettings();
  });

  ipcMain.handle('settings:save', async (_event, payload) => {
    return saveAppSettings(payload);
  });

  ipcMain.handle('api:status', async () => {
    return getApiStatus();
  });

  ipcMain.handle('dialog:openPdf', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      title: 'Select Source PDF',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('rag:processPdf', async (_event, payload) => {
    return processPdfToJson(payload);
  });

  ipcMain.handle('generation:buildArtifacts', async (_event, payload) => {
    return writeSelectedArtifacts(payload);
  });

  ipcMain.handle('generation:createPlaceholders', async (_event, payload) => {
    const nowIso = new Date().toISOString();
    const blueprintInputName = payload?.inputs?.blueprint?.name;
    const defaultQuestionBankFileName =
      typeof blueprintInputName === 'string' && blueprintInputName.trim() !== ''
        ? path.basename(blueprintInputName)
        : 'question_bank.generated.json';
    const questionBankFileName = normalizeJsonFileName(
      payload?.outputFileNames?.questionBank,
      defaultQuestionBankFileName
    );
    const pairSetFileName = normalizeJsonFileName(
      payload?.outputFileNames?.pairSet,
      'pair_set.generated.json'
    );
    const questionBankPath = path.join(payload.questionBankFolder, questionBankFileName);
    const pairSetPath = path.join(payload.pairSetFolder, pairSetFileName);

    const qb = payload.blueprintData?.questionBank;
    const questions = [];
    const pairs = [];

    if (qb && Array.isArray(qb.sectionBlueprints)) {
      qb.sectionBlueprints.forEach((section) => {
        const sectionId = (section.sectionId || section.id).trim();
        const count = Math.max(1, section.requiredQuestions);
        const chapterNumber = Number.parseInt(`${qb?.chapterId || ''}`.split('_')[1], 10) || 0;
        const source = `${qb.bookId} Chapter ${chapterNumber} - ${section.sectionTitle}`;
        const sectionOrdinal = Math.max(1, Number(section?.sectionIndex) || extractSectionOrdinal(sectionId, 1));

        for (let qNum = 1; qNum <= count; qNum++) {
          const questionId = buildStructuredQuestionId(qb.bookId, chapterNumber, sectionOrdinal, qNum);

          const correctAnswers = [1, 2, 3].map((n) => ({
            id: `${questionId}.c.${n}`,
            text: `[Placeholder correct answer ${n} for ${questionId}]`,
          }));

          const wrongAnswers = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
            id: `${questionId}.w.${n}`,
            text: `[Placeholder wrong answer ${n} for ${questionId}]`,
          }));

          questions.push({
            id: questionId,
            question: `[Placeholder question ${qNum} - section ${sectionId}]`,
            correct_answers: correctAnswers,
            wrong_answers: wrongAnswers,
            source,
            subjects: [section.sectionTitle || 'General'],
          });

          // 3 correct + 8 wrong = 11 pairs per question
          correctAnswers.forEach((ans) => {
            const suffix = ans.id.split('.').pop(); // e.g. c1
            pairs.push({
              id: `${questionId}.pair.${suffix}`,
              input: `[Placeholder question ${qNum} — section ${sectionId}]`,
              output: ans.text,
              label: 'correct',
              sourceQuestionId: questionId,
            });
          });

          wrongAnswers.forEach((ans) => {
            const suffix = ans.id.split('.').pop(); // e.g. w1
            pairs.push({
              id: `${questionId}.pair.${suffix}`,
              input: `[Placeholder question ${qNum} — section ${sectionId}]`,
              output: ans.text,
              label: 'wrong',
              sourceQuestionId: questionId,
            });
          });
        }
      });
    }

    const questionBankJson = {
      questionBank: qb
        ? {
            ...qb,
            generatedAt: nowIso,
            targetTotalQuestions: questions.length,
            questions,
          }
        : {
            generatedAt: nowIso,
            targetTotalQuestions: questions.length,
            questions,
          },
    };

    const pairSetJson = {
      metadata: {
        generatedAt: nowIso,
        sourceQuestionBank: questionBankFileName,
        totalQuestions: questions.length,
        totalPairs: pairs.length,
        type: 'pair-set-placeholder',
      },
      pairs,
    };

    await fs.writeFile(questionBankPath, `${JSON.stringify(questionBankJson, null, 2)}\n`, 'utf8');
    await fs.writeFile(pairSetPath, `${JSON.stringify(pairSetJson, null, 2)}\n`, 'utf8');

    return {
      questionBankPath,
      pairSetPath,
      totalQuestions: questions.length,
      totalPairs: pairs.length,
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});