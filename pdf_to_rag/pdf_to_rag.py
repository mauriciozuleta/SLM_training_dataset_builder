"""
pdf_to_rag.py
-------------
Converts FAA handbook PDF files into structured JSON files suitable for
Retrieval-Augmented Generation (RAG).

Usage:
    python pdf_to_rag.py input.pdf --out ./rag/

Dependencies:
    pip install pdfminer.six
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

from pdfminer.high_level import extract_text as pdfminer_extract_text


# ---------------------------------------------------------------------------
# 1. PDF TEXT EXTRACTION
# ---------------------------------------------------------------------------

def extract_text(pdf_path: str) -> str:
    """Extract raw text from a PDF using pdfminer.six (deterministic, no AI)."""
    return pdfminer_extract_text(pdf_path)


# ---------------------------------------------------------------------------
# 2. TEXT CLEANING
# ---------------------------------------------------------------------------

# Patterns compiled once for performance across 120+ PDFs
_RE_PAGE_NUMBER = re.compile(
    r"^\s*"
    r"(?:"
    r"\d{1,3}-\d{1,3}"          # e.g. "3-4"
    r"|"
    r"Page\s+\d+"               # e.g. "Page 12"
    r"|"
    r"\d{1,4}"                  # bare page numbers on their own line
    r")"
    r"\s*$",
    re.MULTILINE | re.IGNORECASE,
)

_RE_FIGURE_CAPTION = re.compile(
    r"^\s*Figure\s+[\d\w\-]+[.:].*$",
    re.MULTILINE | re.IGNORECASE,
)

_RE_IMAGE_CAPTION = re.compile(
    r"^\s*(?:Image|Photo|Illustration|Diagram)\s+[\d\w\-]+[.:].*$",
    re.MULTILINE | re.IGNORECASE,
)

_RE_CID_ARTIFACT = re.compile(r"\(cid:\d+\)")

_RE_IMAGE_ONLY_LINE = re.compile(
    r"^\s*(?:image|photo|illustration|diagram|graphic)\s*$",
    re.IGNORECASE,
)

_RE_DRAWING_LINE = re.compile(r"^[\s_\-=\.|/\\<>\[\]\(\)~`•·:]{4,}$")

_RE_TABLE_SEP = re.compile(r"\t+| {2,}")

# Glossary page marker lines such as "G-1", "A-12".
_RE_GLOSSARY_PAGE_MARKER = re.compile(r"^[A-Z]-\d{1,3}$")

# "Chapter N:" / "Chapter N –" lines — structural markers, always treated as headings
_RE_CHAPTER_LINE = re.compile(r"^Chapter\s+\d+", re.IGNORECASE)

_RE_MULTI_BLANK = re.compile(r"\n{3,}")


def _looks_list_bullet(line: str) -> bool:
    stripped = line.strip()
    return bool(re.match(r"^(?:[-*•]|\d+[.)]|[A-Za-z][.)])\s+", stripped))


def _split_table_cells(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped:
        return []
    return [cell.strip() for cell in _RE_TABLE_SEP.split(stripped) if cell.strip()]


def _looks_table_row(line: str) -> bool:
    stripped = line.rstrip()
    if not stripped.strip() or _looks_list_bullet(stripped):
        return False
    cells = _split_table_cells(stripped)
    return len(cells) >= 2 and bool(_RE_TABLE_SEP.search(stripped))


def _looks_image_artifact_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if _RE_IMAGE_ONLY_LINE.match(stripped):
        return True
    if _RE_DRAWING_LINE.match(stripped):
        return True
    alpha_count = sum(ch.isalpha() for ch in stripped)
    symbol_count = sum(ch in "_|-=./\\<>[]()~`•·:" for ch in stripped)
    return alpha_count <= 2 and symbol_count >= max(4, len(stripped) // 2)


def _normalise_table_block(block_lines: list[str]) -> list[str]:
    parsed_rows = [_split_table_cells(line) for line in block_lines]
    parsed_rows = [row for row in parsed_rows if len(row) >= 2]
    if len(parsed_rows) < 3:
        return block_lines

    column_counts = [len(row) for row in parsed_rows]
    dominant_cols = max(set(column_counts), key=column_counts.count)
    consistent_rows = sum(1 for count in column_counts if abs(count - dominant_cols) <= 1)
    if consistent_rows < max(3, int(len(parsed_rows) * 0.6)):
        return block_lines

    first_row = parsed_rows[0]
    header_like = (
        len(first_row) >= 2
        and all(not any(ch.isdigit() for ch in cell) for cell in first_row)
        and sum(any(ch.isalpha() for ch in cell) for cell in first_row) >= max(2, len(first_row) - 1)
    )

    output: list[str] = []
    if header_like and len(parsed_rows) >= 2:
        headers = [
            re.sub(r"\s+", " ", cell).strip().rstrip(":") or f"col_{idx + 1}"
            for idx, cell in enumerate(first_row)
        ]
        output.append("Table columns: " + " | ".join(headers))
        data_rows = parsed_rows[1:]
        for row in data_rows:
            pairs = []
            for idx, cell in enumerate(row):
                label = headers[idx] if idx < len(headers) else f"col_{idx + 1}"
                clean_cell = re.sub(r"\s+", " ", cell).strip()
                pairs.append(f"{label}: {clean_cell}")
            output.append("- " + "; ".join(pairs))
        return output

    output.append("Table rows:")
    for row in parsed_rows:
        output.append("- " + " | ".join(re.sub(r"\s+", " ", cell).strip() for cell in row))
    return output


def _rewrite_table_blocks(lines: list[str]) -> list[str]:
    rewritten: list[str] = []
    i = 0
    while i < len(lines):
        if not _looks_table_row(lines[i]):
            rewritten.append(lines[i])
            i += 1
            continue

        block: list[str] = []
        j = i
        blank_gaps = 0
        while j < len(lines):
            current = lines[j]
            if _looks_table_row(current):
                block.append(current)
                blank_gaps = 0
                j += 1
                continue
            if not current.strip() and block and blank_gaps == 0:
                blank_gaps += 1
                j += 1
                continue
            break

        if len(block) >= 3:
            rewritten.extend(_normalise_table_block(block))
            rewritten.append("")
            i = j
            continue

        rewritten.append(lines[i])
        i += 1

    return rewritten


def _join_wrapped_lines(lines: list[str]) -> list[str]:
    joined: list[str] = []
    i = 0
    while i < len(lines):
        current = lines[i].strip()
        if not current:
            joined.append("")
            i += 1
            continue

        while i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if not nxt:
                break
            if _looks_list_bullet(current) or _looks_list_bullet(nxt):
                break
            if _looks_table_row(current) or _looks_table_row(nxt):
                break
            if _RE_CHAPTER_LINE.match(current) or _RE_CHAPTER_LINE.match(nxt):
                break
            if current.endswith("-") and nxt[:1].isalnum():
                current = current[:-1] + nxt
                i += 1
                continue
            if current.endswith((".", "!", "?", ":", ";")):
                break
            if nxt[:1].islower() or current.endswith((",", "(", "/")) or len(current) >= 60:
                current = f"{current} {nxt}"
                i += 1
                continue
            break

        joined.append(re.sub(r"\s+", " ", current).strip())
        i += 1

    return joined


def clean_text(raw_text: str) -> str:
    """
    Clean extracted PDF text:
      - Remove standalone page numbers (e.g. "3-4", "Page 12").
      - Remove figure captions (e.g. "Figure 3-8. Nose reference...").
      - Remove common image/OCR artifact lines.
      - Rewrite table-like blocks into machine-readable row text.
      - Remove repeated headers/footers (lines that appear 3+ times).
      - Rejoin wrapped paragraph lines and de-hyphenate word breaks.
      - Normalise whitespace (collapse 3+ blank lines → 2 blank lines).
      - Preserve paragraph structure.
    """
    text = _RE_CID_ARTIFACT.sub("", raw_text)

    # --- Remove figure / image captions ---
    text = _RE_FIGURE_CAPTION.sub("", text)
    text = _RE_IMAGE_CAPTION.sub("", text)

    # --- Remove page-number lines ---
    text = _RE_PAGE_NUMBER.sub("", text)

    # --- Remove repeated headers / footers ---
    # Count how often each stripped line appears; remove if it appears 3+ times
    # and is short (typical of headers/footers).
    lines = text.splitlines()
    line_counts: dict[str, int] = {}
    for line in lines:
        stripped = line.strip()
        if stripped:
            line_counts[stripped] = line_counts.get(stripped, 0) + 1

    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and line_counts.get(stripped, 0) >= 3 and len(stripped) < 120:
            continue
        if _looks_image_artifact_line(line):
            continue
        cleaned_lines.append(line)

    cleaned_lines = _rewrite_table_blocks(cleaned_lines)
    cleaned_lines = _join_wrapped_lines(cleaned_lines)

    text = "\n".join(cleaned_lines)

    # --- Collapse excessive blank lines ---
    text = _RE_MULTI_BLANK.sub("\n\n", text)

    return text.strip()


# ---------------------------------------------------------------------------
# 3. SECTION DETECTION
# ---------------------------------------------------------------------------

# Common short words that are legitimately lowercase in title case
_MINOR_WORDS = frozenset(
    "a an the to of in on at for by and or nor but with as from into"
    " over under about above below between through during".split()
)


def _looks_title_case(text: str) -> bool:
    """
    Lenient Title Case check.
    The first word must be capitalised; every subsequent alphabetic word
    must EITHER start with an uppercase letter OR be a known minor word.
    """
    words = text.split()
    if not words:
        return False
    if not words[0][:1].isupper():
        return False
    for word in words[1:]:
        alpha = word.strip("'\"")
        if not alpha or not alpha[0].isalpha():
            continue  # numbers, punctuation — skip
        if alpha.lower() in _MINOR_WORDS:
            continue  # minor word — allowed lowercase
        if not alpha[0].isupper():
            return False  # major word must be capitalised
    return any(c.isupper() for c in text)


def _is_heading(line: str) -> bool:
    """
    Return True when a line qualifies as a section heading.
    ALL conditions must hold:
      1. Title Case (lenient) or ALL CAPS.
      2. Contains no period.
      3. Not a figure caption.
      4. Not a standalone page number.
      5. Between 3 and 120 characters.
    Blank-line context is checked in detect_sections().
    """
    stripped = line.strip()

    if not stripped:
        return False

    # First character must be alphanumeric (filters !DCA-style NOTAM strings, etc.)
    if not stripped[0].isalnum():
        return False

    # Reasonable length bounds for a heading
    if not (3 <= len(stripped) <= 120):
        return False

    # Must not contain a period
    if "." in stripped:
        return False

    # Must not contain a colon (filters "Limitations:", "HELIPAD H1:H60X60", etc.)
    # Note: "Chapter N:" lines are caught by _RE_CHAPTER_LINE before _is_heading is called.
    if ":" in stripped:
        return False

    # Must not be a figure caption
    if _RE_FIGURE_CAPTION.match(stripped):
        return False

    # Must not be a page number
    if _RE_PAGE_NUMBER.match(stripped):
        return False

    # Must be Title Case (lenient) or ALL CAPS
    is_title_case = _looks_title_case(stripped)
    is_all_caps = stripped == stripped.upper() and any(c.isalpha() for c in stripped)

    return is_title_case or is_all_caps


def _next_nonblank_line(lines: list[str], index: int) -> str:
    """Return the next non-empty line after *index*, or an empty string."""
    j = index + 1
    while j < len(lines):
        candidate = lines[j].strip()
        if candidate:
            return candidate
        j += 1
    return ""


def _clean_glossary_section_content(content: str) -> str:
    """
    Glossary-only cleanup pass.
    Removes residual page markers and table-rewrite artifacts that hurt
    dictionary-style PDF outputs.
    """
    cleaned: list[str] = []
    skipping_table_artifact = False

    for raw_line in content.splitlines():
        s = raw_line.strip()

        if not s:
            cleaned.append("")
            continue

        if _RE_GLOSSARY_PAGE_MARKER.match(s):
            continue

        # Drop stray one-letter divider remnants from content body.
        if len(s) == 1 and s.isalpha() and s.isupper():
            continue

        if s.startswith("Table columns:") or s == "Table rows:":
            skipping_table_artifact = True
            continue

        if skipping_table_artifact:
            # Table artifacts are emitted as "- col: value; col2: value..."
            if s.startswith("- ") and ":" in s and ";" in s:
                continue
            skipping_table_artifact = False

        cleaned.append(raw_line)

    return _RE_MULTI_BLANK.sub("\n\n", "\n".join(cleaned)).strip()


def detect_sections(
    clean_text: str,
    doc_type: str = "auto",
    source_name: str = "",
) -> list[dict]:
    """
    Split cleaned text into sections using a three-pass heading pipeline.

    Pass 1 – Collect raw heading line indices using the existing heuristics.
    Pass 2 – Merge adjacent heading lines that are separated only by blanks
             and within MERGE_GAP lines (handles multi-line decorative titles
             like "Introduction" / "To Flying" on consecutive lines).
    Pass 3 – Remove dense heading clusters (MIN_CLUSTER or more headings all
             within CLUSTER_GAP lines of each other) — these are table cells,
             column headers, airport/navaid listings, etc.  Their text is
             preserved as paragraph content of the surrounding sections.
    """
    lines = clean_text.splitlines()
    n = len(lines)

    mode = (doc_type or "auto").strip().lower()
    if mode not in {"auto", "chapter", "glossary"}:
        mode = "auto"

    source_has_glossary = "glossary" in source_name.lower()
    text_has_glossary = any("glossary" in ln.lower() for ln in lines[:350])
    page_markers = sum(
        1 for ln in lines[:2000] if _RE_GLOSSARY_PAGE_MARKER.match(ln.strip())
    )
    letter_dividers = sum(
        1
        for ln in lines[:2000]
        if len(ln.strip()) == 1 and ln.strip().isalpha() and ln.strip().isupper()
    )
    looks_like_glossary = (
        source_has_glossary
        or text_has_glossary
        or (page_markers >= 5 and letter_dividers >= 3)
    )
    is_glossary = (mode == "glossary") or (mode == "auto" and looks_like_glossary)

    # ── Pass 1: raw heading indices ──────────────────────────────────────────
    raw_headings: list[int] = []

    for i, line in enumerate(lines):
        s = line.strip()

        # Ignore glossary page markers (e.g., "G-1") only in glossary docs.
        if is_glossary and _RE_GLOSSARY_PAGE_MARKER.match(s):
            continue

        # "Chapter N" lines are structural markers — always a heading,
        # as long as they don't contain a period (which would make them
        # a mid-body cross-reference like "Chapter 3, ... discusses stalls in detail.").
        if _RE_CHAPTER_LINE.match(s) and '.' not in s:
            raw_headings.append(i)
            continue

        # Require the next nonblank line to start with the same letter to avoid
        # accidental captures.
        if is_glossary and len(s) == 1 and s.isalpha() and s.isupper():
            nxt = _next_nonblank_line(lines, i)
            if nxt and nxt[0].isalpha() and nxt[0].upper() == s:
                raw_headings.append(i)
            continue

        if not _is_heading(line):
            continue

        prev_blank = (i == 0) or (lines[i - 1].strip() == "")
        if prev_blank:
            raw_headings.append(i)

    if not raw_headings:
        return [{"title": "Content", "content": clean_text.strip()}]

    # ── Pass 2: merge adjacent heading lines ─────────────────────────────────
    # Two heading lines merge when only blank lines separate them and the gap
    # is <= MERGE_GAP.  Produces list of {line, end, title} dicts.
    _MERGE_GAP = 4
    merged_headings: list[dict] = []
    i = 0
    while i < len(raw_headings):
        start = raw_headings[i]
        parts = [lines[start].strip()]
        end = start
        j = i + 1
        while j < len(raw_headings):
            between = lines[end + 1: raw_headings[j]]
            if (raw_headings[j] - end <= _MERGE_GAP
                    and all(ln.strip() == "" for ln in between)):
                parts.append(lines[raw_headings[j]].strip())
                end = raw_headings[j]
                j += 1
            else:
                break
        merged_headings.append({"line": start, "end": end,
                                 "title": " ".join(parts)})
        i = j

    # ── Pass 3: remove dense heading clusters (table cells / listings) ───────
    # A cluster: MIN_CLUSTER or more merged-headings where every consecutive
    # pair has start-of-next minus end-of-prev <= CLUSTER_GAP lines.
    # Raised MIN_CLUSTER and tightened CLUSTER_GAP so FAA chapter headings
    # (which are legitimately close together) are not dropped as table cells.
    _CLUSTER_GAP = 8
    _MIN_CLUSTER = 6
    clean_headings: list[dict] = []
    i = 0
    while i < len(merged_headings):
        cluster = [merged_headings[i]]
        j = i + 1
        while j < len(merged_headings):
            gap = merged_headings[j]["line"] - merged_headings[j - 1]["end"]
            if gap <= _CLUSTER_GAP:
                cluster.append(merged_headings[j])
                j += 1
            else:
                break
        if len(cluster) >= _MIN_CLUSTER:
            i = j          # drop entire cluster; text remains as paragraph content
        else:
            clean_headings.extend(cluster)
            i = j

    if not clean_headings:
        return [{"title": "Content", "content": clean_text.strip()}]

    # ── Build sections ───────────────────────────────────────────────────────
    sections: list[dict] = []
    for idx, h in enumerate(clean_headings):
        content_start = h["end"] + 1
        content_end = clean_headings[idx + 1]["line"] if idx + 1 < len(clean_headings) else n
        content = "\n".join(lines[content_start:content_end]).strip()
        word_count = len(content.split())
        sections.append({"title": h["title"], "content": content, "wordCount": word_count})

    if is_glossary:
        glossary_sections: list[dict] = []
        for sec in sections:
            cleaned_content = _clean_glossary_section_content(sec["content"])
            glossary_sections.append(
                {
                    "title": sec["title"],
                    "content": cleaned_content,
                    "wordCount": len(cleaned_content.split()),
                }
            )
        return glossary_sections

    # ── Post-process: smooth short sections for better RAG chunk quality ──────
    # Headings extracted from lists/tables often produce tiny sections. Merge
    # those into adjacent sections to reduce fragmentary chunks.
    _MIN_CONTENT = 200  # characters
    smoothed: list[dict] = [
        {
            "title": sec["title"],
            "content": sec["content"],
            "wordCount": sec.get("wordCount", len(sec["content"].split())),
        }
        for sec in sections
    ]
    filtered: list[dict] = []
    i = 0
    while i < len(smoothed):
        sec = smoothed[i]
        if len(sec["content"]) < _MIN_CONTENT:
            if filtered:
                # Prefer merging backward into previous section.
                prev = filtered[-1]
                merged = "\n".join(
                    part for part in [prev["content"], sec["title"], sec["content"]] if part
                ).strip()
                filtered[-1] = {
                    "title": prev["title"],
                    "content": merged,
                    "wordCount": len(merged.split()),
                }
                i += 1
                continue
            if i + 1 < len(smoothed):
                # If first section is short, merge forward into next section.
                nxt = smoothed[i + 1]
                nxt_content = "\n".join(
                    part for part in [sec["title"], sec["content"], nxt["content"]] if part
                ).strip()
                smoothed[i + 1] = {
                    "title": nxt["title"],
                    "content": nxt_content,
                    "wordCount": len(nxt_content.split()),
                }
                i += 1
                continue

        filtered.append(sec)
        i += 1

    return filtered


# ---------------------------------------------------------------------------
# 4. JSON CONSTRUCTION
# ---------------------------------------------------------------------------

_SECTION_SPLIT_TARGET_WORDS = 850
_SECTION_SPLIT_MAX_WORDS = 1200
_SECTION_SPLIT_MIN_WORDS = 250


def _count_words(text: str) -> int:
    return len((text or "").split())


def _split_paragraphs(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n\s*\n", text or "") if part.strip()]


def _split_long_block(block: str, target_words: int, max_words: int) -> list[str]:
    stripped = (block or "").strip()
    if not stripped:
        return []

    if _count_words(stripped) <= max_words:
        return [stripped]

    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", stripped) if part.strip()]
    if len(sentences) <= 1:
        words = stripped.split()
        chunks: list[str] = []
        for idx in range(0, len(words), target_words):
            chunk = " ".join(words[idx: idx + target_words]).strip()
            if chunk:
                chunks.append(chunk)
        return chunks

    chunks: list[str] = []
    current: list[str] = []
    current_words = 0
    for sentence in sentences:
        sentence_words = _count_words(sentence)
        if current and current_words + sentence_words > max_words:
            chunks.append(" ".join(current).strip())
            current = [sentence]
            current_words = sentence_words
            continue

        current.append(sentence)
        current_words += sentence_words
        if current_words >= target_words:
            chunks.append(" ".join(current).strip())
            current = []
            current_words = 0

    if current:
        chunks.append(" ".join(current).strip())

    return [chunk for chunk in chunks if chunk]


def _chunk_blocks(blocks: list[str], target_words: int, max_words: int, min_words: int) -> list[str]:
    pieces: list[str] = []
    for block in blocks:
        if _count_words(block) > max_words:
            pieces.extend(_split_long_block(block, target_words, max_words))
        elif block.strip():
            pieces.append(block.strip())

    chunks: list[str] = []
    current: list[str] = []
    current_words = 0
    for piece in pieces:
        piece_words = _count_words(piece)
        if current and current_words + piece_words > max_words and current_words >= min_words:
            chunks.append("\n\n".join(current).strip())
            current = [piece]
            current_words = piece_words
            continue

        current.append(piece)
        current_words += piece_words

    if current:
        chunks.append("\n\n".join(current).strip())

    if len(chunks) >= 2 and _count_words(chunks[-1]) < min_words:
        chunks[-2] = "\n\n".join([chunks[-2], chunks[-1]]).strip()
        chunks.pop()

    return [chunk for chunk in chunks if chunk.strip()]


def split_oversized_sections(
    sections: list[dict],
    target_words: int = _SECTION_SPLIT_TARGET_WORDS,
    max_words: int = _SECTION_SPLIT_MAX_WORDS,
    min_words: int = _SECTION_SPLIT_MIN_WORDS,
) -> list[dict]:
    split_sections: list[dict] = []

    for original_index, sec in enumerate(sections, start=1):
        title = re.sub(r"\s+", " ", f"{sec.get('title', '')}").strip() or f"Section {original_index}"
        content = (sec.get("content") or "").strip()
        word_count = int(sec.get("wordCount") or _count_words(content))

        if not content or word_count <= max_words:
            split_sections.append(
                {
                    "title": title,
                    "content": content,
                    "wordCount": word_count,
                }
            )
            continue

        chunks = _chunk_blocks(_split_paragraphs(content) or [content], target_words, max_words, min_words)
        if len(chunks) <= 1:
            split_sections.append(
                {
                    "title": title,
                    "content": content,
                    "wordCount": word_count,
                }
            )
            continue

        part_count = len(chunks)
        for part_index, chunk in enumerate(chunks, start=1):
            split_sections.append(
                {
                    "title": f"{title} (Part {part_index})",
                    "content": chunk,
                    "wordCount": _count_words(chunk),
                    "parentSectionTitle": title,
                    "parentSectionOrdinal": original_index,
                    "splitPartIndex": part_index,
                    "splitPartCount": part_count,
                }
            )

    return split_sections

def build_json(chapter_number: int, sections: list[dict], prefix: str = "") -> dict:
    """
    Assemble the final RAG JSON object.

    Schema:
    {
        "chapter": <int>,
        "title": "<chapter title>",
        "sections": [
            {
                "id": "<chapter>.<section_number>",
                "title": "<section title>",
                "content": "<full cleaned text>",
                "tags": []
            }
        ]
    }

    The first detected heading is used as the chapter title and is NOT
    included as a numbered section.
    """
    if not sections:
        chapter_title = "Unknown"
        body_sections = []
    else:
        # Prefer a "Chapter N: Title" line as the authoritative chapter title.
        # Fall back to the very first detected heading if none exists.
        chapter_title = "Unknown"
        body_start = 0
        # Only inspect the first few headings for a chapter marker so that
        # mid-body cross-references ("Chapter 3, Basic Flight Maneuvers...") cannot
        # be mistaken for the chapter title.
        search_window = min(4, len(sections))
        for j in range(search_window):
            sec = sections[j]
            if _RE_CHAPTER_LINE.match(sec["title"]):
                raw = re.sub(r"^Chapter\s+\d+[\s:–\-]+", "", sec["title"], flags=re.IGNORECASE)
                chapter_title = re.sub(r"\s+", " ", raw).strip() or sec["title"]
                body_start = j + 1
                break
        else:
            # No "Chapter N:" line in the opening headings — use first heading as title
            chapter_title = re.sub(r"\s+", " ", sections[0]["title"]).strip()
            body_start = 1
        body_sections = split_oversized_sections(sections[body_start:])

    id_prefix = prefix.strip() if prefix and prefix.strip() else str(chapter_number)

    numbered_sections = []
    for seq, sec in enumerate(body_sections, start=1):
        entry = {
            "id": f"{id_prefix}.{seq}",
            "title": sec["title"],
            "content": sec["content"],
            "wordCount": sec.get("wordCount", len(sec["content"].split())),
            "sectionWeight": 0.0,
            "tags": [],
        }
        if sec.get("parentSectionOrdinal") is not None:
            entry["parentSectionOrdinal"] = sec["parentSectionOrdinal"]
        if sec.get("parentSectionTitle"):
            entry["parentSectionTitle"] = sec["parentSectionTitle"]
        if sec.get("splitPartCount"):
            entry["splitPartIndex"] = sec.get("splitPartIndex", 1)
            entry["splitPartCount"] = sec["splitPartCount"]
        numbered_sections.append(entry)

    total_words = sum(s["wordCount"] for s in numbered_sections)
    safe_total = total_words if total_words > 0 else 1
    for s in numbered_sections:
        s["sectionWeight"] = round(s["wordCount"] / safe_total * 100, 2)

    return {
        "chapter": chapter_number,
        "prefix": id_prefix,
        "title": chapter_title,
        "totalSections": len(numbered_sections),
        "totalWords": total_words,
        "sections": numbered_sections,
    }


# ---------------------------------------------------------------------------
# 5. JSON PERSISTENCE
# ---------------------------------------------------------------------------

def save_json(data: dict, output_path: str) -> None:
    """Write the JSON structure to *output_path* with UTF-8 encoding."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


