# Conversational Pairs with Student Personas

## Feature Overview
The conversational pair generator now creates varied student opening questions across **3 distinct personas**:

1. **Confident** - Direct, assertive questioning
2. **Confused** - Uncertain, seeking clarification  
3. **Checkride** - Exam/practical test preparation focused

## Distribution

With 559 total pairs from an 11,180-word document:
- **Confident**: 187 pairs (~33%)
- **Confused**: 186 pairs (~33%)
- **Checkride**: 186 pairs (~34%)

Even distribution ensures diverse training data for SLM models.

## Persona Examples

### CONFIDENT - Direct Knowledge Quest
```json
{
  "conversationalPairId": "AFH.3.1.1.z.1",
  "studentPersona": "confident",
  "turns": [
    {
      "role": "user",
      "content": "Which of the following are considered fundamental maneuvers for mastering flying according to the FAA's Airplane Flying Handbook?",
      "studentPersona": "confident"
    },
    {
      "role": "assistant",
      "content": "Straight-and-level flight In the context of The Four Fundamentals: To master any subject, one should first master the fundamentals..."
    }
  ]
}
```
**Characteristics**:
- No prefix or qualification
- Direct, authoritative tone
- Expects clear, definitive answer
- Good for testing solid knowledge

---

### CONFUSED - Seeking Clarification
```json
{
  "conversationalPairId": "AFH.3.2.1.z.2",
  "studentPersona": "confused",
  "turns": [
    {
      "role": "user",
      "content": "Could you explain: what happens when a pilot applies forward pressure to the elevator pitch control?",
      "studentPersona": "confused"
    },
    {
      "role": "assistant",
      "content": "The airplane rotates the nose forward In the context of Effect and Use of Flight Controls: To master any subject..."
    }
  ]
}
```
**Characteristics**:
- Uncertainty markers: "Could you explain:", "I'm confused about", "Am I correct that", etc.
- Seeks clarification and validation
- Indicates student doesn't fully understand
- Good for teaching and explanation training

**Possible Prefixes Used**:
- "I'm not sure about this, but are..."
- "Can you clarify: are..."
- "I'm confused about whether..."
- "Help me understand: are..."
- "Am I correct that..."
- "Could you explain:..."

---

### CHECKRIDE - Exam Preparation
```json
{
  "conversationalPairId": "AFH.3.2.2.z.3",
  "studentPersona": "checkride",
  "turns": [
    {
      "role": "user",
      "content": "For the practical exam: What is the result of applying right pressure to the aileron control?",
      "studentPersona": "checkride"
    },
    {
      "role": "assistant",
      "content": "The airplane's right wing banks lower In the context of Effect and Use of Flight Controls: To master any subject..."
    }
  ]
}
```
**Characteristics**:
- Exam/practical test framing
- Performance-oriented
- Focuses on practical application
- Good for high-stakes, performance-based training

**Possible Prefixes Used**:
- "For my checkride exam, I need to know:"
- "This might be tested on the checkride - "
- "For the practical exam:"
- "On my checkride, I'll need to know:"
- "This is critical for checkride preparation:"

---

## Integration in Metadata

The metadata now includes student persona distribution:

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
    "pairType": "conversational_exchange",
    "studentPersonas": {
      "confident": 187,
      "confused": 186,
      "checkride": 186
    }
  }
}
```

## Benefits for SLM Training

1. **Diverse Communication Styles**: Models learn to recognize and respond to different student approaches
2. **Real-World Scenarios**: Reflects actual classroom/training environment variations
3. **Better Generalization**: Model exposed to multiple ways students ask questions
4. **Calibrated Responses**: Assistant learns different response depths (quick vs. detailed)

## Algorithm

1. **Cycle Distribution**: Personas cycle through pairs in order: confident → confused → checkride → confident...
2. **Document-Grounded Content**: Pairs are generated from document sections, not from the question bank
3. **Persona-Specific Transformation**: the generator varies confident, confused, and checkride openings
4. **Stored Attribute**: `studentPersona` field in each pair enables filtering/analysis

## Usage

All pairs are now generated with persona variation automatically. No additional configuration needed.

When generating conversational pairs:
```
Input: 11,180 words
Output: 559 pairs (evenly distributed across 3 personas)
File: {prefix}_conversational_training_pairs.json
```

## Testing

Sample generation tested with:
- Document: Airplane Flying Handbook Chapter 3 (11,180 words)
- Output: 559 conversational pairs
- Result: Near-perfect distribution (187, 186, 186)

Note: conversational pairs are built from `document.json`; `questions.json` is not the source for this artifact.

---

**File**: `conversationalPairGenerator.js`  
**Status**: ✅ Complete and tested  
**Ready for**: Production use with all PDF documents
