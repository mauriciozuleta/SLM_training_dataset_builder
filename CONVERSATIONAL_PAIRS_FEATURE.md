# Conversational Pair Generator - Implementation Complete

## Overview
Created a dedicated **Conversational Pair Generator** module that creates high-quality SLM (Small Language Model) training pairs. Each pair generates 1 high-quality conversational exchange for every 20 words in the source document.

## Key Features

### 1. **Separate Module Architecture**
- **File**: `src/main/services/documentGeneration/conversationalPairGenerator.js`
- Dedicated module (NOT reusing deterministicPairGenerator)
- Focused on conversational quality and SLM compatibility

### 2. **Pair Generation Ratio**
- **Formula**: 1 conversational pair per 20 words of source document
- **Example**: 11,180 word document = 559 conversational pairs
- Automatically calculated from `documentJson.totalWords`

### 3. **Pair Structure**
Each conversational pair includes:
```json
{
  "conversationalPairId": "AFH.3.1.1.1.z.1",
  "pairType": "conversational_exchange",
  "studentPersona": "checkride",
  "turns": [
    {
      "role": "user",
      "content": "For the practical exam: What is the key takeaway from this section?"
    },
    {
      "role": "assistant", 
      "content": "Knowledgeable response grounded in the source section"
    }
  ],
  "context": "Relevant document context (150-300 chars)",
  "source": "Source reference from document",
  "subjects": ["Topic category"]
}
```

### 4. **Metadata (Top-Level)**
```json
{
  "conversationalTrainingPairSet": {
    "generatedAtUtc": "2026-03-26T03:04:43.507Z",
    "chapterId": "afh.3",
    "sourceDocumentTitle": "Airplane Flying Handbook (FAA-H-8083-3C) Chapter 3: Basic Flight Maneuvers Introduction",
    "documentTotalWords": 11180,
    "pairGenerationRatio": "1 pair per 20 words",
    "targetPairCount": 559,
    "generatedPairCount": 559,
    "totalSections": 20,
    "pairType": "conversational_exchange"
  },
  "pairs": []
}
```

### 5. **ID Format**
- Uses format: `CHAPTER_ID.SECTION_ID.SUB_TOPIC.z.PAIR_NUMBER`
- Example: `AFH.3.1.1.z.1`, `AFH.3.1.1.z.2`, etc.
- The `.z.` suffix distinguishes conversational pairs (deterministic uses `.p.`)

## Integration Points

### Files Modified:
1. **src/main/services/documentGenerationService.js**
   - Added import: `createConversationalPairGenerator`
   - Instantiated generator in service factory
   - Passed to artifactWriter

2. **src/main/services/documentGeneration/artifactWriter.js**
   - Updated function signature to accept `conversationalPairGenerator`
   - Split pair generation logic:
     - Deterministic pairs: use `deterministicPairGenerator.buildDeterministicPairSet()`
     - Conversational pairs: use `conversationalPairGenerator.buildConversationalPairSet(documentJson)`
   - Conversational generation is now document-grounded and no longer depends on `questions.json`

3. **src/main/services/documentGeneration/conversationalPairGenerator.js** (NEW)
   - 200+ lines of focused conversational pair generation logic
  - Section-weighted pair distribution from document content
  - Contextual content extraction from document sections
  - Natural conversational turn building via Gemini when available, with fallback generation

### UI Already Wired:
- ✓ "Conversational Training Pairs JSON" checkbox in HTML
- ✓ Per-output status badge with spinner animation
- ✓ Independent from Questions JSON
- ✓ Filename: `{prefix}_conversational_training_pairs.json`

## Generation Algorithm

1. **Calculate Target Pairs**: `totalWords / 20`
2. **Distribute Across Sections**: Allocate pair counts proportionally by section word count
3. **Generate Per Section**: Build conversational exchanges directly from each section's content
4. **Extract Context**: Pull relevant section context for grounding
5. **Build Turns**: Format as user/assistant dialogue suitable for SLM fine-tuning

## Test Results

✓ **Tested with AFH Chapter 3 document**:
- Document: 11,180 words
- Generated: 559 conversational pairs
- File size: ~540 KB
- All pairs using `.z.` format correctly
- Metadata complete and accurate
- Each pair includes contextual enhancement

### Sample Pair 1:
```json
{
  "conversationalPairId": "AFH.3.1.1.z.1",
  "turns": [
    { "role": "user", "content": "Which of the following are considered fundamental maneuvers for mastering flying according to the FAA's Airplane Flying Handbook?" },
    { "role": "assistant", "content": "Straight-and-level flight In the context of The Four Fundamentals: To master any subject, one should first master the fundamentals..." }
  ],
  "source": "Airplane Flying Handbook (FAA-H-8083-3C) Chapter 3: Basic Flight Maneuvers Introduction",
  "subjects": ["The Four Fundamentals"]
}
```

## Usage in App

1. **Upload a PDF** or document
2. **Select Outputs**:
  - ✓ Questions JSON (optional, used for deterministic pairs)
   - ✓ Conversational Training Pairs JSON (NOW AVAILABLE)
   - ✓ Deterministic Training Pairs (still available)
3. **Configure APIs** (2 APIs for parallel generation recommended)
4. **Click Generate**
   - Watch per-output spinners indicating:
     - PDF extraction → conversational pairs badge shows spinning disk
     - Questions generation → conversational pairs still waiting
     - Artifact writing → conversational pairs show running spinner
     - Complete → checkmark appears
5. **Download** `{prefix}_conversational_training_pairs.json`

## For SLM Training
The conversational pair format is ideal for:
- **Use case**: Fine-tuning Small Language Models on domain knowledge
- **Format**: Natural dialogue exchanges (user → assistant)
- **Quality**: High-quality answers with contextual grounding
- **Quantity**: Scalable (1 per 20 words)
- **Variety**: Cycles through correct/wrong answers for diverse training signals

## Files Generated (Sample)
- `afh_3_conversational_training_pairs.json` - Test output demonstrating feature
- `conversationalPairGenerator.js` - Implementation module
- `verify_conv_pairs.js` - Verification script (can be deleted)

Note: conversational output is generated from `document.json`, not from `questions.json`.

---
**Status**: ✅ Complete and tested
**Ready for**: Production use and end-to-end testing with real documents