def build_markdown(data: dict) -> str:
    """Render converted chapter data into readable Markdown for fidelity review."""
    chapter = data.get("chapter", "?")
    title = data.get("title", "Unknown")
    sections = data.get("sections", [])

    lines: list[str] = []
    lines.append(f"# Chapter {chapter}: {title}")
    lines.append("")
    lines.append("## Conversion Metadata")
    lines.append(f"- Chapter Number: {chapter}")
    lines.append(f"- Section Count: {len(sections)}")
    lines.append("")

    for section in sections:
        sid = section.get("id", "")
        stitle = section.get("title", "Untitled")
        content = (section.get("content", "") or "").strip()
        lines.append(f"## {sid} - {stitle}")
        lines.append("")
        lines.append(content if content else "[No content extracted]")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def save_markdown(data: dict, output_path: str) -> None:
    """Write Markdown representation of converted chapter data."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    markdown = build_markdown(data)
    with path.open("w", encoding="utf-8") as fh:
        fh.write(markdown)


# ---------------------------------------------------------------------------
# 6. VALIDATION
# ---------------------------------------------------------------------------

def validate(data: dict) -> list[str]:
    """
    Validate the built JSON structure.
    Returns a (possibly empty) list of warning strings.
    """
    warnings: list[str] = []
    sections = data.get("sections", [])

    if not sections:
        warnings.append("WARNING: No headings were detected in the document.")
        return warnings

    if len(sections) < 2:
        warnings.append(
            f"WARNING: Only {len(sections)} section detected. Expected at least 2."
        )

    for sec in sections:
        if len(sec.get("content", "")) < 200:
            warnings.append(
                f"WARNING: Section '{sec['id']} – {sec['title']}' is unusually short "
                f"({len(sec['content'])} chars)."
            )

    return warnings


# ---------------------------------------------------------------------------
# 7. CHAPTER NUMBER DETECTION
# ---------------------------------------------------------------------------

def detect_chapter_number(pdf_path: str) -> int:
    """
    Infer the chapter number from the filename.
    Supports patterns such as:
      chapter_3.pdf  →  3
      ch3.pdf        →  3
      chapter3.pdf   →  3
      03.pdf         →  3
    Falls back to 0 if no number is found.
    """
    stem = Path(pdf_path).stem  # filename without extension
    match = re.search(r"(\d+)", stem)
    return int(match.group(1)) if match else 0


# ---------------------------------------------------------------------------
# 8. PIPELINE ORCHESTRATION
# ---------------------------------------------------------------------------

def process_pdf(
    pdf_path: str,
    output_dir: str,
    output_filename: str | None = None,
    doc_type: str = "auto",
    chapter_number_override: int | None = None,
    prefix: str = "",
) -> str:
    """
        Run the full pipeline for a single PDF:
      extract → clean → detect sections → build JSON → validate → save

    Returns the path of the written JSON file.
    If output_filename is provided, that filename is used.
    """
    pdf_path = str(Path(pdf_path).resolve())
    output_dir = str(Path(output_dir).resolve())
    chapter_number = (
        int(chapter_number_override)
        if chapter_number_override is not None and int(chapter_number_override) > 0
        else detect_chapter_number(pdf_path)
    )

    print(f"\n[INFO] Processing: {pdf_path}")
    print(f"[INFO] Detected chapter number: {chapter_number}")
    print(f"[INFO] Document type mode: {doc_type}")

    # --- Extract ---
    print("[INFO] Extracting text …")
    raw = extract_text(pdf_path)

    # --- Clean ---
    print("[INFO] Cleaning text …")
    cleaned = clean_text(raw)

    # --- Detect sections ---
    print("[INFO] Detecting sections …")
    sections = detect_sections(
        cleaned,
        doc_type=doc_type,
        source_name=Path(pdf_path).name,
    )

    # --- Build JSON ---
    data = build_json(chapter_number, sections, prefix=prefix)

    # --- Validate ---
    warnings = validate(data)
    for w in warnings:
        print(w, file=sys.stderr)

    # --- Save ---
    if output_filename:
        filename = output_filename if output_filename.lower().endswith(".json") else f"{output_filename}.json"
    else:
        filename = f"chapter_{chapter_number}_rag.json"

    output_file = Path(output_dir) / filename
    save_json(data, str(output_file))
    markdown_file = output_file.with_suffix(".md")
    save_markdown(data, str(markdown_file))

    # --- Summary ---
    print(f"[INFO] Chapter title : {data['title']}")
    print(f"[INFO] Sections found: {len(data['sections'])}")
    for sec in data["sections"]:
        char_count = len(sec["content"])
        print(f"         [{sec['id']}] {sec['title']}  ({char_count} chars)")
    print(f"[INFO] Output written: {output_file}")
    print(f"[INFO] Markdown written: {markdown_file}")

    return str(output_file)


# ---------------------------------------------------------------------------
# 9. CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pdf_to_rag",
        description="Convert FAA handbook PDF files to RAG-ready JSON.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single file
  python pdf_to_rag.py chapter_3.pdf --out ./rag/

  # Batch mode (glob)
  python pdf_to_rag.py *.pdf --out ./rag/
""",
    )
    parser.add_argument(
        "pdf",
        nargs="+",
        metavar="PDF",
        help="One or more PDF file paths to process.",
    )
    parser.add_argument(
        "--out",
        default="./rag/",
        metavar="DIR",
        help="Output directory for JSON files (default: ./rag/).",
    )
    parser.add_argument(
        "--doc-type",
        choices=["auto", "chapter", "glossary"],
        default="auto",
        metavar="TYPE",
        help="Document type mode: auto, chapter, or glossary (default: auto).",
    )
    parser.add_argument(
        "--prefix",
        default="",
        metavar="PREFIX",
        help="Document prefix for section IDs (e.g. afh.3). Defaults to chapter number.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    output_dir = args.out
    pdf_files = args.pdf
    doc_type = args.doc_type
    prefix = args.prefix or ""

    # Expand any glob patterns on platforms that don't auto-expand them
    import glob as _glob

    expanded: list[str] = []
    for pattern in pdf_files:
        matches = _glob.glob(pattern)
        if matches:
            expanded.extend(matches)
        else:
            # Treat as a literal path (will fail gracefully later)
            expanded.append(pattern)

    if not expanded:
        print("ERROR: No PDF files matched the provided pattern(s).", file=sys.stderr)
        sys.exit(1)

    success, failed = 0, 0
    for pdf in expanded:
        try:
            process_pdf(pdf, output_dir, doc_type=doc_type, prefix=prefix)
            success += 1
        except FileNotFoundError:
            print(f"ERROR: File not found: {pdf}", file=sys.stderr)
            failed += 1
        except Exception as exc:  # noqa: BLE001
            print(f"ERROR: Failed to process '{pdf}': {exc}", file=sys.stderr)
            failed += 1

    print(f"\n[DONE] {success} succeeded, {failed} failed.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
